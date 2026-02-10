/**
 * AgentBoardroom — Challenge Protocol Engine
 *
 * Manages the structured challenge process between board roles.
 * Enforces round limits and auto-escalation.
 * This is the difference between "suggested" and "enforced" governance.
 */
import type { DecisionRecord, BoardConfig } from '../core/types.js';
import type { DecisionStore } from '../decisions/store.js';
export interface ChallengeResult {
    decision: DecisionRecord;
    outcome: 'accepted' | 'challenged' | 'escalated';
    round: number;
    requires_revision: boolean;
    requires_escalation: boolean;
}
export declare class ChallengeProtocol {
    private config;
    private challengeMap;
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
     */
    canExecute(decision: DecisionRecord): boolean;
    /**
     * Process a challenge action on a decision.
     */
    processChallenge(store: DecisionStore, decisionId: string, challenger: string, action: 'accept' | 'challenge', rationale: string, counterProposal?: string): ChallengeResult;
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