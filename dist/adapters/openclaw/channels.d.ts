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
import type { ChannelAdapter, ChannelMessage } from '../../core/types.js';
/**
 * Abstraction over OpenClaw's message tool.
 * Mockable for testing.
 */
export interface OpenClawMessaging {
    /** Send a message to a channel/target */
    send(config: OpenClawMessageConfig): Promise<string>;
    /** Create a channel (if supported by platform) */
    createChannel?(name: string, purpose: string): Promise<string>;
    /** Edit a message */
    editMessage?(channelId: string, messageId: string, content: string): Promise<void>;
}
export interface OpenClawMessageConfig {
    target: string;
    message: string;
    /** Optional reply-to message ID */
    replyTo?: string;
}
export interface OpenClawChannelConfig {
    /** Messaging tool abstraction */
    messaging: OpenClawMessaging;
    /** Default channel for unrouted messages */
    defaultChannel?: string;
}
/**
 * OpenClaw implementation of ChannelAdapter.
 *
 * Maintains an in-memory message index for search capability.
 * In production, this would be backed by the messaging platform's search API.
 */
export declare class OpenClawChannelAdapter implements ChannelAdapter {
    private messaging;
    private defaultChannel;
    /** In-memory message store for search */
    private messages;
    /** Channel registry: name → id */
    private channels;
    /** Pinned posts: channelId → messageId */
    private pinnedPosts;
    /** Auto-increment for channel IDs when platform doesn't support creation */
    private channelCounter;
    /** Auto-increment for message IDs when platform doesn't return them */
    private messageCounter;
    constructor(config: OpenClawChannelConfig);
    /**
     * Create a channel. Delegates to the messaging platform if supported,
     * otherwise creates a local registration.
     *
     * @returns Channel ID
     */
    createChannel(name: string, purpose: string): Promise<string>;
    /**
     * Post a message to a channel via OpenClaw's message tool.
     * Tags are prepended as bracketed labels for searchability.
     *
     * @returns Message ID
     */
    postMessage(channelId: string, message: string, tags?: string[]): Promise<string>;
    /**
     * Update a pinned status post (dashboard).
     * If the messaging platform supports editing, edits in place.
     * Otherwise, posts a new message and tracks it as the pinned post.
     */
    updatePinnedPost(channelId: string, postId: string, content: string): Promise<void>;
    /**
     * Search messages in a channel by query string.
     * Performs case-insensitive substring matching on content and tags.
     */
    searchMessages(channelId: string, query: string): Promise<ChannelMessage[]>;
    /** Get the pinned post ID for a channel */
    getPinnedPost(channelId: string): string | undefined;
    /** Get channel ID by name */
    getChannelId(name: string): string | undefined;
    /** Get total indexed messages count */
    get messageCount(): number;
}
//# sourceMappingURL=channels.d.ts.map