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
import type { GovernanceConfig } from '../core/types.js';
export interface AccessCheckResult {
    allowed: boolean;
    reason?: string;
    violation_type?: 'governance_asset' | 'out_of_scope' | 'cross_team';
}
/**
 * Structured audit log entry for governance access attempts.
 * Every checkWriteAccess call produces one of these — allowed or denied.
 */
export interface AuditLogEntry {
    /** ISO timestamp of the access attempt */
    timestamp: string;
    /** Agent role that attempted access */
    agent_role: string;
    /** Resolved relative path that was checked */
    target_path: string;
    /** Whether access was granted */
    allowed: boolean;
    /** Violation type if denied */
    violation_type?: 'governance_asset' | 'out_of_scope' | 'cross_team';
    /** Human-readable reason for the decision */
    reason: string;
    /** The specific pattern that matched (for governance asset violations) */
    matched_pattern?: string;
    /** The allowed paths the agent was scoped to (if any) */
    agent_scope?: string[];
}
/**
 * Query parameters for filtering audit log entries.
 * All fields are optional; results match ALL provided criteria (conjunctive).
 */
export interface AuditLogQuery {
    /** Filter by agent role */
    agent_role?: string;
    /** Filter by allowed/denied */
    allowed?: boolean;
    /** Filter by violation type */
    violation_type?: 'governance_asset' | 'out_of_scope' | 'cross_team';
    /** Filter entries after this timestamp (inclusive) */
    after?: string;
    /** Filter entries before this timestamp (inclusive) */
    before?: string;
    /** Filter by target path (substring match) */
    path_contains?: string;
    /** Maximum number of results to return */
    limit?: number;
}
/**
 * Summary statistics for audit log analysis.
 */
export interface AuditSummary {
    /** Total access attempts logged */
    total_attempts: number;
    /** Total denied attempts */
    total_denied: number;
    /** Total allowed attempts */
    total_allowed: number;
    /** Breakdown of denials by violation type */
    denials_by_type: Record<string, number>;
    /** Breakdown of denials by agent role */
    denials_by_agent: Record<string, number>;
    /** Most frequently targeted protected assets */
    top_targeted_assets: Array<{
        path: string;
        count: number;
    }>;
}
/**
 * Detailed violation report for scope enforcement.
 */
export interface ViolationReport {
    /** The access check result */
    result: AccessCheckResult;
    /** The agent that triggered the violation */
    agent_role: string;
    /** The path that was attempted */
    attempted_path: string;
    /** Timestamp of the violation */
    timestamp: string;
    /** For governance violations: which pattern matched */
    matched_pattern?: string;
    /** For scope violations: what paths were allowed */
    allowed_scope?: string[];
    /** For scope violations: nearest allowed path (if any) */
    nearest_allowed?: string;
}
export declare class GovernanceProtection {
    private protectedPatterns;
    private baseDir;
    private auditLog;
    constructor(config: GovernanceConfig, baseDir: string);
    /**
     * Check if an agent is allowed to write to a given path.
     * Returns { allowed: false } if the path is a protected governance asset
     * or outside the agent's allowed scope.
     *
     * Every call is recorded in the audit log.
     */
    checkWriteAccess(agentRole: string, filePath: string, allowedPaths?: string[]): AccessCheckResult;
    /**
     * File access control layer — wraps checkWriteAccess and returns a
     * detailed ViolationReport on denial. Designed for adapter integration.
     *
     * @param agentRole - The role of the agent attempting access
     * @param filePath - The file path being written to
     * @param allowedPaths - Optional scope restriction for the agent
     * @returns ViolationReport if denied, null if allowed
     */
    enforceFileAccess(agentRole: string, filePath: string, allowedPaths?: string[]): ViolationReport | null;
    /**
     * Check if a file path matches a protected governance asset pattern.
     */
    isProtectedAsset(relativePath: string): boolean;
    /**
     * Validate a set of paths against governance protection.
     * Returns all paths that are protected assets.
     * Useful for batch validation (e.g., validating a commit's changed files).
     *
     * @param relativePaths - Array of relative paths to validate
     * @returns Array of objects with path and matched pattern
     */
    validatePaths(relativePaths: string[]): Array<{
        path: string;
        pattern: string;
    }>;
    /**
     * Get the list of protected asset patterns.
     */
    get protectedAssets(): readonly string[];
    /**
     * Query the audit log with optional filters.
     * Returns entries matching ALL provided criteria, sorted by timestamp descending.
     *
     * @param query - Filter criteria (all optional, conjunctive)
     * @returns Matching audit log entries
     */
    queryAuditLog(query?: AuditLogQuery): AuditLogEntry[];
    /**
     * Get a summary of audit log activity.
     * Useful for the Auditor role to assess governance health.
     */
    getAuditSummary(): AuditSummary;
    /**
     * Export the full audit log for external persistence or analysis.
     * Returns a snapshot — modifications to the returned array do not affect the internal log.
     */
    exportAuditLog(): AuditLogEntry[];
    /**
     * Clear the in-memory audit log.
     * Typically called after exporting/persisting the log.
     */
    clearAuditLog(): void;
    /**
     * Find the first protected pattern that matches a relative path.
     * Returns the pattern string or undefined if no match.
     */
    private findMatchingPattern;
    /**
     * Find the nearest allowed path for a given path (for helpful error messages).
     * Uses simple common-prefix matching.
     */
    private findNearestAllowed;
    /**
     * Record an audit log entry for an access check.
     */
    private recordAudit;
}
//# sourceMappingURL=protection.d.ts.map