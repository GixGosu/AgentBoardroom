/**
 * AgentBoardroom — Configuration Loader
 *
 * Loads and validates board.yaml configuration files.
 * Handles template variable resolution for agent prompts.
 */
import type { BoardConfig } from './types.js';
export declare class ConfigLoader {
    private configPath;
    private baseDir;
    constructor(configPath: string);
    /**
     * Load and validate the board configuration.
     */
    load(): BoardConfig;
    /**
     * Resolve template variables in an agent prompt file.
     * Replaces {{variable}} placeholders with values from the board config.
     */
    resolvePrompt(promptPath: string, role: string, config: BoardConfig, channelIds?: Record<string, string>): string;
    private buildTemplateVars;
    private resolveAgentDirectory;
    private validate;
}
//# sourceMappingURL=config.d.ts.map