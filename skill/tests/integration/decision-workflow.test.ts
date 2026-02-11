/**
 * Integration tests: DecisionStore workflow via DecisionStoreAdapter
 *
 * Tests the full CEO → CTO decision workflow:
 * 1. CEO creates a plan_approval decision
 * 2. CTO challenges a proposed decision
 * 3. CTO accepts after challenge
 * 4. Decision chain and challenge history verified
 *
 * Note: recordPlanApproval() auto-accepts. For CTO review workflows,
 * use the store's propose() directly to create a decision in 'proposed' state,
 * then have CTO review it before acceptance.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DecisionStoreAdapter } from '../../src/runtime/DecisionStoreAdapter.js';

const TEST_DIR = resolve(import.meta.dirname ?? __dirname, '../../..', '.test-decision-workflow');
const PROJECT = 'test-project';

describe('Decision Workflow Integration', () => {
  let adapter: DecisionStoreAdapter;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    adapter = new DecisionStoreAdapter();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('CEO creates a plan_approval decision (auto-accepted)', () => {
    const record = adapter.recordPlanApproval(PROJECT, TEST_DIR, {
      phase: 1,
      summary: 'Phase 1 plan: implement core module',
      rationale: 'Parallelizable, within budget',
      evidence: ['WBS analysis'],
      dependencies: ['ARCHITECTURE.md finalized'],
    });

    assert.equal(record.author, 'ceo');
    assert.equal(record.type, 'plan_approval');
    assert.equal(record.status, 'accepted');
    assert.ok(record.id);
    assert.equal(record.summary, 'Phase 1 plan: implement core module');
  });

  it('CTO challenges a proposed decision', () => {
    // CEO proposes (not auto-accepted) so CTO can review
    const store = adapter.getStore(PROJECT, TEST_DIR);
    const proposed = store.propose({
      author: 'ceo',
      type: 'plan_approval',
      summary: 'Phase 1: monolithic module structure',
      rationale: 'Simpler initial implementation',
      evidence: [],
      phase: 1,
      project: PROJECT,
    });
    assert.equal(proposed.status, 'proposed');

    // CTO challenges
    const challenged = adapter.recordCTOReview(PROJECT, TEST_DIR, {
      decisionId: proposed.id,
      action: 'challenge',
      rationale: 'Circular dependency risk in module structure',
      counterProposal: 'Extract shared types to common module',
    });

    assert.equal(challenged.status, 'challenged');
    assert.equal(challenged.challenged_by, 'cto');
    assert.equal(challenged.challenge_rounds, 1);
    assert.equal(challenged.challenge_history.length, 1);
    assert.equal(challenged.challenge_history[0].challenger, 'cto');
    assert.ok(challenged.challenge_history[0].rationale.includes('Circular dependency'));
    assert.equal(challenged.challenge_history[0].counter_proposal, 'Extract shared types to common module');
  });

  it('CTO accepts a proposed decision', () => {
    const store = adapter.getStore(PROJECT, TEST_DIR);
    const proposed = store.propose({
      author: 'ceo',
      type: 'plan_approval',
      summary: 'Phase 1: modular structure with shared types',
      rationale: 'Clean module boundaries',
      evidence: [],
      phase: 1,
      project: PROJECT,
    });

    const accepted = adapter.recordCTOReview(PROJECT, TEST_DIR, {
      decisionId: proposed.id,
      action: 'accept',
      rationale: 'Architecture is sound. No circular deps.',
    });

    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.challenge_rounds, 0);
  });

  it('full workflow: propose → challenge → accept with history', () => {
    const store = adapter.getStore(PROJECT, TEST_DIR);

    // CEO proposes
    const proposed = store.propose({
      author: 'ceo',
      type: 'plan_approval',
      summary: 'Phase 2: API layer with 3 teams',
      rationale: 'Parallel development possible',
      evidence: ['dependency graph shows no blocking'],
      phase: 2,
      project: PROJECT,
    });
    const decisionId = proposed.id;

    // CTO challenge round 1
    const r1 = adapter.recordCTOReview(PROJECT, TEST_DIR, {
      decisionId,
      action: 'challenge',
      rationale: 'Team 2 and 3 share a dependency on auth module',
      counterProposal: 'Sequence teams 2 and 3, or extract auth first',
    });
    assert.equal(r1.status, 'challenged');
    assert.equal(r1.challenge_rounds, 1);

    // CTO accepts after revision
    const final = adapter.recordCTOReview(PROJECT, TEST_DIR, {
      decisionId,
      action: 'accept',
      rationale: 'Auth module extracted to Phase 2a. Teams can now parallelize.',
    });

    assert.equal(final.status, 'accepted');
    assert.equal(final.challenge_rounds, 1);
    // challenge_history includes both the challenge and the acceptance entries
    assert.equal(final.challenge_history.length, 2);
    assert.equal(final.challenge_history[0].action, 'challenged');
    assert.equal(final.challenge_history[1].action, 'accepted');
    assert.equal(final.id, decisionId);

    // Verify store persistence
    const persisted = store.get(decisionId);
    assert.ok(persisted);
    assert.equal(persisted!.status, 'accepted');
    assert.equal(persisted!.challenge_rounds, 1);
  });
});
