/**
 * CLI Command: gates — Query gate verdict history.
 */
export interface GatesOptions {
    project?: string;
    status?: string;
    phase?: number;
    issuedBy?: string;
    limit?: number;
    dir?: string;
    json?: boolean;
}
export declare function gatesCommand(options: GatesOptions): void;
//# sourceMappingURL=gates.d.ts.map