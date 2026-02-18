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

export async function upCommand(opts: UpOptions): Promise<void> {
  const dir = resolve(opts.dir ?? process.cwd());
  const template = opts.template ?? 'software-dev';
  const project = opts.project ?? (basename(process.cwd()) || 'my-board');
  const dryRun = opts.dryRun ?? false;
  const json = opts.json ?? false;

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
