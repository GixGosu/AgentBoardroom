/**
 * AgentBoardroom — Challenge Protocol Engine
 *
 * Manages the structured challenge process between board roles.
 * Enforces round limits, auto-escalation, and counter-proposal tracking.
 * This is structural enforcement, not advisory — decisions cannot bypass the protocol.
 *
 * Phase 2 (ab-2-2): Enhanced with:
 * - Structured counter-proposals with status tracking
 * - Challenge history export (JSON + markdown audit trail)
 * - Round-limit enforcement with configurable auto-escalation
 * - Audit trail generation for compliance review
 */

import type {
  DecisionRecord,
  BoardConfig,
  ChallengeConfig,
  ChallengeRound,
} from '../core/types.js';
import type { DecisionStore } from '../decisions/store.js';

// ─── Counter-Proposal Types ─────────────────────────────────────────

/**
 * A structured counter-proposal attached to a challenge.
 * Goes beyond rationale text — captures the proposed alternative,
 * its impact assessment, and tracking status.
 */
export interface CounterProposal {
  /** Unique ID within the challenge context (e.g., "CP-DEC-0001-1") */
  id: string;
  /** The decision being challenged */
  decision_id: string;
  /** Challenge round this counter-proposal belongs to */
  round: number;
  /** Role proposing the alternative */
  proposed_by: string;
  /** The alternative proposal summary */
  summary: string;
  /** Detailed rationale for the alternative */
  rationale: string;
  /** Expected impact or trade-offs */
  impact: string[];
  /** Current status of this counter-proposal */
  status: CounterProposalStatus;
  /** ISO timestamp of creation */
  created_at: string;
  /** ISO timestamp of last status change */
  resolved_at: string | null;
  /** Resolution notes (why accepted/rejected/withdrawn) */
  resolution_notes: string | null;
}

/** Counter-proposal lifecycle states. */
export type CounterProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'superseded';

// ─── Challenge Result ───────────────────────────────────────────────

export interface ChallengeResult {
  decision: DecisionRecord;
  outcome: 'accepted' | 'challenged' | 'escalated';
  round: number;
  requires_revision: boolean;
  requires_escalation: boolean;
  /** Counter-proposal created during this challenge (if any) */
  counter_proposal?: CounterProposal;
}

// ─── Challenge Audit Entry ──────────────────────────────────────────

/**
 * A denormalized audit entry combining decision context with challenge details.
 * Used for export and compliance reporting.
 */
export interface ChallengeAuditEntry {
  decision_id: string;
  decision_summary: string;
  decision_author: string;
  project: string;
  phase: number;
  current_status: string;
  total_rounds: number;
  challenge_history: ChallengeRound[];
  counter_proposals: CounterProposal[];
  escalated: boolean;
  /** Time from first proposal to resolution (ms), or null if unresolved */
  resolution_time_ms: number | null;
}

// ─── History Query Filters ──────────────────────────────────────────

/**
 * Query parameters for searching challenge history.
 * All fields are optional; results match ALL provided criteria.
 */
export interface ChallengeHistoryQuery {
  /** Filter by decision author role */
  author?: string;
  /** Filter by challenger role */
  challenger?: string;
  /** Filter by project */
  project?: string;
  /** Filter by phase */
  phase?: number;
  /** Only include escalated challenges */
  escalated?: boolean;
  /** Only include decisions with counter-proposals */
  hasCounterProposals?: boolean;
  /** Filter challenges after this timestamp (inclusive, ISO) */
  after?: string;
  /** Filter challenges before this timestamp (inclusive, ISO) */
  before?: string;
  /** Minimum number of challenge rounds */
  minRounds?: number;
}

// ─── Challenge Protocol ─────────────────────────────────────────────

export class ChallengeProtocol {
  private config: ChallengeConfig;
  private challengeMap: Map<string, string[]>; // role -> who challenges it
  /** Structured counter-proposals indexed by decision ID */
  private counterProposals: Map<string, CounterProposal[]> = new Map();

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
   * This is structural enforcement — there is no bypass.
   */
  canExecute(decision: DecisionRecord): boolean {
    if (!this.requiresChallenge(decision)) return true;
    return decision.status === 'accepted' || decision.status === 'escalated';
  }

  /**
   * Get the remaining challenge rounds before auto-escalation.
   *
   * @param decision The decision to check.
   * @returns Remaining rounds, or Infinity if auto-escalation is disabled.
   */
  remainingRounds(decision: DecisionRecord): number {
    if (!this.config.auto_escalation) return Infinity;
    return Math.max(0, this.config.max_rounds - decision.challenge_rounds);
  }

