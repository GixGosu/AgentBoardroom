/**
 * AgentBoardroom — OpenClaw Adapter Factory
 *
 * Explicit adapter selection with logged output.
 * Reads `AdapterMode` from board.yaml `runtime.adapter` field (default: 'auto').
 *
 * @module adapters/openclaw/factory
 */

import { execFileSync } from 'node:child_process';
import { OpenClawCLITools } from './tools.js';
import { OpenClawRestTools } from './rest.js';
import type {
  OpenClawTools,
  OpenClawSessionConfig,
  OpenClawSpawnResult,
  OpenClawSessionStatus,
  OpenClawCronConfig,
} from './runtime.js';

// ─── Types ─────────────────────────────────────────────────────────

/**
 * Adapter selection mode — readable from board.yaml `runtime.adapter`.
 * Default: 'auto'
 */
export type AdapterMode = 'auto' | 'openclaw-cli' | 'openclaw-rest' | 'standalone';

export interface BoardToolsConfig {
  /** Gateway URL for REST adapter */
  url?: string;
  /** Auth token for REST adapter */
  token?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Extended tool interface used by the start/stop commands.
 * Superset of OpenClawTools with lifecycle helpers.
 * Both OpenClawCLITools and OpenClawRestTools structurally satisfy this interface.
 */
export interface BoardTools extends OpenClawTools {
  /** List all configured agents */
  listAgents(): Promise<Array<{ id: string; name: string; model?: string }>>;
  /** Check whether a named cron job exists */
  cronExists(name: string): Promise<boolean>;
  /** Remove a cron job by name */
  cronRemove(name: string): Promise<void>;
}

// ─── Standalone (no-op) adapter ─────────────────────────────────────

/**
 * Standalone adapter — all operations are no-ops or return empty values.
 * Useful for dry-run, local testing, or environments with no OpenClaw instance.
 */
class StandaloneTools implements BoardTools {
  async sessionsSpawn(config: OpenClawSessionConfig): Promise<OpenClawSpawnResult> {
    return { session_id: `standalone-${config.label}` };
  }

  async sessionsSend(_sessionId: string, _message: string): Promise<void> {
    // no-op
  }

  async sessionsStatus(sessionId: string): Promise<OpenClawSessionStatus> {
    return {
      session_id: sessionId,
      state: 'idle',
      last_activity_at: new Date().toISOString(),
    };
  }

  async sessionsKill(_sessionId: string): Promise<void> {
    // no-op
  }

  async cronSchedule(config: OpenClawCronConfig): Promise<string> {
    return config.name;
  }

  async messagePost(_channel: string, _message: string): Promise<void> {
    // no-op
  }

  async listAgents(): Promise<Array<{ id: string; name: string; model?: string }>> {
    return [];
  }

  async cronExists(_name: string): Promise<boolean> {
    return false;
  }

  async cronRemove(_name: string): Promise<void> {
    // no-op
  }
}

// ─── CLI availability check ─────────────────────────────────────────

/**
 * Synchronously check whether the `openclaw` binary is accessible in PATH.
 */
function isCliAvailable(): boolean {
  try {
    execFileSync('openclaw', ['--version'], { timeout: 3_000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ─── Factory function ───────────────────────────────────────────────

/**
 * Create the appropriate OpenClaw tools adapter based on the selected mode.
 *
 * Logs the chosen adapter to stdout so operators can confirm which path is active.
 *
 * @param mode  - Adapter selection mode (reads from board.yaml `runtime.adapter`)
 * @param config - URL/token/verbose config for REST adapter
 * @returns     BoardTools instance (satisfies both OpenClawTools and extended helpers)
 */
export function createTools(mode: AdapterMode, config: BoardToolsConfig = {}): BoardTools {
  const url = config.url ?? process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:18789';
  const token = config.token ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

  switch (mode) {
    case 'openclaw-cli': {
      // Require CLI — fail with actionable error if not found
      if (!isCliAvailable()) {
        console.error('');
        console.error('  ✗ openclaw CLI not found but adapter mode is "openclaw-cli".');
        console.error('');
        console.error('  Install it:');
        console.error('    npm install -g openclaw');
        console.error('    openclaw gateway start');
        console.error('');
        console.error('  Or switch adapter mode in board.yaml:');
        console.error('    runtime:');
        console.error('      adapter: openclaw-rest');
        console.error('');
        process.exit(1);
      }
      console.log('  [INFO] Using OpenClaw CLI adapter');
      return new OpenClawCLITools({ verbose: config.verbose }) as unknown as BoardTools;
    }

    case 'openclaw-rest': {
      // Use REST directly — log the URL
      console.log(`  [INFO] Using OpenClaw REST adapter (${url})`);
      return new OpenClawRestTools({
        baseUrl: url,
        token,
        verbose: config.verbose,
      }) as unknown as BoardTools;
    }

    case 'standalone': {
      console.log('  [INFO] Using standalone adapter (no-op)');
      return new StandaloneTools();
    }

    case 'auto':
    default: {
      if (isCliAvailable()) {
        console.log('  [INFO] Using OpenClaw CLI adapter');
        return new OpenClawCLITools({ verbose: config.verbose }) as unknown as BoardTools;
      }
      console.warn('  [WARN] openclaw CLI not found — falling back to REST adapter');
      return new OpenClawRestTools({
        baseUrl: url,
        token,
        verbose: config.verbose,
      }) as unknown as BoardTools;
    }
  }
}
