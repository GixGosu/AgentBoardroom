/**
 * CLI Command: setup — Configure OpenClaw for AgentBoardroom
 *
 * Reads board.yaml and generates the OpenClaw agent configuration
 * needed to run the board.
 *
 * Default behaviour: writes generated config to ./openclaw-agents.json
 * --dry-run:         prints to stdout, no files written
 * --apply:           patches running OpenClaw gateway via REST API,
 *                    deploys workspace files, and triggers gateway restart
 * --json:            machine-readable output
 */

import { resolve, join } from 'node:path';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { ConfigLoader } from '../../core/config.js';
import { OpenClawRestTools } from '../../adapters/openclaw/rest.js';
import * as out from '../utils/output.js';
import type { ModelTier, RoleConfig, BoardConfig } from '../../core/types.js';

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

// ─── OpenClaw config types ──────────────────────────────────────────

interface OpenClawAgentConfig {
  id: string;
  name: string;
  model: string;
  workspace: string;
  heartbeat?: {
    every: string;
    target: string;
    to: string;
  };
  subagents: {
    allowAgents: string[];
  };
}

interface OpenClawBinding {
  agentId: string;
  match: {
    channel: string;
    peer: {
      kind: string;
      id: string;
    };
  };
}

interface OpenClawConfig {
  agents: {
    list: OpenClawAgentConfig[];
  };
  bindings?: OpenClawBinding[];
}

// ─── Workspace file deployment ──────────────────────────────────────

function getWorkspacePath(role: string): string {
  return join(homedir(), '.openclaw', `workspace-board-${role}`);
}

function deployWorkspaceFiles(
  role: string,
  roleConfig: RoleConfig,
  config: BoardConfig,
  loader: ConfigLoader,
  baseDir: string
): void {
  const workspacePath = getWorkspacePath(role);
  mkdirSync(workspacePath, { recursive: true });

  // AGENTS.md - resolved prompt from agents/{role}.md
  let agentsContent: string;
  try {
    agentsContent = loader.resolvePrompt(roleConfig.prompt, role, config);
  } catch {
    // Fallback if prompt file doesn't exist
    agentsContent = `# ${roleConfig.title}\n\nYou are the ${roleConfig.title}. Responsibilities: ${roleConfig.responsibilities.join(', ')}.`;
  }
  writeFileSync(join(workspacePath, 'AGENTS.md'), agentsContent, 'utf-8');

  // SOUL.md - personality/communication style
  const soulTemplatePath = join(baseDir, 'install', 'workspaces', `board-${role}`, 'SOUL.md');
  let soulContent: string;
  if (existsSync(soulTemplatePath)) {
    soulContent = readFileSync(soulTemplatePath, 'utf-8');
  } else {
    soulContent = `# ${roleConfig.title} — Communication Style

## Tone
- Professional and direct
- Focus on actionable information
- Avoid unnecessary pleasantries

## Format Preferences
- Use structured formats (bullets, numbered lists) for clarity
- Lead with the most important information
- Be concise but complete
`;
  }
  writeFileSync(join(workspacePath, 'SOUL.md'), soulContent, 'utf-8');

  // BOOTSTRAP.md - startup procedure
  const bootstrapTemplatePath = join(baseDir, 'install', 'workspaces', `board-${role}`, 'BOOTSTRAP.md');
  let bootstrapContent: string;
  if (existsSync(bootstrapTemplatePath)) {
    bootstrapContent = readFileSync(bootstrapTemplatePath, 'utf-8');
  } else {
    bootstrapContent = `# ${roleConfig.title} — Startup Procedure

## On Session Start
1. Read state files to understand current project status
2. Check for any pending tasks or messages
3. Post status update to your bound channel
4. Begin autonomous operation

## State Files to Check
- \`state/phase.json\` - Current phase
- \`state/tasks.json\` - Task backlog
- \`registry.json\` - Active projects
- \`memory/active-context.md\` - Working memory
`;
  }
  writeFileSync(join(workspacePath, 'BOOTSTRAP.md'), bootstrapContent, 'utf-8');

  // TOOLS.md - channel IDs and tool configuration
  const toolsTemplatePath = join(baseDir, 'install', 'workspaces', `board-${role}`, 'TOOLS.md');
  let toolsContent: string;
  if (existsSync(toolsTemplatePath)) {
    toolsContent = readFileSync(toolsTemplatePath, 'utf-8');
  } else {
    // Generate template with placeholders for channel IDs
    const primaryChannel = config.channels?.primary ?? '#theboard';
    const platform = config.channels?.messaging_platform ?? 'mattermost';
    toolsContent = `# ${roleConfig.title} — Tools Configuration

## Mattermost Channels

| Channel | ID | Purpose |
|---------|----|---------|
| ${primaryChannel} | <CHANNEL_ID_HERE> | Primary board communication |
| #${role} | <CHANNEL_ID_HERE> | ${roleConfig.title} direct channel |
${config.channels?.decision_log ? `| ${config.channels.decision_log} | <CHANNEL_ID_HERE> | Decision audit log |` : ''}

## Tool Usage

### message (${platform})
\`\`\`
message(action="send", channel="${platform}", target="<channel-id>", message="...")
\`\`\`

### sessions_send (agent-to-agent)
\`\`\`
sessions_send(agentId="board-<role>", message="...")
\`\`\`

## Notes
- Replace <CHANNEL_ID_HERE> with actual Mattermost channel IDs
- Channel IDs can be found in Mattermost channel settings
`;
  }
  writeFileSync(join(workspacePath, 'TOOLS.md'), toolsContent, 'utf-8');

  // HEARTBEAT.md for cron agents (auditor)
  if (roleConfig.session_type === 'cron') {
    const heartbeatContent = `# ${roleConfig.title} — Heartbeat Configuration

## Schedule
- Interval: ${roleConfig.interval ?? '15m'}
- Type: Cron-triggered audit

## On Each Heartbeat
1. Check budget consumption across all projects
2. Scan for anomalies (unusual token usage, scope creep)
3. Review recent decisions for compliance
4. Post summary to audit channel if issues found
5. Update heartbeat timestamp in state
`;
    writeFileSync(join(workspacePath, 'HEARTBEAT.md'), heartbeatContent, 'utf-8');
  }
}

