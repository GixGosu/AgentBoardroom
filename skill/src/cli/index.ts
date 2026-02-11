#!/usr/bin/env node
/**
 * AgentBoardroom Skill CLI — Decisions query interface.
 *
 * Extends the main CLI with DecisionStore-powered query commands.
 */

import { decisionsCommand } from './commands/decisions.js';

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

export async function main(argv?: string[]): Promise<void> {
  const { command, args, flags } = parseArgs(argv ?? process.argv.slice(2));

  if (command === 'decisions') {
    const project = args[0];
    if (!project) {
      console.error('Error: Project name required. Usage: agentboardroom decisions <project> [filters]');
      process.exit(1);
    }

    const format = typeof flags.format === 'string' ? flags.format as 'table' | 'json' : 'table';
    if (format !== 'table' && format !== 'json') {
      console.error(`Error: Invalid format "${format}". Use "table" or "json".`);
      process.exit(1);
    }

    decisionsCommand({
      project,
      author: typeof flags.author === 'string' ? flags.author : undefined,
      type: typeof flags.type === 'string' ? flags.type : undefined,
      phase: typeof flags.phase === 'string' ? parseInt(flags.phase, 10) : undefined,
      since: typeof flags.since === 'string' ? flags.since : undefined,
      challenged: flags.challenged === true,
      format,
      dir: typeof flags.dir === 'string' ? flags.dir : undefined,
    });
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

// Run if executed directly
const isDirectRun = process.argv[1]?.endsWith('cli/index.js') || process.argv[1]?.endsWith('cli/index.ts');
if (isDirectRun) {
  main().catch(err => {
    console.error(err.message ?? String(err));
    process.exit(1);
  });
}
