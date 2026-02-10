"use strict";
/**
 * AgentBoardroom — Cross-Project Isolation Enforcement
 *
 * Ensures teams in Project A cannot see or affect Project B.
 * Enforces physical state isolation and access control.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsolationEnforcer = void 0;
/**
 * Cross-project isolation enforcement.
 * Projects are sovereign — no cross-project access without explicit grants.
 */
class IsolationEnforcer {
    registry;
    violations = [];
    crossProjectGrants = new Map(); // "source->target" => operations
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Check if an access request is allowed.
     */
    checkAccess(request) {
        // Same-project access is always allowed
        if (request.source.projectName === request.targetProject) {
            return { allowed: true, reason: 'Same-project access' };
        }
        // Check explicit cross-project grant
        const grantKey = `${request.source.projectName}->${request.targetProject}`;
        const grants = this.crossProjectGrants.get(grantKey);
        if (grants?.has(request.operation) || grants?.has('*')) {
            return { allowed: true, reason: 'Explicit cross-project grant' };
        }
        // Denied — record violation
        const violation = {
            timestamp: new Date().toISOString(),
            source: request.source,
            targetProject: request.targetProject,
            operation: request.operation,
            resource: request.resource,
            severity: request.operation === 'write' ? 'critical' : 'warning',
        };
        this.violations.push(violation);
        return {
            allowed: false,
            reason: `Cross-project access denied: ${request.source.projectName} → ${request.targetProject}`,
            violation,
        };
    }
    /**
     * Grant cross-project access (CEO or Board Chair only).
     */
    grantCrossProjectAccess(sourceProject, targetProject, operations) {
        // Verify both projects exist
        this.registry.getOrThrow(sourceProject);
        this.registry.getOrThrow(targetProject);
        const key = `${sourceProject}->${targetProject}`;
        const existing = this.crossProjectGrants.get(key) ?? new Set();
        for (const op of operations) {
            existing.add(op);
        }
        this.crossProjectGrants.set(key, existing);
    }
    /**
     * Revoke cross-project access.
     */
    revokeCrossProjectAccess(sourceProject, targetProject) {
        const key = `${sourceProject}->${targetProject}`;
        this.crossProjectGrants.delete(key);
    }
    /**
     * Validate that a file path belongs to a project's state directory.
     */
    validateStatePath(projectName, filePath) {
        const state = this.registry.getOrThrow(projectName);
        // Normalize and check that the path is within the project's state directory
        const normalized = filePath.replace(/\\/g, '/');
        const stateDir = state.stateDir.replace(/\\/g, '/');
        return normalized.startsWith(stateDir);
    }
    /**
     * Get all recorded violations.
     */
    getViolations(projectName) {
        if (!projectName)
            return [...this.violations];
        return this.violations.filter((v) => v.source.projectName === projectName || v.targetProject === projectName);
    }
    /**
     * Clear violations log.
     */
    clearViolations() {
        this.violations = [];
    }
    /**
     * Get violation count by severity.
     */
    violationSummary() {
        const warning = this.violations.filter((v) => v.severity === 'warning').length;
        const critical = this.violations.filter((v) => v.severity === 'critical').length;
        return { warning, critical, total: this.violations.length };
    }
}
exports.IsolationEnforcer = IsolationEnforcer;
//# sourceMappingURL=isolation.js.map