"use strict";
/**
 * AgentBoardroom — OpenClaw Channel Adapter
 *
 * Implements ChannelAdapter using OpenClaw's messaging primitives.
 * Provides channel creation, message posting, pinned post management,
 * and message search over an in-memory message store (with hooks for
 * external persistence).
 *
 * @module adapters/openclaw/channels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawChannelAdapter = void 0;
/**
 * OpenClaw implementation of ChannelAdapter.
 *
 * Maintains an in-memory message index for search capability.
 * In production, this would be backed by the messaging platform's search API.
 */
class OpenClawChannelAdapter {
    messaging;
    defaultChannel;
    /** In-memory message store for search */
    messages = new Map();
    /** Channel registry: name → id */
    channels = new Map();
    /** Pinned posts: channelId → messageId */
    pinnedPosts = new Map();
    /** Auto-increment for channel IDs when platform doesn't support creation */
    channelCounter = 0;
    /** Auto-increment for message IDs when platform doesn't return them */
    messageCounter = 0;
    constructor(config) {
        this.messaging = config.messaging;
        this.defaultChannel = config.defaultChannel ?? 'general';
    }
    /**
     * Create a channel. Delegates to the messaging platform if supported,
     * otherwise creates a local registration.
     *
     * @returns Channel ID
     */
    async createChannel(name, purpose) {
        if (this.messaging.createChannel) {
            const id = await this.messaging.createChannel(name, purpose);
            this.channels.set(name, id);
            return id;
        }
        // Fallback: generate a local channel ID
        const id = `ch-${++this.channelCounter}-${name}`;
        this.channels.set(name, id);
        return id;
    }
    /**
     * Post a message to a channel via OpenClaw's message tool.
     * Tags are prepended as bracketed labels for searchability.
     *
     * @returns Message ID
     */
    async postMessage(channelId, message, tags) {
        // Format tags as searchable prefixes
        const tagPrefix = tags && tags.length > 0
            ? tags.map(t => `[${t}]`).join(' ') + ' '
            : '';
        const formattedMessage = `${tagPrefix}${message}`;
        let messageId;
        try {
            messageId = await this.messaging.send({
                target: channelId,
                message: formattedMessage,
            });
        }
        catch {
            // Generate a local message ID on failure
            messageId = `msg-${++this.messageCounter}`;
        }
        // Index the message for search
        const entry = {
            id: messageId,
            channel_id: channelId,
            author: 'system', // Adapter posts are system-authored
            content: formattedMessage,
            timestamp: new Date().toISOString(),
            tags: tags ?? [],
        };
        this.messages.set(messageId, entry);
        return messageId;
    }
    /**
     * Update a pinned status post (dashboard).
     * If the messaging platform supports editing, edits in place.
     * Otherwise, posts a new message and tracks it as the pinned post.
     */
    async updatePinnedPost(channelId, postId, content) {
        if (this.messaging.editMessage) {
            await this.messaging.editMessage(channelId, postId, content);
            this.pinnedPosts.set(channelId, postId);
            // Update local index
            const existing = this.messages.get(postId);
            if (existing) {
                existing.content = content;
                existing.timestamp = new Date().toISOString();
            }
            return;
        }
        // Fallback: post a new message and track it
        const newId = await this.postMessage(channelId, content, ['pinned', 'dashboard']);
        this.pinnedPosts.set(channelId, newId);
    }
    /**
     * Search messages in a channel by query string.
     * Performs case-insensitive substring matching on content and tags.
     */
    async searchMessages(channelId, query) {
        const lowerQuery = query.toLowerCase();
        const results = [];
        for (const msg of this.messages.values()) {
            if (msg.channel_id !== channelId)
                continue;
            const matchContent = msg.content.toLowerCase().includes(lowerQuery);
            const matchTag = msg.tags.some(t => t.toLowerCase().includes(lowerQuery));
            if (matchContent || matchTag) {
                results.push(msg);
            }
        }
        // Sort by timestamp descending
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return results;
    }
    // ─── Accessors ────────────────────────────────────────────────
    /** Get the pinned post ID for a channel */
    getPinnedPost(channelId) {
        return this.pinnedPosts.get(channelId);
    }
    /** Get channel ID by name */
    getChannelId(name) {
        return this.channels.get(name);
    }
    /** Get total indexed messages count */
    get messageCount() {
        return this.messages.size;
    }
}
exports.OpenClawChannelAdapter = OpenClawChannelAdapter;
//# sourceMappingURL=channels.js.map