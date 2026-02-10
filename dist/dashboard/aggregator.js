"use strict";
/**
 * AgentBoardroom — Dashboard Data Aggregator
 *
 * Collects and normalizes data from PhaseState, DecisionStore,
 * GateEnforcement, and project registry into a unified snapshot
 * suitable for rendering by the dashboard generator.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardAggregator = void 0;
// ─── Aggregator ─────────────────────────────────────────────────────
class DashboardAggregator {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    /**
     * Build a complete dashboard snapshot from all data sources.
     */
    aggregate() {
        const registry = this.dataSource.getProjectRegistry();
        const allProjects = registry.active_projects;
        const projects = allProjects.map(entry => this.aggregateProject(entry));
        const allAgents = projects.flatMap(p => p.agents);
        return {
            timestamp: new Date().toISOString(),
            projects,
            totalAgents: allAgents.length,
            activeAgents: allAgents.filter(a => a.status === 'active').length,
            idleAgents: allAgents.filter(a => a.status === 'idle').length,
            blockedAgents: allAgents.filter(a => a.status === 'blocked').length,
        };
    }
    /**
     * Aggregate a single project, pulling phase state, decisions, gates, teams, agents.
     */
    aggregateProject(entry) {
        const phaseState = this.dataSource.getPhaseState(entry.name);
        const decisions = this.dataSource.getRecentDecisions(entry.name, 5);
        const latestGate = this.dataSource.getLatestGateVerdict(entry.name);
        const teams = this.dataSource.getTeams(entry.name);
        const agents = this.dataSource.getAgentStatuses(entry.name);
        const budgetPercent = entry.budget_total > 0
            ? Math.round((entry.budget_used / entry.budget_total) * 100)
            : 0;
        const teamSnapshots = teams.map(t => {
            const active = t.members.filter(m => m.status === 'active').length;
            const completed = t.members.filter(m => m.status === 'completed').length;
            const total = t.members.length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            return {
                name: t.name,
                scope: t.scope,
                modulePath: t.module_path,
                memberCount: total,
                activeCount: active,
                progress,
                status: t.status,
            };
        });
        const decisionSnapshots = decisions.map(d => ({
            id: d.id,
            summary: d.summary,
            status: d.status,
            timestamp: d.timestamp,
        }));
        let gateSnapshot = null;
        if (latestGate) {
            gateSnapshot = {
                gateId: latestGate.gate_id,
                verdict: latestGate.verdict,
                issuedBy: latestGate.issued_by,
                fromPhase: latestGate.phase,
                toPhase: latestGate.phase + 1,
                timestamp: latestGate.timestamp,
            };
        }
        return {
            name: entry.name,
            currentPhase: phaseState?.current_phase ?? entry.current_phase,
            phaseName: phaseState?.phase_name ?? 'unknown',
            phaseStatus: phaseState?.status ?? entry.status,
            budgetTotal: entry.budget_total,
            budgetUsed: entry.budget_used,
            budgetPercent,
            priority: entry.priority,
            agents,
            teams: teamSnapshots,
            recentDecisions: decisionSnapshots,
            lastGate: gateSnapshot,
            updatedAt: phaseState?.updated_at ?? new Date().toISOString(),
        };
    }
    /**
     * Compute a diff between two snapshots, returning only changed project names.
     * Used for efficient incremental updates.
     */
    static diff(prev, next) {
        const changed = [];
        const prevMap = new Map(prev.projects.map(p => [p.name, p]));
        const nextMap = new Map(next.projects.map(p => [p.name, p]));
        // New or changed projects
        for (const [name, np] of nextMap) {
            const pp = prevMap.get(name);
            if (!pp || DashboardAggregator.projectChanged(pp, np)) {
                changed.push(name);
            }
        }
        // Removed projects
        for (const name of prevMap.keys()) {
            if (!nextMap.has(name)) {
                changed.push(name);
            }
        }
        return changed;
    }
    /** Quick structural comparison of two project snapshots. */
    static projectChanged(a, b) {
        return (a.currentPhase !== b.currentPhase ||
            a.phaseStatus !== b.phaseStatus ||
            a.budgetUsed !== b.budgetUsed ||
            a.agents.length !== b.agents.length ||
            a.teams.length !== b.teams.length ||
            a.recentDecisions.length !== b.recentDecisions.length ||
            a.recentDecisions[0]?.id !== b.recentDecisions[0]?.id ||
            a.lastGate?.gateId !== b.lastGate?.gateId ||
            a.lastGate?.verdict !== b.lastGate?.verdict ||
            JSON.stringify(a.agents.map(ag => ag.status)) !== JSON.stringify(b.agents.map(ag => ag.status)));
    }
}
exports.DashboardAggregator = DashboardAggregator;
//# sourceMappingURL=aggregator.js.map