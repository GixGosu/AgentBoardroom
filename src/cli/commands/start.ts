/**
 * AgentBoardroom CLI — `start` command
 *
 * Launches the Boardroom runtime:
 * 1. Loads board config
 * 2. Verifies OpenClaw agents exist
 * 3. Spawns persistent CEO/CTO sessions
 * 4. Schedules Auditor cron job
 * 5. Initializes channels
 * 6. Keeps running until stopped (SIGINT/SIGTERM)
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ConfigLoader } from '../../core/config.js';
import { GovernanceProtection } from '../../governance/protection.js';
import { OpenClawRuntimeAdapter } from '../../adapters/openclaw/runtime.js';
import { OpenClawCLITools } from '../../adapters/openclaw/tools.js';
import { StateManager } from '../../adapters/openclaw/state.js';
import * as out from '../utils/output.js';
import type { BoardConfig, RoleConfig } from '../../core/types.js';

export interface StartOptions {
  config?: string;
  dir?: string;
  json?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Find the board config file — check common locations.
 */
function findConfig(dir: string, explicit?: string): string {
  if (explicit) {
    const p = resolve(dir, explicit);
    if (!existsSync(p)) throw new Error(`Config not found: ${p}`);
    return p;
  }
  const candidates = ['board.yaml', 'agentboardroom.yaml', 'templates/software-dev.yaml'];
  for (const c of candidates) {
    const p = resolve(dir, c);
    if (existsSync(p)) return p;
  }
  throw new Error(
    'No board config found. Create board.yaml or use --config <path>.\n' +
    'Run `agentboardroom init` to create one from a template.'
  );
}

