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
