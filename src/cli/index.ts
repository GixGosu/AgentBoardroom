#!/usr/bin/env node
/**
 * AgentBoardroom CLI — Corporate governance for AI agents.
 *
 * Commands:
 *   init       Initialize a new board from a template
 *   status     Display board/project status
 *   decisions  Query decision log
 *   gates      Query gate verdict history
 *   projects   Multi-project management (list, prioritize)
 */

import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { decisionsCommand } from './commands/decisions.js';
import { gatesCommand } from './commands/gates.js';
import { projectsCommand } from './commands/projects.js';
import * as out from './utils/output.js';

const VERSION = '0.1.0';

function parseArgs(argv: string[]): { command: string; args: string[]; flags: Record<string, string | boolean> } {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else {
      args.push(arg);
    }
  }

  return { command, args, flags };
}

function showHelp(): void {
  console.log(`
${out.bold('agentboardroom')} — Corporate governance for AI agents

${out.bold('Usage:')}
  agentboardroom <command> [options]

${out.bold('Commands:')}
  init         Initialize a new board from a template
  status       Display board/project status
  decisions    Query decision log
  gates        Query gate verdict history
  projects     Multi-project management

${out.bold('Global Options:')}
  --help       Show help
  --version    Show version
  --json       Machine-readable JSON output
  --dir <path> Working directory (default: current)

${out.bold('Examples:')}
  agentboardroom init --template software-dev --project my-app
  agentboardroom status
  agentboardroom decisions --project my-app --status accepted
  agentboardroom gates --project my-app --status failed
  agentboardroom projects list
  agentboardroom projects prioritize my-app --priority high
`);
}

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv.slice(2));

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  if (flags.help || !command) {
    showHelp();
    return;
  }

  const json = flags.json === true;
  const dir = typeof flags.dir === 'string' ? flags.dir : undefined;

  try {
    switch (command) {
      case 'init':
        await initCommand({
          template: typeof flags.template === 'string' ? flags.template : undefined,
          project: typeof flags.project === 'string' ? flags.project : undefined,
          dir,
          json,
        });
        break;

      case 'status':
        statusCommand({
          project: typeof flags.project === 'string' ? flags.project : undefined,
          dir,
          json,
        });
        break;

      case 'decisions':
        decisionsCommand({
          project: typeof flags.project === 'string' ? flags.project : undefined,
          status: typeof flags.status === 'string' ? flags.status : undefined,
          type: typeof flags.type === 'string' ? flags.type : undefined,
          author: typeof flags.author === 'string' ? flags.author : undefined,
          limit: typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : undefined,
          dir,
          json,
        });
        break;

      case 'gates':
        gatesCommand({
          project: typeof flags.project === 'string' ? flags.project : undefined,
          status: typeof flags.status === 'string' ? flags.status : undefined,
          phase: typeof flags.phase === 'string' ? parseInt(flags.phase, 10) : undefined,
          issuedBy: typeof flags['issued-by'] === 'string' ? flags['issued-by'] : undefined,
          limit: typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : undefined,
          dir,
          json,
        });
        break;

      case 'projects': {
        const subcommand = args[0] ?? 'list';
        const project = args[1] ?? (typeof flags.project === 'string' ? flags.project : undefined);
        projectsCommand({
          subcommand,
          project,
          priority: typeof flags.priority === 'string' ? flags.priority : undefined,
          dir,
          json,
        });
        break;
      }

      default:
        out.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err: any) {
    out.error(err.message ?? String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  out.error(err.message ?? String(err));
  process.exit(1);
});
