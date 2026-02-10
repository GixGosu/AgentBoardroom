/**
 * AgentBoardroom — Corporate Governance for AI Agents
 *
 * A decision intelligence platform that applies governance patterns —
 * adversarial review, gate enforcement, separation of powers, and audit trails —
 * to autonomous multi-agent systems.
 *
 * @module agentboardroom
 */

// Core
export { ConfigLoader } from './core/config.js';
export type {
  BoardConfig,
  RoleConfig,
  ModelTier,
  RuntimeAdapter,
  ChannelAdapter,
  DecisionRecord,
  DecisionStatus,
  DecisionType,
  ChallengeRound,
  GateVerdict,
  GateVerdictType,
  GateHistoryQuery,
  PhaseState,
  PhaseStatus,
  PhaseDefinition,
  ProjectRegistry as ProjectRegistryConfig,
  ProjectEntry,
  AgentTeam,
  TeamMember,
  AnomalyAlert,
  AnomalyRule,
} from './core/types.js';

// Decisions
export { DecisionStore } from './decisions/store.js';

// Challenge Protocol
export { ChallengeProtocol } from './challenges/protocol.js';
export type {
  ChallengeResult,
  CounterProposal,
  CounterProposalStatus,
  ChallengeAuditEntry,
  ChallengeHistoryQuery,
} from './challenges/protocol.js';

// Gate Enforcement
export { GateEnforcement } from './gates/enforcement.js';

// Governance
export { GovernanceProtection } from './governance/protection.js';
export type {
  AccessCheckResult,
  AuditLogEntry,
  AuditLogQuery,
  AuditSummary,
  ViolationReport,
} from './governance/protection.js';

// Dashboard
export { DashboardGenerator, DashboardAggregator } from './dashboard/index.js';
export type {
  DashboardRenderOptions,
  DashboardDataSource,
  DashboardSnapshot,
  ProjectSnapshot,
  AgentSnapshot,
  AgentActivityStatus,
  TeamSnapshot,
  DecisionSnapshot,
  GateSnapshot,
} from './dashboard/index.js';

// Projects — Multi-project registry, allocation, isolation
export {
  ProjectRegistry,
  ResourceAllocator,
  IsolationEnforcer,
} from './projects/index.js';
export type {
  ProjectState,
  ProjectStatus,
  RegistrySnapshot,
  ResourcePool,
  ProjectAllocation,
  AllocationRequest,
  AllocationResult,
  IsolationContext,
  AccessRequest,
  AccessResult,
  IsolationViolation,
} from './projects/index.js';

// Adapters — OpenClaw
export {
  OpenClawRuntimeAdapter,
  OpenClawChannelAdapter,
} from './adapters/openclaw/index.js';
export type {
  OpenClawRuntimeConfig,
  OpenClawTools,
  OpenClawSessionConfig,
  FileAccessPolicy,
  OpenClawChannelConfig,
  OpenClawMessaging,
  OpenClawCLIToolsConfig,
  BoardroomState,
} from './adapters/openclaw/index.js';

export {
  OpenClawCLITools,
  StateManager,
} from './adapters/openclaw/index.js';
