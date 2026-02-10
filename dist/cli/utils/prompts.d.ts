/**
 * CLI Interactive Prompts — minimal readline-based prompts for template selection, etc.
 */
declare const TEMPLATES: readonly ["software-dev", "research", "content", "ops-incident", "custom"];
export type TemplateName = typeof TEMPLATES[number];
export declare function getAvailableTemplates(): readonly string[];
export declare function prompt(question: string, defaultValue?: string): Promise<string>;
export declare function selectTemplate(): Promise<string>;
export declare function isValidTemplate(name: string): boolean;
export declare function confirm(question: string, defaultYes?: boolean): Promise<boolean>;
export {};
//# sourceMappingURL=prompts.d.ts.map