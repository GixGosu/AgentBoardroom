/**
 * AgentBoardroom — Decision Record Store
 *
 * Append-only storage and query engine for Decision Records.
 * Decisions are first-class objects with lineage, not messages in a log.
 */
import type { DecisionRecord, DecisionStatus, DecisionType } from '../core/types.js';
export declare class DecisionStore {
    private filePath;
    private decisions;
    private nextId;
    constructor(stateDir: string);
    private load;
    private save;
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
    }): DecisionRecord;
    /**
     * Record a challenge round on an existing decision.
     */
    challenge(decisionId: string, challenger: string, rationale: string, counterProposal?: string): DecisionRecord;
    /**
     * Accept a proposed or challenged decision.
     */
    accept(decisionId: string, acceptedBy: string, rationale?: string): DecisionRecord;
    /**
     * Escalate a decision to the Board Chair.
     */
    escalate(decisionId: string): DecisionRecord;
    /**
     * Supersede a decision with a new one.
     */
    supersede(decisionId: string, newDecisionId: string): DecisionRecord;
    /**
     * Get a decision by ID.
     */
    get(decisionId: string): DecisionRecord | undefined;
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
    }): DecisionRecord[];
    /**
     * Get the decision chain leading to a specific decision (follow supersedes links).
     */
    chain(decisionId: string): DecisionRecord[];
    /**
     * Get all decisions (read-only snapshot).
     */
    all(): readonly DecisionRecord[];
    /**
     * Get count of decisions.
     */
    count(): number;
}
//# sourceMappingURL=store.d.ts.map