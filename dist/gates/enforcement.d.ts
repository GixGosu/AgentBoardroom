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
import type { BoardConfig, GateConfig, GateVerdict, GateHistoryQuery, PhaseState, PhaseDefinition } from '../core/types.js';
export declare class GateEnforcement {
    private gates;
    private stateDir;
    private phases;
    /**
     * Create a GateEnforcement engine.
     * @param boardConfig - Board configuration with gate definitions
     * @param stateDir - Directory for persisting phase and gate state
     * @param phases - Ordered phase definitions (optional; defaults to standard software dev phases)
     */
    constructor(boardConfig: BoardConfig, stateDir: string, phases?: PhaseDefinition[]);
    /**
     * Get the gate definition for a specific phase transition.
     */
    getGate(transitionName: string): GateConfig | undefined;
    /**
     * Get the phase definition by phase number.
     */
    getPhaseDefinition(phase: number): PhaseDefinition | undefined;
    /**
     * Check if a phase transition is allowed.
     * Returns the blocking reasons if not.
     *
     * CONDITIONAL verdicts are treated as passing — they allow advancement
     * but their conditions are tracked for follow-up.
     */
    canAdvance(project: string, fromPhase: number, toPhase: number, transitionName: string): {
        allowed: boolean;
        blockers: string[];
        conditional: boolean;
        conditions: string[];
    };
    /**
     * Record a gate verdict for a project phase.
     * Verdict is stored in both the phase state and the global history.
     */
    recordVerdict(verdict: GateVerdict): void;
    /**
     * Attempt to advance a phase. Returns success or the blockers.
     * This is the STRUCTURAL enforcement — the code path that prevents advancement.
     *
     * For CONDITIONAL passes, the phase advances but status reflects the conditions.
     */
    advancePhase(project: string, transitionName: string, fromPhase: number, toPhase: number, phaseName: string): {
        advanced: boolean;
        blockers: string[];
        conditional: boolean;
        conditions: string[];
    };
    /**
     * Revert a phase after a FAIL verdict (structural enforcement).
     */
    revertPhase(project: string): PhaseState | null;
    /**
     * Query gate verdict history across all projects.
     * Returns verdicts matching ALL provided query criteria.
     *
     * @param query - Filter criteria (all optional, conjunctive)
     * @returns Array of matching GateVerdict records, sorted by timestamp descending
     */
    queryHistory(query: GateHistoryQuery): GateVerdict[];
    /**
     * Get the current phase state for a project.
     */
    getPhaseState(project: string): PhaseState | null;
    private findVerdict;
    private findGateForPhase;
    private loadPhaseState;
    private createPhaseState;
    private savePhaseState;
    /** Global history file for cross-project queries. */
    private historyPath;
    private loadHistory;
    private appendToHistory;
}
//# sourceMappingURL=enforcement.d.ts.map