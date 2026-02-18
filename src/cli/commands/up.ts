/**
 * CLI Command: up — Shortcut: init + setup + start in one command.
 *
 * Orchestrates the three-step startup sequence:
 *   [1/3] Init   — creates board.yaml (skipped if already exists)
 *   [2/3] Setup  — configures OpenClaw agents
 *   [3/3] Start  — launches the Boardroom runtime
 */

import { existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { initCommand } from './init.js';
import { setupCommand } from './setup.js';
import { startCommand } from './start.js';
import { OpenClawRestTools } from '../../adapters/openclaw/rest.js';
import * as out from '../utils/output.js';

export interface UpOptions {
  /** Template to use for init (default: software-dev) */
  template?: string;
  /** Project name for init (default: cwd folder name) */
  project?: string;
  /** Working directory (default: cwd) */
  dir?: string;
  /** Show what would happen, don't actually start */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Machine-readable output */
  json?: boolean;
}

// ─── Gateway readiness helper ───────────────────────────────────────

/**
 * Wait for the gateway to come back up after restart.
 * Polls the gateway health endpoint every second for up to maxWaitMs.
 */
async function waitForGateway(
  maxWaitMs: number = 10_000,
  pollIntervalMs: number = 1_000,
  verbose: boolean = false,
  log: (msg: string) => void = console.log
): Promise<boolean> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;

  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    const available = await OpenClawRestTools.isAvailable(gatewayUrl, token, 2_000);

    if (available) {
      if (verbose) {
        log(`  Gateway ready after ${attempts} attempt(s) (${Date.now() - startTime}ms)`);
      }
      return true;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

/**
 * Simple delay helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function upCommand(opts: UpOptions): Promise<void> {
  const dir = resolve(opts.dir ?? process.cwd());
  const template = opts.template ?? 'software-dev';
  const project = opts.project ?? (basename(process.cwd()) || 'my-board');
  const dryRun = opts.dryRun ?? false;
  const json = opts.json ?? false;
  const verbose = opts.verbose ?? false;

  // ─── [1/3] Init ────────────────────────────────────────────────
  const boardYaml = resolve(dir, 'board.yaml');
  const alreadyInitialized = existsSync(boardYaml);

  if (alreadyInitialized) {
    if (!json) {
      console.log('[1/3] Board already initialized — skipping init');
    }
  } else {
    if (!json) {
      console.log('[1/3] Initializing board...');
    }
    try {
      await initCommand({ template, project, dir, json });
    } catch (err: any) {
      out.error(`Init failed: ${err.message ?? String(err)}`);
      console.log('');
      console.log('  Fix the error above, then re-run: agentboardroom up');
      process.exit(1);
    }
  }

  // ─── [2/3] Setup ───────────────────────────────────────────────
  if (!json) {
    console.log('[2/3] Configuring agents...');
  }

  const hasToken = !!process.env.OPENCLAW_GATEWAY_TOKEN;
  let setupApplied = false;

  if (!hasToken && !json) {
    out.warn('OPENCLAW_GATEWAY_TOKEN is not set.');
    console.log('  To apply agents automatically, set it with:');
    console.log('    export OPENCLAW_GATEWAY_TOKEN=your-token');
    console.log('  Continuing in standalone mode (dry-run setup)...');
    console.log('');
  }

  try {
    if (hasToken) {
      await setupCommand({ dir, json, apply: true });
      setupApplied = true;
    } else {
      // Dry-run mode — generate openclaw-agents.json but don't apply
      await setupCommand({ dir, json, dryRun: true });
    }
  } catch (err: any) {
    // Setup failure is non-fatal — warn and continue
    if (!json) {
      out.warn(`Setup encountered an issue: ${err.message ?? String(err)}`);
      console.log('  Continuing to start in standalone mode...');
      console.log('');
    }
  }

  // ─── Wait for gateway after setup --apply ──────────────────────
  if (setupApplied && !dryRun) {
    if (!json) {
      console.log('');
      console.log('  Waiting for gateway to restart...');
    }

    // Initial delay to let gateway begin restart
    await sleep(3_000);

    // Poll gateway health for up to 10 seconds
    const ready = await waitForGateway(10_000, 1_000, verbose, console.log);

    if (!ready) {
      if (!json) {
        out.warn('Gateway may not be fully ready. Proceeding anyway...');
        console.log('');
      }
    } else {
      if (!json && verbose) {
        console.log('  Gateway is ready.');
        console.log('');
      }
    }
  }

  // ─── [3/3] Start ───────────────────────────────────────────────
  if (!json) {
    console.log('[3/3] Starting boardroom...');
  }

  try {
    await startCommand({ dir, json, dryRun, verbose: opts.verbose });
  } catch (err: any) {
    out.error(`Start failed: ${err.message ?? String(err)}`);
    console.log('');
    console.log('  Remediation steps:');
    console.log('  1. Check board.yaml is valid:  agentboardroom status');
    console.log('  2. Verify agents are set up:   agentboardroom setup --dry-run');
    console.log('  3. Check OpenClaw gateway:     openclaw gateway status');
    console.log('  4. Re-run:                     agentboardroom up');
    process.exit(1);
  }
}
