"use strict";
/**
 * AgentBoardroom — Multi-Project Registry
 *
 * Manages multiple projects with independent state, lifecycle, and budget tracking.
 * Each project is sovereign: own state directory, teams, phases, and budget.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectRegistry = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
/**
 * Multi-project registry with independent state per project.
 * Provides CRUD operations, lifecycle management, and aggregate views.
 */
class ProjectRegistry {
    projects = new Map();
    stateRoot;
    constructor(stateRoot) {
        this.stateRoot = stateRoot;
        if (!(0, node_fs_1.existsSync)(stateRoot)) {
            (0, node_fs_1.mkdirSync)(stateRoot, { recursive: true });
        }
        this.loadPersistedState();
    }
    /**
     * Register a new project.
     */
    register(entry) {
        if (this.projects.has(entry.name)) {
            throw new Error(`Project already registered: ${entry.name}`);
        }
        const stateDir = (0, node_path_1.join)(this.stateRoot, entry.name);
        if (!(0, node_fs_1.existsSync)(stateDir)) {
            (0, node_fs_1.mkdirSync)(stateDir, { recursive: true });
        }
        const state = {
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
    get(name) {
        return this.projects.get(name);
    }
    /**
     * Get a project or throw.
     */
    getOrThrow(name) {
        const p = this.projects.get(name);
        if (!p)
            throw new Error(`Project not found: ${name}`);
        return p;
    }
    /**
     * List projects by status.
     */
    list(status) {
        const entries = Array.from(this.projects.values()).map((s) => s.entry);
        if (!status)
            return entries;
        return entries.filter((e) => e.status === status);
    }
    /**
     * Update a project entry (partial).
     */
    update(name, updates) {
        const state = this.getOrThrow(name);
        Object.assign(state.entry, updates);
        this.persistProject(name);
        return state;
    }
    /**
     * Pause a project.
     */
    pause(name) {
        this.update(name, { status: 'paused' });
    }
    /**
     * Resume a paused project.
     */
    resume(name) {
        const state = this.getOrThrow(name);
        if (state.entry.status !== 'paused') {
            throw new Error(`Project ${name} is not paused (status: ${state.entry.status})`);
        }
        this.update(name, { status: 'active' });
    }
    /**
     * Mark a project as completed.
     */
    complete(name) {
        this.update(name, { status: 'completed' });
    }
    /**
     * Remove a project from registry.
     */
    unregister(name) {
        if (!this.projects.has(name)) {
            throw new Error(`Project not found: ${name}`);
        }
        this.projects.delete(name);
    }
    /**
     * Add a team to a project.
     */
    addTeam(projectName, teamName) {
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
    removeTeam(projectName, teamName) {
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
    recordBudgetUsage(name, amount) {
        const state = this.getOrThrow(name);
        state.entry.budget_used += amount;
        this.persistProject(name);
    }
    /**
     * Get aggregate snapshot (Auditor view).
     */
    snapshot() {
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
    get activeCount() {
        return this.list('active').length;
    }
    /**
     * Get all project names.
     */
    get projectNames() {
        return Array.from(this.projects.keys());
    }
    // ─── Persistence ────────────────────────────────────────────────
    persistProject(name) {
        const state = this.projects.get(name);
        if (!state)
            return;
        const filePath = (0, node_path_1.join)(state.stateDir, 'project.json');
        (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(state, null, 2));
    }
    loadPersistedState() {
        // Load any previously persisted projects from state directories
        if (!(0, node_fs_1.existsSync)(this.stateRoot))
            return;
        const { readdirSync, statSync } = require('node:fs');
        for (const dir of readdirSync(this.stateRoot)) {
            const projectFile = (0, node_path_1.join)(this.stateRoot, dir, 'project.json');
            if ((0, node_fs_1.existsSync)(projectFile)) {
                try {
                    const data = JSON.parse((0, node_fs_1.readFileSync)(projectFile, 'utf-8'));
                    data.stateDir = (0, node_path_1.join)(this.stateRoot, dir);
                    this.projects.set(data.entry.name, data);
                }
                catch {
                    // Skip corrupted state files
                }
            }
        }
    }
}
exports.ProjectRegistry = ProjectRegistry;
//# sourceMappingURL=registry.js.map