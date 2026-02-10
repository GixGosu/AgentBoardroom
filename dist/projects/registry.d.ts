/**
 * AgentBoardroom — Multi-Project Registry
 *
 * Manages multiple projects with independent state, lifecycle, and budget tracking.
 * Each project is sovereign: own state directory, teams, phases, and budget.
 */
import type { ProjectEntry } from '../core/types.js';
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
export declare class ProjectRegistry {
    private projects;
    private readonly stateRoot;
    constructor(stateRoot: string);
    /**
     * Register a new project.
     */
    register(entry: ProjectEntry): ProjectState;
    /**
     * Get a project by name.
     */
    get(name: string): ProjectState | undefined;
    /**
     * Get a project or throw.
     */
    getOrThrow(name: string): ProjectState;
    /**
     * List projects by status.
     */
    list(status?: ProjectStatus): ProjectEntry[];
    /**
     * Update a project entry (partial).
     */
    update(name: string, updates: Partial<ProjectEntry>): ProjectState;
    /**
     * Pause a project.
     */
    pause(name: string): void;
    /**
     * Resume a paused project.
     */
    resume(name: string): void;
    /**
     * Mark a project as completed.
     */
    complete(name: string): void;
    /**
     * Remove a project from registry.
     */
    unregister(name: string): void;
    /**
     * Add a team to a project.
     */
    addTeam(projectName: string, teamName: string): void;
    /**
     * Remove a team from a project.
     */
    removeTeam(projectName: string, teamName: string): void;
    /**
     * Record budget usage for a project.
     */
    recordBudgetUsage(name: string, amount: number): void;
    /**
     * Get aggregate snapshot (Auditor view).
     */
    snapshot(): RegistrySnapshot;
    /**
     * Get the count of active projects.
     */
    get activeCount(): number;
    /**
     * Get all project names.
     */
    get projectNames(): string[];
    private persistProject;
    private loadPersistedState;
}
//# sourceMappingURL=registry.d.ts.map