/**
 * AgentBoardroom — State Persistence Manager
 *
 * Manages saving/loading of runtime state so the Boardroom survives restarts.
 * State includes: active sessions, cron job IDs, channel mappings, and timestamps.
 *
 * @module adapters/openclaw/state
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/** Runtime state that persists across restarts */
export interface BoardroomState {
  /** When the boardroom was started */
  started_at: string;
  /** When state was last saved */
  updated_at: string;
  /** Active agent sessions: role → session ID */
  sessions: Record<string, string>;
  /** Active cron job IDs: name → job ID */
  cronJobs: Record<string, string>;
  /** Channel mappings: logical name → platform channel ID */
  channels: Record<string, string>;
  /** Board config path used */
  configPath: string;
  /** PID of the running process (for stop command) */
  pid: number;
  /** Status */
  status: 'running' | 'stopped' | 'error';
}

const DEFAULT_STATE: BoardroomState = {
  started_at: '',
  updated_at: '',
  sessions: {},
  cronJobs: {},
  channels: {},
  configPath: '',
  pid: 0,
  status: 'stopped',
};

export class StateManager {
  private statePath: string;

  constructor(stateDir: string) {
    this.statePath = resolve(stateDir, 'runtime.json');
  }

  /** Load existing state or return defaults */
  load(): BoardroomState {
    if (!existsSync(this.statePath)) {
      return { ...DEFAULT_STATE };
    }
    try {
      const raw = readFileSync(this.statePath, 'utf-8');
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  /** Save state to disk */
  save(state: BoardroomState): void {
    state.updated_at = new Date().toISOString();
    const dir = dirname(this.statePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  /** Check if a boardroom is currently running */
  isRunning(): boolean {
    const state = this.load();
    if (state.status !== 'running') return false;
    // Check if PID is still alive
    if (state.pid > 0) {
      try {
        process.kill(state.pid, 0);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Mark as running */
  markRunning(configPath: string): BoardroomState {
    const state = this.load();
    state.status = 'running';
    state.started_at = new Date().toISOString();
    state.configPath = configPath;
    state.pid = process.pid;
    this.save(state);
    return state;
  }

  /** Mark as stopped */
  markStopped(): void {
    const state = this.load();
    state.status = 'stopped';
    state.pid = 0;
    this.save(state);
  }

  /** Record a spawned session */
  recordSession(role: string, sessionId: string): void {
    const state = this.load();
    state.sessions[role] = sessionId;
    this.save(state);
  }

  /** Record a cron job */
  recordCronJob(name: string, jobId: string): void {
    const state = this.load();
    state.cronJobs[name] = jobId;
    this.save(state);
  }

  /** Record a channel mapping */
  recordChannel(name: string, channelId: string): void {
    const state = this.load();
    state.channels[name] = channelId;
    this.save(state);
  }

  /** Get state file path */
  get path(): string {
    return this.statePath;
  }
}
