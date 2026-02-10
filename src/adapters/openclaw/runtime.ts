/**
 * AgentBoardroom — OpenClaw Runtime Adapter
 *
 * Implements RuntimeAdapter using OpenClaw's session and cron primitives.
 * Enforces GovernanceProtection at the infrastructure level by generating
 * file_access policies from governance config for spawned sessions.
 *
 * @module adapters/openclaw/runtime
 */

import type {
  RuntimeAdapter,
  SpawnConfig,
  CronConfig,
  AgentStatus,
  ModelTier,
} from '../../core/types.js';
import { GovernanceProtection } from '../../governance/protection.js';
import type { ViolationReport } from '../../governance/protection.js';

// ─── OpenClaw Tool Interfaces ───────────────────────────────────────

/**
 * Abstraction over OpenClaw tool calls.
 * In production, these delegate to the actual OpenClaw CLI/API.
 * In tests, they are easily mockable.
 */
export interface OpenClawTools {
  /** Spawn a new agent session */
  sessionsSpawn(config: OpenClawSessionConfig): Promise<OpenClawSpawnResult>;
  /** Send a message to an existing session */
  sessionsSend(sessionId: string, message: string): Promise<void>;
  /** Get session status */
  sessionsStatus(sessionId: string): Promise<OpenClawSessionStatus>;
  /** Kill a session */
  sessionsKill(sessionId: string): Promise<void>;
  /** Schedule a cron job */
  cronSchedule(config: OpenClawCronConfig): Promise<string>;
  /** Post to a channel via messaging */
  messagePost(channel: string, message: string): Promise<void>;
}

export interface OpenClawSessionConfig {
  label: string;
  model: string;
  system_prompt: string;
  initial_message: string;
  file_access?: FileAccessPolicy;
  timeout_ms?: number;
}

export interface FileAccessPolicy {
  /** Glob patterns the agent may write to */
  allowed_write: string[];
  /** Glob patterns that are always denied (governance assets) */
  denied_write: string[];
  /** Whether to enforce at the tool level */
  enforce: boolean;
}

export interface OpenClawSpawnResult {
  session_id: string;
}

export interface OpenClawSessionStatus {
  session_id: string;
  state: 'running' | 'idle' | 'stopped' | 'error';
  last_activity_at: string;
  tokens_used?: number;
}

export interface OpenClawCronConfig {
  name: string;
  schedule: string;
  session_label: string;
  model: string;
  message: string;
}

// ─── Model Tier Mapping ─────────────────────────────────────────────

/** Default model tier → OpenClaw model name mapping */
const DEFAULT_MODEL_MAP: Record<ModelTier, string> = {
  high: 'anthropic/claude-opus-4-6',
  medium: 'anthropic/claude-sonnet-4-20250514',
  low: 'anthropic/claude-haiku-3-5',
  local_only: 'ollama/llama3',
};

// ─── Runtime Adapter ────────────────────────────────────────────────

export interface OpenClawRuntimeConfig {
  /** OpenClaw tool abstraction */
  tools: OpenClawTools;
  /** Governance protection instance for file access enforcement */
  governance: GovernanceProtection;
  /** Optional custom model tier mapping */
  modelMap?: Partial<Record<ModelTier, string>>;
  /** Default allowed write paths for spawned agents (scope restriction) */
  defaultAllowedPaths?: string[];
}

/**
 * OpenClaw implementation of RuntimeAdapter.
 *
 * Key design decisions:
 * - Governance enforcement is baked into session spawn (file_access policy)
 * - Every file write by a spawned agent goes through GovernanceProtection
 * - Model tiers are mapped to concrete OpenClaw model names
 * - Audit trail is maintained via GovernanceProtection's audit log
 */
export class OpenClawRuntimeAdapter implements RuntimeAdapter {
  private tools: OpenClawTools;
  private governance: GovernanceProtection;
  private modelMap: Record<ModelTier, string>;
  private defaultAllowedPaths: string[];
  /** Track active sessions for status lookups */
  private sessions: Map<string, { sessionId: string; agentId: string }> = new Map();

  constructor(config: OpenClawRuntimeConfig) {
    this.tools = config.tools;
    this.governance = config.governance;
    this.modelMap = { ...DEFAULT_MODEL_MAP, ...config.modelMap };
    this.defaultAllowedPaths = config.defaultAllowedPaths ?? [];
  }

