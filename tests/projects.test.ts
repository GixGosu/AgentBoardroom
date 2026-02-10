import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ProjectRegistry } from '../dist/projects/registry.js';
import { ResourceAllocator } from '../dist/projects/allocator.js';
import { IsolationEnforcer } from '../dist/projects/isolation.js';
import type { ProjectEntry } from '../dist/core/types.js';
import type { AllocationRequest } from '../dist/projects/allocator.js';

function makeEntry(name: string, overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return {
    name,
    status: 'active',
    channel: `#${name}`,
    priority: 'normal',
    budget_total: 10000,
    budget_used: 0,
    started: new Date().toISOString(),
    team_count: 0,
    current_phase: 1,
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ab-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Registry Tests ─────────────────────────────────────────────

describe('ProjectRegistry', () => {
  it('registers and retrieves a project', () => {
    const reg = new ProjectRegistry(tmpDir);
    const state = reg.register(makeEntry('alpha'));
    assert.equal(state.entry.name, 'alpha');
    assert.equal(reg.get('alpha')?.entry.name, 'alpha');
  });

  it('rejects duplicate registration', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    assert.throws(() => reg.register(makeEntry('alpha')), /already registered/);
  });

  it('lists projects by status', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('a', { status: 'active' }));
    reg.register(makeEntry('b', { status: 'active' }));
    reg.register(makeEntry('c', { status: 'completed' }));
    assert.equal(reg.list('active').length, 2);
    assert.equal(reg.list('completed').length, 1);
    assert.equal(reg.list().length, 3);
  });

  it('pauses and resumes a project', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    reg.pause('alpha');
    assert.equal(reg.get('alpha')?.entry.status, 'paused');
    reg.resume('alpha');
    assert.equal(reg.get('alpha')?.entry.status, 'active');
  });

  it('resume fails if not paused', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    assert.throws(() => reg.resume('alpha'), /not paused/);
  });

  it('manages teams', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    reg.addTeam('alpha', 'frontend');
    reg.addTeam('alpha', 'backend');
    assert.equal(reg.get('alpha')?.teams.length, 2);
    assert.equal(reg.get('alpha')?.entry.team_count, 2);
    reg.removeTeam('alpha', 'frontend');
    assert.equal(reg.get('alpha')?.teams.length, 1);
  });

  it('tracks budget usage', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha', { budget_total: 5000 }));
    reg.recordBudgetUsage('alpha', 1500);
    reg.recordBudgetUsage('alpha', 500);
    assert.equal(reg.get('alpha')?.entry.budget_used, 2000);
  });

  it('provides aggregate snapshot', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('a', { budget_total: 5000, budget_used: 1000 }));
    reg.register(makeEntry('b', { budget_total: 3000, budget_used: 500 }));
    const snap = reg.snapshot();
    assert.equal(snap.totalBudgetAllocated, 8000);
    assert.equal(snap.totalBudgetUsed, 1500);
  });

  it('persists and reloads state', () => {
    const reg1 = new ProjectRegistry(tmpDir);
    reg1.register(makeEntry('alpha', { budget_used: 100 }));
    // Create new registry from same dir
    const reg2 = new ProjectRegistry(tmpDir);
    assert.equal(reg2.get('alpha')?.entry.budget_used, 100);
  });
});

// ─── Allocator Tests ────────────────────────────────────────────