  /**
   * Check whether a decision has exceeded the maximum challenge rounds.
   *
   * @param decision The decision to check.
   * @returns true if the decision is at or beyond the round limit.
   */
  isAtRoundLimit(decision: DecisionRecord): boolean {
    return decision.challenge_rounds >= this.config.max_rounds;
  }

  /**
   * Process a challenge action on a decision.
   *
   * Enforces authorization, round limits, and auto-escalation structurally.
   * When a counter-proposal is provided with structured fields, creates a
   * tracked CounterProposal object.
   *
   * @param store The decision store.
   * @param decisionId The decision to challenge/accept.
   * @param challenger The role performing the action.
   * @param action Whether to accept or challenge.
   * @param rationale Explanation for the action.
   * @param counterProposal Optional text counter-proposal (backward compat).
   * @param structuredCounterProposal Optional structured counter-proposal.
   */
  processChallenge(
    store: DecisionStore,
    decisionId: string,
    challenger: string,
    action: 'accept' | 'challenge',
    rationale: string,
    counterProposal?: string,
    structuredCounterProposal?: {
      summary: string;
      rationale: string;
      impact: string[];
    }
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

    // Block challenges on already-resolved decisions
    if (decision.status === 'accepted' || decision.status === 'escalated' || decision.status === 'superseded') {
      throw new Error(
        `Decision ${decisionId} is already ${decision.status}, cannot process further challenges`
      );
    }

    if (action === 'accept') {
      const updated = store.accept(decisionId, challenger, rationale);
      // Supersede any pending counter-proposals
      this._supersedePendingCounterProposals(decisionId, 'Decision accepted');
      return {
        decision: updated,
        outcome: 'accepted',
        round: updated.challenge_rounds,
        requires_revision: false,
        requires_escalation: false,
      };
    }

    // Challenge action — enforce round limit structurally
    if (this.isAtRoundLimit(decision)) {
      // Already at limit — force escalation, do not allow another round
      if (this.config.auto_escalation) {
        const escalated = store.escalate(decisionId);
        this._supersedePendingCounterProposals(decisionId, 'Auto-escalated at round limit');
        return {
          decision: escalated,
          outcome: 'escalated',
          round: escalated.challenge_rounds,
          requires_revision: false,
          requires_escalation: true,
        };
      }
    }

    // Use text counter-proposal for backward compat, or structured summary
    const cpText = counterProposal ?? structuredCounterProposal?.summary;
    const updated = store.challenge(decisionId, challenger, rationale, cpText);

    // Create structured counter-proposal if provided
    let createdCP: CounterProposal | undefined;
    if (structuredCounterProposal) {
      createdCP = this._createCounterProposal(
        decisionId,
        updated.challenge_rounds,
        challenger,
        structuredCounterProposal
      );
    }

    // Check if we've now hit the round limit
    if (updated.challenge_rounds >= this.config.max_rounds) {
      if (this.config.auto_escalation) {
        const escalated = store.escalate(decisionId);
        this._supersedePendingCounterProposals(decisionId, 'Auto-escalated at round limit');
        return {
          decision: escalated,
          outcome: 'escalated',
          round: escalated.challenge_rounds,
          requires_revision: false,
          requires_escalation: true,
          counter_proposal: createdCP,
        };
      }
    }

    return {
      decision: updated,
      outcome: 'challenged',
      round: updated.challenge_rounds,
      requires_revision: true,
      requires_escalation: false,
      counter_proposal: createdCP,
    };
  }

  // ─── Counter-Proposal Management ───────────────────────────────────

  /**
   * Create a structured counter-proposal.
   * @internal
   */
  private _createCounterProposal(
    decisionId: string,
    round: number,
    proposedBy: string,
    params: { summary: string; rationale: string; impact: string[] }
  ): CounterProposal {
    const existing = this.counterProposals.get(decisionId) ?? [];
    const cp: CounterProposal = {
      id: `CP-${decisionId}-${round}`,
      decision_id: decisionId,
      round,
      proposed_by: proposedBy,
      summary: params.summary,
      rationale: params.rationale,
      impact: params.impact,
      status: 'pending',
      created_at: new Date().toISOString(),
      resolved_at: null,
      resolution_notes: null,
    };
    existing.push(cp);
    this.counterProposals.set(decisionId, existing);
    return cp;
  }

