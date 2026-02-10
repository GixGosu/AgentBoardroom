/**
 * AgentBoardroom — Decision Record Store
 *
 * Append-only storage and query engine for Decision Records.
 * Decisions are first-class objects with lineage, not messages in a log.
 *
 * Phase 2: Extended with full graph lineage tracking, advanced query engine,
 * and export capabilities (JSON + markdown audit trail).
 */
import type { DecisionRecord, DecisionStatus, DecisionType } from '../core/types.js';
/** Filter options for querying decisions. */
export interface DecisionQueryFilters {
    author?: string;
    type?: DecisionType;
    status?: DecisionStatus;
    project?: string;
    phase?: number;
    challenged?: boolean;
    /** Filter to decisions that have been challenged at least once */
    hasChallenge?: boolean;
    /** Filter by dependency — returns decisions that depend on the given ID */
    dependsOn?: string;
    /** Filter by supersedes — returns decisions that supersede the given ID */
    supersedesId?: string;
    /** Date range filter (inclusive, ISO strings) */
    after?: string;
    before?: string;
}
/** Export format options */
export type ExportFormat = 'json' | 'markdown';
export declare class DecisionStore {
    private filePath;
    private decisions;
    private nextId;
    /** Forward index: decision ID → IDs of decisions that supersede it */
    private supersededByIndex;
    /** Forward index: decision ID → IDs of decisions that depend on it */
    private dependedOnByIndex;
    constructor(stateDir: string);
    private load;
    private save;
    /** Rebuild forward lineage indices from current decisions. */
    private rebuildForwardIndices;
    /** Update forward indices for a single new decision (avoids full rebuild). */
    private indexDecision;
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
        dependencies?: string[];
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
     *
     * Supports filtering by author, type, status, project, phase, challenge state,
     * dependency relationships, supersession relationships, and date ranges.
     */
    query(filters: DecisionQueryFilters): DecisionRecord[];
    /**
     * Get the decision chain leading to a specific decision (follow supersedes links backward).
     */
    chain(decisionId: string): DecisionRecord[];
    /**
     * Get the forward lineage — all decisions that supersede the given decision.
     *
     * Traverses the supersededBy index to find the full forward chain.
     */
    forwardChain(decisionId: string): DecisionRecord[];
    /**
     * Get all decisions that directly depend on the given decision ID (forward dependency lookup).
     */
    dependents(decisionId: string): DecisionRecord[];
    /**
     * Get the full dependency graph for a decision (all transitive dependencies, backward).
     */
    dependencyGraph(decisionId: string): DecisionRecord[];
    /**
     * Export decisions as JSON string.
     *
     * @param filters Optional filters to narrow export scope.
     * @returns Pretty-printed JSON string of matching decisions.
     */
    exportJSON(filters?: DecisionQueryFilters): string;
    /**
     * Export decisions as a markdown audit trail.
     *
     * @param filters Optional filters to narrow export scope.
     * @returns Markdown-formatted string with decision details and challenge history.
     */
    exportMarkdown(filters?: DecisionQueryFilters): string;
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