describe('ResourceAllocator', () => {
  it('allocates resources within pool', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    const alloc = new ResourceAllocator(reg, { workers: 10, modelCapacity: 5, tokenBudget: 100000 });

    const result = alloc.allocate({
      projectName: 'alpha',
      workers: 3,
      modelCapacity: 2,
      tokenBudget: 30000,
      priority: 'normal',
      requestedBy: 'ceo',
    });

    assert.equal(result.granted, true);
    assert.equal(result.allocation.workers, 3);
    assert.equal(alloc.available.workers, 7);
  });

  it('denies when exceeding pool with no reallocation targets', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    const alloc = new ResourceAllocator(reg, { workers: 2, modelCapacity: 1, tokenBudget: 1000 });

    const result = alloc.allocate({
      projectName: 'alpha',
      workers: 5,
      modelCapacity: 1,
      tokenBudget: 500,
      priority: 'normal',
      requestedBy: 'ceo',
    });

    assert.equal(result.granted, false);
  });

  it('reallocates from lower-priority projects', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('low-proj', { priority: 'low' }));
    reg.register(makeEntry('high-proj', { priority: 'high' }));
    const alloc = new ResourceAllocator(reg, { workers: 5, modelCapacity: 3, tokenBudget: 50000 });

    // Allocate to low-priority
    alloc.allocate({
      projectName: 'low-proj', workers: 4, modelCapacity: 2, tokenBudget: 40000,
      priority: 'low', requestedBy: 'ceo',
    });

    // High-priority needs more than available
    const result = alloc.allocate({
      projectName: 'high-proj', workers: 4, modelCapacity: 2, tokenBudget: 30000,
      priority: 'high', requestedBy: 'ceo',
    });

    assert.equal(result.granted, true);
    assert.ok(result.reallocatedFrom?.includes('low-proj'));
  });

  it('force allocate works regardless of priority', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('a', { priority: 'high' }));
    reg.register(makeEntry('b', { priority: 'normal' }));
    const alloc = new ResourceAllocator(reg, { workers: 4, modelCapacity: 2, tokenBudget: 10000 });

    alloc.allocate({
      projectName: 'a', workers: 4, modelCapacity: 2, tokenBudget: 10000,
      priority: 'high', requestedBy: 'ceo',
    });

    // Force allocate for normal-priority takes from high
    const result = alloc.forceAllocate({
      projectName: 'b', workers: 2, modelCapacity: 1, tokenBudget: 5000,
      priority: 'normal', requestedBy: 'board_chair',
    });

    assert.equal(result.granted, true);
  });

  it('releases resources', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    const alloc = new ResourceAllocator(reg, { workers: 5, modelCapacity: 3, tokenBudget: 10000 });

    alloc.allocate({
      projectName: 'alpha', workers: 3, modelCapacity: 2, tokenBudget: 5000,
      priority: 'normal', requestedBy: 'ceo',
    });

    assert.equal(alloc.available.workers, 2);
    alloc.release('alpha');
    assert.equal(alloc.available.workers, 5);
  });
});

// ─── Isolation Tests ────────────────────────────────────────────

describe('IsolationEnforcer', () => {
  it('allows same-project access', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    const iso = new IsolationEnforcer(reg);

    const result = iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'worker-1' },
      targetProject: 'alpha',
      operation: 'read',
      resource: '/state/alpha/data.json',
    });

    assert.equal(result.allowed, true);
  });

  it('denies cross-project access by default', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    reg.register(makeEntry('beta'));
    const iso = new IsolationEnforcer(reg);

    const result = iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'worker-1' },
      targetProject: 'beta',
      operation: 'read',
      resource: '/state/beta/data.json',
    });

    assert.equal(result.allowed, false);
    assert.ok(result.violation);
  });

  it('records violations with correct severity', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    reg.register(makeEntry('beta'));
    const iso = new IsolationEnforcer(reg);

    iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'w1' },
      targetProject: 'beta', operation: 'read', resource: 'x',
    });
    iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'w1' },
      targetProject: 'beta', operation: 'write', resource: 'y',
    });

    const summary = iso.violationSummary();
    assert.equal(summary.warning, 1);
    assert.equal(summary.critical, 1);
    assert.equal(summary.total, 2);
  });

  it('allows access with explicit grant', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    reg.register(makeEntry('beta'));
    const iso = new IsolationEnforcer(reg);

    iso.grantCrossProjectAccess('alpha', 'beta', ['read']);

    const result = iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'w1' },
      targetProject: 'beta', operation: 'read', resource: 'x',
    });
    assert.equal(result.allowed, true);

    // Write still denied
    const writeResult = iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'w1' },
      targetProject: 'beta', operation: 'write', resource: 'x',
    });
    assert.equal(writeResult.allowed, false);
  });

  it('revokes cross-project access', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    reg.register(makeEntry('beta'));
    const iso = new IsolationEnforcer(reg);

    iso.grantCrossProjectAccess('alpha', 'beta', ['read']);
    iso.revokeCrossProjectAccess('alpha', 'beta');

    const result = iso.checkAccess({
      source: { projectName: 'alpha', agentId: 'w1' },
      targetProject: 'beta', operation: 'read', resource: 'x',
    });
    assert.equal(result.allowed, false);
  });

  it('validates state path belongs to project', () => {
    const reg = new ProjectRegistry(tmpDir);
    reg.register(makeEntry('alpha'));
    const iso = new IsolationEnforcer(reg);

    const stateDir = reg.get('alpha')!.stateDir;
    assert.equal(iso.validateStatePath('alpha', join(stateDir, 'data.json')), true);
    assert.equal(iso.validateStatePath('alpha', '/some/other/path'), false);
  });
});
