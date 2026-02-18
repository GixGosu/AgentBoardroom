/**
 * CLI Command: setup — Configure OpenClaw for AgentBoardroom
 *
 * Reads board.yaml and generates the OpenClaw agent configuration
 * needed to run the board.
 *
 * Default behaviour: writes generated config to ./openclaw-agents.json
 * --dry-run:         prints to stdout, no files written
 * --apply:           patches running OpenClaw gateway via REST API
 * --json:            machine-readable output
 */

import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { ConfigLoader } from '../../core/config.js';
import { OpenClawRestTools } from '../../adapters/openclaw/rest.js';
import * as out from '../utils/output.js';
import type { ModelTier, RoleConfig } from '../../core/types.js';

export interface SetupOptions {
  /** Working directory (default: cwd) */
  dir?: string;
  /** Explicit path to board.yaml */
  config?: string;
  /** Apply config via REST API to a running gateway */
  apply?: boolean;
  /** Show what would be done without writing files */
  dryRun?: boolean;
  /** Machine-readable JSON output */
  json?: boolean;
}

// ─── Model tier → concrete model name ──────────────────────────────

const MODEL_TIER_MAP: Record<ModelTier, string> = {
  high: 'anthropic/claude-opus-4-5',
  medium: 'anthropic/claude-sonnet-4-5',
  low: 'anthropic/claude-haiku-4-5',
  local_only: 'ollama/llama3',
};

function resolveModel(tier: ModelTier): string {
  return MODEL_TIER_MAP[tier] ?? MODEL_TIER_MAP.medium;
}

// ─── Agent stanza builders ──────────────────────────────────────────

/** Default set of tools every board agent may use */
const DEFAULT_AGENT_TOOLS = [
  'message',
  'exec',
  'sessions_spawn',
  'sessions_send',
  'memory_search',
  'cron',
];

/** Generate the prompt string for an agent stanza */
function generatePrompt(roleKey: string, roleConfig: RoleConfig): string {
  return `You are the ${roleConfig.title}. Responsibilities: ${roleConfig.responsibilities.join(', ')}.`;
}

// ─── Config loader helper ───────────────────────────────────────────

function findConfig(dir: string, explicit?: string): string {
  if (explicit) {
    const p = resolve(dir, explicit);
    if (!existsSync(p)) throw new Error(`Config not found: ${p}`);
    return p;
  }
  const candidates = ['board.yaml', 'agentboardroom.yaml'];
  for (const c of candidates) {
    const p = resolve(dir, c);
    if (existsSync(p)) return p;
  }
  throw new Error(
    'No board config found. Run `agentboardroom init` first or use --config <path>.'
  );
}

// ─── Stanza shape ───────────────────────────────────────────────────

interface AgentStanza {
  prompt: string;
  model: string;
  tools: { allow: string[] };
}

// ─── Command ────────────────────────────────────────────────────────

