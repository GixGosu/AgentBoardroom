/**
 * CLI Command: decisions — Query decision log.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as out from '../utils/output.js';

export interface DecisionsOptions {
  project?: string;
  status?: string;
  type?: string;
  author?: string;
  limit?: number;
  dir?: string;
  json?: boolean;
}

interface DecisionRecord {
  id: string;
  timestamp: string;
  author: string;
  type: string;
  summary: string;
  status: string;
  challenge_rounds: number;
  project: string;
  phase: number;
}

export function decisionsCommand(options: DecisionsOptions): void {
  const targetDir = resolve(options.dir || '.');
  const stateDir = join(targetDir, 'state');

  // Load decisions from state directory
  let decisions = loadDecisions(stateDir);

  if (decisions.length === 0) {
    if (options.json) {
      out.jsonOutput([]);
    } else {
      out.info('No decisions recorded yet.');
    }
    return;
  }

  // Apply filters
  if (options.project) {
    decisions = decisions.filter(d => d.project === options.project);
  }
  if (options.status) {
    decisions = decisions.filter(d => d.status === options.status);
  }
  if (options.type) {
    decisions = decisions.filter(d => d.type === options.type);
  }
  if (options.author) {
    decisions = decisions.filter(d => d.author === options.author);
  }

  // Sort by timestamp descending
  decisions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Apply limit
  const limit = options.limit ?? 20;
  decisions = decisions.slice(0, limit);

  if (options.json) {
    out.jsonOutput(decisions);
    return;
  }

  if (decisions.length === 0) {
    out.info('No decisions match the given filters.');
    return;
  }

  out.heading('Decision Log');
  console.log('');

  const rows = decisions.map(d => [
    d.id,
    out.colorStatus(d.status),
    d.type,
    d.author,
    truncate(d.summary, 40),
    d.challenge_rounds > 0 ? out.yellow(`${d.challenge_rounds}x`) : out.dim('-'),
  ]);

  out.table(['ID', 'Status', 'Type', 'Author', 'Summary', 'Challenged'], rows);
  console.log('');
  out.dim(`Showing ${decisions.length} decision(s)`);
  console.log('');
}

function loadDecisions(stateDir: string): DecisionRecord[] {
  const decisionsFile = join(stateDir, 'decisions.json');
  if (existsSync(decisionsFile)) {
    try {
      return JSON.parse(readFileSync(decisionsFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  // Also check per-project state dirs
  const decisions: DecisionRecord[] = [];
  if (existsSync(stateDir)) {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    for (const dir of readdirSync(stateDir)) {
      if (dir.startsWith('_')) continue;
      const file = join(stateDir, dir, 'decisions.json');
      if (existsSync(file)) {
        try {
          const data = JSON.parse(readFileSync(file, 'utf-8'));
          decisions.push(...(Array.isArray(data) ? data : []));
        } catch {
          // skip
        }
      }
    }
  }
  return decisions;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
