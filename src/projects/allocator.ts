/**
 * AgentBoardroom — Resource Allocation
 *
 * CEO-managed resource allocation across projects.
 * Handles worker pools, model capacity, token budgets, and priority-based reallocation.
 */

import type { ProjectEntry } from '../core/types.js';
import type { ProjectRegistry } from './registry.js';

export interface ResourcePool {
  workers: number;
  modelCapacity: number; // concurrent model slots
  tokenBudget: number;   // total tokens available
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
  requestedBy: string; // role making the request
}

export interface AllocationResult {
  granted: boolean;
  allocation: ProjectAllocation;
  reason?: string;
  reallocatedFrom?: string[]; // projects that lost resources
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Resource allocator for multi-project environments.
 * CEO allocates; Board Chair can override.
 */
export class ResourceAllocator {
  private pool: ResourcePool;
  private allocations: Map<string, ProjectAllocation> = new Map();
  private readonly registry: ProjectRegistry;

  constructor(registry: ProjectRegistry, pool: ResourcePool) {
    this.registry = registry;
    this.pool = { ...pool };
  }

  /**
   * Get current total pool.
   */
  get totalPool(): ResourcePool {
    return { ...this.pool };
  }

  /**
   * Get available (unallocated) resources.
   */
  get available(): ResourcePool {
    const used = this.usedResources();
    return {
      workers: this.pool.workers - used.workers,
      modelCapacity: this.pool.modelCapacity - used.modelCapacity,
      tokenBudget: this.pool.tokenBudget - used.tokenBudget,
    };
  }

  /**
   * Get allocation for a specific project.
   */
  getAllocation(projectName: string): ProjectAllocation | undefined {
    return this.allocations.get(projectName);
  }

  /**
   * Get all current allocations.
   */
  getAllAllocations(): ProjectAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Request resource allocation for a project.
   * Only CEO or Board Chair roles should call this.
   */
  allocate(request: AllocationRequest): AllocationResult {
    // Verify project exists
    this.registry.getOrThrow(request.projectName);

    const avail = this.available;
    const existing = this.allocations.get(request.projectName);

    // Add back existing allocation to available (we're replacing it)
    if (existing) {
      avail.workers += existing.workers;
      avail.modelCapacity += existing.modelCapacity;
      avail.tokenBudget += existing.tokenBudget;
    }

    // Check if we can satisfy directly
    if (
      request.workers <= avail.workers &&
      request.modelCapacity <= avail.modelCapacity &&
      request.tokenBudget <= avail.tokenBudget
    ) {
      const allocation: ProjectAllocation = {
        projectName: request.projectName,
        workers: request.workers,
        modelCapacity: request.modelCapacity,
        tokenBudget: request.tokenBudget,
      };
      this.allocations.set(request.projectName, allocation);
      return { granted: true, allocation };
    }

    // Try reallocation from lower-priority projects
    return this.tryReallocation(request, existing);
  }

  /**
   * Board Chair override: force allocation regardless of availability.
   * Takes from lower-priority projects as needed.
   */
  forceAllocate(request: AllocationRequest): AllocationResult {
    this.registry.getOrThrow(request.projectName);
    const result = this.tryReallocation(request, this.allocations.get(request.projectName), true);
    return result;
  }

  /**
   * Release all resources for a project.
   */
  release(projectName: string): void {
    this.allocations.delete(projectName);
  }

  /**
   * Update the total resource pool.
   */
  updatePool(pool: Partial<ResourcePool>): void {
    Object.assign(this.pool, pool);
  }

  // ─── Internals ──────────────────────────────────────────────────

  private usedResources(): ResourcePool {
    let workers = 0;
    let modelCapacity = 0;
    let tokenBudget = 0;
    for (const a of this.allocations.values()) {
      workers += a.workers;
      modelCapacity += a.modelCapacity;
      tokenBudget += a.tokenBudget;
    }
    return { workers, modelCapacity, tokenBudget };
  }

  private tryReallocation(
    request: AllocationRequest,
    existing: ProjectAllocation | undefined,
    force = false,
  ): AllocationResult {
    const avail = this.available;

    // Add back existing allocation
    if (existing) {
      avail.workers += existing.workers;
      avail.modelCapacity += existing.modelCapacity;
      avail.tokenBudget += existing.tokenBudget;
    }

    const deficit = {
      workers: Math.max(0, request.workers - avail.workers),
      modelCapacity: Math.max(0, request.modelCapacity - avail.modelCapacity),
      tokenBudget: Math.max(0, request.tokenBudget - avail.tokenBudget),
    };

    if (deficit.workers === 0 && deficit.modelCapacity === 0 && deficit.tokenBudget === 0) {
      const allocation: ProjectAllocation = {
        projectName: request.projectName,
        workers: request.workers,
        modelCapacity: request.modelCapacity,
        tokenBudget: request.tokenBudget,
      };
      this.allocations.set(request.projectName, allocation);
      return { granted: true, allocation };
    }

    // Gather lower-priority projects sorted by priority ascending
    const requestPriority = PRIORITY_ORDER[request.priority] ?? 2;
    const candidates: Array<{ name: string; alloc: ProjectAllocation; priority: number }> = [];

    for (const [name, alloc] of this.allocations) {
      if (name === request.projectName) continue;
      const project = this.registry.get(name);
      const prio = project ? (PRIORITY_ORDER[project.entry.priority] ?? 2) : 2;
      if (force || prio < requestPriority) {
        candidates.push({ name, alloc, priority: prio });
      }
    }

    // Sort: lowest priority first
    candidates.sort((a, b) => a.priority - b.priority);

    const reallocatedFrom: string[] = [];

    for (const cand of candidates) {
      if (deficit.workers <= 0 && deficit.modelCapacity <= 0 && deficit.tokenBudget <= 0) break;

      const takeWorkers = Math.min(cand.alloc.workers, deficit.workers);
      const takeModel = Math.min(cand.alloc.modelCapacity, deficit.modelCapacity);
      const takeTokens = Math.min(cand.alloc.tokenBudget, deficit.tokenBudget);

      if (takeWorkers > 0 || takeModel > 0 || takeTokens > 0) {
        cand.alloc.workers -= takeWorkers;
        cand.alloc.modelCapacity -= takeModel;
        cand.alloc.tokenBudget -= takeTokens;
        deficit.workers -= takeWorkers;
        deficit.modelCapacity -= takeModel;
        deficit.tokenBudget -= takeTokens;
        reallocatedFrom.push(cand.name);

        // Update the allocation in the map
        this.allocations.set(cand.name, cand.alloc);
      }
    }

    if (deficit.workers > 0 || deficit.modelCapacity > 0 || deficit.tokenBudget > 0) {
      return {
        granted: false,
        allocation: existing ?? {
          projectName: request.projectName,
          workers: 0,
          modelCapacity: 0,
          tokenBudget: 0,
        },
        reason: 'Insufficient resources even after reallocation attempt',
      };
    }

    const allocation: ProjectAllocation = {
      projectName: request.projectName,
      workers: request.workers,
      modelCapacity: request.modelCapacity,
      tokenBudget: request.tokenBudget,
    };
    this.allocations.set(request.projectName, allocation);
    return { granted: true, allocation, reallocatedFrom };
  }
}
