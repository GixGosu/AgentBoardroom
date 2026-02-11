/**
 * DecisionStoreAdapter — Unit Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DecisionStoreAdapter } from '../../src/runtime/DecisionStoreAdapter.js';
import type { GateVerdict } from '../../../src/core/types.js';

describe('DecisionStoreAdapter', () => {
  let stateDir: string;
  let adapter: DecisionStoreAdapter;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'dsa-test-'));
    adapter = new DecisionStoreAdapter();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  describe('getStore / lazy initialization', () => {
    it('creates decisions.json only when first decision is recorded', () => {
      const projectDir = join(stateDir, 'test-project');
      // Getting the store should not create the file yet (DecisionStore creates dir on save)
      const store = adapter.getStore('test-project', stateDir);
      assert.ok(store, 'Store should be returned');

      // File doesn't exist until we write
      // Now record something to trigger file creation
      adapter.recordPlanApproval('test-project', stateDir, {
        phase: 1,
        summary: 'Approve phase 1',
        rationale: 'Looks good',
      });

      const decisionsPath = join(projectDir, 'decisions.json');
      assert.ok(existsSync(decisionsPath), 'decisions.json should exist after first write');
    });

    it('returns same store instance for same project', () => {
      const store1 = adapter.getStore('proj', stateDir);
      const store2 = adapter.getStore('proj', stateDir);
      assert.strictEqual(store1, store2);
    });

    it('returns different store instances for different projects', () => {
      const store1 = adapter.getStore('proj-a', stateDir);
      const store2 = adapter.getStore('proj-b', stateDir);
      assert.notStrictEqual(store1, store2);
    });
  });

  describe('recordPlanApproval', () => {
    it('creates a decision with DEC-0001 format ID', () => {
      const record = adapter.recordPlanApproval('myproject', stateDir, {
        phase: 1,
        summary: 'Phase 1 plan approved',
        rationale: 'Architecture is sound',
        evidence: ['Design doc reviewed'],
      });

      assert.strictEqual(record.id, 'DEC-0001');
      assert.strictEqual(record.type, 'plan_approval');
      assert.strictEqual(record.author, 'ceo');
      assert.strictEqual(record.status, 'accepted');
      assert.strictEqual(record.project, 'myproject');
      assert.strictEqual(record.phase, 1);
    });

    it('increments IDs for subsequent approvals', () => {
      const r1 = adapter.recordPlanApproval('myproject', stateDir, {
        phase: 1,
        summary: 'Phase 1',
        rationale: 'OK',
      });
      const r2 = adapter.recordPlanApproval('myproject', stateDir, {
        phase: 2,
        summary: 'Phase 2',
        rationale: 'OK',
      });

      assert.strictEqual(r1.id, 'DEC-0001');
      assert.strictEqual(r2.id, 'DEC-0002');
    });

    it('persists to decisions.json', () => {
      adapter.recordPlanApproval('myproject', stateDir, {
        phase: 1,
        summary: 'Persisted',
        rationale: 'Test',
      });

      const raw = readFileSync(join(stateDir, 'myproject', 'decisions.json'), 'utf-8');
      const decisions = JSON.parse(raw);
      assert.strictEqual(decisions.length, 1);
      assert.strictEqual(decisions[0].id, 'DEC-0001');
    });
  });

  describe('recordCTOReview', () => {
    it('accepts an existing decision', () => {
      // First create a decision to review
      const approval = adapter.recordPlanApproval('proj', stateDir, {
        phase: 1,
        summary: 'Plan',
        rationale: 'Reason',
      });

      // Manually propose a new decision for CTO to review
      const store = adapter.getStore('proj', stateDir);
      const proposed = store.propose({
        author: 'ceo',
        type: 'architecture',
        summary: 'Arch decision',
        rationale: 'Because',
        phase: 1,
        project: 'proj',
      });

      const reviewed = adapter.recordCTOReview('proj', stateDir, {
        decisionId: proposed.id,
        action: 'accept',
        rationale: 'LGTM',
      });

      assert.strictEqual(reviewed.status, 'accepted');
    });

    it('challenges a decision and appends to challenge history', () => {
      const store = adapter.getStore('proj', stateDir);
      const proposed = store.propose({
        author: 'ceo',
        type: 'architecture',
        summary: 'Risky arch',
        rationale: 'Speed',
        phase: 1,
        project: 'proj',
      });

      const challenged = adapter.recordCTOReview('proj', stateDir, {
        decisionId: proposed.id,
        action: 'challenge',
        rationale: 'Too risky',
        counterProposal: 'Use proven pattern instead',
      });

      assert.strictEqual(challenged.status, 'challenged');
      assert.strictEqual(challenged.challenge_rounds, 1);
      assert.strictEqual(challenged.challenge_history.length, 1);
      assert.strictEqual(challenged.challenge_history[0].challenger, 'cto');
      assert.strictEqual(challenged.challenge_history[0].counter_proposal, 'Use proven pattern instead');
    });

    it('allows multiple challenge rounds', () => {
      const store = adapter.getStore('proj', stateDir);
      const proposed = store.propose({
        author: 'ceo',
        type: 'architecture',
        summary: 'Debate this',
        rationale: 'Reason',
        phase: 1,
        project: 'proj',
      });

      adapter.recordCTOReview('proj', stateDir, {
        decisionId: proposed.id,
        action: 'challenge',
        rationale: 'Round 1 challenge',
      });

      const round2 = adapter.recordCTOReview('proj', stateDir, {
        decisionId: proposed.id,
        action: 'challenge',
        rationale: 'Round 2 challenge',
      });

      assert.strictEqual(round2.challenge_rounds, 2);
      assert.strictEqual(round2.challenge_history.length, 2);
    });
  });

  describe('recordGateVerdict', () => {
    it('auto-creates a decision from GateVerdict object', () => {
      const verdict: GateVerdict = {
        gate_id: 'phase-1-exit',
        verdict: 'PASS',
        issued_by: 'qa-lead',
        timestamp: new Date().toISOString(),
        tests_run: 50,
        tests_passed: 50,
        tests_failed: 0,
        coverage: '92%',
        blocking_issues: [],
        warnings: ['Minor lint warnings'],
        recommendation: 'Ready to proceed',
        project: 'myproject',
        phase: 1,
      };

      const record = adapter.recordGateVerdict('myproject', stateDir, verdict);

      assert.strictEqual(record.id, 'DEC-0001');
      assert.strictEqual(record.type, 'qa_gate');
      assert.strictEqual(record.author, 'qa-lead');
      assert.strictEqual(record.status, 'accepted');
      assert.ok(record.summary.includes('PASS'));
      assert.ok(record.summary.includes('phase-1-exit'));
      assert.ok(record.evidence.some(e => e.includes('50/50')));
      assert.ok(record.evidence.some(e => e.includes('92%')));
      assert.ok(record.evidence.some(e => e.includes('Warning:')));
    });

    it('records FAIL verdict with blocking issues in evidence', () => {
      const verdict: GateVerdict = {
        gate_id: 'phase-2-exit',
        verdict: 'FAIL',
        issued_by: 'qa-lead',
        timestamp: new Date().toISOString(),
        tests_run: 100,
        tests_passed: 85,
        tests_failed: 15,
        coverage: '67%',
        blocking_issues: ['Coverage below 80%', '15 test failures'],
        warnings: [],
        recommendation: 'Fix failures before proceeding',
        project: 'myproject',
        phase: 2,
      };

      const record = adapter.recordGateVerdict('myproject', stateDir, verdict);

      assert.strictEqual(record.type, 'qa_gate');
      assert.ok(record.summary.includes('FAIL'));
      assert.ok(record.evidence.some(e => e.includes('Blocking: Coverage below 80%')));
      assert.ok(record.evidence.some(e => e.includes('Blocking: 15 test failures')));
    });
  });
});