  /**
   * Supersede all pending counter-proposals for a decision.
   * @internal
   */
  private _supersedePendingCounterProposals(decisionId: string, notes: string): void {
    const cps = this.counterProposals.get(decisionId);
    if (!cps) return;
    const now = new Date().toISOString();
    for (const cp of cps) {
      if (cp.status === 'pending') {
        cp.status = 'superseded';
        cp.resolved_at = now;
        cp.resolution_notes = notes;
      }
    }
  }

  /**
   * Resolve a counter-proposal by ID.
   *
   * @param counterProposalId The counter-proposal ID (e.g., "CP-DEC-0001-1").
   * @param status The resolution status.
   * @param notes Optional resolution notes.
   * @returns The updated counter-proposal.
   * @throws If the counter-proposal is not found or already resolved.
   */
  resolveCounterProposal(
    counterProposalId: string,
    status: 'accepted' | 'rejected' | 'withdrawn',
    notes?: string
  ): CounterProposal {
    for (const [, cps] of this.counterProposals) {
      const cp = cps.find(c => c.id === counterProposalId);
      if (cp) {
        if (cp.status !== 'pending') {
          throw new Error(`Counter-proposal ${counterProposalId} is already ${cp.status}`);
        }
        cp.status = status;
        cp.resolved_at = new Date().toISOString();
        cp.resolution_notes = notes ?? null;
        return cp;
      }
    }
    throw new Error(`Counter-proposal ${counterProposalId} not found`);
  }

  /**
   * Get all counter-proposals for a decision.
   *
   * @param decisionId The decision ID.
   * @returns Array of counter-proposals (empty if none).
   */
  getCounterProposals(decisionId: string): readonly CounterProposal[] {
    return this.counterProposals.get(decisionId) ?? [];
  }

  /**
   * Get a single counter-proposal by ID.
   *
   * @param counterProposalId The counter-proposal ID.
   * @returns The counter-proposal, or undefined if not found.
   */
  getCounterProposal(counterProposalId: string): CounterProposal | undefined {
    for (const [, cps] of this.counterProposals) {
      const cp = cps.find(c => c.id === counterProposalId);
      if (cp) return cp;
    }
    return undefined;
  }

  // ─── Challenge History & Audit ─────────────────────────────────────

  /**
   * Build audit entries from the decision store, filtered by query.
   *
   * This is the primary audit interface — combines decision data with
   * challenge history and counter-proposal tracking into a single
   * denormalized view suitable for compliance reporting.
   *
   * @param store The decision store to query.
   * @param query Optional filters.
   * @returns Array of audit entries sorted by decision timestamp (newest first).
   */
  getAuditTrail(store: DecisionStore, query?: ChallengeHistoryQuery): ChallengeAuditEntry[] {
    const all = store.all();
    const entries: ChallengeAuditEntry[] = [];

    for (const d of all) {
      // Only include decisions that have been through the challenge process
      if (d.challenge_rounds === 0 && d.status === 'proposed') continue;

      // Apply filters
      if (query) {
        if (query.author && d.author !== query.author) continue;
        if (query.project && d.project !== query.project) continue;
        if (query.phase !== undefined && d.phase !== query.phase) continue;
        if (query.escalated !== undefined && (d.status === 'escalated') !== query.escalated) continue;
        if (query.minRounds !== undefined && d.challenge_rounds < query.minRounds) continue;
        if (query.challenger) {
          const hasChallenger = d.challenge_history.some(ch => ch.challenger === query.challenger);
          if (!hasChallenger) continue;
        }
        if (query.after && d.timestamp < query.after) continue;
        if (query.before && d.timestamp > query.before) continue;
        if (query.hasCounterProposals !== undefined) {
          const cps = this.counterProposals.get(d.id) ?? [];
          if (query.hasCounterProposals && cps.length === 0) continue;
          if (!query.hasCounterProposals && cps.length > 0) continue;
        }
      }

      const cps = this.counterProposals.get(d.id) ?? [];
      const isResolved = d.status === 'accepted' || d.status === 'escalated' || d.status === 'superseded' || d.status === 'rejected';
      const resolutionMs = isResolved && d.challenge_history.length > 0
        ? new Date(d.challenge_history[d.challenge_history.length - 1].timestamp).getTime() -
          new Date(d.timestamp).getTime()
        : null;

      entries.push({
        decision_id: d.id,
        decision_summary: d.summary,
        decision_author: d.author,
        project: d.project,
        phase: d.phase,
        current_status: d.status,
        total_rounds: d.challenge_rounds,
        challenge_history: [...d.challenge_history],
        counter_proposals: [...cps],
        escalated: d.status === 'escalated',
        resolution_time_ms: resolutionMs,
      });
    }

    // Sort newest first
    entries.sort((a, b) => {
      const aTime = store.get(a.decision_id)?.timestamp ?? '';
      const bTime = store.get(b.decision_id)?.timestamp ?? '';
      return bTime.localeCompare(aTime);
    });

    return entries;
  }

