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

import { resolve, relative } from 'node:path';
import { minimatch } from './minimatch.js';
import type { GovernanceConfig } from '../core/types.js';

// ─── Types ──────────────────────────────────────────────────────────

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
  top_targeted_assets: Array<{ path: string; count: number }>;
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

// ─── Main Class ─────────────────────────────────────────────────────

export class GovernanceProtection {
  private protectedPatterns: string[];
  private baseDir: string;
  private auditLog: AuditLogEntry[] = [];

  constructor(config: GovernanceConfig, baseDir: string) {
    this.protectedPatterns = config.protected_assets;
    this.baseDir = resolve(baseDir);
  }

  /**
   * Check if an agent is allowed to write to a given path.
   * Returns { allowed: false } if the path is a protected governance asset
   * or outside the agent's allowed scope.
   *
   * Every call is recorded in the audit log.
   */
  checkWriteAccess(
    agentRole: string,
    filePath: string,
    allowedPaths?: string[]
  ): AccessCheckResult {
    const resolved = resolve(filePath);
    const relativePath = relative(this.baseDir, resolved);

    // Path traversal check: reject paths that escape the base directory
    if (relativePath.startsWith('..') || resolve(this.baseDir, relativePath) !== resolved) {
      const result: AccessCheckResult = {
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
      const result: AccessCheckResult = {
        allowed: false,
        reason: `"${relativePath}" is a protected governance asset (matched pattern: "${matchedPattern}"). No governed agent may modify governance infrastructure. (Constitution Article IX)`,
        violation_type: 'governance_asset',
      };
      this.recordAudit(agentRole, relativePath, result, allowedPaths, matchedPattern);
      return result;
    }

    // Check scope restriction (if agent has allowed paths)
    if (allowedPaths && allowedPaths.length > 0) {
      const inScope = allowedPaths.some(pattern =>
        minimatch(relativePath, pattern) || relativePath.startsWith(pattern.replace('*', ''))
      );
      if (!inScope) {
        const nearest = this.findNearestAllowed(relativePath, allowedPaths);
        const result: AccessCheckResult = {
          allowed: false,
          reason: `"${relativePath}" is outside agent "${agentRole}" scope. Allowed: [${allowedPaths.join(', ')}]${nearest ? `. Nearest allowed: "${nearest}"` : ''}`,
          violation_type: 'out_of_scope',
        };
        this.recordAudit(agentRole, relativePath, result, allowedPaths);
        return result;
      }
    }

    const result: AccessCheckResult = { allowed: true };
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
  enforceFileAccess(
    agentRole: string,
    filePath: string,
    allowedPaths?: string[]
  ): ViolationReport | null {
    const result = this.checkWriteAccess(agentRole, filePath, allowedPaths);
    if (result.allowed) return null;

    const relativePath = relative(this.baseDir, resolve(filePath));
    const report: ViolationReport = {
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
  isProtectedAsset(relativePath: string): boolean {
    return this.protectedPatterns.some(pattern =>
      minimatch(relativePath, pattern)
    );
  }

  /**
   * Validate a set of paths against governance protection.
   * Returns all paths that are protected assets.
   * Useful for batch validation (e.g., validating a commit's changed files).
   *
   * @param relativePaths - Array of relative paths to validate
   * @returns Array of objects with path and matched pattern
   */
  validatePaths(relativePaths: string[]): Array<{ path: string; pattern: string }> {
    const violations: Array<{ path: string; pattern: string }> = [];
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
  get protectedAssets(): readonly string[] {
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
  queryAuditLog(query: AuditLogQuery = {}): AuditLogEntry[] {
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
  getAuditSummary(): AuditSummary {
    const denied = this.auditLog.filter(e => !e.allowed);
    const allowed = this.auditLog.filter(e => e.allowed);

    const denialsByType: Record<string, number> = {};
    const denialsByAgent: Record<string, number> = {};
    const pathCounts: Record<string, number> = {};

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
  exportAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear the in-memory audit log.
   * Typically called after exporting/persisting the log.
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  // ─── Private helpers ────────────────────────────────────────────

  /**
   * Find the first protected pattern that matches a relative path.
   * Returns the pattern string or undefined if no match.
   */
  private findMatchingPattern(relativePath: string): string | undefined {
    return this.protectedPatterns.find(pattern => minimatch(relativePath, pattern));
  }

  /**
   * Find the nearest allowed path for a given path (for helpful error messages).
   * Uses simple common-prefix matching.
   */
  private findNearestAllowed(relativePath: string, allowedPaths: string[]): string | null {
    let best: string | null = null;
    let bestLen = 0;

    for (const pattern of allowedPaths) {
      const prefix = pattern.replace(/\*.*$/, '');
      // Find common prefix length
      let common = 0;
      const limit = Math.min(relativePath.length, prefix.length);
      for (let i = 0; i < limit; i++) {
        if (relativePath[i] === prefix[i]) common++;
        else break;
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
  private recordAudit(
    agentRole: string,
    relativePath: string,
    result: AccessCheckResult,
    allowedPaths?: string[],
    matchedPattern?: string,
  ): void {
    const entry: AuditLogEntry = {
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
