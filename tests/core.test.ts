import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ConfigLoader } from '../dist/core/config.js';
import { DecisionStore } from '../dist/decisions/store.js';
import { ChallengeProtocol } from '../dist/challenges/protocol.js';
import { GateEnforcement } from '../dist/gates/enforcement.js';
import { GovernanceProtection } from '../dist/governance/protection.js';

const TEST_DIR = resolve(import.meta.dirname, '_test_state');
const TEMPLATE_PATH = resolve(import.meta.dirname, '../templates/software-dev.yaml');

describe('ConfigLoader', () => {
  it('loads the software-dev template', () => {
    const loader = new ConfigLoader(TEMPLATE_PATH);
    const config = loader.load();
    assert.equal(config.name, 'Software Development Board');
    assert.ok(config.roles.ceo);
    assert.ok(config.roles.cto);
    assert.ok(config.roles.qa);
    assert.ok(config.roles.auditor);
  });

  it('validates challenge relationships', () => {
    const loader = new ConfigLoader(TEMPLATE_PATH);
    const config = loader.load();
    // CEO is challenged by CTO
    assert.deepEqual(config.roles.ceo.challenges, ['cto']);
    // CTO is challenged by CEO
    assert.deepEqual(config.roles.cto.challenges, ['ceo']);
  });

  it('validates governance config', () => {
    const loader = new ConfigLoader(TEMPLATE_PATH);
    const config = loader.load();
    assert.equal(config.governance.self_modification, 'prohibited');
    assert.ok(config.governance.protected_assets.length > 0);
  });
});

