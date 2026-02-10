/**
 * CLI Command: init — Initialize a new board from a template.
 */
export interface InitOptions {
    template?: string;
    project?: string;
    dir?: string;
    json?: boolean;
}
export declare function initCommand(options: InitOptions): Promise<void>;
//# sourceMappingURL=init.d.ts.map