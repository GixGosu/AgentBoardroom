/**
 * AgentBoardroom — OpenClaw Adapter Tests
 *
 * Tests for RuntimeAdapter and ChannelAdapter implementations.
 * Target: 15+ tests covering spawn, send, cron, messaging, and governance enforcement.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GovernanceProtection } from '../dist/governance/protection.js';
import {
  OpenClawRuntimeAdapter,
  type OpenClawTools,
  type OpenClawSessionConfig,
  type OpenClawSessionStatus,
  type OpenClawCronConfig,
} from '../dist/adapters/openclaw/runtime.js';
import {
  OpenClawChannelAdapter,
  type OpenClawMessaging,
  type OpenClawMessageConfig,
} from '../dist/adapters/openclaw/channels.js';
import type { GovernanceConfig } from '../dist/core/types.js';

// ─── Test Helpers ───────────────────────────────────────────────────

const TEST_BASE_DIR = '/tmp/test-project';

function makeGovernanceConfig(): GovernanceConfig {
  return {
    self_modification: 'prohibited',
    protected_assets: [
      'board.yaml',
      'CONSTITUTION.md',
      'src/governance/**',
      'prompts/**',
    ],
  };
}

function makeGovernance(): GovernanceProtection {
  return new GovernanceProtection(makeGovernanceConfig(), TEST_BASE_DIR);
}

/** Creates a mock OpenClawTools that records calls */
function makeMockTools(): OpenClawTools & {
  calls: Array<{ method: string; args: unknown[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    async sessionsSpawn(config: OpenClawSessionConfig) {
      calls.push({ method: 'sessionsSpawn', args: [config] });
      return { session_id: `sess-${config.label}` };
    },
    async sessionsSend(sessionId: string, message: string) {
      calls.push({ method: 'sessionsSend', args: [sessionId, message] });
    },
    async sessionsStatus(sessionId: string): Promise<OpenClawSessionStatus> {
      calls.push({ method: 'sessionsStatus', args: [sessionId] });
      return {
        session_id: sessionId,
        state: 'running',
        last_activity_at: new Date().toISOString(),
        tokens_used: 1500,
      };
    },
    async sessionsKill(sessionId: string) {
      calls.push({ method: 'sessionsKill', args: [sessionId] });
    },
    async cronSchedule(config: OpenClawCronConfig) {
      calls.push({ method: 'cronSchedule', args: [config] });
      return `cron-${config.name}`;
    },
    async messagePost(channel: string, message: string) {
      calls.push({ method: 'messagePost', args: [channel, message] });
    },
  };
}

function makeMockMessaging(): OpenClawMessaging & {
  calls: Array<{ method: string; args: unknown[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let counter = 0;
  return {
    calls,
    async send(config: OpenClawMessageConfig) {
      calls.push({ method: 'send', args: [config] });
      return `msg-${++counter}`;
    },
    async createChannel(name: string, purpose: string) {
      calls.push({ method: 'createChannel', args: [name, purpose] });
      return `ch-${name}`;
    },
    async editMessage(channelId: string, messageId: string, content: string) {
      calls.push({ method: 'editMessage', args: [channelId, messageId, content] });
    },
  };
}

// ─── Runtime Adapter Tests ──────────────────────────────────────────

describe('OpenClawRuntimeAdapter', () => {
  let tools: ReturnType<typeof makeMockTools>;
  let governance: GovernanceProtection;
  let adapter: OpenClawRuntimeAdapter;

  beforeEach(() => {
    tools = makeMockTools();
    governance = makeGovernance();
    adapter = new OpenClawRuntimeAdapter({ tools, governance });
  });

  it('should spawn an agent session with correct model', async () => {
    const sessionId = await adapter.spawnAgent({
      agentId: 'cto',
      prompt: 'You are the CTO',
      task: 'Review architecture',
      model: 'high',
    });
    assert.equal(sessionId, 'sess-cto');
    assert.equal(tools.calls.length, 1);
    const config = tools.calls[0].args[0] as OpenClawSessionConfig;
    assert.equal(config.model, 'anthropic/claude-opus-4-6');
    assert.equal(config.label, 'cto');
  });

  it('should include file_access policy in spawn config', async () => {
    await adapter.spawnAgent({
      agentId: 'dev',
      prompt: 'You are a developer',
      task: 'Write code',
    });
    const config = tools.calls[0].args[0] as OpenClawSessionConfig;
    assert.ok(config.file_access);
    assert.equal(config.file_access.enforce, true);
    assert.ok(config.file_access.denied_write.includes('board.yaml'));
    assert.ok(config.file_access.denied_write.includes('CONSTITUTION.md'));
  });

  it('should map model tiers correctly', () => {
    assert.equal(adapter.resolveModel('high'), 'anthropic/claude-opus-4-6');
    assert.equal(adapter.resolveModel('medium'), 'anthropic/claude-sonnet-4-20250514');
    assert.equal(adapter.resolveModel('low'), 'anthropic/claude-haiku-3-5');
    assert.equal(adapter.resolveModel('local_only'), 'ollama/llama3');
  });

  it('should pass through explicit model names', () => {
    assert.equal(adapter.resolveModel('openai/gpt-4o'), 'openai/gpt-4o');
  });

  it('should default to high tier when no model specified', () => {
    assert.equal(adapter.resolveModel(), 'anthropic/claude-opus-4-6');
  });

  it('should send message to spawned agent', async () => {
    await adapter.spawnAgent({ agentId: 'dev', prompt: 'p', task: 't' });
    await adapter.sendToAgent('dev', 'Hello');
    assert.equal(tools.calls[1].method, 'sessionsSend');
    assert.equal(tools.calls[1].args[0], 'sess-dev');
    assert.equal(tools.calls[1].args[1], 'Hello');
  });

  it('should throw when sending to unknown agent', async () => {
    await assert.rejects(
      () => adapter.sendToAgent('nonexistent', 'Hi'),
      /No active session found/
    );
  });

  it('should schedule cron jobs', async () => {
    const jobId = await adapter.scheduleCron({
      name: 'daily-standup',
      schedule: '0 9 * * *',
      agentId: 'scrum-master',
      message: 'Run standup',
      model: 'low',
    });
    assert.equal(jobId, 'cron-daily-standup');
    const config = tools.calls[0].args[0] as OpenClawCronConfig;
    assert.equal(config.model, 'anthropic/claude-haiku-3-5');
  });

  it('should get agent status', async () => {
    await adapter.spawnAgent({ agentId: 'dev', prompt: 'p', task: 't' });
    const status = await adapter.getAgentStatus('dev');
    assert.equal(status.id, 'dev');
    assert.equal(status.status, 'active');
    assert.equal(status.token_usage, 1500);
  });

  it('should kill agent and remove from tracking', async () => {
    await adapter.spawnAgent({ agentId: 'dev', prompt: 'p', task: 't' });
    assert.equal(adapter.activeSessionCount, 1);
    await adapter.killAgent('dev');
    assert.equal(adapter.activeSessionCount, 0);
  });

  it('should enforce governance on file access checks', () => {
    const violation = adapter.checkFileAccess('dev', '/tmp/test-project/board.yaml');
    assert.notEqual(violation, null);
    assert.equal(violation!.result.violation_type, 'governance_asset');
  });

  it('should allow file access to non-protected paths', () => {
    const violation = adapter.checkFileAccess('dev', '/tmp/test-project/src/app.ts');
    assert.equal(violation, null);
  });

  it('should generate file access policy with governance denied list', () => {
    const policy = adapter.generateFileAccessPolicy(['src/**']);
    assert.deepEqual(policy.allowed_write, ['src/**']);
    assert.ok(policy.denied_write.includes('board.yaml'));
    assert.ok(policy.denied_write.includes('src/governance/**'));
    assert.equal(policy.enforce, true);
  });

  it('should post to channel via tools', async () => {
    await adapter.postToChannel('board-decisions', 'Decision D-001 accepted');
    assert.equal(tools.calls[0].method, 'messagePost');
    assert.equal(tools.calls[0].args[0], 'board-decisions');
  });

  it('should support custom model map', () => {
    const custom = new OpenClawRuntimeAdapter({
      tools,
      governance,
      modelMap: { high: 'openai/gpt-4o' },
    });
    assert.equal(custom.resolveModel('high'), 'openai/gpt-4o');
    // Others still use defaults
    assert.equal(custom.resolveModel('low'), 'anthropic/claude-haiku-3-5');
  });

  it('should set timeout on spawn when provided', async () => {
    await adapter.spawnAgent({
      agentId: 'dev',
      prompt: 'p',
      task: 't',
      timeout: 300,
    });
    const config = tools.calls[0].args[0] as OpenClawSessionConfig;
    assert.equal(config.timeout_ms, 300000);
  });
});

// ─── Channel Adapter Tests ──────────────────────────────────────────

describe('OpenClawChannelAdapter', () => {
  let messaging: ReturnType<typeof makeMockMessaging>;
  let adapter: OpenClawChannelAdapter;

  beforeEach(() => {
    messaging = makeMockMessaging();
    adapter = new OpenClawChannelAdapter({ messaging });
  });

  it('should create a channel via messaging platform', async () => {
    const id = await adapter.createChannel('decisions', 'Decision log');
    assert.equal(id, 'ch-decisions');
    assert.equal(adapter.getChannelId('decisions'), 'ch-decisions');
  });

  it('should post a message and return ID', async () => {
    const id = await adapter.postMessage('ch-1', 'Hello world');
    assert.equal(id, 'msg-1');
    assert.equal(adapter.messageCount, 1);
  });

  it('should format tags as bracketed prefixes', async () => {
    await adapter.postMessage('ch-1', 'Decision accepted', ['decision', 'D-001']);
    const config = messaging.calls[0].args[0] as OpenClawMessageConfig;
    assert.ok(config.message.startsWith('[decision] [D-001] '));
  });

  it('should search messages by content', async () => {
    await adapter.postMessage('ch-1', 'Architecture review complete');
    await adapter.postMessage('ch-1', 'Budget approved');
    await adapter.postMessage('ch-2', 'Architecture in ch-2');

    const results = await adapter.searchMessages('ch-1', 'architecture');
    assert.equal(results.length, 1);
    assert.ok(results[0].content.includes('Architecture review'));
  });

  it('should search messages by tag', async () => {
    await adapter.postMessage('ch-1', 'Some decision', ['gate-verdict']);
    await adapter.postMessage('ch-1', 'Other message');

    const results = await adapter.searchMessages('ch-1', 'gate-verdict');
    assert.equal(results.length, 1);
  });

  it('should update pinned post via edit', async () => {
    await adapter.updatePinnedPost('ch-1', 'msg-1', 'Updated dashboard');
    assert.equal(messaging.calls[0].method, 'editMessage');
    assert.equal(adapter.getPinnedPost('ch-1'), 'msg-1');
  });

  it('should fallback to new post when edit not supported', async () => {
    const noEdit: OpenClawMessaging = {
      async send(config: OpenClawMessageConfig) { return 'msg-fallback'; },
    };
    const fallbackAdapter = new OpenClawChannelAdapter({ messaging: noEdit });
    await fallbackAdapter.updatePinnedPost('ch-1', 'old-msg', 'New content');
    assert.equal(fallbackAdapter.getPinnedPost('ch-1'), 'msg-fallback');
  });

  it('should create channel locally when platform does not support it', async () => {
    const noCreate: OpenClawMessaging = {
      async send() { return 'msg-1'; },
    };
    const localAdapter = new OpenClawChannelAdapter({ messaging: noCreate });
    const id = await localAdapter.createChannel('test', 'Test channel');
    assert.ok(id.includes('test'));
  });
});
