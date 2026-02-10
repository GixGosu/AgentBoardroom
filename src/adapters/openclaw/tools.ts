/**
 * AgentBoardroom — OpenClaw Tools Implementation
 *
 * Concrete implementation of OpenClawTools that shells out to the OpenClaw CLI.
 * This is the bridge between AgentBoardroom's governance abstractions and
 * the actual OpenClaw gateway runtime.
 *
 * @module adapters/openclaw/tools
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  OpenClawTools,
  OpenClawSessionConfig,
  OpenClawSpawnResult,
  OpenClawSessionStatus,
  OpenClawCronConfig,
} from './runtime.js';

const execFileAsync = promisify(execFile);

/** Options for the CLI tools implementation */
export interface OpenClawCLIToolsConfig {
  /** Path to the openclaw binary (default: 'openclaw') */
  binary?: string;
  /** Gateway URL override */
  gatewayUrl?: string;
  /** Gateway token override */
  gatewayToken?: string;
  /** Default timeout for CLI commands in ms */
  timeoutMs?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Logger function */
  log?: (msg: string) => void;
}

/**
 * Execute an openclaw CLI command and return stdout.
 */
async function runCLI(
  binary: string,
  args: string[],
  timeoutMs: number,
  log?: (msg: string) => void,
): Promise<string> {
  log?.(`[openclaw] ${binary} ${args.join(' ')}`);
  const { stdout, stderr } = await execFileAsync(binary, args, {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env },
  });
  if (stderr && log) {
    log(`[openclaw stderr] ${stderr.trim()}`);
  }
  return stdout.trim();
}

/**
 * Concrete OpenClawTools implementation using the OpenClaw CLI.
 *
 * Maps governance operations to CLI commands:
 * - sessionsSpawn → `openclaw agent --agent <id> --message <initial>`
 * - sessionsSend  → `openclaw agent --agent <id> --message <msg>`
 * - sessionsStatus → `openclaw sessions --json` (filtered)
 * - sessionsKill  → (agents are persistent; this is a no-op or clears session)
 * - cronSchedule  → `openclaw cron add`
 * - messagePost   → `openclaw message --channel <ch> --message <msg>`
 */
export class OpenClawCLITools implements OpenClawTools {
  private binary: string;
  private timeoutMs: number;
  private log?: (msg: string) => void;

  constructor(config: OpenClawCLIToolsConfig = {}) {
    this.binary = config.binary ?? 'openclaw';
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.log = config.verbose ? (config.log ?? console.log) : config.log;
  }

  /**
   * Spawn/activate an agent session by sending it an initial message.
   *
   * OpenClaw agents are pre-configured (via `openclaw agents add`).
   * "Spawning" means sending the first message to activate the session.
   * The agent ID maps to the OpenClaw agent ID (e.g., "board-ceo").
   */
  async sessionsSpawn(config: OpenClawSessionConfig): Promise<OpenClawSpawnResult> {
    const agentId = this.resolveAgentId(config.label);

    // Send the initial message to activate the agent
    const args = [
      'agent',
      '--agent', agentId,
      '--message', config.initial_message,
      '--json',
    ];

    if (config.timeout_ms) {
      args.push('--timeout', String(Math.ceil(config.timeout_ms / 1000)));
    }

    try {
      const output = await runCLI(this.binary, args, config.timeout_ms ?? this.timeoutMs, this.log);
      // Try to parse JSON response for session ID
      try {
        const result = JSON.parse(output);
        return { session_id: result.sessionId ?? result.session_id ?? `${agentId}:main` };
      } catch {
        // If not JSON, the agent responded — session is active
        return { session_id: `${agentId}:main` };
      }
    } catch (err: any) {
      throw new Error(`Failed to spawn agent "${agentId}": ${err.message}`);
    }
  }

  /**
   * Send a message to an existing agent session.
   */
  async sessionsSend(sessionId: string, message: string): Promise<void> {
    // sessionId format: "board-ceo:main" or just "board-ceo"
    const agentId = sessionId.split(':')[0];

    const args = [
      'agent',
      '--agent', agentId,
      '--message', message,
    ];

    try {
      await runCLI(this.binary, args, this.timeoutMs, this.log);
    } catch (err: any) {
      throw new Error(`Failed to send to agent "${agentId}": ${err.message}`);
    }
  }

