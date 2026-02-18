/**
 * AgentBoardroom — OpenClaw REST Tools Implementation
 *
 * Concrete implementation of OpenClawTools that calls the OpenClaw gateway
 * REST API directly (POST /tools/invoke). Works without the openclaw CLI binary.
 *
 * Config via environment variables:
 *   OPENCLAW_GATEWAY_URL   — default: http://localhost:18789
 *   OPENCLAW_GATEWAY_TOKEN — required for auth
 */

import type {
  OpenClawTools,
  OpenClawSessionConfig,
  OpenClawSpawnResult,
  OpenClawSessionStatus,
  OpenClawCronConfig,
} from './runtime.js';

/** Options for the REST tools implementation */
export interface OpenClawRestToolsConfig {
  /** Gateway base URL (default: process.env.OPENCLAW_GATEWAY_URL or http://localhost:18789) */
  baseUrl?: string;
  /** Auth token (default: process.env.OPENCLAW_GATEWAY_TOKEN) */
  token?: string;
  /** Request timeout in ms (default: 30_000) */
  timeoutMs?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Logger function */
  log?: (msg: string) => void;
}

// ─── Agent ID Helper ───────────────────────────────────────────────

/**
 * Map a role name / label to the canonical OpenClaw agent ID format.
 * Examples:
 *   "ceo"       → "board-ceo"
 *   "board-cto" → "board-cto"   (already prefixed, pass through)
 *   "qa"        → "board-qa"
 */
export function resolveAgentId(label: string): string {
  if (label.startsWith('board-')) return label;
  return `board-${label}`;
}

// ─── REST Tools Implementation ─────────────────────────────────────

/**
 * Concrete OpenClawTools implementation that talks to the OpenClaw
 * gateway REST API instead of shelling out to the CLI binary.
 *
 * Endpoint: POST /tools/invoke
 * Body:     { tool: string, args: object }
 * Header:   Authorization: Bearer <token>
 */
export class OpenClawRestTools implements OpenClawTools {
  private gatewayUrl: string;
  private gatewayToken: string;
  private timeoutMs: number;
  private log?: (msg: string) => void;

  constructor(config: OpenClawRestToolsConfig = {}) {
    this.gatewayUrl = (
      config.baseUrl ??
      process.env.OPENCLAW_GATEWAY_URL ??
      'http://localhost:18789'
    ).replace(/\/$/, '');

    this.gatewayToken = (
      config.token ??
      process.env.OPENCLAW_GATEWAY_TOKEN ??
      ''
    );

    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.log = config.verbose ? (config.log ?? console.log) : config.log;
  }

  // ─── Core invoke helper ─────────────────────────────────────────

