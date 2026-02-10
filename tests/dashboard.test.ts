import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DashboardGenerator } from '../dist/dashboard/generator.js';
import { DashboardAggregator } from '../dist/dashboard/aggregator.js';
import type {
  DashboardSnapshot,
  ProjectSnapshot,
  DashboardDataSource,
  AgentSnapshot,
} from '../dist/dashboard/aggregator.js';

// ─── Test Fixtures ──────────────────────────────────────────────────

function makeAgent(id: string, role: string, activity: string, status: 'active' | 'idle' | 'blocked'): AgentSnapshot {
  return { id, role, activity, status };
}

function makeProjectSnapshot(overrides?: Partial<ProjectSnapshot>): ProjectSnapshot {
  return {
    name: 'DecisionEngines',
    currentPhase: 2,
    phaseName: 'implementation',
    phaseStatus: 'in_progress',
    budgetTotal: 1000,
    budgetUsed: 340,
    budgetPercent: 34,
    priority: 'high',
    agents: [
      makeAgent('ceo-1', 'CEO', 'Planning Phase 3', 'active'),
      makeAgent('cto-1', 'CTO', 'Reviewing module-auth', 'active'),
      makeAgent('qa-1', 'QA', 'Waiting for submission', 'idle'),
    ],
    teams: [
      {
        name: 'Team Alpha',
        scope: 'core decisions',
        modulePath: 'src/core/decisions',
        memberCount: 4,
        activeCount: 3,
        progress: 75,
        status: 'active',
      },
    ],
    recentDecisions: [
      { id: 'DEC-0042', summary: 'Use event sourcing', status: 'accepted', timestamp: '2026-02-10T03:00:00Z' },
      { id: 'DEC-0041', summary: 'Add caching layer', status: 'accepted', timestamp: '2026-02-09T22:00:00Z' },
    ],
    lastGate: {
      gateId: 'planning_to_implementation',
      verdict: 'PASS',
      issuedBy: 'QA',
      fromPhase: 1,
      toPhase: 2,
      timestamp: '2026-02-10T08:42:00Z',
    },
    updatedAt: '2026-02-10T08:42:00Z',
    ...overrides,
  };
}

function makeSnapshot(projects?: ProjectSnapshot[]): DashboardSnapshot {
  const p = projects ?? [makeProjectSnapshot()];
  const allAgents = p.flatMap(pr => pr.agents);
  return {
    timestamp: '2026-02-10T08:45:00Z',
    projects: p,
    totalAgents: allAgents.length,
    activeAgents: allAgents.filter(a => a.status === 'active').length,
    idleAgents: allAgents.filter(a => a.status === 'idle').length,
    blockedAgents: allAgents.filter(a => a.status === 'blocked').length,
  };
}

// ─── Generator Tests ────────────────────────────────────────────────

describe('DashboardGenerator', () => {

  it('renders a project board with all sections', () => {
    const gen = new DashboardGenerator();
    const output = gen.render(makeSnapshot());

    assert.ok(output.includes('AGENTBOARDROOM'));
    assert.ok(output.includes('DecisionEngines'));
    assert.ok(output.includes('Phase: 2'));
    assert.ok(output.includes('Budget: 34% used'));
    assert.ok(output.includes('CEO'));
    assert.ok(output.includes('● active'));
    assert.ok(output.includes('○ idle'));
    assert.ok(output.includes('Team Alpha'));
    assert.ok(output.includes('DEC-0042'));
    assert.ok(output.includes('Last Gate'));
    assert.ok(output.includes('PASS'));
  });

  it('renders empty state when no projects', () => {
    const gen = new DashboardGenerator();
    const output = gen.render(makeSnapshot([]));

    assert.ok(output.includes('No active projects'));
  });

  it('respects showTeams=false', () => {
    const gen = new DashboardGenerator({ showTeams: false });
    const output = gen.render(makeSnapshot());

    assert.ok(!output.includes('Team Alpha'));
    assert.ok(!output.includes('Teams:'));
  });

  it('respects showDecisions=false', () => {
    const gen = new DashboardGenerator({ showDecisions: false });
    const output = gen.render(makeSnapshot());

    assert.ok(!output.includes('Recent Decisions'));
    assert.ok(!output.includes('DEC-0042'));
  });

  it('respects showGates=false', () => {
    const gen = new DashboardGenerator({ showGates: false });
    const output = gen.render(makeSnapshot());

    assert.ok(!output.includes('Last Gate'));
  });

  it('wraps in code block when codeBlock=true', () => {
    const gen = new DashboardGenerator({ codeBlock: true });
    const output = gen.render(makeSnapshot());

    assert.ok(output.startsWith('```\n'));
    assert.ok(output.endsWith('\n```'));
  });

  it('limits decisions via maxDecisions', () => {
    const project = makeProjectSnapshot({
      recentDecisions: [
        { id: 'DEC-0005', summary: 'a', status: 'accepted', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'DEC-0004', summary: 'b', status: 'accepted', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'DEC-0003', summary: 'c', status: 'accepted', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'DEC-0002', summary: 'd', status: 'accepted', timestamp: '2026-01-01T00:00:00Z' },
      ],
    });
    const gen = new DashboardGenerator({ maxDecisions: 2 });
    const output = gen.render(makeSnapshot([project]));

    assert.ok(output.includes('DEC-0005'));
    assert.ok(output.includes('DEC-0004'));
    assert.ok(!output.includes('DEC-0003'));
  });

  it('renders progress bar correctly', () => {
    const gen = new DashboardGenerator();
    const output = gen.render(makeSnapshot());

    // 75% of 8 chars = 6 filled, 2 empty
    assert.ok(output.includes('[██████░░]'));
  });

  it('renders summary view for multiple projects', () => {
    const p1 = makeProjectSnapshot({ name: 'ProjectA' });
    const p2 = makeProjectSnapshot({ name: 'ProjectB', currentPhase: 1, budgetPercent: 10 });
    const gen = new DashboardGenerator();
    const output = gen.renderSummary(makeSnapshot([p1, p2]));

    assert.ok(output.includes('Summary'));
    assert.ok(output.includes('ProjectA'));
    assert.ok(output.includes('ProjectB'));
    assert.ok(output.includes('Projects: 2'));
  });

  it('renderIncremental returns only changed projects', () => {
    const p1 = makeProjectSnapshot({ name: 'A' });
    const p2 = makeProjectSnapshot({ name: 'B' });
    const gen = new DashboardGenerator();
    const result = gen.renderIncremental(makeSnapshot([p1, p2]), ['A']);

    assert.equal(result.size, 1);
    assert.ok(result.has('A'));
    assert.ok(!result.has('B'));
  });

  it('renders blocked agent status', () => {
    const project = makeProjectSnapshot({
      agents: [makeAgent('dev-1', 'DEV', 'Blocked on review', 'blocked')],
    });
    const gen = new DashboardGenerator();
    const output = gen.render(makeSnapshot([project]));

    assert.ok(output.includes('■ blocked'));
  });
});

