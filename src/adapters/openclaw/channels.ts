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

import type {
  ChannelAdapter,
  ChannelMessage,
} from '../../core/types.js';

// ─── OpenClaw Messaging Interface ───────────────────────────────────

/**
 * Abstraction over OpenClaw's message tool.
 * Mockable for testing.
 */
export interface OpenClawMessaging {
  /** Send a message to a channel/target */
  send(config: OpenClawMessageConfig): Promise<string>; // returns message ID
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

// ─── Channel Adapter ────────────────────────────────────────────────

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
export class OpenClawChannelAdapter implements ChannelAdapter {
  private messaging: OpenClawMessaging;
  private defaultChannel: string;
  /** In-memory message store for search */
  private messages: Map<string, ChannelMessage> = new Map();
  /** Channel registry: name → id */
  private channels: Map<string, string> = new Map();
  /** Pinned posts: channelId → messageId */
  private pinnedPosts: Map<string, string> = new Map();
  /** Auto-increment for channel IDs when platform doesn't support creation */
  private channelCounter = 0;
  /** Auto-increment for message IDs when platform doesn't return them */
  private messageCounter = 0;

  constructor(config: OpenClawChannelConfig) {
    this.messaging = config.messaging;
    this.defaultChannel = config.defaultChannel ?? 'general';
  }

  /**
   * Create a channel. Delegates to the messaging platform if supported,
   * otherwise creates a local registration.
   *
   * @returns Channel ID
   */
  async createChannel(name: string, purpose: string): Promise<string> {
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
  async postMessage(channelId: string, message: string, tags?: string[]): Promise<string> {
    // Format tags as searchable prefixes
    const tagPrefix = tags && tags.length > 0
      ? tags.map(t => `[${t}]`).join(' ') + ' '
      : '';
    const formattedMessage = `${tagPrefix}${message}`;

    let messageId: string;
    try {
      messageId = await this.messaging.send({
        target: channelId,
        message: formattedMessage,
      });
    } catch {
      // Generate a local message ID on failure
      messageId = `msg-${++this.messageCounter}`;
    }

    // Index the message for search
    const entry: ChannelMessage = {
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
  async updatePinnedPost(channelId: string, postId: string, content: string): Promise<void> {
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
  async searchMessages(channelId: string, query: string): Promise<ChannelMessage[]> {
    const lowerQuery = query.toLowerCase();
    const results: ChannelMessage[] = [];

    for (const msg of this.messages.values()) {
      if (msg.channel_id !== channelId) continue;
      const matchContent = msg.content.toLowerCase().includes(lowerQuery);
      const matchTag = msg.tags.some(t => t.toLowerCase().includes(lowerQuery));
      if (matchContent || matchTag) {
        results.push(msg);
      }
    }

    // Sort by timestamp descending
    results.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return results;
  }

  // ─── Accessors ────────────────────────────────────────────────

  /** Get the pinned post ID for a channel */
  getPinnedPost(channelId: string): string | undefined {
    return this.pinnedPosts.get(channelId);
  }

  /** Get channel ID by name */
  getChannelId(name: string): string | undefined {
    return this.channels.get(name);
  }

  /** Get total indexed messages count */
  get messageCount(): number {
    return this.messages.size;
  }
}