export async function setupCommand(opts: SetupOptions): Promise<void> {
  const dir = resolve(opts.dir ?? process.cwd());
  const configPath = findConfig(dir, opts.config);

  // Load board config
  const loader = new ConfigLoader(configPath);
  const config = loader.load();

  // Build agent stanzas for each role
  const agents: Record<string, AgentStanza> = {};

  for (const [role, roleConfig] of Object.entries(config.roles)) {
    const agentId = `board-${role}`;
    agents[agentId] = {
      prompt: generatePrompt(role, roleConfig),
      model: resolveModel(roleConfig.model_tier),
      tools: { allow: [...DEFAULT_AGENT_TOOLS] },
    };
  }

  const configPatch = { agents };

  // ── JSON output mode ──────────────────────────────────────────
  if (opts.json) {
    out.jsonOutput({
      board: config.name,
      configPatch,
      mode: opts.dryRun ? 'dry-run' : opts.apply ? 'apply' : 'write',
      outputFile: opts.dryRun || opts.apply ? null : resolve(dir, 'openclaw-agents.json'),
    });
    return;
  }

  // ── Dry run ───────────────────────────────────────────────────
  if (opts.dryRun) {
    const outputFile = resolve(dir, 'openclaw-agents.json');
    writeFileSync(outputFile, JSON.stringify(configPatch, null, 2) + '\n');

    console.log(out.bold('\n🔧 AgentBoardroom — Setup (dry run)\n'));
    console.log(`  Board:  ${config.name}`);
    console.log(`  Config: ${configPath}`);
    console.log('');
    console.log(out.bold('  OpenClaw agent stanzas (openclaw-agents.json):\n'));
    console.log('  Written to: openclaw-agents.json (review before applying)');
    console.log(JSON.stringify(configPatch, null, 2));
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Review the stanzas above');
    console.log('    2. Merge into your openclaw.json under the "agents" key');
    console.log('    3. Run: openclaw gateway restart');
    console.log('');
    console.log('  Or write the file:');
    console.log('    agentboardroom setup');
    console.log('');
    console.log('  Or apply directly (requires OPENCLAW_GATEWAY_TOKEN):');
    console.log('    agentboardroom setup --apply');
    console.log('');
    return;
  }

  // ── Apply via REST ────────────────────────────────────────────
  if (opts.apply) {
    console.log(out.bold('\n🔧 AgentBoardroom — Setup (--apply)\n'));
    console.log(`  Board:  ${config.name}`);

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;

    if (!token) {
      out.error('OPENCLAW_GATEWAY_TOKEN is required for --apply mode.');
      console.log('  Set it with:');
      console.log('    export OPENCLAW_GATEWAY_TOKEN=your-token');
      process.exit(1);
    }

    // Check gateway is reachable
    const available = await OpenClawRestTools.isAvailable(gatewayUrl, token);
    if (!available) {
      out.error('OpenClaw gateway is not reachable. Is it running?');
      console.log(`  URL: ${gatewayUrl ?? 'http://localhost:18789'}`);
      console.log('  Try: openclaw gateway start');
      process.exit(1);
    }

    const restTools = new OpenClawRestTools({ baseUrl: gatewayUrl, token, verbose: false });

    console.log('  Patching OpenClaw config via gateway REST API...');
    try {
      await (restTools as any).invoke('gateway', {
        action: 'config.patch',
        raw: JSON.stringify({ agents: configPatch.agents }),
      });

      const outputFile = resolve(dir, 'openclaw-agents.json');
      writeFileSync(outputFile, JSON.stringify(configPatch, null, 2) + '\n');

      console.log('');
      out.success('OpenClaw config patched successfully!');
      console.log('  Written to: openclaw-agents.json (applied via REST)');
      console.log('');
      console.log('  Agents registered:');
      for (const [id, stanza] of Object.entries(configPatch.agents)) {
        console.log(`    ${id}: ${stanza.model}`);
      }
      console.log('');
      out.warn('Gateway restart required to activate new agents:');
      console.log('    openclaw gateway restart');
      console.log('');
    } catch (err: any) {
      out.error(`Config patch failed: ${err.message}`);
      console.log('  Write the file manually instead:');
      console.log('    agentboardroom setup');
      process.exit(1);
    }
    return;
  }

  // ── Default: write openclaw-agents.json ───────────────────────
  const outPath = resolve(dir, 'openclaw-agents.json');
  const content = JSON.stringify(configPatch, null, 2);
  writeFileSync(outPath, content, 'utf-8');

  console.log(out.bold('\n🔧 AgentBoardroom — Setup\n'));
  console.log(`  Board:   ${config.name}`);
  console.log(`  Written: ${outPath}`);
  console.log('');
  console.log(out.bold('  Agents configured:'));
  for (const [id, stanza] of Object.entries(configPatch.agents)) {
    console.log(`    ${id}: ${stanza.model}`);
  }
  console.log('');
  console.log('  Next steps:');
  console.log('  1. Review openclaw-agents.json');
  console.log('  2. Merge into your openclaw.json under the "agents" key');
  console.log('  3. Run: openclaw gateway restart');
  console.log('');
  console.log('  Or apply directly (requires OPENCLAW_GATEWAY_TOKEN):');
  console.log('    agentboardroom setup --apply');
  console.log('');
}