describe('DecisionStore', () => {
  before(() => { mkdirSync(TEST_DIR, { recursive: true }); });
  after(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

  it('proposes a decision', () => {
    const store = new DecisionStore(TEST_DIR);
    const dec = store.propose({
      author: 'ceo',
      type: 'planning',
      summary: 'Use event-driven architecture',
      rationale: 'Reduces coupling',
      phase: 1,
      project: 'test-project',
    });
    assert.equal(dec.id, 'DEC-0001');
    assert.equal(dec.status, 'proposed');
    assert.equal(dec.challenge_rounds, 0);
  });

  it('challenges a decision', () => {
    const store = new DecisionStore(TEST_DIR);
    const dec = store.challenge('DEC-0001', 'cto', 'Prefer message bus pattern', 'Use RabbitMQ');
    assert.equal(dec.status, 'challenged');
    assert.equal(dec.challenge_rounds, 1);
    assert.equal(dec.challenged_by, 'cto');
    assert.equal(dec.challenge_history.length, 1);
  });

  it('accepts a decision', () => {
    const store = new DecisionStore(TEST_DIR);
    const dec = store.accept('DEC-0001', 'cto', 'Revised proposal addresses concerns');
    assert.equal(dec.status, 'accepted');
  });

  it('queries decisions', () => {
    const store = new DecisionStore(TEST_DIR);
    const challenged = store.query({ challenged: true });
    assert.equal(challenged.length, 1);
    const byAuthor = store.query({ author: 'ceo' });
    assert.equal(byAuthor.length, 1);
  });
});

describe('ChallengeProtocol', () => {
  const loader = new ConfigLoader(TEMPLATE_PATH);
  const config = loader.load();
  const protocol = new ChallengeProtocol(config);

  it('identifies challengers for CEO', () => {
    const challengers = protocol.getChallengers('ceo');
    assert.deepEqual(challengers, ['cto']);
  });

  it('identifies challengers for CTO', () => {
    const challengers = protocol.getChallengers('cto');
    assert.deepEqual(challengers, ['ceo']);
  });

  it('knows max rounds', () => {
    assert.equal(protocol.maxRounds, 3);
  });

  it('enforces auto-escalation after max rounds', () => {
    const stateDir = resolve(TEST_DIR, 'challenge_test');
    mkdirSync(stateDir, { recursive: true });
    const store = new DecisionStore(stateDir);

    const dec = store.propose({
      author: 'ceo',
      type: 'architecture',
      summary: 'Test escalation',
      rationale: 'Testing',
      phase: 1,
      project: 'test',
    });

    // Round 1
    protocol.processChallenge(store, dec.id, 'cto', 'challenge', 'Disagree round 1');
    // Round 2
    protocol.processChallenge(store, dec.id, 'cto', 'challenge', 'Disagree round 2');
    // Round 3 — should auto-escalate
    const result = protocol.processChallenge(store, dec.id, 'cto', 'challenge', 'Disagree round 3');

    assert.equal(result.outcome, 'escalated');
    assert.equal(result.requires_escalation, true);

    rmSync(stateDir, { recursive: true, force: true });
  });
});

describe('GovernanceProtection', () => {
  const protection = new GovernanceProtection(
    {
      self_modification: 'prohibited',
      protected_assets: ['board.yaml', 'agents/*.md', 'CONSTITUTION.md', 'templates/*.yaml'],
    },
    '/fake/base'
  );

  it('blocks writes to board.yaml', () => {
    const result = protection.checkWriteAccess('ceo', '/fake/base/board.yaml');
    assert.equal(result.allowed, false);
    assert.equal(result.violation_type, 'governance_asset');
  });

  it('blocks writes to agent prompts', () => {
    const result = protection.checkWriteAccess('cto', '/fake/base/agents/ceo.md');
    assert.equal(result.allowed, false);
    assert.equal(result.violation_type, 'governance_asset');
  });

  it('blocks writes to CONSTITUTION.md', () => {
    const result = protection.checkWriteAccess('auditor', '/fake/base/CONSTITUTION.md');
    assert.equal(result.allowed, false);
  });

  it('allows writes to non-protected paths', () => {
    const result = protection.checkWriteAccess('ceo', '/fake/base/src/core/types.ts');
    assert.equal(result.allowed, true);
  });

  it('enforces scope restrictions', () => {
    const result = protection.checkWriteAccess('worker', '/fake/base/src/other/file.ts', ['src/mymodule/*']);
    assert.equal(result.allowed, false);
    assert.equal(result.violation_type, 'out_of_scope');
  });
});

describe('GateEnforcement', () => {
  const loader = new ConfigLoader(TEMPLATE_PATH);
  const config = loader.load();
  const stateDir = resolve(TEST_DIR, 'gate_test');

  before(() => { mkdirSync(stateDir, { recursive: true }); });
  after(() => { rmSync(stateDir, { recursive: true, force: true }); });

  it('blocks advancement without required verdicts', () => {
    const gates = new GateEnforcement(config, stateDir);
    const check = gates.canAdvance('test-proj', 2, 3, 'implementation_to_integration');
    assert.equal(check.allowed, false);
    assert.ok(check.blockers.length > 0);
  });

  it('allows advancement after PASS verdict', () => {
    const gates = new GateEnforcement(config, stateDir);

    gates.recordVerdict({
      gate_id: 'implementation_to_integration',
      verdict: 'PASS',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 42,
      tests_passed: 42,
      tests_failed: 0,
      coverage: '85%',
      blocking_issues: [],
      warnings: [],
      recommendation: 'Good to proceed',
      project: 'test-proj',
      phase: 2,
    });

    const check = gates.canAdvance('test-proj', 2, 3, 'implementation_to_integration');
    assert.equal(check.allowed, true);
  });
});

// ─── Extended Gate Tests (ab-2-3) ───────────────────────────────────

describe('GateEnforcement — Conditional Verdicts', () => {
  const loader = new ConfigLoader(TEMPLATE_PATH);
  const config = loader.load();
  const stateDir = resolve(TEST_DIR, 'gate_conditional');

  before(() => { mkdirSync(stateDir, { recursive: true }); });
  after(() => { rmSync(stateDir, { recursive: true, force: true }); });

  it('allows advancement with CONDITIONAL verdict', () => {
    const gates = new GateEnforcement(config, stateDir);
    gates.recordVerdict({
      gate_id: 'implementation_to_integration',
      verdict: 'CONDITIONAL',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 40,
      tests_passed: 38,
      tests_failed: 2,
      coverage: '78%',
      blocking_issues: [],
      warnings: ['Coverage below 80% threshold'],
      conditions: ['Fix 2 flaky tests before delivery gate'],
      recommendation: 'Proceed with caution',
      project: 'cond-proj',
      phase: 2,
    });

    const check = gates.canAdvance('cond-proj', 2, 3, 'implementation_to_integration');
    assert.equal(check.allowed, true);
    assert.equal(check.conditional, true);
    assert.ok(check.conditions.length > 0);
  });

  it('blocks advancement with expired CONDITIONAL verdict', () => {
    const gates = new GateEnforcement(config, stateDir);
    gates.recordVerdict({
      gate_id: 'implementation_to_integration',
      verdict: 'CONDITIONAL',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 40,
      tests_passed: 38,
      tests_failed: 2,
      coverage: '78%',
      blocking_issues: [],
      warnings: ['Coverage below threshold'],
      conditions: ['Fix tests'],
      recommendation: 'Proceed with caution',
      project: 'expired-proj',
      phase: 2,
      expires_at: '2020-01-01T00:00:00.000Z', // expired
    });

    const check = gates.canAdvance('expired-proj', 2, 3, 'implementation_to_integration');
    assert.equal(check.allowed, false);
    assert.ok(check.blockers.some(b => b.includes('expired')));
  });

  it('sets phase status to gated_conditional on CONDITIONAL verdict', () => {
    const gates = new GateEnforcement(config, stateDir);
    gates.recordVerdict({
      gate_id: 'implementation_to_integration',
      verdict: 'CONDITIONAL',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 10,
      tests_passed: 9,
      tests_failed: 1,
      coverage: '75%',
      blocking_issues: [],
      warnings: ['Minor issue'],
      conditions: ['Address warning'],
      recommendation: 'OK',
      project: 'status-proj',
      phase: 2,
    });

    const state = gates.getPhaseState('status-proj');
    assert.equal(state?.status, 'gated_conditional');
  });
});

describe('GateEnforcement — Phase State Machine', () => {
  const loader = new ConfigLoader(TEMPLATE_PATH);
  const config = loader.load();
  const stateDir = resolve(TEST_DIR, 'gate_statemachine');

  before(() => { mkdirSync(stateDir, { recursive: true }); });
  after(() => { rmSync(stateDir, { recursive: true, force: true }); });

  it('blocks phase skipping (0 → 2)', () => {
    const gates = new GateEnforcement(config, stateDir);
    // Record a verdict so phase state exists
    gates.recordVerdict({
      gate_id: 'planning_to_architecture',
      verdict: 'PASS',
      issued_by: 'ceo',
      timestamp: new Date().toISOString(),
      tests_run: 0, tests_passed: 0, tests_failed: 0,
      coverage: 'N/A', blocking_issues: [], warnings: [],
      recommendation: 'Go', project: 'skip-proj', phase: 0,
    });

    const result = gates.advancePhase('skip-proj', 'planning_to_architecture', 0, 2, 'implementation');
    assert.equal(result.advanced, false);
    assert.ok(result.blockers.some(b => b.includes('skip')));
  });

  it('blocks wrong gate for phase transition', () => {
    const gates = new GateEnforcement(config, stateDir);
    gates.recordVerdict({
      gate_id: 'planning_to_architecture',
      verdict: 'PASS',
      issued_by: 'ceo',
      timestamp: new Date().toISOString(),
      tests_run: 0, tests_passed: 0, tests_failed: 0,
      coverage: 'N/A', blocking_issues: [], warnings: [],
      recommendation: 'Go', project: 'wronggate-proj', phase: 0,
    });

    // Try to use wrong gate name for phase 0→1
    const result = gates.advancePhase('wronggate-proj', 'implementation_to_integration', 0, 1, 'architecture');
    assert.equal(result.advanced, false);
    assert.ok(result.blockers.some(b => b.includes('Invalid transition')));
  });

  it('structurally blocks FAIL verdict advancement', () => {
    const gates = new GateEnforcement(config, stateDir);
    gates.recordVerdict({
      gate_id: 'implementation_to_integration',
      verdict: 'FAIL',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 50, tests_passed: 30, tests_failed: 20,
      coverage: '40%',
      blocking_issues: ['20 tests failing', 'Coverage critically low'],
      warnings: [],
      recommendation: 'Do not proceed',
      project: 'fail-proj',
      phase: 2,
    });

    const state = gates.getPhaseState('fail-proj');
    assert.equal(state?.status, 'gated_fail');

    const result = gates.advancePhase('fail-proj', 'implementation_to_integration', 2, 3, 'integration');
    assert.equal(result.advanced, false);
  });

  it('advances phase with conditional status', () => {
    const gates = new GateEnforcement(config, stateDir);
    gates.recordVerdict({
      gate_id: 'implementation_to_integration',
      verdict: 'CONDITIONAL',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 42, tests_passed: 40, tests_failed: 2,
      coverage: '82%',
      blocking_issues: [],
      warnings: ['2 flaky tests'],
      conditions: ['Stabilize flaky tests'],
      recommendation: 'Proceed with conditions',
      project: 'advance-cond',
      phase: 2,
    });

    const result = gates.advancePhase('advance-cond', 'implementation_to_integration', 2, 3, 'integration');
    assert.equal(result.advanced, true);
    assert.equal(result.conditional, true);
    assert.ok(result.conditions.length > 0);
  });
});

describe('GateEnforcement — History Queries', () => {
  const loader = new ConfigLoader(TEMPLATE_PATH);
  const config = loader.load();
  const stateDir = resolve(TEST_DIR, 'gate_history');

  before(() => {
    mkdirSync(stateDir, { recursive: true });

    const gates = new GateEnforcement(config, stateDir);

    // Seed history with multiple verdicts across projects
    const verdicts = [
      { project: 'alpha', phase: 0, verdict: 'PASS', issued_by: 'ceo', gate_id: 'planning_to_architecture', ts: '2026-01-10T10:00:00Z' },
      { project: 'alpha', phase: 0, verdict: 'PASS', issued_by: 'cto', gate_id: 'planning_to_architecture', ts: '2026-01-10T11:00:00Z' },
      { project: 'alpha', phase: 1, verdict: 'FAIL', issued_by: 'cto', gate_id: 'architecture_to_implementation', ts: '2026-01-15T10:00:00Z' },
      { project: 'beta', phase: 2, verdict: 'CONDITIONAL', issued_by: 'qa', gate_id: 'implementation_to_integration', ts: '2026-02-01T10:00:00Z' },
      { project: 'beta', phase: 2, verdict: 'PASS', issued_by: 'qa', gate_id: 'implementation_to_integration', ts: '2026-02-05T10:00:00Z' },
    ];

    for (const v of verdicts) {
      gates.recordVerdict({
        gate_id: v.gate_id,
        verdict: v.verdict,
        issued_by: v.issued_by,
        timestamp: v.ts,
        tests_run: 10, tests_passed: v.verdict === 'FAIL' ? 5 : 10, tests_failed: v.verdict === 'FAIL' ? 5 : 0,
        coverage: '80%', blocking_issues: v.verdict === 'FAIL' ? ['issues'] : [],
        warnings: v.verdict === 'CONDITIONAL' ? ['warn'] : [],
        recommendation: 'test',
        project: v.project,
        phase: v.phase,
      });
    }
  });

  after(() => { rmSync(stateDir, { recursive: true, force: true }); });

  it('queries by project', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({ project: 'alpha' });
    assert.equal(results.length, 3);
  });

  it('queries by verdict type', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({ verdict: 'FAIL' });
    assert.equal(results.length, 1);
    assert.equal(results[0].project, 'alpha');
  });

  it('queries by issuer', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({ issued_by: 'qa' });
    assert.equal(results.length, 2);
  });

  it('queries by phase', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({ phase: 2 });
    assert.equal(results.length, 2);
    assert.ok(results.every(v => v.project === 'beta'));
  });

  it('queries with combined filters', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({ project: 'alpha', issued_by: 'cto' });
    assert.equal(results.length, 2);
  });

  it('queries by time range', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({ after: '2026-02-01T00:00:00Z' });
    assert.equal(results.length, 2);
    assert.ok(results.every(v => v.project === 'beta'));
  });

  it('returns results sorted by timestamp descending', () => {
    const gates = new GateEnforcement(config, stateDir);
    const results = gates.queryHistory({});
    assert.equal(results.length, 5);
    for (let i = 1; i < results.length; i++) {
      assert.ok(new Date(results[i - 1].timestamp) >= new Date(results[i].timestamp));
    }
  });
});

