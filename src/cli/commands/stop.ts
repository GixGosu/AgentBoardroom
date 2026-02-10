/**
 * AgentBoardroom CLI — `stop` command
 *
 * Gracefully shuts down the Boardroom runtime:
 * 1. Loads runtime state
 * 2. Cancels Auditor cron jobs
 * 3. Sends shutdown notification to channels
 * 4. Saves final state
 * 5. Signals the running process to exit (if PID-based)
 */

import { resolve } from 'node:path';
import { ConfigLoader } from '../../core/config.js';
import { OpenClawCLITools } from '../../adapters/openclaw/tools.js';
import { StateManager } from '../../adapters/openclaw/state.js';
import * as out from '../utils/output.js';

export interface StopOptions {
  dir?: string;
  json?: boolean;
  force?: boolean;
}

export async function stopCommand(opts: StopOptions): Promise<void> {
  const dir = resolve(opts.dir ?? process.cwd());
  const stateDir = resolve(dir, 'state');

  console.log(out.bold('\n🏛️  AgentBoardroom — Stopping Boardroom\n'));

  const stateManager = new StateManager(stateDir);
  const state = stateManager.load();

  if (state.status !== 'running' && !opts.force) {
    console.log('  Boardroom is not running.');
    if (opts.json) console.log(JSON.stringify(state, null, 2));
    return;
  }

  const tools = new OpenClawCLITools();

  // ─── Remove cron jobs ─────────────────────────────────────────
  for (const [name] of Object.entries(state.cronJobs)) {
    try {
      await tools.cronRemove(name);
      console.log(`  ✅ Removed cron: ${name}`);
    } catch {
      console.log(`  ⚠️  Could not remove cron: ${name}`);
    }
  }

  // ─── Post shutdown to channel ─────────────────────────────────
  if (state.configPath) {
    try {
      const loader = new ConfigLoader(state.configPath);
      const config = loader.load();
      if (config.channels?.primary) {
        await tools.messagePost(
          config.channels.primary,
          `🏛️ **AgentBoardroom Stopped**\n\n` +
          `Ran since: ${state.started_at}\n` +
          `Stopped: ${new Date().toISOString()}\n` +
          `Sessions: ${Object.keys(state.sessions).length}\n` +
          `Cron jobs removed: ${Object.keys(state.cronJobs).length}`
        );
      }
    } catch {
      // Non-fatal
    }
  }

  // ─── Signal the running process ───────────────────────────────
  if (state.pid > 0 && state.pid !== process.pid) {
    try {
      process.kill(state.pid, 'SIGTERM');
      console.log(`  ✅ Sent SIGTERM to PID ${state.pid}`);
    } catch (err: any) {
      if (err.code === 'ESRCH') {
        console.log(`  ℹ️  Process ${state.pid} already exited`);
      } else {
        console.log(`  ⚠️  Could not signal PID ${state.pid}: ${err.message}`);
      }
    }
  }

  // ─── Mark stopped ─────────────────────────────────────────────
  stateManager.markStopped();

  console.log('');
  console.log(out.bold('  ✅ Boardroom stopped.\n'));
  console.log(`  State saved to: ${stateManager.path}`);
  console.log(`  Sessions were: ${Object.keys(state.sessions).join(', ') || 'none'}`);
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify(stateManager.load(), null, 2));
  }
}
