/**
 * AgentBoardroom — Dashboard Data Aggregator
 *
 * Collects and normalizes data from PhaseState, DecisionStore,
 * GateEnforcement, and project registry into a unified snapshot
 * suitable for rendering by the dashboard generator.
 */
import type { ProjectEntry, ProjectRegistry, PhaseState, DecisionRecord, GateVerdict, AgentTeam } from '../core/types.js';
/** Status of an individual agent/role. */
export type AgentActivityStatus = 'active' | 'idle' | 'blocked' | 'stopped';
export interface AgentSnapshot {
    id: string;
    role: string;
    activity: string;
    status: AgentActivityStatus;
    lastActivity?: string;
}
export interface TeamSnapshot {
    name: string;
    scope: string;
    modulePath: string;
    memberCount: number;
    activeCount: number;
    progress: number;
    status: 'active' | 'paused' | 'dissolved';
}
export interface DecisionSnapshot {
    id: string;
    summary: string;
    status: string;
    timestamp: string;
}
export interface GateSnapshot {
    gateId: string;
    verdict: string;
    issuedBy: string;
    fromPhase: number;
    toPhase: number;
    timestamp: string;
}
export interface ProjectSnapshot {
    name: string;
    currentPhase: number;
    phaseName: string;
    phaseStatus: string;
    budgetTotal: number;
    budgetUsed: number;
    budgetPercent: number;
    priority: string;
    agents: AgentSnapshot[];
    teams: TeamSnapshot[];
    recentDecisions: DecisionSnapshot[];
    lastGate: GateSnapshot | null;
    updatedAt: string;
}
export interface DashboardSnapshot {
    timestamp: string;
    projects: ProjectSnapshot[];
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    blockedAgents: number;
}
/**
 * Abstraction over the various data stores.
 * Consumers provide an implementation; the aggregator doesn't care about persistence details.
 */
export interface DashboardDataSource {
    getProjectRegistry(): ProjectRegistry;
    getPhaseState(project: string): PhaseState | null;
    getRecentDecisions(project: string, limit: number): DecisionRecord[];
    getLatestGateVerdict(project: string): GateVerdict | null;
    getTeams(project: string): AgentTeam[];
    getAgentStatuses(project: string): AgentSnapshot[];
}
export declare class DashboardAggregator {
    private dataSource;
    constructor(dataSource: DashboardDataSource);
    /**
     * Build a complete dashboard snapshot from all data sources.
     */
    aggregate(): DashboardSnapshot;
    /**
     * Aggregate a single project, pulling phase state, decisions, gates, teams, agents.
     */
    aggregateProject(entry: ProjectEntry): ProjectSnapshot;
    /**
     * Compute a diff between two snapshots, returning only changed project names.
     * Used for efficient incremental updates.
     */
    static diff(prev: DashboardSnapshot, next: DashboardSnapshot): string[];
    /** Quick structural comparison of two project snapshots. */
    private static projectChanged;
}
//# sourceMappingURL=aggregator.d.ts.map