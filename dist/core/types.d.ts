/**
 * AgentBoardroom — Core Type Definitions
 *
 * These types define the governance abstractions that make up AgentBoardroom.
 * They are runtime-agnostic — no dependency on OpenClaw, Mattermost, or any adapter.
 */
export interface BoardConfig {
    name: string;
    version: number;
    roles: Record<string, RoleConfig>;
    teams: TeamsConfig;
    projects: ProjectsConfig;
    challenge: ChallengeConfig;
    gates: Record<string, GateConfig>;
    budget: BudgetConfig;
    governance: GovernanceConfig;
    channels: ChannelsConfig;
    state: StateConfig;
    runtime: RuntimeConfig;
}
export interface RoleConfig {
    title: string;
    prompt: string;
    responsibilities: string[];
    challenges?: string[];
    gates?: string[];
    model_tier: ModelTier;
    session_type: 'persistent' | 'spawned' | 'cron' | 'ephemeral';
    interval?: string;
}
export interface TeamsConfig {
    defaults: {
        max_concurrent_members: number;
        model_tier: ModelTier;
        session_type: 'ephemeral';
        self_governing: boolean;
    };
}
export interface ProjectsConfig {
    max_concurrent: number;
    resource_competition: string;
    board_chair_override: boolean;
}
export interface ChallengeConfig {
    max_rounds: number;
    auto_escalation: boolean;
    default_action: 'challenge' | 'accept';
}
export interface GateConfig {
    required: string[];
    verdict_type?: 'advisory' | 'structural';
}
export interface BudgetConfig {
    tiers: Record<string, Record<string, ModelTier>>;
    thresholds: {
        medium_at: number;
        low_at: number;
        freeze_at: number;
    };
}
export interface GovernanceConfig {
    self_modification: 'prohibited' | 'restricted';
    protected_assets: string[];
}
export interface ChannelsConfig {
    primary: string;
    per_agent: boolean;
    decision_log: string;
    messaging_platform: string;
}
export interface StateConfig {
    backend: 'git' | 'filesystem' | 'database';
    directory: string;
}
export interface RuntimeConfig {
    platform: 'openclaw' | 'standalone';
}
export type ModelTier = 'high' | 'medium' | 'low' | 'local_only';
export interface DecisionRecord {
    id: string;
    timestamp: string;
    author: string;
    type: DecisionType;
    summary: string;
    rationale: string;
    evidence: string[];
    challenged_by: string | null;
    challenge_rounds: number;
    challenge_history: ChallengeRound[];
    status: DecisionStatus;
    supersedes: string | null;
    dependencies: string[];
    phase: number;
    project: string;
}
export type DecisionType = 'architecture' | 'planning' | 'resource' | 'scope' | 'technical' | 'process';
export type DecisionStatus = 'proposed' | 'accepted' | 'challenged' | 'escalated' | 'superseded' | 'rejected';
export interface ChallengeRound {
    round: number;
    challenger: string;
    action: 'accepted' | 'challenged';
    rationale: string;
    counter_proposal?: string;
    timestamp: string;
}
/**
 * Full gate verdict schema.
 * Captures test results, coverage, blocking issues, warnings, and recommendation.
 * A CONDITIONAL verdict allows advancement with acknowledged warnings/conditions.
 */
export interface GateVerdict {
    gate_id: string;
    verdict: GateVerdictType;
    issued_by: string;
    timestamp: string;
    tests_run: number;
    tests_passed: number;
    tests_failed: number;
    coverage: string;
    blocking_issues: string[];
    warnings: string[];
    /** Conditions that must be addressed (for CONDITIONAL verdicts). */
    conditions?: string[];
    recommendation: string;
    project: string;
    phase: number;
    /** Optional expiry for CONDITIONAL verdicts (ISO timestamp). */
    expires_at?: string;
}
/** Gate verdict outcome types. */
export type GateVerdictType = 'PASS' | 'FAIL' | 'CONDITIONAL';
/**
 * Query parameters for searching gate verdict history.
 * All fields are optional; results match ALL provided criteria.
 */
