/**
 * AgentBoardroom — Multi-Project Registry
 *
 * Manages multiple projects with independent state, lifecycle, and budget tracking.
 * Each project is sovereign: own state directory, teams, phases, and budget.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectEntry, ProjectRegistry as IProjectRegistry } from '../core/types.js';

export type ProjectStatus = 'active' | 'paused' | 'completed';

export interface ProjectState {
  entry: ProjectEntry;
  stateDir: string;
  teams: string[];
  metadata: Record<string, unknown>;
}

export interface RegistrySnapshot {
  active: ProjectEntry[];
  paused: ProjectEntry[];
  completed: ProjectEntry[];
  totalBudgetAllocated: number;
  totalBudgetUsed: number;
}

/**
 * Multi-project registry with independent state per project.
 * Provides CRUD operations, lifecycle management, and aggregate views.
 */
export class ProjectRegistry {
  private projects: Map<string, ProjectState> = new Map();
  private readonly stateRoot: string;

  constructor(stateRoot: string) {
    this.stateRoot = stateRoot;
    if (!existsSync(stateRoot)) {
      mkdirSync(stateRoot, { recursive: true });
    }
    this.loadPersistedState();
  }

  /**
   * Register a new project.
   */
  register(entry: ProjectEntry): ProjectState {
    if (this.projects.has(entry.name)) {
      throw new Error(`Project already registered: ${entry.name}`);
    }

    const stateDir = join(this.stateRoot, entry.name);
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    const state: ProjectState = {
      entry: { ...entry },
      stateDir,
      teams: [],
      metadata: {},
    };

    this.projects.set(entry.name, state);
    this.persistProject(entry.name);
    return state;
  }

  /**
   * Get a project by name.
   */
  get(name: string): ProjectState | undefined {
    return this.projects.get(name);
  }

  /**
   * Get a project or throw.
   */
  getOrThrow(name: string): ProjectState {
    const p = this.projects.get(name);
    if (!p) throw new Error(`Project not found: ${name}`);
    return p;
  }

  /**
   * List projects by status.
   */
  list(status?: ProjectStatus): ProjectEntry[] {
    const entries = Array.from(this.projects.values()).map((s) => s.entry);
    if (!status) return entries;
    return entries.filter((e) => e.status === status);
  }

  /**
   * Update a project entry (partial).
   */
  update(name: string, updates: Partial<ProjectEntry>): ProjectState {
    const state = this.getOrThrow(name);
    Object.assign(state.entry, updates);
    this.persistProject(name);
    return state;
  }

  /**
   * Pause a project.
   */
  pause(name: string): void {
    this.update(name, { status: 'paused' });
  }

  /**
   * Resume a paused project.
   */
  resume(name: string): void {
    const state = this.getOrThrow(name);
    if (state.entry.status !== 'paused') {
      throw new Error(`Project ${name} is not paused (status: ${state.entry.status})`);
    }
    this.update(name, { status: 'active' });
  }

  /**
   * Mark a project as completed.
   */
  complete(name: string): void {
    this.update(name, { status: 'completed' });
  }

  /**
   * Remove a project from registry.
   */
  unregister(name: string): void {
    if (!this.projects.has(name)) {
      throw new Error(`Project not found: ${name}`);
    }
    this.projects.delete(name);
  }

  /**
   * Add a team to a project.
   */
  addTeam(projectName: string, teamName: string): void {
    const state = this.getOrThrow(projectName);
    if (state.teams.includes(teamName)) {
      throw new Error(`Team ${teamName} already in project ${projectName}`);
    }
    state.teams.push(teamName);
    state.entry.team_count = state.teams.length;
    this.persistProject(projectName);
  }

  /**
   * Remove a team from a project.
   */
  removeTeam(projectName: string, teamName: string): void {
    const state = this.getOrThrow(projectName);
    const idx = state.teams.indexOf(teamName);
    if (idx === -1) {
      throw new Error(`Team ${teamName} not in project ${projectName}`);
    }
    state.teams.splice(idx, 1);
    state.entry.team_count = state.teams.length;
    this.persistProject(projectName);
  }

  /**
   * Record budget usage for a project.
   */
  recordBudgetUsage(name: string, amount: number): void {
    const state = this.getOrThrow(name);
    state.entry.budget_used += amount;
    this.persistProject(name);
  }

  /**
   * Get aggregate snapshot (Auditor view).
   */
  snapshot(): RegistrySnapshot {
    const active = this.list('active');
    const paused = this.list('paused');
    const completed = this.list('completed');
    const all = [...active, ...paused, ...completed];

    return {
      active,
      paused,
      completed,
      totalBudgetAllocated: all.reduce((s, p) => s + p.budget_total, 0),
      totalBudgetUsed: all.reduce((s, p) => s + p.budget_used, 0),
    };
  }

  /**
   * Get the count of active projects.
   */
  get activeCount(): number {
    return this.list('active').length;
  }

  /**
   * Get all project names.
   */
  get projectNames(): string[] {
    return Array.from(this.projects.keys());
  }

  // ─── Persistence ────────────────────────────────────────────────

  private persistProject(name: string): void {
    const state = this.projects.get(name);
    if (!state) return;
    const filePath = join(state.stateDir, 'project.json');
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  private loadPersistedState(): void {
    // Load any previously persisted projects from state directories
    if (!existsSync(this.stateRoot)) return;

    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
    for (const dir of readdirSync(this.stateRoot)) {
      const projectFile = join(this.stateRoot, dir, 'project.json');
      if (existsSync(projectFile)) {
        try {
          const data = JSON.parse(readFileSync(projectFile, 'utf-8')) as ProjectState;
          data.stateDir = join(this.stateRoot, dir);
          this.projects.set(data.entry.name, data);
        } catch {
          // Skip corrupted state files
        }
      }
    }
  }
}
