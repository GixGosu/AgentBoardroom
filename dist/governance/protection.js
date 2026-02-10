"use strict";
/**
 * AgentBoardroom — Self-Modification Prevention
 *
 * Constitution Article IX: "No agent operating within AgentBoardroom may modify
 * the system that governs it."
 *
 * This module enforces the self-modification prohibition at the infrastructure level.
 * Not a policy agents are asked to follow — a constraint they cannot bypass.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GovernanceProtection = void 0;
const node_path_1 = require("node:path");
const minimatch_js_1 = require("./minimatch.js");
class GovernanceProtection {
    protectedPatterns;
    baseDir;
    constructor(config, baseDir) {
        this.protectedPatterns = config.protected_assets;
        this.baseDir = (0, node_path_1.resolve)(baseDir);
    }
    /**
     * Check if an agent is allowed to write to a given path.
     * Returns { allowed: false } if the path is a protected governance asset.
     */
    checkWriteAccess(agentRole, filePath, allowedPaths) {
        const relativePath = (0, node_path_1.relative)(this.baseDir, (0, node_path_1.resolve)(filePath));
        // Check governance asset protection (applies to ALL agents)
        if (this.isProtectedAsset(relativePath)) {
            return {
                allowed: false,
                reason: `"${relativePath}" is a protected governance asset. No governed agent may modify governance infrastructure. (Constitution Article IX)`,
                violation_type: 'governance_asset',
            };
        }
        // Check scope restriction (if agent has allowed paths)
        if (allowedPaths && allowedPaths.length > 0) {
            const inScope = allowedPaths.some(pattern => (0, minimatch_js_1.minimatch)(relativePath, pattern) || relativePath.startsWith(pattern.replace('*', '')));
            if (!inScope) {
                return {
                    allowed: false,
                    reason: `"${relativePath}" is outside agent "${agentRole}" scope. Allowed: ${allowedPaths.join(', ')}`,
                    violation_type: 'out_of_scope',
                };
            }
        }
        return { allowed: true };
    }
    /**
     * Check if a file path matches a protected governance asset pattern.
     */
    isProtectedAsset(relativePath) {
        return this.protectedPatterns.some(pattern => (0, minimatch_js_1.minimatch)(relativePath, pattern));
    }
    /**
     * Get the list of protected asset patterns.
     */
    get protectedAssets() {
        return this.protectedPatterns;
    }
}
exports.GovernanceProtection = GovernanceProtection;
//# sourceMappingURL=protection.js.map