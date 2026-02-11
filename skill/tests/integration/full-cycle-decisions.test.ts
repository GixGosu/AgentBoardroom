/**
 * Full-Cycle Integration Test: DecisionStore Governance Cycle
 *
 * Simulates a complete governance cycle:
 * 1. CEO creates plan_approval decision
 * 2. CTO challenges the plan
 * 3. CEO revises and creates new plan (supersedes original)
 * 4. CTO accepts revised plan
 * 5. QA creates qa_gate decision (PASS verdict)
 * 6. Verify complete decision chain, challenge history, queries, and file structure
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DecisionStoreAdapter } from '../../src/runtime/DecisionStoreAdapter.js';
import { DecisionStore } from '../../../src/decisions/store.js';

const TEST_DIR = resolve(import.meta.dirname ?? __dirname, '../../..', '.test-full-cycle');
const PROJECT = 'full-cycle-project';

describe('Full Governance Cycle with DecisionStore', () => {
  let adapter: DecisionStoreAdapter;
  let store: DecisionStore;
  let decisionIds: { ceoOriginal: string; ceoRevised: string; qaGate: string };

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    adapter = new DecisionStoreAdapter();
    decisionIds = { ceoOriginal: '', ceoRevised: '', qaGate: '' };
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('complete governance cycle: propose → challenge → revise → accept → QA gate', () => {
    store = adapter.getStore(PROJECT, TEST_DIR);

    // Step 1: CEO proposes plan (proposed, not auto-accepted)
    const proposed = store.propose({
      author: 'ceo',
      type: 'plan_approval',
      summary: 'Phase 1: monolithic API with shared state',
      rationale: 'Fastest initial implementation path',
      evidence: ['timeline analysis', 'resource availability'],
      phase: 1,
      project: PROJECT,
    });
    decisionIds.ceoOriginal = proposed.id;
    assert.equal(proposed.status, 'proposed');
    assert.match(proposed.id, /^DEC-\d{4}$/);

    // Step 2: CTO challenges the plan
    const challenged = adapter.recordCTOReview(PROJECT, TEST_DIR, {
      decisionId: proposed.id,
      action: 'challenge',
      rationale: 'Shared state creates coupling; will block parallelization in Phase 2',
      counterProposal: 'Use event-driven architecture with isolated modules',
    });
    assert.equal(challenged.status, 'challenged');
    assert.equal(challenged.challenged_by, 'cto');
    assert.equal(challenged.challenge_rounds, 1);

    // Step 3: CEO revises — creates new decision that supersedes original
    const revised = store.propose({
      author: 'ceo',
      type: 'plan_approval',
      summary: 'Phase 1 (revised): event-driven API with isolated modules',
      rationale: 'Adopted CTO feedback — isolated modules enable Phase 2 parallelization',
      evidence: ['CTO challenge rationale', 'revised dependency graph'],
      phase: 1,
      project: PROJECT,
      supersedes: proposed.id,
    });
    decisionIds.ceoRevised = revised.id;
    assert.equal(revised.status, 'proposed');
    assert.equal(revised.supersedes, proposed.id);

    // Step 4: CTO accepts revised plan
    const accepted = adapter.recordCTOReview(PROJECT, TEST_DIR, {
      decisionId: revised.id,
      action: 'accept',
      rationale: 'Architecture is sound. Module boundaries are clean.',
    });
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.id, revised.id);

    // Step 5: QA issues PASS verdict
    const qaRecord = adapter.recordGateVerdict(PROJECT, TEST_DIR, {
      gate_id: 'phase-1-gate',
      verdict: 'PASS',
      issued_by: 'qa',
      timestamp: new Date().toISOString(),
      tests_run: 50,
      tests_passed: 50,
      tests_failed: 0,
      coverage: '92%',
      blocking_issues: [],
      warnings: ['Consider adding edge-case tests for event bus'],
      recommendation: 'Phase 1 meets all acceptance criteria. Proceed to Phase 2.',
      project: PROJECT,
      phase: 1,
    });
    decisionIds.qaGate = qaRecord.id;
    assert.equal(qaRecord.type, 'qa_gate');
    assert.equal(qaRecord.status, 'accepted');
    assert.equal(qaRecord.author, 'qa');

    // Step 6: Verify total decisions = 3
    const allDecisions = store.query({});
    assert.equal(allDecisions.length, 3);

    // Step 7: Query challenged decisions (only original)
    const challengedDecisions = store.query({ challenged: true });
    assert.equal(challengedDecisions.length, 1);
    assert.equal(challengedDecisions[0].id, decisionIds.ceoOriginal);

    // Step 8: Query by author
    const ceoDecisions = store.query({ author: 'ceo' });
    assert.equal(ceoDecisions.length, 2);
    const qaDecisions = store.query({ author: 'qa' });
    assert.equal(qaDecisions.length, 1);

    // Step 9: Verify decisions.json file exists and is valid JSON
    const projectDir = resolve(TEST_DIR, PROJECT);
    const decisionsFile = resolve(projectDir, 'decisions.json');
    assert.ok(existsSync(decisionsFile), 'decisions.json should exist');
    const raw = readFileSync(decisionsFile, 'utf-8');
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 3);

    // Step 10: Verify decision chain integrity
    const original = store.get(decisionIds.ceoOriginal);
    const rev = store.get(decisionIds.ceoRevised);
    assert.ok(original);
    assert.ok(rev);
    assert.equal(original!.status, 'challenged');
    assert.equal(rev!.supersedes, decisionIds.ceoOriginal);
    assert.equal(rev!.status, 'accepted');
  });

  it('decision IDs follow DEC-XXXX format', () => {
    store = adapter.getStore(PROJECT, TEST_DIR);
    const d1 = store.propose({
      author: 'ceo', type: 'plan_approval', summary: 'Test',
      rationale: 'Test', evidence: [], phase: 1, project: PROJECT,
    });
    const d2 = store.propose({
      author: 'cto', type: 'cto_review', summary: 'Test 2',
      rationale: 'Test 2', evidence: [], phase: 1, project: PROJECT,
    });
    assert.match(d1.id, /^DEC-\d{4}$/);
    assert.match(d2.id, /^DEC-\d{4}$/);
    assert.notEqual(d1.id, d2.id);
  });

  it('query by phase returns correct decisions', () => {
    store = adapter.getStore(PROJECT, TEST_DIR);
    store.propose({ author: 'ceo', type: 'plan_approval', summary: 'P1', rationale: 'R', evidence: [], phase: 1, project: PROJECT });
    store.propose({ author: 'ceo', type: 'plan_approval', summary: 'P2', rationale: 'R', evidence: [], phase: 2, project: PROJECT });
    const phase1 = store.query({ phase: 1 });
    assert.equal(phase1.length, 1);
    assert.equal(phase1[0].summary, 'P1');
  });
});
