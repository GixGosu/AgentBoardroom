/**
 * AgentBoardroom — Corporate Governance for AI Agents
 *
 * A decision intelligence platform that applies governance patterns —
 * adversarial review, gate enforcement, separation of powers, and audit trails —
 * to autonomous multi-agent systems.
 *
 * @module agentboardroom
 */
export { ConfigLoader } from './core/config.js';
export type { BoardConfig, RoleConfig, ModelTier, RuntimeAdapter, ChannelAdapter, DecisionRecord, DecisionStatus, DecisionType, ChallengeRound, GateVerdict, GateVerdictType, GateHistoryQuery, PhaseState, PhaseStatus, PhaseDefinition, ProjectRegistry, ProjectEntry, AgentTeam, TeamMember, AnomalyAlert, AnomalyRule, } from './core/types.js';
export { DecisionStore } from './decisions/store.js';
export { ChallengeProtocol } from './challenges/protocol.js';
export type { ChallengeResult } from './challenges/protocol.js';
export { GateEnforcement } from './gates/enforcement.js';
export { GovernanceProtection } from './governance/protection.js';
export type { AccessCheckResult } from './governance/protection.js';
//# sourceMappingURL=index.d.ts.map