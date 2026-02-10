/**
 * AgentBoardroom — Cross-Project Isolation Enforcement
 *
 * Ensures teams in Project A cannot see or affect Project B.
 * Enforces physical state isolation and access control.
 */
import type { ProjectRegistry } from './registry.js';
export interface IsolationContext {
    projectName: string;
    agentId: string;
    teamName?: string;
}
export interface AccessRequest {
    source: IsolationContext;
    targetProject: string;
    operation: 'read' | 'write' | 'execute';
    resource: string;
}
export interface AccessResult {
    allowed: boolean;
    reason: string;
    violation?: IsolationViolation;
}
export interface IsolationViolation {
    timestamp: string;
    source: IsolationContext;
    targetProject: string;
    operation: string;
    resource: string;
    severity: 'warning' | 'critical';
}
/**
 * Cross-project isolation enforcement.
 * Projects are sovereign — no cross-project access without explicit grants.
 */
export declare class IsolationEnforcer {
    private readonly registry;
    private violations;
    private crossProjectGrants;
    constructor(registry: ProjectRegistry);
    /**
     * Check if an access request is allowed.
     */
    checkAccess(request: AccessRequest): AccessResult;
    /**
     * Grant cross-project access (CEO or Board Chair only).
     */
    grantCrossProjectAccess(sourceProject: string, targetProject: string, operations: Array<'read' | 'write' | 'execute' | '*'>): void;
    /**
     * Revoke cross-project access.
     */
    revokeCrossProjectAccess(sourceProject: string, targetProject: string): void;
    /**
     * Validate that a file path belongs to a project's state directory.
     */
    validateStatePath(projectName: string, filePath: string): boolean;
    /**
     * Get all recorded violations.
     */
    getViolations(projectName?: string): IsolationViolation[];
    /**
     * Clear violations log.
     */
    clearViolations(): void;
    /**
     * Get violation count by severity.
     */
    violationSummary(): {
        warning: number;
        critical: number;
        total: number;
    };
}
//# sourceMappingURL=isolation.d.ts.map