// ─── GovernanceProtection — Audit Logging (ab-2-4) ──────────────────

describe('GovernanceProtection — Audit Logging', () => {
  const protection = new GovernanceProtection(
    {
      self_modification: 'prohibited',
      protected_assets: ['board.yaml', 'agents/*.md', 'CONSTITUTION.md', 'templates/*.yaml'],
    },
    '/fake/base'
  );

  it('logs allowed access attempts', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('worker', '/fake/base/src/index.ts');
    const log = protection.exportAuditLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].allowed, true);
    assert.equal(log[0].agent_role, 'worker');
    assert.equal(log[0].target_path, 'src/index.ts');
  });

  it('logs denied governance asset access with matched pattern', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('ceo', '/fake/base/board.yaml');
    const log = protection.exportAuditLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].allowed, false);
    assert.equal(log[0].violation_type, 'governance_asset');
    assert.equal(log[0].matched_pattern, 'board.yaml');
  });

  it('logs denied scope violation with agent scope', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('worker', '/fake/base/src/other/file.ts', ['src/mymodule/*']);
    const log = protection.exportAuditLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].allowed, false);
    assert.equal(log[0].violation_type, 'out_of_scope');
    assert.deepEqual(log[0].agent_scope, ['src/mymodule/*']);
  });

  it('accumulates multiple log entries', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('ceo', '/fake/base/src/index.ts');
    protection.checkWriteAccess('cto', '/fake/base/board.yaml');
    protection.checkWriteAccess('worker', '/fake/base/src/foo.ts', ['src/*']);
    const log = protection.exportAuditLog();
    assert.equal(log.length, 3);
  });

  it('clears audit log', () => {
    protection.clearAuditLog();
    assert.equal(protection.exportAuditLog().length, 0);
  });
});

