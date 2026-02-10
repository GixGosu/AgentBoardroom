"use strict";
/**
 * AgentBoardroom — Decision Record Store
 *
 * Append-only storage and query engine for Decision Records.
 * Decisions are first-class objects with lineage, not messages in a log.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class DecisionStore {
    filePath;
    decisions = [];
    nextId = 1;
    constructor(stateDir) {
        this.filePath = (0, node_path_1.resolve)(stateDir, 'decisions.json');
        this.load();
    }
    load() {
        if ((0, node_fs_1.existsSync)(this.filePath)) {
            const raw = (0, node_fs_1.readFileSync)(this.filePath, 'utf-8');
            this.decisions = JSON.parse(raw);
            // Set nextId based on highest existing ID
            const maxId = this.decisions.reduce((max, d) => {
                const num = parseInt(d.id.replace('DEC-', ''), 10);
                return num > max ? num : max;
            }, 0);
            this.nextId = maxId + 1;
        }
    }
    save() {
        const dir = (0, node_path_1.dirname)(this.filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        (0, node_fs_1.writeFileSync)(this.filePath, JSON.stringify(this.decisions, null, 2));
    }
    /**
     * Create a new decision record with status 'proposed'.
     */
    propose(params) {
        const record = {
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
    challenge(decisionId, challenger, rationale, counterProposal) {
        const decision = this.get(decisionId);
        if (!decision)
            throw new Error(`Decision ${decisionId} not found`);
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
    accept(decisionId, acceptedBy, rationale) {
        const decision = this.get(decisionId);
        if (!decision)
            throw new Error(`Decision ${decisionId} not found`);
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
    escalate(decisionId) {
        const decision = this.get(decisionId);
        if (!decision)
            throw new Error(`Decision ${decisionId} not found`);
        decision.status = 'escalated';
        this.save();
        return decision;
    }
    /**
     * Supersede a decision with a new one.
     */
    supersede(decisionId, newDecisionId) {
        const decision = this.get(decisionId);
        if (!decision)
            throw new Error(`Decision ${decisionId} not found`);
        decision.status = 'superseded';
        this.save();
        return decision;
    }
    /**
     * Get a decision by ID.
     */
    get(decisionId) {
        return this.decisions.find(d => d.id === decisionId);
    }
    /**
     * Query decisions with filters.
     */
    query(filters) {
        return this.decisions.filter(d => {
            if (filters.author && d.author !== filters.author)
                return false;
            if (filters.type && d.type !== filters.type)
                return false;
            if (filters.status && d.status !== filters.status)
                return false;
            if (filters.project && d.project !== filters.project)
                return false;
            if (filters.phase !== undefined && d.phase !== filters.phase)
                return false;
            if (filters.challenged !== undefined) {
                const wasChallenged = d.challenge_rounds > 0;
                if (filters.challenged !== wasChallenged)
                    return false;
            }
            return true;
        });
    }
    /**
     * Get the decision chain leading to a specific decision (follow supersedes links).
     */
    chain(decisionId) {
        const chain = [];
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
    all() {
        return this.decisions;
    }
    /**
     * Get count of decisions.
     */
    count() {
        return this.decisions.length;
    }
}
exports.DecisionStore = DecisionStore;
//# sourceMappingURL=store.js.map