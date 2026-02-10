/**
 * AgentBoardroom — Gate Enforcement Engine
 *
 * Structural gate enforcement for phase transitions.
 * A FAIL verdict physically blocks phase advancement — not a suggestion, not honor-system.
 * This is the line between "review" and "governance."
 */
import type { BoardConfig, GateConfig, GateVerdict, PhaseState } from '../core/types.js';
export declare class GateEnforcement {
    private gates;
    private stateDir;
    constructor(boardConfig: BoardConfig, stateDir: string);
    /**
     * Get the gate definition for a specific phase transition.
     */
    getGate(transitionName: string): GateConfig | undefined;
    /**
     * Check if a phase transition is allowed.
     * Returns the blocking reasons if not.
     */
    canAdvance(project: string, fromPhase: number, toPhase: number, transitionName: string): {
        allowed: boolean;
        blockers: string[];
    };
    /**
     * Record a gate verdict for a project phase.
     */
    recordVerdict(verdict: GateVerdict): void;
    /**
     * Attempt to advance a phase. Returns success or the blockers.
     * This is the STRUCTURAL enforcement — the code path that prevents advancement.
     */
    advancePhase(project: string, transitionName: string, fromPhase: number, toPhase: number, phaseName: string): {
        advanced: boolean;
        blockers: string[];
    };
    /**
     * Revert a phase after a FAIL verdict (structural enforcement).
     */
    revertPhase(project: string): PhaseState | null;
    private findVerdict;
    private findGateForPhase;
    private loadPhaseState;
    private createPhaseState;
    private savePhaseState;
}
//# sourceMappingURL=enforcement.d.ts.map