describe('GovernanceProtection — Audit Log Queries', () => {
  const protection = new GovernanceProtection(
    {
      self_modification: 'prohibited',
      protected_assets: ['board.yaml', 'agents/*.md', 'CONSTITUTION.md'],
    },
    '/fake/base'
  );

  it('queries by agent_role', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('ceo', '/fake/base/src/a.ts');
    protection.checkWriteAccess('cto', '/fake/base/src/b.ts');
    protection.checkWriteAccess('ceo', '/fake/base/board.yaml');
    const results = protection.queryAuditLog({ agent_role: 'ceo' });
    assert.equal(results.length, 2);
  });

  it('queries denied-only entries', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('ceo', '/fake/base/src/ok.ts');
    protection.checkWriteAccess('cto', '/fake/base/CONSTITUTION.md');
    const results = protection.queryAuditLog({ allowed: false });
    assert.equal(results.length, 1);
    assert.equal(results[0].target_path, 'CONSTITUTION.md');
  });

  it('queries by path substring', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('worker', '/fake/base/src/core/types.ts');
    protection.checkWriteAccess('worker', '/fake/base/src/gates/enforcement.ts');
    const results = protection.queryAuditLog({ path_contains: 'gates' });
    assert.equal(results.length, 1);
  });

  it('respects limit parameter', () => {
    protection.clearAuditLog();
    for (let i = 0; i < 5; i++) {
      protection.checkWriteAccess('worker', `/fake/base/src/file${i}.ts`);
    }
    const results = protection.queryAuditLog({ limit: 3 });
    assert.equal(results.length, 3);
  });

  it('returns results sorted descending by timestamp', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('a', '/fake/base/src/1.ts');
    protection.checkWriteAccess('b', '/fake/base/src/2.ts');
    const results = protection.queryAuditLog({});
    assert.equal(results.length, 2);
    // Most recent first
    assert.ok(new Date(results[0].timestamp) >= new Date(results[1].timestamp));
  });
});