  /**
   * POST /tools/invoke with the given tool name and args.
   * Returns parsed JSON from the response body.
   */
  private async invoke(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const url = `${this.gatewayUrl}/tools/invoke`;
    const body = JSON.stringify({ tool, args });

    this.log?.(`[rest] POST ${url} tool=${tool}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.gatewayToken) {
        headers['Authorization'] = `Bearer ${this.gatewayToken}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gateway returned ${res.status}: ${text}`);
      }

      const json = await res.json() as unknown;
      this.log?.(`[rest] response: ${JSON.stringify(json).slice(0, 200)}`);
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── OpenClawTools interface ────────────────────────────────────

  /**
   * Spawn/activate an agent session by sending it an initial message via REST.
   * Maps to: POST /tools/invoke { tool: "sessions_send", args: { agentId, message } }
   */
  async sessionsSpawn(config: OpenClawSessionConfig): Promise<OpenClawSpawnResult> {
    const agentId = resolveAgentId(config.label);
    try {
      const result = await this.invoke('sessions_send', {
        agentId,
        message: config.initial_message,
      }) as Record<string, unknown>;

      const sessionId: string =
        (typeof result?.sessionId === 'string' ? result.sessionId : undefined) ??
        (typeof result?.session_id === 'string' ? result.session_id : undefined) ??
        `${agentId}:main`;

      return { session_id: sessionId };
    } catch (err: any) {
      throw new Error(`Failed to spawn agent "${agentId}" via REST: ${err.message}`);
    }
  }

  /**
   * Send a message to an existing session.
   * Maps to: POST /tools/invoke { tool: "sessions_send", args: { sessionKey, message } }
   */
  async sessionsSend(sessionId: string, message: string): Promise<void> {
    try {
      await this.invoke('sessions_send', { sessionKey: sessionId, message });
    } catch (err: any) {
      throw new Error(`Failed to send to session "${sessionId}" via REST: ${err.message}`);
    }
  }

  /**
   * Get session status.
   * Maps to: POST /tools/invoke { tool: "sessions_list", args: {} } → filter by sessionKey
   */
  async sessionsStatus(sessionId: string): Promise<OpenClawSessionStatus> {
    try {
      const result = await this.invoke('sessions_list', {}) as unknown[];
      const sessions = Array.isArray(result) ? result : [];

      const match = sessions.find((s: any) =>
        s?.sessionKey === sessionId ||
        s?.id === sessionId ||
        s?.sessionId === sessionId ||
        (typeof s?.sessionKey === 'string' && s.sessionKey.includes(sessionId))
      ) as Record<string, unknown> | undefined;

      if (match) {
        return {
          session_id: sessionId,
          state: 'running',
          last_activity_at:
            (typeof match.updatedAt === 'string' ? match.updatedAt : undefined) ??
            (typeof match.lastActivity === 'string' ? match.lastActivity : undefined) ??
            new Date().toISOString(),
          tokens_used: typeof match.tokensUsed === 'number' ? match.tokensUsed : undefined,
        };
      }
    } catch {
      // Fall through to idle response
    }

    return {
      session_id: sessionId,
      state: 'idle',
      last_activity_at: new Date().toISOString(),
    };
  }

  /**
   * Kill/stop a session.
   * OpenClaw agents are persistent — this is a no-op for REST as well.
   */
  async sessionsKill(_sessionId: string): Promise<void> {
    this.log?.(`[rest] sessionsKill is a no-op (agents are persistent): ${_sessionId}`);
  }

  /**
   * Schedule a cron job via REST.
   * Maps to: POST /tools/invoke { tool: "cron", args: { action: "add", job: { ... } } }
   */
  async cronSchedule(config: OpenClawCronConfig): Promise<string> {
    try {
      const result = await this.invoke('cron', {
        action: 'add',
        job: {
          name: config.name,
          schedule: { kind: 'cron', expr: config.schedule },
          payload: { kind: 'agentTurn', message: config.message },
          sessionTarget: 'isolated',
        },
      }) as Record<string, unknown>;

      return (
        (typeof result?.id === 'string' ? result.id : undefined) ??
        (typeof result?.name === 'string' ? result.name : undefined) ??
        config.name
      );
    } catch (err: any) {
      throw new Error(`Failed to schedule cron "${config.name}" via REST: ${err.message}`);
    }
  }

  /**
   * Post a message to a channel via REST.
   * Maps to: POST /tools/invoke { tool: "message", args: { action: "send", channel, message } }
   */
  async messagePost(channel: string, message: string): Promise<void> {
    try {
      await this.invoke('message', { action: 'send', channel, message });
    } catch (err: any) {
      // Graceful degradation — log but do not throw
      this.log?.(`[rest] messagePost failed (non-fatal): ${err.message}`);
    }
  }

  // ─── Extended methods (matching OpenClawCLITools) ───────────────

  /**
   * Check if a cron job exists by name.
   * Maps to: POST /tools/invoke { tool: "cron", args: { action: "list" } }
   */
  async cronExists(name: string): Promise<boolean> {
    try {
      const result = await this.invoke('cron', { action: 'list' }) as unknown[];
      const jobs = Array.isArray(result) ? result : [];
      return jobs.some((j: any) => j?.name === name);
    } catch {
      return false;
    }
  }

  /**
   * Remove a cron job by name.
   * Maps to: POST /tools/invoke { tool: "cron", args: { action: "remove", jobId: name } }
   */
  async cronRemove(name: string): Promise<void> {
    try {
      await this.invoke('cron', { action: 'remove', jobId: name });
    } catch (err: any) {
      this.log?.(`[rest] cronRemove failed (non-fatal): ${err.message}`);
    }
  }

  /**
   * List all agents.
   * Maps to: POST /tools/invoke { tool: "agents_list", args: {} }
   */
  async listAgents(): Promise<Array<{ id: string; name: string; model?: string }>> {
    try {
      const result = await this.invoke('agents_list', {}) as unknown[];
      return Array.isArray(result) ? result as Array<{ id: string; name: string; model?: string }> : [];
    } catch {
      return [];
    }
  }

  // ─── Static helpers ─────────────────────────────────────────────

  /**
   * Test connectivity to the OpenClaw gateway.
   * Returns true if the gateway is reachable, false otherwise.
   */
  static async isAvailable(
    baseUrl?: string,
    token?: string,
    timeoutMs = 5_000,
  ): Promise<boolean> {
    const url = (
      baseUrl ??
      process.env.OPENCLAW_GATEWAY_URL ??
      'http://localhost:18789'
    ).replace(/\/$/, '');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const tok = token ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? '';
      if (tok) headers['Authorization'] = `Bearer ${tok}`;

      // Try a lightweight ping via the tools/invoke endpoint
      const res = await fetch(`${url}/tools/invoke`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tool: 'agents_list', args: {} }),
        signal: controller.signal,
      });

      // Any HTTP response (even 401) means the gateway is up
      return res.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
