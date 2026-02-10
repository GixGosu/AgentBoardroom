/**
 * AgentBoardroom — Challenge Protocol Engine
 *
 * Manages the structured challenge process between board roles.
 * Enforces round limits and auto-escalation.
 * This is the difference between "suggested" and "enforced" governance.
 */

import type { DecisionRecord, BoardConfig, ChallengeConfig } from '../core/types.js';
import type { DecisionStore } from '../decisions/store.js';

export interface ChallengeResult {
  decision: DecisionRecord;
  outcome: 'accepted' | 'challenged' | 'escalated';
  round: number;
  requires_revision: boolean;
  requires_escalation: boolean;
}

export class ChallengeProtocol {
  private config: ChallengeConfig;
  private challengeMap: Map<string, string[]>; // role -> who challenges it

  constructor(boardConfig: BoardConfig) {
    this.config = boardConfig.challenge;
    this.challengeMap = new Map();

    // Build challenge relationship map
    for (const [roleName, roleConfig] of Object.entries(boardConfig.roles)) {
      if (roleConfig.challenges) {
        // This role is challenged BY the roles listed in its 'challenges' field
        this.challengeMap.set(roleName, roleConfig.challenges);
      }
    }
  }

  /**
   * Get the designated challenger(s) for a given role's decisions.
   */
  getChallengers(authorRole: string): string[] {
    return this.challengeMap.get(authorRole) ?? [];
  }

  /**
   * Check if a decision requires challenge before execution.
   */
  requiresChallenge(decision: DecisionRecord): boolean {
    const challengers = this.getChallengers(decision.author);
    return challengers.length > 0;
  }

  /**
   * Check if a decision can proceed to execution.
   * Returns false if challenge is required but not complete.
   */
  canExecute(decision: DecisionRecord): boolean {
    if (!this.requiresChallenge(decision)) return true;
    return decision.status === 'accepted' || decision.status === 'escalated';
  }

  /**
   * Process a challenge action on a decision.
   */
  processChallenge(
    store: DecisionStore,
    decisionId: string,
    challenger: string,
    action: 'accept' | 'challenge',
    rationale: string,
    counterProposal?: string
  ): ChallengeResult {
    const decision = store.get(decisionId);
    if (!decision) throw new Error(`Decision ${decisionId} not found`);

    // Verify the challenger is authorized
    const authorizedChallengers = this.getChallengers(decision.author);
    if (!authorizedChallengers.includes(challenger)) {
      throw new Error(
        `Role "${challenger}" is not authorized to challenge ${decision.author}'s decisions`
      );
    }

    if (action === 'accept') {
      const updated = store.accept(decisionId, challenger, rationale);
      return {
        decision: updated,
        outcome: 'accepted',
        round: updated.challenge_rounds,
        requires_revision: false,
        requires_escalation: false,
      };
    }

    // Challenge action
    const updated = store.challenge(decisionId, challenger, rationale, counterProposal);

    // Check if we've hit the round limit
    if (updated.challenge_rounds >= this.config.max_rounds) {
      if (this.config.auto_escalation) {
        const escalated = store.escalate(decisionId);
        return {
          decision: escalated,
          outcome: 'escalated',
          round: escalated.challenge_rounds,
          requires_revision: false,
          requires_escalation: true,
        };
      }
    }

    return {
      decision: updated,
      outcome: 'challenged',
      round: updated.challenge_rounds,
      requires_revision: true,
      requires_escalation: false,
    };
  }

  /**
   * Get the maximum number of challenge rounds before escalation.
   */
  get maxRounds(): number {
    return this.config.max_rounds;
  }

  /**
   * Check if auto-escalation is enabled.
   */
  get autoEscalation(): boolean {
    return this.config.auto_escalation;
  }
}
