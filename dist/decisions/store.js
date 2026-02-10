"use strict";
/**
 * AgentBoardroom — Decision Record Store
 *
 * Append-only storage and query engine for Decision Records.
 * Decisions are first-class objects with lineage, not messages in a log.
 *
 * Phase 2: Extended with full graph lineage tracking, advanced query engine,
 * and export capabilities (JSON + markdown audit trail).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class DecisionStore {
    filePath;
    decisions = [];
    nextId = 1;
    /** Forward index: decision ID → IDs of decisions that supersede it */
    supersededByIndex = new Map();
    /** Forward index: decision ID → IDs of decisions that depend on it */
    dependedOnByIndex = new Map();
    constructor(stateDir) {
        this.filePath = (0, node_path_1.resolve)(stateDir, 'decisions.json');
        this.load();
    }
    load() {
        if ((0, node_fs_1.existsSync)(this.filePath)) {
            const raw = (0, node_fs_1.readFileSync)(this.filePath, 'utf-8');
            this.decisions = JSON.parse(raw);
            // Migrate: ensure all records have dependencies array
            for (const d of this.decisions) {
                if (!d.dependencies)
                    d.dependencies = [];
            }
            // Set nextId based on highest existing ID
            const maxId = this.decisions.reduce((max, d) => {
                const num = parseInt(d.id.replace('DEC-', ''), 10);
                return num > max ? num : max;
            }, 0);
            this.nextId = maxId + 1;
        }
        this.rebuildForwardIndices();
    }
    save() {
        const dir = (0, node_path_1.dirname)(this.filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        (0, node_fs_1.writeFileSync)(this.filePath, JSON.stringify(this.decisions, null, 2));
    }
    /** Rebuild forward lineage indices from current decisions. */
    rebuildForwardIndices() {
        this.supersededByIndex.clear();
        this.dependedOnByIndex.clear();
        for (const d of this.decisions) {
            if (d.supersedes) {
                const arr = this.supersededByIndex.get(d.supersedes) ?? [];
                arr.push(d.id);
                this.supersededByIndex.set(d.supersedes, arr);
            }
            for (const dep of d.dependencies ?? []) {
                const arr = this.dependedOnByIndex.get(dep) ?? [];
                arr.push(d.id);
                this.dependedOnByIndex.set(dep, arr);
            }
        }
    }
    /** Update forward indices for a single new decision (avoids full rebuild). */
    indexDecision(d) {
        if (d.supersedes) {
            const arr = this.supersededByIndex.get(d.supersedes) ?? [];
            arr.push(d.id);
            this.supersededByIndex.set(d.supersedes, arr);
        }
        for (const dep of d.dependencies ?? []) {
            const arr = this.dependedOnByIndex.get(dep) ?? [];
            arr.push(d.id);
            this.dependedOnByIndex.set(dep, arr);
        }
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
            dependencies: params.dependencies ?? [],
            phase: params.phase,
            project: params.project,
        };
        this.decisions.push(record);
        this.indexDecision(record);
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
     *
     * Supports filtering by author, type, status, project, phase, challenge state,
     * dependency relationships, supersession relationships, and date ranges.
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
            if (filters.dependsOn && !(d.dependencies ?? []).includes(filters.dependsOn))
                return false;
            if (filters.supersedesId && d.supersedes !== filters.supersedesId)
                return false;
            if (filters.after && d.timestamp < filters.after)
                return false;
            if (filters.before && d.timestamp > filters.before)
                return false;
            return true;
        });
    }
    /**
     * Get the decision chain leading to a specific decision (follow supersedes links backward).
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
     * Get the forward lineage — all decisions that supersede the given decision.
     *
     * Traverses the supersededBy index to find the full forward chain.
     */
    forwardChain(decisionId) {
        const result = [];
        const queue = [decisionId];
        const visited = new Set();
        while (queue.length > 0) {
            const id = queue.shift();
            if (visited.has(id))
                continue;
            visited.add(id);
            const successors = this.supersededByIndex.get(id) ?? [];
            for (const sId of successors) {
                const dec = this.get(sId);
                if (dec) {
                    result.push(dec);
                    queue.push(sId);
                }
            }
        }
        return result;
    }
    /**
     * Get all decisions that directly depend on the given decision ID (forward dependency lookup).
     */
    dependents(decisionId) {
        const ids = this.dependedOnByIndex.get(decisionId) ?? [];
        return ids.map(id => this.get(id)).filter((d) => d !== undefined);
    }
    /**
     * Get the full dependency graph for a decision (all transitive dependencies, backward).
     */
    dependencyGraph(decisionId) {
        const result = [];
        const visited = new Set();
        const walk = (id) => {
            const dec = this.get(id);
            if (!dec || visited.has(id))
                return;
            visited.add(id);
            for (const dep of dec.dependencies ?? []) {
                walk(dep);
            }
            result.push(dec);
        };
        walk(decisionId);
        // Remove the root decision itself from dependencies list
        return result.filter(d => d.id !== decisionId);
    }
    /**
     * Export decisions as JSON string.
     *
     * @param filters Optional filters to narrow export scope.
     * @returns Pretty-printed JSON string of matching decisions.
     */
    exportJSON(filters) {
        const data = filters ? this.query(filters) : [...this.decisions];
        return JSON.stringify(data, null, 2);
    }
    /**
     * Export decisions as a markdown audit trail.
     *
     * @param filters Optional filters to narrow export scope.
     * @returns Markdown-formatted string with decision details and challenge history.
     */
    exportMarkdown(filters) {
        const data = filters ? this.query(filters) : [...this.decisions];
        const lines = ['# Decision Audit Trail', ''];
        for (const d of data) {
            lines.push(`## ${d.id}: ${d.summary}`);
            lines.push('');
            lines.push(`- **Author:** ${d.author}`);
            lines.push(`- **Type:** ${d.type}`);
            lines.push(`- **Status:** ${d.status}`);
            lines.push(`- **Project:** ${d.project}`);
            lines.push(`- **Phase:** ${d.phase}`);
            lines.push(`- **Timestamp:** ${d.timestamp}`);
            if (d.supersedes)
                lines.push(`- **Supersedes:** ${d.supersedes}`);
            if (d.dependencies.length > 0)
                lines.push(`- **Dependencies:** ${d.dependencies.join(', ')}`);
            lines.push('');
            lines.push(`**Rationale:** ${d.rationale}`);
            lines.push('');
            if (d.evidence.length > 0) {
                lines.push('**Evidence:**');
                for (const e of d.evidence)
                    lines.push(`- ${e}`);
                lines.push('');
            }
            if (d.challenge_history.length > 0) {
                lines.push('**Challenge History:**');
                lines.push('');
                for (const ch of d.challenge_history) {
                    lines.push(`### Round ${ch.round} — ${ch.action} by ${ch.challenger}`);
                    lines.push('');
                    lines.push(`- ${ch.rationale}`);
                    if (ch.counter_proposal)
                        lines.push(`- Counter-proposal: ${ch.counter_proposal}`);
                    lines.push(`- _${ch.timestamp}_`);
                    lines.push('');
                }
            }
            lines.push('---');
            lines.push('');
        }
        return lines.join('\n');
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