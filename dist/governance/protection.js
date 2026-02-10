"use strict";
/**
 * AgentBoardroom — Self-Modification Prevention
 *
 * Constitution Article IX: "No agent operating within AgentBoardroom may modify
 * the system that governs it."
 *
 * This module enforces the self-modification prohibition at the infrastructure level.
 * Not a policy agents are asked to follow — a constraint they cannot bypass.
 *
 * Enhanced in Phase 2 (ab-2-4) with:
 * - Structured audit logging for all governance access attempts
 * - Enhanced scope enforcement with detailed violation reporting
 * - File access control layer for adapter integration
 * - Audit log export capability for the Auditor role
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GovernanceProtection = void 0;
const node_path_1 = require("node:path");
const minimatch_js_1 = require("./minimatch.js");
// ─── Main Class ─────────────────────────────────────────────────────
class GovernanceProtection {
    protectedPatterns;
    baseDir;
    auditLog = [];
    constructor(config, baseDir) {
        this.protectedPatterns = config.protected_assets;
        this.baseDir = (0, node_path_1.resolve)(baseDir);
    }
    /**
     * Check if an agent is allowed to write to a given path.
     * Returns { allowed: false } if the path is a protected governance asset
     * or outside the agent's allowed scope.
     *
     * Every call is recorded in the audit log.
     */
    checkWriteAccess(agentRole, filePath, allowedPaths) {
        const resolved = (0, node_path_1.resolve)(filePath);
        const relativePath = (0, node_path_1.relative)(this.baseDir, resolved);
        // Path traversal check: reject paths that escape the base directory
        if (relativePath.startsWith('..') || (0, node_path_1.resolve)(this.baseDir, relativePath) !== resolved) {
            const result = {
                allowed: false,
                reason: `Path "${filePath}" resolves outside the project base directory. Potential path traversal.`,
                violation_type: 'out_of_scope',
            };
            this.recordAudit(agentRole, relativePath, result, allowedPaths);
            return result;
        }
        // Check governance asset protection (applies to ALL agents)
        const matchedPattern = this.findMatchingPattern(relativePath);
        if (matchedPattern !== undefined) {
            const result = {
                allowed: false,
                reason: `"${relativePath}" is a protected governance asset (matched pattern: "${matchedPattern}"). No governed agent may modify governance infrastructure. (Constitution Article IX)`,
                violation_type: 'governance_asset',
            };
            this.recordAudit(agentRole, relativePath, result, allowedPaths, matchedPattern);
            return result;
        }
        // Check scope restriction (if agent has allowed paths)
        if (allowedPaths && allowedPaths.length > 0) {
            const inScope = allowedPaths.some(pattern => (0, minimatch_js_1.minimatch)(relativePath, pattern) || relativePath.startsWith(pattern.replace('*', '')));
            if (!inScope) {
                const nearest = this.findNearestAllowed(relativePath, allowedPaths);
                const result = {
                    allowed: false,
                    reason: `"${relativePath}" is outside agent "${agentRole}" scope. Allowed: [${allowedPaths.join(', ')}]${nearest ? `. Nearest allowed: "${nearest}"` : ''}`,
                    violation_type: 'out_of_scope',
                };
                this.recordAudit(agentRole, relativePath, result, allowedPaths);
                return result;
            }
        }
        const result = { allowed: true };
        this.recordAudit(agentRole, relativePath, result, allowedPaths);
        return result;
    }
    /**
     * File access control layer — wraps checkWriteAccess and returns a
     * detailed ViolationReport on denial. Designed for adapter integration.
     *
     * @param agentRole - The role of the agent attempting access
     * @param filePath - The file path being written to
     * @param allowedPaths - Optional scope restriction for the agent
     * @returns ViolationReport if denied, null if allowed
     */
    enforceFileAccess(agentRole, filePath, allowedPaths) {
        const result = this.checkWriteAccess(agentRole, filePath, allowedPaths);
        if (result.allowed)
            return null;
        const relativePath = (0, node_path_1.relative)(this.baseDir, (0, node_path_1.resolve)(filePath));
        const report = {
            result,
            agent_role: agentRole,
            attempted_path: relativePath,
            timestamp: new Date().toISOString(),
        };
        if (result.violation_type === 'governance_asset') {
            report.matched_pattern = this.findMatchingPattern(relativePath);
        }
        if (result.violation_type === 'out_of_scope' && allowedPaths) {
            report.allowed_scope = allowedPaths;
            report.nearest_allowed = this.findNearestAllowed(relativePath, allowedPaths) ?? undefined;
        }
        return report;
    }
    /**
     * Check if a file path matches a protected governance asset pattern.
     */
    isProtectedAsset(relativePath) {
        return this.protectedPatterns.some(pattern => (0, minimatch_js_1.minimatch)(relativePath, pattern));
    }
    /**
     * Validate a set of paths against governance protection.
     * Returns all paths that are protected assets.
     * Useful for batch validation (e.g., validating a commit's changed files).
     *
     * @param relativePaths - Array of relative paths to validate
     * @returns Array of objects with path and matched pattern
     */
    validatePaths(relativePaths) {
        const violations = [];
        for (const p of relativePaths) {
            const pattern = this.findMatchingPattern(p);
            if (pattern !== undefined) {
                violations.push({ path: p, pattern });
            }
        }
        return violations;
    }
    /**
     * Get the list of protected asset patterns.
     */
    get protectedAssets() {
        return this.protectedPatterns;
    }
    // ─── Audit Log ──────────────────────────────────────────────────
    /**
     * Query the audit log with optional filters.
     * Returns entries matching ALL provided criteria, sorted by timestamp descending.
     *
     * @param query - Filter criteria (all optional, conjunctive)
     * @returns Matching audit log entries
     */
    queryAuditLog(query = {}) {
        let results = [...this.auditLog];
        if (query.agent_role !== undefined) {
            results = results.filter(e => e.agent_role === query.agent_role);
        }
        if (query.allowed !== undefined) {
            results = results.filter(e => e.allowed === query.allowed);
        }
        if (query.violation_type !== undefined) {
            results = results.filter(e => e.violation_type === query.violation_type);
        }
        if (query.after) {
            const afterMs = new Date(query.after).getTime();
            results = results.filter(e => new Date(e.timestamp).getTime() >= afterMs);
        }
        if (query.before) {
            const beforeMs = new Date(query.before).getTime();
            results = results.filter(e => new Date(e.timestamp).getTime() <= beforeMs);
        }
        if (query.path_contains) {
            const sub = query.path_contains;
            results = results.filter(e => e.target_path.includes(sub));
        }
        // Sort descending by timestamp
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (query.limit !== undefined && query.limit > 0) {
            results = results.slice(0, query.limit);
        }
        return results;
    }
    /**
     * Get a summary of audit log activity.
     * Useful for the Auditor role to assess governance health.
     */
    getAuditSummary() {
        const denied = this.auditLog.filter(e => !e.allowed);
        const allowed = this.auditLog.filter(e => e.allowed);
        const denialsByType = {};
        const denialsByAgent = {};
        const pathCounts = {};
        for (const entry of denied) {
            const vt = entry.violation_type ?? 'unknown';
            denialsByType[vt] = (denialsByType[vt] ?? 0) + 1;
            denialsByAgent[entry.agent_role] = (denialsByAgent[entry.agent_role] ?? 0) + 1;
            pathCounts[entry.target_path] = (pathCounts[entry.target_path] ?? 0) + 1;
        }
        const topAssets = Object.entries(pathCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([path, count]) => ({ path, count }));
        return {
            total_attempts: this.auditLog.length,
            total_denied: denied.length,
            total_allowed: allowed.length,
            denials_by_type: denialsByType,
            denials_by_agent: denialsByAgent,
            top_targeted_assets: topAssets,
        };
    }
    /**
     * Export the full audit log for external persistence or analysis.
     * Returns a snapshot — modifications to the returned array do not affect the internal log.
     */
    exportAuditLog() {
        return [...this.auditLog];
    }
    /**
     * Clear the in-memory audit log.
     * Typically called after exporting/persisting the log.
     */
    clearAuditLog() {
        this.auditLog = [];
    }
    // ─── Private helpers ────────────────────────────────────────────
    /**
     * Find the first protected pattern that matches a relative path.
     * Returns the pattern string or undefined if no match.
     */
    findMatchingPattern(relativePath) {
        return this.protectedPatterns.find(pattern => (0, minimatch_js_1.minimatch)(relativePath, pattern));
    }
    /**
     * Find the nearest allowed path for a given path (for helpful error messages).
     * Uses simple common-prefix matching.
     */
    findNearestAllowed(relativePath, allowedPaths) {
        let best = null;
        let bestLen = 0;
        for (const pattern of allowedPaths) {
            const prefix = pattern.replace(/\*.*$/, '');
            // Find common prefix length
            let common = 0;
            const limit = Math.min(relativePath.length, prefix.length);
            for (let i = 0; i < limit; i++) {
                if (relativePath[i] === prefix[i])
                    common++;
                else
                    break;
            }
            if (common > bestLen) {
                bestLen = common;
                best = pattern;
            }
        }
        return best;
    }
    /**
     * Record an audit log entry for an access check.
     */
    recordAudit(agentRole, relativePath, result, allowedPaths, matchedPattern) {
        const entry = {
            timestamp: new Date().toISOString(),
            agent_role: agentRole,
            target_path: relativePath,
            allowed: result.allowed,
            reason: result.allowed ? 'Access permitted' : (result.reason ?? 'Denied'),
        };
        if (result.violation_type) {
            entry.violation_type = result.violation_type;
        }
        if (matchedPattern) {
            entry.matched_pattern = matchedPattern;
        }
        if (allowedPaths && allowedPaths.length > 0) {
            entry.agent_scope = allowedPaths;
        }
        this.auditLog.push(entry);
    }
}
exports.GovernanceProtection = GovernanceProtection;
//# sourceMappingURL=protection.js.map