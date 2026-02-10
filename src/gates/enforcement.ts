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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type {
  BoardConfig,
  GateConfig,
  GateVerdict,
  GateVerdictType,
  GateHistoryQuery,
  PhaseState,
  PhaseStatus,
  PhaseDefinition,
} from '../core/types.js';

/**
 * Gate history store — persisted per-project, queryable across projects.
 * Separate from phase state to allow cross-project queries.
 */
interface GateHistoryStore {
  verdicts: GateVerdict[];
}

export class GateEnforcement {
  private gates: Record<string, GateConfig>;
  private stateDir: string;
  private phases: PhaseDefinition[];

  /**
   * Create a GateEnforcement engine.
   * @param boardConfig - Board configuration with gate definitions
   * @param stateDir - Directory for persisting phase and gate state
   * @param phases - Ordered phase definitions (optional; defaults to standard software dev phases)
   */
  constructor(boardConfig: BoardConfig, stateDir: string, phases?: PhaseDefinition[]) {
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
  getGate(transitionName: string): GateConfig | undefined {
    return this.gates[transitionName];
  }

  /**
   * Get the phase definition by phase number.
   */
  getPhaseDefinition(phase: number): PhaseDefinition | undefined {
    return this.phases.find(p => p.phase === phase);
  }

  /**
   * Check if a phase transition is allowed.
   * Returns the blocking reasons if not.
   *
   * CONDITIONAL verdicts are treated as passing — they allow advancement
   * but their conditions are tracked for follow-up.
   */
  canAdvance(
    project: string,
    fromPhase: number,
    toPhase: number,
    transitionName: string
  ): { allowed: boolean; blockers: string[]; conditional: boolean; conditions: string[] } {
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

    const blockers: string[] = [];
    let hasConditional = false;
    const allConditions: string[] = [];

    for (const requiredRole of gate.required) {
      const verdict = this.findVerdict(phaseState, requiredRole, fromPhase);
      if (!verdict) {
        blockers.push(`Missing verdict from ${requiredRole}`);
      } else if (verdict.verdict === 'FAIL') {
        blockers.push(
          `${requiredRole} issued FAIL: ${verdict.blocking_issues.join('; ') || 'no details'}`
        );
      } else if (verdict.verdict === 'CONDITIONAL') {
        // Check if CONDITIONAL verdict has expired
        if (verdict.expires_at && new Date(verdict.expires_at) < new Date()) {
          blockers.push(`${requiredRole} CONDITIONAL verdict expired at ${verdict.expires_at}`);
        } else {
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
  recordVerdict(verdict: GateVerdict): void {
    const phaseState = this.loadPhaseState(verdict.project) ?? this.createPhaseState(verdict.project);
    phaseState.gate_verdicts.push(verdict);
    phaseState.updated_at = new Date().toISOString();

    // If FAIL and gate is structural, set phase status to gated_fail
    const transitionGate = this.findGateForPhase(verdict.phase);
    if (verdict.verdict === 'FAIL' && transitionGate?.verdict_type === 'structural') {
      phaseState.status = 'gated_fail';
    } else if (verdict.verdict === 'CONDITIONAL') {
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
  advancePhase(
    project: string,
    transitionName: string,
    fromPhase: number,
    toPhase: number,
    phaseName: string
  ): { advanced: boolean; blockers: string[]; conditional: boolean; conditions: string[] } {
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
  revertPhase(project: string): PhaseState | null {
    const phaseState = this.loadPhaseState(project);
    if (!phaseState) return null;

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
  queryHistory(query: GateHistoryQuery): GateVerdict[] {
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
  getPhaseState(project: string): PhaseState | null {
    return this.loadPhaseState(project);
  }

  // ─── Private helpers ────────────────────────────────────────────

  private findVerdict(state: PhaseState, role: string, phase: number): GateVerdict | undefined {
    // Find the most recent verdict from this role for this phase
    return [...state.gate_verdicts]
      .reverse()
      .find(v => v.issued_by === role && v.phase === phase);
  }

  private findGateForPhase(phase: number): GateConfig | undefined {
    const phaseDef = this.phases.find(p => p.phase === phase);
    if (phaseDef?.exit_gate) {
      return this.gates[phaseDef.exit_gate];
    }
    // Fallback: simple heuristic
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

  /** Global history file for cross-project queries. */
  private historyPath(): string {
    return resolve(this.stateDir, '_gate_history.json');
  }

  private loadHistory(): GateHistoryStore {
    const path = this.historyPath();
    if (!existsSync(path)) return { verdicts: [] };
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  private appendToHistory(verdict: GateVerdict): void {
    const history = this.loadHistory();
    history.verdicts.push(verdict);
    if (!existsSync(this.stateDir)) mkdirSync(this.stateDir, { recursive: true });
    writeFileSync(this.historyPath(), JSON.stringify(history, null, 2));
  }
}