export async function startCommand(opts: StartOptions): Promise<void> {
  const dir = resolve(opts.dir ?? process.cwd());
  const configPath = findConfig(dir, opts.config);
  const stateDir = resolve(dir, 'state');

  console.log(out.bold('\n🏛️  AgentBoardroom — Starting Boardroom Runtime\n'));
  console.log(`  Config:  ${configPath}`);
  console.log(`  State:   ${stateDir}`);
  console.log('');

  // ─── Check if already running ──────────────────────────────────
  const stateManager = new StateManager(stateDir);
  if (stateManager.isRunning()) {
    const existing = stateManager.load();
    out.error(`Boardroom is already running (PID ${existing.pid}, since ${existing.started_at})`);
    console.log('  Use `agentboardroom stop` to stop it first.');
    process.exit(1);
  }

  // ─── Load config ───────────────────────────────────────────────
  const loader = new ConfigLoader(configPath);
  const config = loader.load();
  console.log(`  Board:   ${config.name} (v${config.version})`);
  console.log(`  Roles:   ${Object.keys(config.roles).join(', ')}`);
  console.log('');

  // ─── Initialize tools ─────────────────────────────────────────
  const tools = new OpenClawCLITools({
    verbose: opts.verbose,
    log: opts.verbose ? console.log : undefined,
  });

  // ─── Verify agents exist ──────────────────────────────────────
  console.log('  Checking OpenClaw agents...');
  const agents = await tools.listAgents();
  const agentIds = new Set(agents.map(a => a.id));
  const missingAgents: string[] = [];

  for (const role of Object.keys(config.roles)) {
    const expectedId = `board-${role}`;
    if (agentIds.has(expectedId)) {
      const agent = agents.find(a => a.id === expectedId);
      console.log(`    ✅ ${expectedId} (${agent?.name ?? role}) — ${agent?.model ?? 'default model'}`);
    } else {
      console.log(`    ❌ ${expectedId} — NOT FOUND`);
      missingAgents.push(expectedId);
    }
  }

  if (missingAgents.length > 0) {
    console.log('');
    out.error(`Missing agents: ${missingAgents.join(', ')}`);
    console.log('  Create them with:');
    for (const id of missingAgents) {
      console.log(`    openclaw agents add ${id}`);
    }
    process.exit(1);
  }
  console.log('');

  if (opts.dryRun) {
    console.log(out.bold('  Dry run complete — would start the following:'));
    printStartPlan(config);
    return;
  }

  // ─── Initialize governance ─────────────────────────────────────
  const governance = new GovernanceProtection(config.governance, dir);

  // ─── Initialize runtime adapter ───────────────────────────────
  const runtime = new OpenClawRuntimeAdapter({
    tools,
    governance,
    defaultAllowedPaths: ['state/**', 'output/**'],
  });

  // ─── Mark as running ──────────────────────────────────────────
  const state = stateManager.markRunning(configPath);

  // ─── Spawn persistent sessions ────────────────────────────────
  console.log('  Activating board agents...\n');

  for (const [role, roleConfig] of Object.entries(config.roles)) {
    if (roleConfig.session_type === 'cron') {
      // Schedule cron instead of spawning
      await startCronAgent(role, roleConfig, config, tools, stateManager, loader);
      continue;
    }

    if (roleConfig.session_type === 'persistent') {
      await startPersistentAgent(role, roleConfig, config, runtime, stateManager, loader);
    } else if (roleConfig.session_type === 'spawned') {
      // On-demand agents are not spawned at startup
      console.log(`    ⏳ ${role} (${roleConfig.title}) — on-demand, will spawn when needed`);
    }
  }

  // ─── Post startup message to channel ──────────────────────────
  if (config.channels?.primary) {
    try {
      const agentList = Object.entries(config.roles)
        .map(([r, rc]) => `• **${rc.title}** (${r}) — ${rc.session_type}`)
        .join('\n');

      await tools.messagePost(
        config.channels.primary,
        `🏛️ **AgentBoardroom Started**\n\n` +
        `Board: ${config.name}\n` +
        `Agents:\n${agentList}\n\n` +
        `State: ${stateDir}\n` +
        `Started: ${new Date().toISOString()}`
      );
    } catch {
      console.log('    ⚠️  Could not post to primary channel (messaging may not be configured)');
    }
  }

  // ─── Status summary ───────────────────────────────────────────
  console.log('');
  console.log(out.bold('  ✅ Boardroom is running!\n'));
  console.log(`  PID:     ${process.pid}`);
  console.log(`  State:   ${stateManager.path}`);
  console.log(`  Stop:    agentboardroom stop${opts.dir ? ` --dir ${opts.dir}` : ''}`);
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify(stateManager.load(), null, 2));
  }

  // ─── Keep alive ───────────────────────────────────────────────
  // The boardroom stays running to maintain session state.
  // In practice, the agents are persistent in OpenClaw and don't need
  // a keepalive process. But we keep this alive for:
  // - Clean shutdown via `agentboardroom stop`
  // - State file locking (PID check)
  // - Future: health monitoring loop

  const shutdown = async (signal: string) => {
    console.log(`\n  Received ${signal} — shutting down...`);
    await stopAllAgents(stateManager, tools, config);
    stateManager.markStopped();
    console.log('  🏛️  Boardroom stopped.\n');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Heartbeat loop — periodic health check
  const heartbeatInterval = setInterval(() => {
    // Update state timestamp to show we're alive
    const s = stateManager.load();
    s.updated_at = new Date().toISOString();
    stateManager.save(s);
  }, 60_000);

  // Keep process alive
  await new Promise(() => {
    // Never resolves — process runs until signal
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

async function startPersistentAgent(
  role: string,
  roleConfig: RoleConfig,
  boardConfig: BoardConfig,
  runtime: OpenClawRuntimeAdapter,
  stateManager: StateManager,
  loader: ConfigLoader,
): Promise<void> {
  try {
    // Resolve prompt template
    let prompt: string;
    try {
      prompt = loader.resolvePrompt(roleConfig.prompt, role, boardConfig);
    } catch {
      prompt = `You are the ${roleConfig.title}. Responsibilities: ${roleConfig.responsibilities.join(', ')}.`;
    }

    const sessionId = await runtime.spawnAgent({
      agentId: role,
      prompt,
      task: `You are now active as the ${roleConfig.title}. The Boardroom has been started. ` +
            `Your responsibilities: ${roleConfig.responsibilities.join(', ')}. ` +
            `Acknowledge your activation and await directives.`,
      model: roleConfig.model_tier,
    });

    stateManager.recordSession(role, sessionId);
    console.log(`    ✅ ${role} (${roleConfig.title}) — session: ${sessionId}`);
  } catch (err: any) {
    console.log(`    ❌ ${role} (${roleConfig.title}) — FAILED: ${err.message}`);
  }
}

async function startCronAgent(
  role: string,
  roleConfig: RoleConfig,
  boardConfig: BoardConfig,
  tools: OpenClawCLITools,
  stateManager: StateManager,
  loader: ConfigLoader,
): Promise<void> {
  const cronName = `boardroom-${role}`;
  const interval = roleConfig.interval ?? '15m';

  // Convert interval notation to cron expression
  const cronExpr = intervalToCron(interval);

  // Build the audit message
  const message = `Perform your scheduled ${roleConfig.title} audit. ` +
    `Check: ${roleConfig.responsibilities.join(', ')}. ` +
    `Report any anomalies, budget concerns, or governance violations.`;

  try {
    // Check if cron already exists
    const exists = await tools.cronExists(cronName);
    if (exists) {
      console.log(`    ♻️  ${role} (${roleConfig.title}) — cron "${cronName}" already exists`);
      stateManager.recordCronJob(cronName, cronName);
      return;
    }

    const jobId = await tools.cronSchedule({
      name: cronName,
      schedule: cronExpr,
      session_label: role,
      model: 'low',
      message,
    });

    stateManager.recordCronJob(cronName, jobId);
    console.log(`    ✅ ${role} (${roleConfig.title}) — cron: ${cronExpr} (${cronName})`);
  } catch (err: any) {
    console.log(`    ❌ ${role} (${roleConfig.title}) — cron FAILED: ${err.message}`);
  }
}

async function stopAllAgents(
  stateManager: StateManager,
  tools: OpenClawCLITools,
  config: BoardConfig,
): Promise<void> {
  const state = stateManager.load();

  // Remove cron jobs
  for (const [name] of Object.entries(state.cronJobs)) {
    try {
      await tools.cronRemove(name);
      console.log(`    Removed cron: ${name}`);
    } catch {
      console.log(`    ⚠️  Could not remove cron: ${name}`);
    }
  }

  // Post shutdown message
  if (config.channels?.primary) {
    try {
      await tools.messagePost(
        config.channels.primary,
        `🏛️ **AgentBoardroom Stopping**\n\nShutdown initiated at ${new Date().toISOString()}`
      );
    } catch {
      // Non-fatal
    }
  }
}

function intervalToCron(interval: string): string {
  const match = interval.match(/^(\d+)(m|h|d)$/);
  if (!match) return '*/15 * * * *'; // Default: every 15 minutes

  const [, num, unit] = match;
  const n = parseInt(num, 10);

  switch (unit) {
    case 'm': return `*/${n} * * * *`;
    case 'h': return `0 */${n} * * *`;
    case 'd': return `0 0 */${n} * *`;
    default: return '*/15 * * * *';
  }
}

function printStartPlan(config: BoardConfig): void {
  for (const [role, rc] of Object.entries(config.roles)) {
    const action = rc.session_type === 'cron'
      ? `cron (${rc.interval ?? '15m'})`
      : rc.session_type === 'spawned'
        ? 'on-demand'
        : 'spawn persistent session';
    console.log(`    ${role} (${rc.title}): ${action} [${rc.model_tier}]`);
  }
}
