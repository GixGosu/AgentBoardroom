/**
 * AgentBoardroom — Self-Modification Prevention
 *
 * Constitution Article IX: "No agent operating within AgentBoardroom may modify
 * the system that governs it."
 *
 * This module enforces the self-modification prohibition at the infrastructure level.
 * Not a policy agents are asked to follow — a constraint they cannot bypass.
 */

import { resolve, relative } from 'node:path';
import { minimatch } from './minimatch.js';
import type { GovernanceConfig } from '../core/types.js';

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  violation_type?: 'governance_asset' | 'out_of_scope' | 'cross_team';
}

export class GovernanceProtection {
  private protectedPatterns: string[];
  private baseDir: string;

  constructor(config: GovernanceConfig, baseDir: string) {
    this.protectedPatterns = config.protected_assets;
    this.baseDir = resolve(baseDir);
  }

  /**
   * Check if an agent is allowed to write to a given path.
   * Returns { allowed: false } if the path is a protected governance asset.
   */
  checkWriteAccess(
    agentRole: string,
    filePath: string,
    allowedPaths?: string[]
  ): AccessCheckResult {
    const relativePath = relative(this.baseDir, resolve(filePath));

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
      const inScope = allowedPaths.some(pattern =>
        minimatch(relativePath, pattern) || relativePath.startsWith(pattern.replace('*', ''))
      );
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
  isProtectedAsset(relativePath: string): boolean {
    return this.protectedPatterns.some(pattern =>
      minimatch(relativePath, pattern)
    );
  }

  /**
   * Get the list of protected asset patterns.
   */
  get protectedAssets(): readonly string[] {
    return this.protectedPatterns;
  }
}
