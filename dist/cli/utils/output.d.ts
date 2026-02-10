/**
 * CLI Output Helpers — colorized, formatted output for terminal and JSON modes.
 */
export declare function bold(text: string): string;
export declare function dim(text: string): string;
export declare function red(text: string): string;
export declare function green(text: string): string;
export declare function yellow(text: string): string;
export declare function blue(text: string): string;
export declare function cyan(text: string): string;
export declare function colorVerdict(verdict: string): string;
export declare function colorStatus(status: string): string;
export declare function heading(text: string): void;
export declare function keyValue(key: string, value: string, indent?: number): void;
export declare function table(headers: string[], rows: string[][]): void;
export declare function jsonOutput(data: unknown): void;
export declare function error(message: string): void;
export declare function success(message: string): void;
export declare function warn(message: string): void;
export declare function info(message: string): void;
//# sourceMappingURL=output.d.ts.map