  /**
   * Resolve a ModelTier or explicit model string to an OpenClaw model name.
   */
  resolveModel(modelOrTier?: string): string {
    if (!modelOrTier) return this.modelMap.high;
    if (modelOrTier in this.modelMap) {
      return this.modelMap[modelOrTier as ModelTier];
    }
    // Assume it's already a concrete model name
    return modelOrTier;
  }

  /**
   * Generate a FileAccessPolicy from governance config.
   * This is the critical integration point — governance rules become
   * infrastructure-level constraints on spawned sessions.
   *
   * @param allowedPaths - Scope-specific allowed write paths for this agent
   */
  generateFileAccessPolicy(allowedPaths?: string[]): FileAccessPolicy {
    return {
      allowed_write: allowedPaths ?? this.defaultAllowedPaths,
      denied_write: [...this.governance.protectedAssets],
      enforce: true,
    };
  }

  /**
   * Check file write access through governance protection.
   * Returns null if allowed, ViolationReport if denied.
   *
   * This method is exposed for adapters that need to check access
   * before performing file operations.
   */
  checkFileAccess(
    agentRole: string,
    filePath: string,
    allowedPaths?: string[]
  ): ViolationReport | null {
    return this.governance.enforceFileAccess(agentRole, filePath, allowedPaths);
  }

  // ─── RuntimeAdapter Implementation ─────────────────────────────

  /**
   * Spawn an ephemeral agent session via OpenClaw.
   *
   * Generates a file_access policy from GovernanceProtection so that
   * the spawned agent is constrained at the infrastructure level.
   *
   * @returns Session ID
   */
  async spawnAgent(config: SpawnConfig): Promise<string> {
    const model = this.resolveModel(config.model);
    const filePolicy = this.generateFileAccessPolicy();

    const result = await this.tools.sessionsSpawn({
      label: config.agentId,
      model,
      system_prompt: config.prompt,
      initial_message: config.task,
      file_access: filePolicy,
      timeout_ms: config.timeout ? config.timeout * 1000 : undefined,
    });

    this.sessions.set(config.agentId, {
      sessionId: result.session_id,
      agentId: config.agentId,
    });

    return result.session_id;
  }

  /**
   * Send a message to an active agent session.
   */
  async sendToAgent(agentId: string, message: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session) {
      throw new Error(`No active session found for agent "${agentId}". Was it spawned?`);
    }
    await this.tools.sessionsSend(session.sessionId, message);
  }

  /**
   * Post a message to a channel (visible, auditable).
   */
  async postToChannel(channelId: string, message: string): Promise<void> {
    await this.tools.messagePost(channelId, message);
  }

  /**
   * Schedule a cron job via OpenClaw.
   *
   * @returns Job ID
   */
  async scheduleCron(config: CronConfig): Promise<string> {
    const model = this.resolveModel(config.model);
    const jobId = await this.tools.cronSchedule({
      name: config.name,
      schedule: config.schedule,
      session_label: config.agentId,
      model,
      message: config.message,
    });
    return jobId;
  }

  /**
   * Kill an agent session.
   */
  async killAgent(sessionId: string): Promise<void> {
    // Try to find by session ID first, then by agent ID
    let actualSessionId = sessionId;
    for (const [agentId, entry] of this.sessions) {
      if (entry.sessionId === sessionId || agentId === sessionId) {
        actualSessionId = entry.sessionId;
        this.sessions.delete(agentId);
        break;
      }
    }
    await this.tools.sessionsKill(actualSessionId);
  }

  /**
   * Get agent session status.
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    const session = this.sessions.get(agentId);
    const sessionId = session?.sessionId ?? agentId;

    const status = await this.tools.sessionsStatus(sessionId);

    const stateMap: Record<string, AgentStatus['status']> = {
      running: 'active',
      idle: 'idle',
      stopped: 'stopped',
      error: 'stopped',
    };

    return {
      id: agentId,
      status: stateMap[status.state] ?? 'stopped',
      last_activity: status.last_activity_at,
      token_usage: status.tokens_used,
    };
  }

  // ─── Accessors ────────────────────────────────────────────────

  /** Get the governance protection instance */
  get governanceProtection(): GovernanceProtection {
    return this.governance;
  }

  /** Get the number of tracked sessions */
  get activeSessionCount(): number {
    return this.sessions.size;
  }
}