export interface GateHistoryQuery {
    /** Filter by project name. */
    project?: string;
    /** Filter by phase number. */
    phase?: number;
    /** Filter by verdict type. */
    verdict?: GateVerdictType;
    /** Filter by issuer role. */
    issued_by?: string;
    /** Filter verdicts after this timestamp (inclusive). */
    after?: string;
    /** Filter verdicts before this timestamp (inclusive). */
    before?: string;
    /** Filter by gate ID. */
    gate_id?: string;
}
export interface PhaseState {
    project: string;
    current_phase: number;
    phase_name: string;
    status: PhaseStatus;
    started_at: string;
    updated_at: string;
    gate_verdicts: GateVerdict[];
}
export type PhaseStatus = 'planning' | 'in_progress' | 'awaiting_review' | 'awaiting_gate' | 'gated_fail' | 'gated_conditional' | 'complete';
/**
 * Defines the ordered phases and their gate transitions.
 * Used by the phase state machine for structural enforcement.
 */
export interface PhaseDefinition {
    phase: number;
    name: string;
    /** Gate transition name required to exit this phase (if any). */
    exit_gate?: string;
}
export interface ProjectRegistry {
    active_projects: ProjectEntry[];
    completed_projects: ProjectEntry[];
    paused_projects: ProjectEntry[];
}
export interface ProjectEntry {
    name: string;
    status: string;
    channel: string;
    priority: 'critical' | 'high' | 'normal' | 'low';
    budget_total: number;
    budget_used: number;
    started: string;
    team_count: number;
    current_phase: number;
}
export interface AgentTeam {
    name: string;
    project: string;
    scope: string;
    module_path: string;
    members: TeamMember[];
    status: 'active' | 'paused' | 'dissolved';
    commissioned_at: string;
    commissioned_by: string;
    acceptance_criteria: string[];
}
export interface TeamMember {
    id: string;
    role?: string;
    session_id: string;
    model_tier: ModelTier;
    status: 'active' | 'idle' | 'completed' | 'failed';
}
export interface AnomalyAlert {
    type: 'ANOMALY_ALERT';
    severity: 'WARNING' | 'CRITICAL';
    rule: AnomalyRule;
    details: string;
    impact: string;
    recommended_action: string;
    timestamp: string;
    project?: string;
}
export type AnomalyRule = 'infinite_loop' | 'budget_warning' | 'budget_breach' | 'scope_creep' | 'time_breach' | 'permission_violation' | 'resource_pressure' | 'governance_violation' | 'rogue_spawning';
/**
 * Runtime adapter interface — abstracts the agent runtime (OpenClaw, standalone, etc.)
 * Implementations handle session management, messaging, and cron.
 */
export interface RuntimeAdapter {
    /** Spawn an ephemeral agent session */
    spawnAgent(config: SpawnConfig): Promise<string>;
    /** Send a message to an agent by ID */
    sendToAgent(agentId: string, message: string): Promise<void>;
    /** Post a message to a channel (visible, auditable) */
    postToChannel(channelId: string, message: string): Promise<void>;
    /** Schedule a cron job */
    scheduleCron(config: CronConfig): Promise<string>;
    /** Kill an agent session */
    killAgent(sessionId: string): Promise<void>;
    /** Get session status */
    getAgentStatus(agentId: string): Promise<AgentStatus>;
}
export interface SpawnConfig {
    agentId: string;
    prompt: string;
    task: string;
    model?: string;
    timeout?: number;
}
export interface CronConfig {
    name: string;
    schedule: string;
    agentId: string;
    message: string;
    model?: string;
}
export interface AgentStatus {
    id: string;
    status: 'active' | 'idle' | 'stopped';
    last_activity: string;
    token_usage?: number;
}
/**
 * Channel adapter interface — abstracts the communication layer (Mattermost, Discord, etc.)
 */
export interface ChannelAdapter {
    /** Create a channel */
    createChannel(name: string, purpose: string): Promise<string>;
    /** Post a message to a channel */
    postMessage(channelId: string, message: string, tags?: string[]): Promise<string>;
    /** Update a pinned status post (dashboard) */
    updatePinnedPost(channelId: string, postId: string, content: string): Promise<void>;
    /** Search messages in a channel */
    searchMessages(channelId: string, query: string): Promise<ChannelMessage[]>;
}
export interface ChannelMessage {
    id: string;
    channel_id: string;
    author: string;
    content: string;
    timestamp: string;
    tags: string[];
}
//# sourceMappingURL=types.d.ts.map