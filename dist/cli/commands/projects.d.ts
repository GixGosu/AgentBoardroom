/**
 * CLI Command: projects — Multi-project management (list, prioritize).
 */
export interface ProjectsOptions {
    subcommand?: string;
    project?: string;
    priority?: string;
    dir?: string;
    json?: boolean;
}
export declare function projectsCommand(options: ProjectsOptions): void;
//# sourceMappingURL=projects.d.ts.map