describe('GovernanceProtection — Audit Summary', () => {
  const protection = new GovernanceProtection(
    {
      self_modification: 'prohibited',
      protected_assets: ['board.yaml', 'agents/*.md'],
    },
    '/fake/base'
  );

  it('produces correct summary statistics', () => {
    protection.clearAuditLog();
    protection.checkWriteAccess('ceo', '/fake/base/src/ok.ts');
    protection.checkWriteAccess('ceo', '/fake/base/board.yaml');
    protection.checkWriteAccess('cto', '/fake/base/board.yaml');
    protection.checkWriteAccess('worker', '/fake/base/src/other.ts', ['src/mine/*']);

    const summary = protection.getAuditSummary();
    assert.equal(summary.total_attempts, 4);
    assert.equal(summary.total_allowed, 1);
    assert.equal(summary.total_denied, 3);
    assert.equal(summary.denials_by_type['governance_asset'], 2);
    assert.equal(summary.denials_by_type['out_of_scope'], 1);
    assert.equal(summary.denials_by_agent['ceo'], 1);
    assert.equal(summary.denials_by_agent['cto'], 1);
    assert.ok(summary.top_targeted_assets.length > 0);
    assert.equal(summary.top_targeted_assets[0].path, 'board.yaml');
    assert.equal(summary.top_targeted_assets[0].count, 2);
  });
});

