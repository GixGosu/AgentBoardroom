"use strict";
/**
 * AgentBoardroom — Gate Enforcement Engine
 *
 * Structural gate enforcement for phase transitions.
 * A FAIL verdict physically blocks phase advancement — not a suggestion, not honor-system.
 * This is the line between "review" and "governance."
 *
 * Key features:
 * - CONDITIONAL verdicts allow advancement with tracked conditions/warnings
 * - Gate history is queryable by project, phase, verdict type, issuer, and time range
 * - Phase state machine enforces structural gates (code-level blocking)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateEnforcement = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class GateEnforcement {
    gates;
    stateDir;
    phases;
    /**
     * Create a GateEnforcement engine.
     * @param boardConfig - Board configuration with gate definitions
     * @param stateDir - Directory for persisting phase and gate state
     * @param phases - Ordered phase definitions (optional; defaults to standard software dev phases)
     */
    constructor(boardConfig, stateDir, phases) {
        this.gates = boardConfig.gates;
        this.stateDir = stateDir;
        this.phases = phases ?? [
            { phase: 0, name: 'planning', exit_gate: 'planning_to_architecture' },
            { phase: 1, name: 'architecture', exit_gate: 'architecture_to_implementation' },
            { phase: 2, name: 'implementation', exit_gate: 'implementation_to_integration' },
            { phase: 3, name: 'integration', exit_gate: 'integration_to_delivery' },
            { phase: 4, name: 'delivery' },
        ];
    }
    /**
     * Get the gate definition for a specific phase transition.
     */
    getGate(transitionName) {
        return this.gates[transitionName];
    }
    /**
     * Get the phase definition by phase number.
     */
    getPhaseDefinition(phase) {
        return this.phases.find(p => p.phase === phase);
    }
    /**
     * Check if a phase transition is allowed.
     * Returns the blocking reasons if not.
     *
     * CONDITIONAL verdicts are treated as passing — they allow advancement
     * but their conditions are tracked for follow-up.
     */
    canAdvance(project, fromPhase, toPhase, transitionName) {
        const gate = this.gates[transitionName];
        if (!gate) {
            // No gate defined for this transition — allowed by default
            return { allowed: true, blockers: [], conditional: false, conditions: [] };
        }
        const phaseState = this.loadPhaseState(project);
        if (!phaseState) {
            return { allowed: false, blockers: ['Phase state not found'], conditional: false, conditions: [] };
        }
        // Structural enforcement: if phase is gated_fail, block until new verdicts
        if (phaseState.status === 'gated_fail' && phaseState.current_phase === fromPhase) {
            // Check if new passing verdicts exist since the fail
            // (fall through to normal checking logic)
        }
        const blockers = [];
        let hasConditional = false;
        const allConditions = [];
        for (const requiredRole of gate.required) {
            const verdict = this.findVerdict(phaseState, requiredRole, fromPhase);
            if (!verdict) {
                blockers.push(`Missing verdict from ${requiredRole}`);
            }
            else if (verdict.verdict === 'FAIL') {
                blockers.push(`${requiredRole} issued FAIL: ${verdict.blocking_issues.join('; ') || 'no details'}`);
            }
            else if (verdict.verdict === 'CONDITIONAL') {
                // Check if CONDITIONAL verdict has expired
                if (verdict.expires_at && new Date(verdict.expires_at) < new Date()) {
                    blockers.push(`${requiredRole} CONDITIONAL verdict expired at ${verdict.expires_at}`);
                }
                else {
                    hasConditional = true;
                    allConditions.push(...(verdict.conditions ?? []), ...verdict.warnings);
                }
            }
        }
        return {
            allowed: blockers.length === 0,
            blockers,
            conditional: hasConditional && blockers.length === 0,
            conditions: allConditions,
        };
    }
    /**
     * Record a gate verdict for a project phase.
     * Verdict is stored in both the phase state and the global history.
     */
    recordVerdict(verdict) {
        const phaseState = this.loadPhaseState(verdict.project) ?? this.createPhaseState(verdict.project);
        phaseState.gate_verdicts.push(verdict);
        phaseState.updated_at = new Date().toISOString();
        // If FAIL and gate is structural, set phase status to gated_fail
        const transitionGate = this.findGateForPhase(verdict.phase);
        if (verdict.verdict === 'FAIL' && transitionGate?.verdict_type === 'structural') {
            phaseState.status = 'gated_fail';
        }
        else if (verdict.verdict === 'CONDITIONAL') {
            phaseState.status = 'gated_conditional';
        }
        this.savePhaseState(verdict.project, phaseState);
        // Also store in global history
        this.appendToHistory(verdict);
    }
    /**
     * Attempt to advance a phase. Returns success or the blockers.
     * This is the STRUCTURAL enforcement — the code path that prevents advancement.
     *
     * For CONDITIONAL passes, the phase advances but status reflects the conditions.
     */
    advancePhase(project, transitionName, fromPhase, toPhase, phaseName) {
        // Structural check: validate phase sequence
        const fromDef = this.getPhaseDefinition(fromPhase);
        if (fromDef && fromDef.exit_gate && fromDef.exit_gate !== transitionName) {
            return {
                advanced: false,
                blockers: [`Invalid transition: phase ${fromPhase} requires gate '${fromDef.exit_gate}', got '${transitionName}'`],
                conditional: false,
                conditions: [],
            };
        }
        // Structural check: no skipping phases
        if (toPhase !== fromPhase + 1) {
            return {
                advanced: false,
                blockers: [`Cannot skip phases: attempted ${fromPhase} → ${toPhase}`],
                conditional: false,
                conditions: [],
            };
        }
        const check = this.canAdvance(project, fromPhase, toPhase, transitionName);
        if (!check.allowed) {
            return { advanced: false, blockers: check.blockers, conditional: false, conditions: [] };
        }
        // Advance the phase
        const phaseState = this.loadPhaseState(project) ?? this.createPhaseState(project);
        phaseState.current_phase = toPhase;
        phaseState.phase_name = phaseName;
        phaseState.status = check.conditional ? 'gated_conditional' : 'planning';
        phaseState.updated_at = new Date().toISOString();
        this.savePhaseState(project, phaseState);
        return { advanced: true, blockers: [], conditional: check.conditional, conditions: check.conditions };
    }
    /**
     * Revert a phase after a FAIL verdict (structural enforcement).
     */
    revertPhase(project) {
        const phaseState = this.loadPhaseState(project);
        if (!phaseState)
            return null;
        phaseState.status = 'gated_fail';
        phaseState.updated_at = new Date().toISOString();
        this.savePhaseState(project, phaseState);
        return phaseState;
    }
    /**
     * Query gate verdict history across all projects.
     * Returns verdicts matching ALL provided query criteria.
     *
     * @param query - Filter criteria (all optional, conjunctive)
     * @returns Array of matching GateVerdict records, sorted by timestamp descending
     */
    queryHistory(query) {
        const history = this.loadHistory();
        let results = history.verdicts;
        if (query.project) {
            results = results.filter(v => v.project === query.project);
        }
        if (query.phase !== undefined) {
            results = results.filter(v => v.phase === query.phase);
        }
        if (query.verdict) {
            results = results.filter(v => v.verdict === query.verdict);
        }
        if (query.issued_by) {
            results = results.filter(v => v.issued_by === query.issued_by);
        }
        if (query.gate_id) {
            results = results.filter(v => v.gate_id === query.gate_id);
        }
        if (query.after) {
            const afterDate = new Date(query.after).getTime();
            results = results.filter(v => new Date(v.timestamp).getTime() >= afterDate);
        }
        if (query.before) {
            const beforeDate = new Date(query.before).getTime();
            results = results.filter(v => new Date(v.timestamp).getTime() <= beforeDate);
        }
        // Sort by timestamp descending (most recent first)
        return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    /**
     * Get the current phase state for a project.
     */
    getPhaseState(project) {
        return this.loadPhaseState(project);
    }
    // ─── Private helpers ────────────────────────────────────────────
    findVerdict(state, role, phase) {
        // Find the most recent verdict from this role for this phase
        return [...state.gate_verdicts]
            .reverse()
            .find(v => v.issued_by === role && v.phase === phase);
    }
    findGateForPhase(phase) {
        const phaseDef = this.phases.find(p => p.phase === phase);
        if (phaseDef?.exit_gate) {
            return this.gates[phaseDef.exit_gate];
        }
        // Fallback: simple heuristic
        const gateNames = Object.keys(this.gates);
        return this.gates[gateNames[phase]] ?? undefined;
    }
    loadPhaseState(project) {
        const path = (0, node_path_1.resolve)(this.stateDir, project, 'phase.json');
        if (!(0, node_fs_1.existsSync)(path))
            return null;
        return JSON.parse((0, node_fs_1.readFileSync)(path, 'utf-8'));
    }
    createPhaseState(project) {
        return {
            project,
            current_phase: 0,
            phase_name: 'planning',
            status: 'planning',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            gate_verdicts: [],
        };
    }
    savePhaseState(project, state) {
        const dir = (0, node_path_1.resolve)(this.stateDir, project);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.resolve)(dir, 'phase.json'), JSON.stringify(state, null, 2));
    }
    /** Global history file for cross-project queries. */
    historyPath() {
        return (0, node_path_1.resolve)(this.stateDir, '_gate_history.json');
    }
    loadHistory() {
        const path = this.historyPath();
        if (!(0, node_fs_1.existsSync)(path))
            return { verdicts: [] };
        return JSON.parse((0, node_fs_1.readFileSync)(path, 'utf-8'));
    }
    appendToHistory(verdict) {
        const history = this.loadHistory();
        history.verdicts.push(verdict);
        if (!(0, node_fs_1.existsSync)(this.stateDir))
            (0, node_fs_1.mkdirSync)(this.stateDir, { recursive: true });
        (0, node_fs_1.writeFileSync)(this.historyPath(), JSON.stringify(history, null, 2));
    }
}
exports.GateEnforcement = GateEnforcement;
//# sourceMappingURL=enforcement.js.map