  /**
   * Get session status for an agent.
   */
  async sessionsStatus(sessionId: string): Promise<OpenClawSessionStatus> {
    const agentId = sessionId.split(':')[0];

    try {
      const output = await runCLI(
        this.binary,
        ['sessions', '--json', '--active', '1440'],
        this.timeoutMs,
        this.log,
      );
      const sessions = JSON.parse(output);

      // Find the session matching this agent
      const match = Array.isArray(sessions)
        ? sessions.find((s: any) =>
            s.agentId === agentId ||
            s.id?.startsWith(`agent:${agentId}`) ||
            s.sessionId?.includes(agentId)
          )
        : null;

      if (match) {
        return {
          session_id: sessionId,
          state: 'running',
          last_activity_at: match.updatedAt ?? match.lastActivity ?? new Date().toISOString(),
          tokens_used: match.tokensUsed ?? match.tokens,
        };
      }

      return {
        session_id: sessionId,
        state: 'idle',
        last_activity_at: new Date().toISOString(),
      };
    } catch {
      return {
        session_id: sessionId,
        state: 'idle',
        last_activity_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Kill/stop an agent session.
   * Since OpenClaw agents are persistent, this is effectively a no-op.
   * The agent remains configured but won't receive further messages.
   */
  async sessionsKill(_sessionId: string): Promise<void> {
    // OpenClaw agents are persistent infrastructure.
    // "Killing" means we stop sending messages to them.
    // The session state is managed by OpenClaw itself.
    this.log?.(`[openclaw] Session ${_sessionId} marked for stop (agent remains configured)`);
  }

  /**
   * Schedule a cron job via the OpenClaw CLI.
   */
  async cronSchedule(config: OpenClawCronConfig): Promise<string> {
    const agentId = this.resolveAgentId(config.session_label);

    const args = [
      'cron', 'add',
      '--name', config.name,
      '--cron', config.schedule,
      '--agent', agentId,
      '--message', config.message,
      '--model', config.model,
      '--json',
    ];

    try {
      const output = await runCLI(this.binary, args, this.timeoutMs, this.log);
      try {
        const result = JSON.parse(output);
        return result.id ?? result.name ?? config.name;
      } catch {
        return config.name;
      }
    } catch (err: any) {
      throw new Error(`Failed to schedule cron "${config.name}": ${err.message}`);
    }
  }

  /**
   * Post a message to a channel (Mattermost, Discord, etc.)
   */
  async messagePost(channel: string, message: string): Promise<void> {
    const args = [
      'message',
      '--action', 'send',
      '--target', channel,
      '--message', message,
    ];

    try {
      await runCLI(this.binary, args, this.timeoutMs, this.log);
    } catch (err: any) {
      // Graceful degradation: log but don't throw if messaging fails
      this.log?.(`[openclaw] Message post failed (non-fatal): ${err.message}`);
    }
  }

  /**
   * Check if a cron job exists by name.
   */
  async cronExists(name: string): Promise<boolean> {
    try {
      const output = await runCLI(this.binary, ['cron', 'list', '--json'], this.timeoutMs, this.log);
      const jobs = JSON.parse(output);
      return Array.isArray(jobs) && jobs.some((j: any) => j.name === name);
    } catch {
      return false;
    }
  }

  /**
   * Remove a cron job by name.
   */
  async cronRemove(name: string): Promise<void> {
    try {
      await runCLI(this.binary, ['cron', 'rm', '--name', name], this.timeoutMs, this.log);
    } catch (err: any) {
      this.log?.(`[openclaw] Cron remove failed (non-fatal): ${err.message}`);
    }
  }

  /**
   * List all agents to verify they exist.
   */
  async listAgents(): Promise<Array<{ id: string; name: string; model?: string }>> {
    try {
      const output = await runCLI(this.binary, ['agents', 'list', '--json'], this.timeoutMs, this.log);
      return JSON.parse(output);
    } catch {
      return [];
    }
  }

  // ─── Private helpers ────────────────────────────────────────────

  /**
   * Resolve a boardroom role label to an OpenClaw agent ID.
   * Convention: role "ceo" → agent "board-ceo"
   */
  private resolveAgentId(label: string): string {
    // If already prefixed with "board-", use as-is
    if (label.startsWith('board-')) return label;
    // If it's a raw role name, prefix with "board-"
    return `board-${label}`;
  }
}
