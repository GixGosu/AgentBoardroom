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
import type { DecisionRecord, BoardConfig, ChallengeRound } from '../core/types.js';
import type { DecisionStore } from '../decisions/store.js';
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
export type CounterProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'superseded';
export interface ChallengeResult {
    decision: DecisionRecord;
    outcome: 'accepted' | 'challenged' | 'escalated';
    round: number;
    requires_revision: boolean;
    requires_escalation: boolean;
    /** Counter-proposal created during this challenge (if any) */
    counter_proposal?: CounterProposal;
}
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
export declare class ChallengeProtocol {
    private config;
    private challengeMap;
    /** Structured counter-proposals indexed by decision ID */
    private counterProposals;
    constructor(boardConfig: BoardConfig);
    /**
     * Get the designated challenger(s) for a given role's decisions.
     */
    getChallengers(authorRole: string): string[];
    /**
     * Check if a decision requires challenge before execution.
     */
    requiresChallenge(decision: DecisionRecord): boolean;
    /**
     * Check if a decision can proceed to execution.
     * Returns false if challenge is required but not complete.
     * This is structural enforcement — there is no bypass.
     */
    canExecute(decision: DecisionRecord): boolean;
    /**
     * Get the remaining challenge rounds before auto-escalation.
     *
     * @param decision The decision to check.
     * @returns Remaining rounds, or Infinity if auto-escalation is disabled.
     */
    remainingRounds(decision: DecisionRecord): number;
    /**
     * Check whether a decision has exceeded the maximum challenge rounds.
     *
     * @param decision The decision to check.
     * @returns true if the decision is at or beyond the round limit.
     */
    isAtRoundLimit(decision: DecisionRecord): boolean;
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
    processChallenge(store: DecisionStore, decisionId: string, challenger: string, action: 'accept' | 'challenge', rationale: string, counterProposal?: string, structuredCounterProposal?: {
        summary: string;
        rationale: string;
        impact: string[];
    }): ChallengeResult;
    /**
     * Create a structured counter-proposal.
     * @internal
     */
    private _createCounterProposal;
    /**
     * Supersede all pending counter-proposals for a decision.
     * @internal
     */
    private _supersedePendingCounterProposals;
    /**
     * Resolve a counter-proposal by ID.
     *
     * @param counterProposalId The counter-proposal ID (e.g., "CP-DEC-0001-1").
     * @param status The resolution status.
     * @param notes Optional resolution notes.
     * @returns The updated counter-proposal.
     * @throws If the counter-proposal is not found or already resolved.
     */
    resolveCounterProposal(counterProposalId: string, status: 'accepted' | 'rejected' | 'withdrawn', notes?: string): CounterProposal;
    /**
     * Get all counter-proposals for a decision.
     *
     * @param decisionId The decision ID.
     * @returns Array of counter-proposals (empty if none).
     */
    getCounterProposals(decisionId: string): readonly CounterProposal[];
    /**
     * Get a single counter-proposal by ID.
     *
     * @param counterProposalId The counter-proposal ID.
     * @returns The counter-proposal, or undefined if not found.
     */
    getCounterProposal(counterProposalId: string): CounterProposal | undefined;
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
    getAuditTrail(store: DecisionStore, query?: ChallengeHistoryQuery): ChallengeAuditEntry[];
    /**
     * Export challenge history as a JSON string.
     *
     * @param store The decision store.
     * @param query Optional filters.
     * @returns Pretty-printed JSON string of audit entries.
     */
    exportJSON(store: DecisionStore, query?: ChallengeHistoryQuery): string;
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
    exportMarkdown(store: DecisionStore, query?: ChallengeHistoryQuery): string;
    /**
     * Get the maximum number of challenge rounds before escalation.
     */
    get maxRounds(): number;
    /**
     * Check if auto-escalation is enabled.
     */
    get autoEscalation(): boolean;
}
//# sourceMappingURL=protocol.d.ts.map