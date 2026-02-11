/**
 * DecisionStoreAdapter — Runtime Bridge for Governance Decisions
 *
 * Lazy-initializes a DecisionStore per project and provides high-level
 * methods for recording governance decisions (plan approvals, CTO reviews,
 * QA gate verdicts). Agents call explicit methods; runtime calls automatic ones.
 */

import { resolve } from 'node:path';
import { DecisionStore } from '../../../src/decisions/store.js';
import type { DecisionRecord, GateVerdict } from '../../../src/core/types.js';

export interface PlanApprovalParams {
  phase: number;
  summary: string;
  rationale: string;
  evidence?: string[];
  dependencies?: string[];
}

export interface CTOReviewParams {
  decisionId: string;
  action: 'accept' | 'challenge';
  rationale: string;
  counterProposal?: string;
}

/**
 * Runtime bridge between governance agents and the DecisionStore.
 * One adapter instance can manage multiple projects via lazy-init stores.
 */
export class DecisionStoreAdapter {
  private stores: Map<string, DecisionStore> = new Map();

  /**
   * Get or lazy-init a DecisionStore for a project.
   * Creates `<stateDir>/<project>/` and `decisions.json` on first access.
   */
  getStore(project: string, stateDir: string): DecisionStore {
    const key = `${stateDir}::${project}`;
    let store = this.stores.get(key);
    if (!store) {
      const projectStateDir = resolve(stateDir, project);
      store = new DecisionStore(projectStateDir);
      this.stores.set(key, store);
    }
    return store;
  }

  /**
   * CEO records a plan approval decision.
   * Creates a new decision record with type 'plan_approval' and status 'accepted'.
   */
  recordPlanApproval(
    project: string,
    stateDir: string,
    params: PlanApprovalParams
  ): DecisionRecord {
    const store = this.getStore(project, stateDir);
    const record = store.propose({
      author: 'ceo',
      type: 'plan_approval',
      summary: params.summary,
      rationale: params.rationale,
      evidence: params.evidence ?? [],
      phase: params.phase,
      project,
      dependencies: params.dependencies,
    });
    // CEO approval is immediately accepted
    return store.accept(record.id, 'ceo', params.rationale);
  }

  /**
   * CTO records a review (accept or challenge) on an existing decision.
   */
  recordCTOReview(
    project: string,
    stateDir: string,
    params: CTOReviewParams
  ): DecisionRecord {
    const store = this.getStore(project, stateDir);
    if (params.action === 'challenge') {
      return store.challenge(
        params.decisionId,
        'cto',
        params.rationale,
        params.counterProposal
      );
    } else {
      return store.accept(params.decisionId, 'cto', params.rationale);
    }
  }

  /**
   * Auto-record a QA gate verdict as a decision record.
   * Called automatically by the runtime when a gate verdict is issued.
   */
  recordGateVerdict(
    project: string,
    stateDir: string,
    verdict: GateVerdict
  ): DecisionRecord {
    const store = this.getStore(project, stateDir);
    const summary = `Gate ${verdict.gate_id}: ${verdict.verdict} (${verdict.tests_passed}/${verdict.tests_run} tests, ${verdict.coverage} coverage)`;
    const evidence = [
      `Tests: ${verdict.tests_passed}/${verdict.tests_run} passed, ${verdict.tests_failed} failed`,
      `Coverage: ${verdict.coverage}`,
      ...verdict.blocking_issues.map(i => `Blocking: ${i}`),
      ...verdict.warnings.map(w => `Warning: ${w}`),
    ];

    const record = store.propose({
      author: verdict.issued_by,
      type: 'qa_gate',
      summary,
      rationale: verdict.recommendation,
      evidence,
      phase: verdict.phase,
      project: verdict.project,
    });

    // Gate verdicts are auto-accepted (structural, not advisory)
    return store.accept(record.id, verdict.issued_by, verdict.recommendation);
  }
}