// ─── Aggregator Tests ───────────────────────────────────────────────

describe('DashboardAggregator', () => {

  function makeMockDataSource(): DashboardDataSource {
    return {
      getProjectRegistry: () => ({
        active_projects: [{
          name: 'TestProject',
          status: 'in_progress',
          channel: '#test',
          priority: 'high' as const,
          budget_total: 500,
          budget_used: 100,
          started: '2026-01-01T00:00:00Z',
          team_count: 1,
          current_phase: 1,
        }],
        completed_projects: [],
        paused_projects: [],
      }),
      getPhaseState: () => ({
        project: 'TestProject',
        current_phase: 1,
        phase_name: 'architecture',
        status: 'in_progress' as const,
        started_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-10T08:00:00Z',
        gate_verdicts: [],
      }),
      getRecentDecisions: () => [{
        id: 'DEC-0001',
        timestamp: '2026-02-10T07:00:00Z',
        author: 'CTO',
        type: 'architecture' as const,
        summary: 'Use microservices',
        rationale: 'Scalability',
        evidence: [],
        challenged_by: null,
        challenge_rounds: 0,
        challenge_history: [],
        status: 'accepted' as const,
        supersedes: null,
        dependencies: [],
        phase: 1,
        project: 'TestProject',
      }],
      getLatestGateVerdict: () => null,
      getTeams: () => [{
        name: 'Team Beta',
        project: 'TestProject',
        scope: 'auth module',
        module_path: 'src/auth',
        members: [
          { id: 'w1', session_id: 's1', model_tier: 'low' as const, status: 'active' as const },
          { id: 'w2', session_id: 's2', model_tier: 'low' as const, status: 'completed' as const },
        ],
        status: 'active' as const,
        commissioned_at: '2026-02-01T00:00:00Z',
        commissioned_by: 'PM',
        acceptance_criteria: ['Tests pass'],
      }],
      getAgentStatuses: () => [
        makeAgent('cto-1', 'CTO', 'Architecture review', 'active'),
      ],
    };
  }

  it('aggregates project data from data source', () => {
    const agg = new DashboardAggregator(makeMockDataSource());
    const snap = agg.aggregate();

    assert.equal(snap.projects.length, 1);
    assert.equal(snap.projects[0].name, 'TestProject');
    assert.equal(snap.projects[0].currentPhase, 1);
    assert.equal(snap.projects[0].budgetPercent, 20);
    assert.equal(snap.projects[0].teams.length, 1);
    assert.equal(snap.projects[0].teams[0].progress, 50); // 1 completed of 2
    assert.equal(snap.totalAgents, 1);
    assert.equal(snap.activeAgents, 1);
  });

  it('diff detects changed projects', () => {
    const prev = makeSnapshot([makeProjectSnapshot({ name: 'A', budgetUsed: 100 })]);
    const next = makeSnapshot([makeProjectSnapshot({ name: 'A', budgetUsed: 200 })]);
    const changed = DashboardAggregator.diff(prev, next);

    assert.ok(changed.includes('A'));
  });

  it('diff detects new projects', () => {
    const prev = makeSnapshot([makeProjectSnapshot({ name: 'A' })]);
    const next = makeSnapshot([makeProjectSnapshot({ name: 'A' }), makeProjectSnapshot({ name: 'B' })]);
    const changed = DashboardAggregator.diff(prev, next);

    assert.ok(changed.includes('B'));
  });

  it('diff detects removed projects', () => {
    const prev = makeSnapshot([makeProjectSnapshot({ name: 'A' }), makeProjectSnapshot({ name: 'B' })]);
    const next = makeSnapshot([makeProjectSnapshot({ name: 'A' })]);
    const changed = DashboardAggregator.diff(prev, next);

    assert.ok(changed.includes('B'));
  });

  it('diff returns empty for identical snapshots', () => {
    const snap = makeSnapshot();
    const changed = DashboardAggregator.diff(snap, snap);

    assert.equal(changed.length, 0);
  });
});