describe('GovernanceProtection — enforceFileAccess', () => {
  const protection = new GovernanceProtection(
    {
      self_modification: 'prohibited',
      protected_assets: ['board.yaml', 'agents/*.md'],
    },
    '/fake/base'
  );

  it('returns null for allowed access', () => {
    const report = protection.enforceFileAccess('worker', '/fake/base/src/code.ts');
    assert.equal(report, null);
  });

  it('returns ViolationReport for governance asset denial', () => {
    const report = protection.enforceFileAccess('ceo', '/fake/base/board.yaml');
    assert.ok(report !== null);
    assert.equal(report!.result.allowed, false);
    assert.equal(report!.result.violation_type, 'governance_asset');
    assert.equal(report!.matched_pattern, 'board.yaml');
    assert.equal(report!.agent_role, 'ceo');
  });

  it('returns ViolationReport with scope info for out_of_scope denial', () => {
    const report = protection.enforceFileAccess('worker', '/fake/base/src/other.ts', ['src/mine/*']);
    assert.ok(report !== null);
    assert.equal(report!.result.violation_type, 'out_of_scope');
    assert.deepEqual(report!.allowed_scope, ['src/mine/*']);
    assert.ok(report!.nearest_allowed);
  });
});

describe('GovernanceProtection — validatePaths', () => {
  const protection = new GovernanceProtection(
    {
      self_modification: 'prohibited',
      protected_assets: ['board.yaml', 'agents/*.md', 'CONSTITUTION.md'],
    },
    '/fake/base'
  );

  it('identifies protected paths in a batch', () => {
    const violations = protection.validatePaths([
      'src/index.ts',
      'board.yaml',
      'agents/ceo.md',
      'src/core/types.ts',
      'CONSTITUTION.md',
    ]);
    assert.equal(violations.length, 3);
    assert.ok(violations.some(v => v.path === 'board.yaml'));
    assert.ok(violations.some(v => v.path === 'agents/ceo.md' && v.pattern === 'agents/*.md'));
    assert.ok(violations.some(v => v.path === 'CONSTITUTION.md'));
  });

  it('returns empty array when no violations', () => {
    const violations = protection.validatePaths(['src/a.ts', 'src/b.ts']);
    assert.equal(violations.length, 0);
  });
});