// ─── Gateway restart helper ─────────────────────────────────────────

function restartGateway(): { success: boolean; error?: string } {
  try {
    execSync('openclaw gateway restart', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message ?? String(err),
    };
  }
}

// ─── Build OpenClaw config ──────────────────────────────────────────

function buildOpenClawConfig(
  config: BoardConfig,
  loader: ConfigLoader,
  baseDir: string,
  deployWorkspaces: boolean
): OpenClawConfig {
  const agentsList: OpenClawAgentConfig[] = [];
  const bindings: OpenClawBinding[] = [];

  const platform = config.channels?.messaging_platform ?? 'mattermost';
  // Read channel IDs from board.yaml if provided — format: channels.ids.<role>: "actual-id"
  const channelIds: Record<string, string> = (config.channels as any)?.ids ?? {};
  const hasRealChannelIds = Object.keys(channelIds).length > 0;

  for (const [role, roleConfig] of Object.entries(config.roles)) {
    const agentId = `board-${role}`;
    const workspacePath = getWorkspacePath(role);
    const channelId = channelIds[role];

    // Build agent config
    const agentConfig: OpenClawAgentConfig = {
      id: agentId,
      name: `${roleConfig.title} — The ${getTitleDescriptor(role)}`,
      model: resolveModel(roleConfig.model_tier),
      workspace: workspacePath,
      subagents: { allowAgents: ['*'] },
    };

    // Add heartbeat for cron agents (auditor) — only if real channel ID is available
    if (roleConfig.session_type === 'cron' && channelId) {
      agentConfig.heartbeat = {
        every: roleConfig.interval ?? '15m',
        target: platform,
        to: channelId,
      };
    }

    agentsList.push(agentConfig);

    // Only add bindings when real channel IDs are configured
    // Never patch placeholder <channel-id> strings into OpenClaw — would break existing bindings
    if (channelId) {
      bindings.push({
        agentId,
        match: {
          channel: platform,
          peer: { kind: 'channel', id: channelId },
        },
      });
    }

    // Deploy workspace files if requested
    if (deployWorkspaces) {
      deployWorkspaceFiles(role, roleConfig, config, loader, baseDir);
    }
  }

  const result: OpenClawConfig = { agents: { list: agentsList } };
  // Only include bindings in the patch if we have real channel IDs to bind
  if (hasRealChannelIds && bindings.length > 0) {
    result.bindings = bindings;
  }
  return result;
}

function getTitleDescriptor(role: string): string {
  const descriptors: Record<string, string> = {
    ceo: 'Strategist',
    cto: 'Architect',
    qa: 'Gatekeeper',
    auditor: 'Watchdog',
    lead: 'Leader',
    advisor: 'Counselor',
    reviewer: 'Critic',
    monitor: 'Observer',
  };
  return descriptors[role] ?? 'Agent';
}

