/**
 * AgentBoardroom — Self-Modification Prevention
 *
 * Constitution Article IX: "No agent operating within AgentBoardroom may modify
 * the system that governs it."
 *
 * This module enforces the self-modification prohibition at the infrastructure level.
 * Not a policy agents are asked to follow — a constraint they cannot bypass.
 */
import type { GovernanceConfig } from '../core/types.js';
export interface AccessCheckResult {
    allowed: boolean;
    reason?: string;
    violation_type?: 'governance_asset' | 'out_of_scope' | 'cross_team';
}
export declare class GovernanceProtection {
    private protectedPatterns;
    private baseDir;
    constructor(config: GovernanceConfig, baseDir: string);
    /**
     * Check if an agent is allowed to write to a given path.
     * Returns { allowed: false } if the path is a protected governance asset.
     */
    checkWriteAccess(agentRole: string, filePath: string, allowedPaths?: string[]): AccessCheckResult;
    /**
     * Check if a file path matches a protected governance asset pattern.
     */
    isProtectedAsset(relativePath: string): boolean;
    /**
     * Get the list of protected asset patterns.
     */
    get protectedAssets(): readonly string[];
}
//# sourceMappingURL=protection.d.ts.map