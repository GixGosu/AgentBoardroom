/**
 * CLI Command: decisions — Query decision log.
 */
export interface DecisionsOptions {
    project?: string;
    status?: string;
    type?: string;
    author?: string;
    limit?: number;
    dir?: string;
    json?: boolean;
}
export declare function decisionsCommand(options: DecisionsOptions): void;
//# sourceMappingURL=decisions.d.ts.map