  /**
   * Export challenge history as a JSON string.
   *
   * @param store The decision store.
   * @param query Optional filters.
   * @returns Pretty-printed JSON string of audit entries.
   */
  exportJSON(store: DecisionStore, query?: ChallengeHistoryQuery): string {
    const entries = this.getAuditTrail(store, query);
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Export challenge history as a markdown audit report.
   *
   * Produces a human-readable report suitable for governance review,
   * including challenge rounds, counter-proposals, and resolution status.
   *
   * @param store The decision store.
   * @param query Optional filters.
   * @returns Markdown-formatted audit report.
   */
  exportMarkdown(store: DecisionStore, query?: ChallengeHistoryQuery): string {
    const entries = this.getAuditTrail(store, query);
    const lines: string[] = [
      '# Challenge Protocol Audit Trail',
      '',
      `> Generated: ${new Date().toISOString()}`,
      `> Total entries: ${entries.length}`,
      '',
    ];

    if (entries.length === 0) {
      lines.push('_No challenge activity found matching the query._');
      return lines.join('\n');
    }

    // Summary statistics
    const escalated = entries.filter(e => e.escalated).length;
    const withCPs = entries.filter(e => e.counter_proposals.length > 0).length;
    const avgRounds = entries.reduce((s, e) => s + e.total_rounds, 0) / entries.length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total challenged decisions:** ${entries.length}`);
    lines.push(`- **Escalated:** ${escalated}`);
    lines.push(`- **With counter-proposals:** ${withCPs}`);
    lines.push(`- **Average rounds:** ${avgRounds.toFixed(1)}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const entry of entries) {
      lines.push(`## ${entry.decision_id}: ${entry.decision_summary}`);
      lines.push('');
      lines.push(`- **Author:** ${entry.decision_author}`);
      lines.push(`- **Project:** ${entry.project} (Phase ${entry.phase})`);
      lines.push(`- **Status:** ${entry.current_status}`);
      lines.push(`- **Challenge rounds:** ${entry.total_rounds}`);
      if (entry.escalated) lines.push('- **⚠️ ESCALATED**');
      if (entry.resolution_time_ms !== null) {
        const hours = (entry.resolution_time_ms / 3600000).toFixed(1);
        lines.push(`- **Resolution time:** ${hours}h`);
      }
      lines.push('');

      // Challenge rounds
      if (entry.challenge_history.length > 0) {
        lines.push('### Challenge History');
        lines.push('');
        for (const ch of entry.challenge_history) {
          const icon = ch.action === 'accepted' ? '✅' : '🔴';
          lines.push(`${icon} **Round ${ch.round}** — ${ch.action} by \`${ch.challenger}\``);
          lines.push(`  - ${ch.rationale}`);
          if (ch.counter_proposal) {
            lines.push(`  - _Counter-proposal:_ ${ch.counter_proposal}`);
          }
          lines.push(`  - _${ch.timestamp}_`);
          lines.push('');
        }
      }

      // Counter-proposals
      if (entry.counter_proposals.length > 0) {
        lines.push('### Counter-Proposals');
        lines.push('');
        for (const cp of entry.counter_proposals) {
          const statusIcon =
            cp.status === 'accepted' ? '✅' :
            cp.status === 'rejected' ? '❌' :
            cp.status === 'withdrawn' ? '↩️' :
            cp.status === 'superseded' ? '⏭️' : '⏳';
          lines.push(`#### ${cp.id} ${statusIcon} \`${cp.status}\``);
          lines.push('');
          lines.push(`- **Proposed by:** ${cp.proposed_by}`);
          lines.push(`- **Summary:** ${cp.summary}`);
          lines.push(`- **Rationale:** ${cp.rationale}`);
          if (cp.impact.length > 0) {
            lines.push('- **Impact:**');
            for (const imp of cp.impact) lines.push(`  - ${imp}`);
          }
          if (cp.resolution_notes) {
            lines.push(`- **Resolution:** ${cp.resolution_notes}`);
          }
          lines.push('');
        }
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  // ─── Config Accessors ─────────────────────────────────────────────

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
