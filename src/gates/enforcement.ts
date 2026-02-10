/**
 * AgentBoardroom — Gate Enforcement Engine
 *
 * Structural gate enforcement for phase transitions.
 * A FAIL verdict physically blocks phase advancement — not a suggestion, not honor-system.
 * This is the line between "review" and "governance."
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { BoardConfig, GateConfig, GateVerdict, PhaseState, PhaseStatus } from '../core/types.js';

export class GateEnforcement {
  private gates: Record<string, GateConfig>;
  private stateDir: string;

  constructor(boardConfig: BoardConfig, stateDir: string) {
    this.gates = boardConfig.gates;
    this.stateDir = stateDir;
  }

  /**
   * Get the gate definition for a specific phase transition.
   */
  getGate(transitionName: string): GateConfig | undefined {
    return this.gates[transitionName];
  }

  /**
   * Check if a phase transition is allowed.
   * Returns the blocking reasons if not.
   */
  canAdvance(
    project: string,
    fromPhase: number,
    toPhase: number,
    transitionName: string
  ): { allowed: boolean; blockers: string[] } {
    const gate = this.gates[transitionName];
    if (!gate) {
      // No gate defined for this transition — allowed by default
      return { allowed: true, blockers: [] };
    }

    const phaseState = this.loadPhaseState(project);
    if (!phaseState) {
      return { allowed: false, blockers: ['Phase state not found'] };
    }

    // Check that all required roles have issued PASS verdicts for this phase
    const blockers: string[] = [];
    for (const requiredRole of gate.required) {
      const verdict = this.findVerdict(phaseState, requiredRole, fromPhase);
      if (!verdict) {
        blockers.push(`Missing verdict from ${requiredRole}`);
      } else if (verdict.verdict === 'FAIL') {
        blockers.push(
          `${requiredRole} issued FAIL: ${verdict.blocking_issues.join('; ') || 'no details'}`
        );
      }
    }

    return {
      allowed: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Record a gate verdict for a project phase.
   */
  recordVerdict(verdict: GateVerdict): void {
    const phaseState = this.loadPhaseState(verdict.project) ?? this.createPhaseState(verdict.project);
    phaseState.gate_verdicts.push(verdict);
    phaseState.updated_at = new Date().toISOString();

    // If FAIL and gate is structural, revert phase status
    const transitionGate = this.findGateForPhase(verdict.phase);
    if (verdict.verdict === 'FAIL' && transitionGate?.verdict_type === 'structural') {
      phaseState.status = 'gated_fail';
    }

    this.savePhaseState(verdict.project, phaseState);
  }

  /**
   * Attempt to advance a phase. Returns success or the blockers.
   * This is the STRUCTURAL enforcement — the code path that prevents advancement.
   */
  advancePhase(
    project: string,
    transitionName: string,
    fromPhase: number,
    toPhase: number,
    phaseName: string
  ): { advanced: boolean; blockers: string[] } {
    const check = this.canAdvance(project, fromPhase, toPhase, transitionName);
    if (!check.allowed) {
      return { advanced: false, blockers: check.blockers };
    }

    // Advance the phase
    const phaseState = this.loadPhaseState(project) ?? this.createPhaseState(project);
    phaseState.current_phase = toPhase;
    phaseState.phase_name = phaseName;
    phaseState.status = 'planning';
    phaseState.updated_at = new Date().toISOString();

    this.savePhaseState(project, phaseState);
    return { advanced: true, blockers: [] };
  }

  /**
   * Revert a phase after a FAIL verdict (structural enforcement).
   */
  revertPhase(project: string): PhaseState | null {
    const phaseState = this.loadPhaseState(project);
    if (!phaseState) return null;

    phaseState.status = 'gated_fail';
    phaseState.updated_at = new Date().toISOString();
    this.savePhaseState(project, phaseState);
    return phaseState;
  }

  // ─── Private helpers ────────────────────────────────────────────

  private findVerdict(state: PhaseState, role: string, phase: number): GateVerdict | undefined {
    // Find the most recent verdict from this role for this phase
    return [...state.gate_verdicts]
      .reverse()
      .find(v => v.issued_by === role && v.phase === phase);
  }

  private findGateForPhase(phase: number): GateConfig | undefined {
    // Simple heuristic — could be improved with explicit phase-to-gate mapping
    const gateNames = Object.keys(this.gates);
    return this.gates[gateNames[phase]] ?? undefined;
  }

  private loadPhaseState(project: string): PhaseState | null {
    const path = resolve(this.stateDir, project, 'phase.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  private createPhaseState(project: string): PhaseState {
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

  private savePhaseState(project: string, state: PhaseState): void {
    const dir = resolve(this.stateDir, project);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'phase.json'), JSON.stringify(state, null, 2));
  }
}
