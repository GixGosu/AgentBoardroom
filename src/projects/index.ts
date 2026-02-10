/**
 * AgentBoardroom — Projects Module
 *
 * Multi-project registry, resource allocation, and isolation enforcement.
 */

export { ProjectRegistry } from './registry.js';
export type { ProjectState, ProjectStatus, RegistrySnapshot } from './registry.js';

export { ResourceAllocator } from './allocator.js';
export type {
  ResourcePool,
  ProjectAllocation,
  AllocationRequest,
  AllocationResult,
} from './allocator.js';

export { IsolationEnforcer } from './isolation.js';
export type {
  IsolationContext,
  AccessRequest,
  AccessResult,
  IsolationViolation,
} from './isolation.js';
