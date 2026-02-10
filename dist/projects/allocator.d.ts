/**
 * AgentBoardroom — Resource Allocation
 *
 * CEO-managed resource allocation across projects.
 * Handles worker pools, model capacity, token budgets, and priority-based reallocation.
 */
import type { ProjectRegistry } from './registry.js';
export interface ResourcePool {
    workers: number;
    modelCapacity: number;
    tokenBudget: number;
}
export interface ProjectAllocation {
    projectName: string;
    workers: number;
    modelCapacity: number;
    tokenBudget: number;
}
export interface AllocationRequest {
    projectName: string;
    workers: number;
    modelCapacity: number;
    tokenBudget: number;
    priority: 'critical' | 'high' | 'normal' | 'low';
    requestedBy: string;
}
export interface AllocationResult {
    granted: boolean;
    allocation: ProjectAllocation;
    reason?: string;
    reallocatedFrom?: string[];
}
/**
 * Resource allocator for multi-project environments.
 * CEO allocates; Board Chair can override.
 */
export declare class ResourceAllocator {
    private pool;
    private allocations;
    private readonly registry;
    constructor(registry: ProjectRegistry, pool: ResourcePool);
    /**
     * Get current total pool.
     */
    get totalPool(): ResourcePool;
    /**
     * Get available (unallocated) resources.
     */
    get available(): ResourcePool;
    /**
     * Get allocation for a specific project.
     */
    getAllocation(projectName: string): ProjectAllocation | undefined;
    /**
     * Get all current allocations.
     */
    getAllAllocations(): ProjectAllocation[];
    /**
     * Request resource allocation for a project.
     * Only CEO or Board Chair roles should call this.
     */
    allocate(request: AllocationRequest): AllocationResult;
    /**
     * Board Chair override: force allocation regardless of availability.
     * Takes from lower-priority projects as needed.
     */
    forceAllocate(request: AllocationRequest): AllocationResult;
    /**
     * Release all resources for a project.
     */
    release(projectName: string): void;
    /**
     * Update the total resource pool.
     */
    updatePool(pool: Partial<ResourcePool>): void;
    private usedResources;
    private tryReallocation;
}
//# sourceMappingURL=allocator.d.ts.map