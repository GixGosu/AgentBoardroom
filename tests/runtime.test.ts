/**
 * AgentBoardroom — Runtime Integration Tests
 *
 * Tests the OpenClaw tools implementation, state persistence, and start/stop flow.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { StateManager } from '../src/adapters/openclaw/state.js';
import { OpenClawRuntimeAdapter } from '../src/adapters/openclaw/runtime.js';
import { GovernanceProtection } from '../src/governance/protection.js';
import type { OpenClawTools, OpenClawSessionConfig, OpenClawCronConfig, OpenClawSessionStatus } from '../src/adapters/openclaw/runtime.js';

// ─── Mock OpenClaw Tools ────────────────────────────────────────────

class MockOpenClawTools implements OpenClawTools {
  spawned: OpenClawSessionConfig[] = [];
  sent: Array<{ sessionId: string; message: string }> = [];
  killed: string[] = [];
  cronJobs: OpenClawCronConfig[] = [];
  posted: Array<{ channel: string; message: string }> = [];

  async sessionsSpawn(config: OpenClawSessionConfig) {
    this.spawned.push(config);
    return { session_id: `session-${config.label}` };
  }

  async sessionsSend(sessionId: string, message: string) {
    this.sent.push({ sessionId, message });
  }

  async sessionsStatus(sessionId: string): Promise<OpenClawSessionStatus> {
    return {
      session_id: sessionId,
      state: 'running',
      last_activity_at: new Date().toISOString(),
      tokens_used: 100,
    };
  }

  async sessionsKill(sessionId: string) {
    this.killed.push(sessionId);
  }

  async cronSchedule(config: OpenClawCronConfig) {
    this.cronJobs.push(config);
    return `cron-${config.name}`;
  }

  async messagePost(channel: string, message: string) {
    this.posted.push({ channel, message });
  }
}

// ─── State Manager Tests ────────────────────────────────────────────

describe('StateManager', () => {
  let stateDir: string;
  let manager: StateManager;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'ab-state-'));
    manager = new StateManager(stateDir);
  });

  it('should load defaults when no state exists', () => {
    const state = manager.load();
    assert.equal(state.status, 'stopped');
    assert.equal(state.pid, 0);
    assert.deepEqual(state.sessions, {});
  });

  it('should mark as running and persist', () => {
    const state = manager.markRunning('/test/board.yaml');
    assert.equal(state.status, 'running');
    assert.equal(state.configPath, '/test/board.yaml');
    assert.ok(state.pid > 0);

    // Reload
    const loaded = manager.load();
    assert.equal(loaded.status, 'running');
    assert.equal(loaded.configPath, '/test/board.yaml');
  });

  it('should record sessions', () => {
    manager.markRunning('/test/board.yaml');
    manager.recordSession('ceo', 'session-ceo-123');
    manager.recordSession('cto', 'session-cto-456');

    const state = manager.load();
    assert.equal(state.sessions.ceo, 'session-ceo-123');
    assert.equal(state.sessions.cto, 'session-cto-456');
  });

  it('should record cron jobs', () => {
    manager.markRunning('/test/board.yaml');
    manager.recordCronJob('boardroom-auditor', 'cron-123');

    const state = manager.load();
    assert.equal(state.cronJobs['boardroom-auditor'], 'cron-123');
  });

  it('should mark as stopped', () => {
    manager.markRunning('/test/board.yaml');
    assert.equal(manager.isRunning(), true);

    manager.markStopped();
    const state = manager.load();
    assert.equal(state.status, 'stopped');
    assert.equal(state.pid, 0);
  });

  it('should detect non-running state', () => {
    assert.equal(manager.isRunning(), false);
  });
});

// ─── Runtime Adapter with Mock Tools ────────────────────────────────

describe('OpenClawRuntimeAdapter (with mock tools)', () => {
  let tools: MockOpenClawTools;
  let runtime: OpenClawRuntimeAdapter;

  beforeEach(() => {
    tools = new MockOpenClawTools();
    const governance = new GovernanceProtection(
      { self_modification: 'prohibited', protected_assets: ['board.yaml', 'agents/*.md'] },
      '/tmp/test'
    );
    runtime = new OpenClawRuntimeAdapter({
      tools,
      governance,
      defaultAllowedPaths: ['state/**', 'output/**'],
    });
  });

  it('should spawn agent and track session', async () => {
    const sessionId = await runtime.spawnAgent({
      agentId: 'ceo',
      prompt: 'You are the CEO.',
      task: 'Start planning.',
      model: 'high',
    });

    assert.equal(sessionId, 'session-ceo');
    assert.equal(tools.spawned.length, 1);
    assert.equal(tools.spawned[0].label, 'ceo');
    assert.ok(tools.spawned[0].model.includes('opus'));
  });

  it('should send message to spawned agent', async () => {
    await runtime.spawnAgent({
      agentId: 'cto',
      prompt: 'You are the CTO.',
      task: 'Review architecture.',
    });

    await runtime.sendToAgent('cto', 'Please review the API design.');
    assert.equal(tools.sent.length, 1);
    assert.equal(tools.sent[0].message, 'Please review the API design.');
  });

  it('should throw when sending to non-existent agent', async () => {
    await assert.rejects(
      () => runtime.sendToAgent('nonexistent', 'hello'),
      /No active session/
    );
  });

  it('should schedule cron job', async () => {
    const jobId = await runtime.scheduleCron({
      name: 'boardroom-auditor',
      schedule: '*/15 * * * *',
      agentId: 'auditor',
      message: 'Run audit.',
      model: 'low',
    });

    assert.ok(jobId);
    assert.equal(tools.cronJobs.length, 1);
    assert.equal(tools.cronJobs[0].name, 'boardroom-auditor');
  });

  it('should post to channel', async () => {
    await runtime.postToChannel('#theboard', 'Status update');
    assert.equal(tools.posted.length, 1);
    assert.equal(tools.posted[0].channel, '#theboard');
  });

  it('should kill agent session', async () => {
    await runtime.spawnAgent({
      agentId: 'qa',
      prompt: 'You are QA.',
      task: 'Run tests.',
    });

    await runtime.killAgent('qa');
    assert.equal(tools.killed.length, 1);
    assert.equal(runtime.activeSessionCount, 0);
  });

  it('should get agent status', async () => {
    await runtime.spawnAgent({
      agentId: 'ceo',
      prompt: 'You are the CEO.',
      task: 'Start.',
    });

    const status = await runtime.getAgentStatus('ceo');
    assert.equal(status.id, 'ceo');
    assert.equal(status.status, 'active');
  });

  it('should generate file access policy from governance', () => {
    const policy = runtime.generateFileAccessPolicy(['src/**']);
    assert.deepEqual(policy.allowed_write, ['src/**']);
    assert.ok(policy.denied_write.includes('board.yaml'));
    assert.equal(policy.enforce, true);
  });

  it('should resolve model tiers', () => {
    assert.ok(runtime.resolveModel('high').includes('opus'));
    assert.ok(runtime.resolveModel('medium').includes('sonnet'));
    assert.ok(runtime.resolveModel('low').includes('haiku'));
    assert.equal(runtime.resolveModel('anthropic/custom-model'), 'anthropic/custom-model');
  });
});
