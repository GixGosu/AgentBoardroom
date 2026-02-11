/**
 * CLI Command: decisions — Query the DecisionStore for a project.
 *
 * Usage: agentboardroom decisions <project> [filters]
 *
 * Filters:
 *   --author <role>      Filter by author (ceo, cto, qa, auditor)
 *   --type <type>        Filter by decision type
 *   --phase <n>          Show decisions from specific phase
 *   --since <date>       Show decisions after date (ISO-8601)
 *   --challenged         Show only challenged decisions
 *   --format table|json  Output format (default: table)
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DecisionStore } from '../../../../src/decisions/store.js';
import type { DecisionQueryFilters } from '../../../../src/decisions/store.js';
import type { DecisionRecord, DecisionType } from '../../../../src/core/types.js';

export interface DecisionsCommandOptions {
  project: string;
  author?: string;
  type?: string;
  phase?: number;
  since?: string;
  challenged?: boolean;
  format?: 'table' | 'json';
  dir?: string;
}

/**
 * Execute the decisions query command.
 * Returns the output string (for testability) and prints to stdout.
 */
export function decisionsCommand(options: DecisionsCommandOptions): string {
  const { project, format = 'table' } = options;
  const targetDir = resolve(options.dir || '.');
  const stateDir = resolve(targetDir, 'state', project);

  // Check if project state directory exists
  const decisionsFile = resolve(stateDir, 'decisions.json');
  if (!existsSync(decisionsFile)) {
    const msg = `No decisions found for project "${project}". State file not found: ${decisionsFile}`;
    if (format === 'json') {
      const output = JSON.stringify({ error: msg, decisions: [] }, null, 2);
      console.log(output);
      return output;
    }
    console.error(`Error: ${msg}`);
    return msg;
  }

  // Use DecisionStore query API
  const store = new DecisionStore(stateDir);
  const filters: DecisionQueryFilters = {};

  if (options.author) filters.author = options.author;
  if (options.type) filters.type = options.type as DecisionType;
  if (options.phase !== undefined) filters.phase = options.phase;
  if (options.since) filters.after = options.since;
  if (options.challenged) filters.challenged = true;

  const decisions = store.query(filters);

  if (decisions.length === 0) {
    if (format === 'json') {
      const output = JSON.stringify([], null, 2);
      console.log(output);
      return output;
    }
    const msg = 'No decisions match the given filters.';
    console.log(msg);
    return msg;
  }

  if (format === 'json') {
    const output = JSON.stringify(decisions, null, 2);
    console.log(output);
    return output;
  }

  // Table format
  return formatTable(decisions);
}

function formatTable(decisions: DecisionRecord[]): string {
  const headers = ['ID', 'Timestamp', 'Author', 'Type', 'Summary'];
  const rows = decisions.map(d => [
    d.id,
    d.timestamp.slice(0, 19).replace('T', ' '),
    d.author,
    d.type,
    truncate(d.summary, 50),
  ]);

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length))
  );

  const lines: string[] = [];
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '─'.repeat(w)).join('──');

  lines.push(headerLine);
  lines.push(separator);
  for (const row of rows) {
    lines.push(row.map((cell, i) => cell.padEnd(widths[i])).join('  '));
  }
  lines.push('');
  lines.push(`${decisions.length} decision(s)`);

  const output = lines.join('\n');
  console.log(output);
  return output;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
