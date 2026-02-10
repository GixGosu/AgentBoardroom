/**
 * AgentBoardroom — Decision Record Store
 *
 * Append-only storage and query engine for Decision Records.
 * Decisions are first-class objects with lineage, not messages in a log.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { DecisionRecord, DecisionStatus, DecisionType } from '../core/types.js';

export class DecisionStore {
  private filePath: string;
  private decisions: DecisionRecord[] = [];
  private nextId: number = 1;

  constructor(stateDir: string) {
    this.filePath = resolve(stateDir, 'decisions.json');
    this.load();
  }

  private load(): void {
    if (existsSync(this.filePath)) {
      const raw = readFileSync(this.filePath, 'utf-8');
      this.decisions = JSON.parse(raw);
      // Set nextId based on highest existing ID
      const maxId = this.decisions.reduce((max, d) => {
        const num = parseInt(d.id.replace('DEC-', ''), 10);
        return num > max ? num : max;
      }, 0);
      this.nextId = maxId + 1;
    }
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.decisions, null, 2));
  }

  /**
   * Create a new decision record with status 'proposed'.
   */
  propose(params: {
    author: string;
    type: DecisionType;
    summary: string;
    rationale: string;
    evidence?: string[];
    phase: number;
    project: string;
    supersedes?: string;
  }): DecisionRecord {
    const record: DecisionRecord = {
      id: `DEC-${String(this.nextId++).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      author: params.author,
      type: params.type,
      summary: params.summary,
      rationale: params.rationale,
      evidence: params.evidence ?? [],
      challenged_by: null,
      challenge_rounds: 0,
      challenge_history: [],
      status: 'proposed',
      supersedes: params.supersedes ?? null,
      phase: params.phase,
      project: params.project,
    };

    this.decisions.push(record);
    this.save();
    return record;
  }

  /**
   * Record a challenge round on an existing decision.
   */
  challenge(
    decisionId: string,
    challenger: string,
    rationale: string,
    counterProposal?: string
  ): DecisionRecord {
    const decision = this.get(decisionId);
    if (!decision) throw new Error(`Decision ${decisionId} not found`);
    if (decision.status !== 'proposed' && decision.status !== 'challenged') {
      throw new Error(`Decision ${decisionId} is ${decision.status}, cannot challenge`);
    }

    decision.challenged_by = challenger;
    decision.challenge_rounds++;
    decision.status = 'challenged';
    decision.challenge_history.push({
      round: decision.challenge_rounds,
      challenger,
      action: 'challenged',
      rationale,
      counter_proposal: counterProposal,
      timestamp: new Date().toISOString(),
    });

    this.save();
    return decision;
  }

  /**
   * Accept a proposed or challenged decision.
   */
  accept(decisionId: string, acceptedBy: string, rationale?: string): DecisionRecord {
    const decision = this.get(decisionId);
    if (!decision) throw new Error(`Decision ${decisionId} not found`);

    decision.status = 'accepted';
    if (rationale) {
      decision.challenge_history.push({
        round: decision.challenge_rounds + 1,
        challenger: acceptedBy,
        action: 'accepted',
        rationale,
        timestamp: new Date().toISOString(),
      });
    }

    this.save();
    return decision;
  }

  /**
   * Escalate a decision to the Board Chair.
   */
  escalate(decisionId: string): DecisionRecord {
    const decision = this.get(decisionId);
    if (!decision) throw new Error(`Decision ${decisionId} not found`);

    decision.status = 'escalated';
    this.save();
    return decision;
  }

  /**
   * Supersede a decision with a new one.
   */
  supersede(decisionId: string, newDecisionId: string): DecisionRecord {
    const decision = this.get(decisionId);
    if (!decision) throw new Error(`Decision ${decisionId} not found`);

    decision.status = 'superseded';
    this.save();
    return decision;
  }

  /**
   * Get a decision by ID.
   */
  get(decisionId: string): DecisionRecord | undefined {
    return this.decisions.find(d => d.id === decisionId);
  }

  /**
   * Query decisions with filters.
   */
  query(filters: {
    author?: string;
    type?: DecisionType;
    status?: DecisionStatus;
    project?: string;
    phase?: number;
    challenged?: boolean;
  }): DecisionRecord[] {
    return this.decisions.filter(d => {
      if (filters.author && d.author !== filters.author) return false;
      if (filters.type && d.type !== filters.type) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.project && d.project !== filters.project) return false;
      if (filters.phase !== undefined && d.phase !== filters.phase) return false;
      if (filters.challenged !== undefined) {
        const wasChallenged = d.challenge_rounds > 0;
        if (filters.challenged !== wasChallenged) return false;
      }
      return true;
    });
  }

  /**
   * Get the decision chain leading to a specific decision (follow supersedes links).
   */
  chain(decisionId: string): DecisionRecord[] {
    const chain: DecisionRecord[] = [];
    let current = this.get(decisionId);
    while (current) {
      chain.unshift(current);
      current = current.supersedes ? this.get(current.supersedes) : undefined;
    }
    return chain;
  }

  /**
   * Get all decisions (read-only snapshot).
   */
  all(): readonly DecisionRecord[] {
    return this.decisions;
  }

  /**
   * Get count of decisions.
   */
  count(): number {
    return this.decisions.length;
  }
}
