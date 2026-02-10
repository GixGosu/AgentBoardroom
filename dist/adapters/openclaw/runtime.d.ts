/**
 * AgentBoardroom — OpenClaw Runtime Adapter
 *
 * Implements RuntimeAdapter using OpenClaw's session and cron primitives.
 * Enforces GovernanceProtection at the infrastructure level by generating
 * file_access policies from governance config for spawned sessions.
 *
 * @module adapters/openclaw/runtime
 */
import type { RuntimeAdapter, SpawnConfig, CronConfig, AgentStatus, ModelTier } from '../../core/types.js';
import { GovernanceProtection } from '../../governance/protection.js';
import type { ViolationReport } from '../../governance/protection.js';
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
export declare class OpenClawRuntimeAdapter implements RuntimeAdapter {
    private tools;
    private governance;
    private modelMap;
    private defaultAllowedPaths;
    /** Track active sessions for status lookups */
    private sessions;
    constructor(config: OpenClawRuntimeConfig);
    /**
     * Resolve a ModelTier or explicit model string to an OpenClaw model name.
     */
    resolveModel(modelOrTier?: string): string;
    /**
     * Generate a FileAccessPolicy from governance config.
     * This is the critical integration point — governance rules become
     * infrastructure-level constraints on spawned sessions.
     *
     * @param allowedPaths - Scope-specific allowed write paths for this agent
     */
    generateFileAccessPolicy(allowedPaths?: string[]): FileAccessPolicy;
    /**
     * Check file write access through governance protection.
     * Returns null if allowed, ViolationReport if denied.
     *
     * This method is exposed for adapters that need to check access
     * before performing file operations.
     */
    checkFileAccess(agentRole: string, filePath: string, allowedPaths?: string[]): ViolationReport | null;
    /**
     * Spawn an ephemeral agent session via OpenClaw.
     *
     * Generates a file_access policy from GovernanceProtection so that
     * the spawned agent is constrained at the infrastructure level.
     *
     * @returns Session ID
     */
    spawnAgent(config: SpawnConfig): Promise<string>;
    /**
     * Send a message to an active agent session.
     */
    sendToAgent(agentId: string, message: string): Promise<void>;
    /**
     * Post a message to a channel (visible, auditable).
     */
    postToChannel(channelId: string, message: string): Promise<void>;
    /**
     * Schedule a cron job via OpenClaw.
     *
     * @returns Job ID
     */
    scheduleCron(config: CronConfig): Promise<string>;
    /**
     * Kill an agent session.
     */
    killAgent(sessionId: string): Promise<void>;
    /**
     * Get agent session status.
     */
    getAgentStatus(agentId: string): Promise<AgentStatus>;
    /** Get the governance protection instance */
    get governanceProtection(): GovernanceProtection;
    /** Get the number of tracked sessions */
    get activeSessionCount(): number;
}
//# sourceMappingURL=runtime.d.ts.map