// ─── Command ────────────────────────────────────────────────────────

export async function setupCommand(opts: SetupOptions): Promise<void> {
  const dir = resolve(opts.dir ?? process.cwd());
  const configPath = findConfig(dir, opts.config);

  // Load board config
  const loader = new ConfigLoader(configPath);
  const config = loader.load();

  // Build OpenClaw config (don't deploy workspaces yet for dry-run)
  const openclawConfig = buildOpenClawConfig(config, loader, dir, false);

  // ── JSON output mode ──────────────────────────────────────────
  if (opts.json) {
    out.jsonOutput({
      board: config.name,
      configPatch: openclawConfig,
      mode: opts.dryRun ? 'dry-run' : opts.apply ? 'apply' : 'write',
      outputFile: opts.dryRun || opts.apply ? null : resolve(dir, 'openclaw-agents.json'),
    });
    return;
  }

  // ── Dry run ───────────────────────────────────────────────────
  if (opts.dryRun) {
    const outputFile = resolve(dir, 'openclaw-agents.json');
    writeFileSync(outputFile, JSON.stringify(openclawConfig, null, 2) + '\n');

    console.log(out.bold('\n🔧 AgentBoardroom — Setup (dry run)\n'));
    console.log(`  Board:  ${config.name}`);
    console.log(`  Config: ${configPath}`);
    console.log('');
    console.log(out.bold('  OpenClaw config (openclaw-agents.json):\n'));
    console.log('  Written to: openclaw-agents.json (review before applying)');
    console.log(JSON.stringify(openclawConfig, null, 2));
    console.log('');
    console.log('  Agents:');
    for (const agent of openclawConfig.agents.list) {
      console.log(`    ${agent.id}: ${agent.model}`);
      console.log(`      workspace: ${agent.workspace}`);
    }
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Review the config above');
    console.log('    2. Update channel IDs (<channel-id> placeholders)');
    console.log('    3. Run: agentboardroom setup --apply');
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

    // Deploy workspace files
    console.log('  Deploying workspace files...');
    const configWithWorkspaces = buildOpenClawConfig(config, loader, dir, true);
    for (const agent of configWithWorkspaces.agents.list) {
      console.log(`    ${agent.id}: ${agent.workspace}`);
    }

    const restTools = new OpenClawRestTools({ baseUrl: gatewayUrl, token, verbose: false });

    console.log('');
    console.log('  Patching OpenClaw config via gateway REST API...');
    try {
      await (restTools as any).invoke('gateway', {
        action: 'config.patch',
        raw: JSON.stringify(configWithWorkspaces),
      });

      const outputFile = resolve(dir, 'openclaw-agents.json');
      writeFileSync(outputFile, JSON.stringify(configWithWorkspaces, null, 2) + '\n');

      console.log('');
      out.success('OpenClaw config patched successfully!');
      console.log('  Written to: openclaw-agents.json');
      console.log('');
      console.log('  Agents registered:');
      for (const agent of configWithWorkspaces.agents.list) {
        console.log(`    ${agent.id}: ${agent.model}`);
      }
      console.log('');

      // Trigger gateway restart
      console.log('  Restarting gateway to activate new agents...');
      const restartResult = restartGateway();
      if (restartResult.success) {
        out.success('Gateway restarted successfully!');
      } else {
        out.warn(`Gateway restart failed: ${restartResult.error}`);
        console.log('  You may need to restart manually:');
        console.log('    openclaw gateway restart');
      }
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
  const content = JSON.stringify(openclawConfig, null, 2);
  writeFileSync(outPath, content, 'utf-8');

  console.log(out.bold('\n🔧 AgentBoardroom — Setup\n'));
  console.log(`  Board:   ${config.name}`);
  console.log(`  Written: ${outPath}`);
  console.log('');
  console.log(out.bold('  Agents configured:'));
  for (const agent of openclawConfig.agents.list) {
    console.log(`    ${agent.id}: ${agent.model}`);
    console.log(`      workspace: ${agent.workspace}`);
  }
  console.log('');
  console.log('  Next steps:');
  console.log('  1. Review openclaw-agents.json');
  console.log('  2. Update channel IDs (<channel-id> placeholders)');
  console.log('  3. Run: agentboardroom setup --apply');
  console.log('');
  console.log('  Or apply directly (requires OPENCLAW_GATEWAY_TOKEN):');
  console.log('    agentboardroom setup --apply');
  console.log('');
}
