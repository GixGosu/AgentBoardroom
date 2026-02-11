/**
 * CLI Command: decisions — Query decision log.
 *
 * Supports two modes:
 *   agentboardroom decisions <project> [filters]   (positional project)
 *   agentboardroom decisions --project <name>       (flag-based, legacy)
 *
 * Filters:
 *   --author <role>      Filter by author
 *   --type <type>        Filter by decision type
 *   --phase <n>          Show decisions from specific phase
 *   --since <date>       Show decisions after date (ISO-8601)
 *   --challenged         Show only challenged decisions
 *   --status <status>    Filter by status
 *   --format table|json  Output format (default: table)
 *   --limit <n>          Max results (default: 20, table only)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DecisionStore } from '../../decisions/store.js';
import type { DecisionQueryFilters } from '../../decisions/store.js';
import type { DecisionRecord, DecisionType } from '../../core/types.js';
import * as out from '../utils/output.js';

export interface DecisionsOptions {
  project?: string;
  status?: string;
  type?: string;
  author?: string;
  phase?: number;
  since?: string;
  challenged?: boolean;
  format?: 'table' | 'json';
  limit?: number;
  dir?: string;
  json?: boolean;
}

export function decisionsCommand(options: DecisionsOptions): void {
  const targetDir = resolve(options.dir || '.');
  const stateDir = join(targetDir, 'state');
  const useJson = options.format === 'json' || options.json === true;

  // If a specific project is given, use DecisionStore query API
  if (options.project) {
    const projectStateDir = join(stateDir, options.project);
    const decisionsFile = join(projectStateDir, 'decisions.json');

    if (!existsSync(decisionsFile)) {
      if (useJson) {
        out.jsonOutput({ error: `No decisions found for project "${options.project}"`, decisions: [] });
      } else {
        out.error(`No decisions found for project "${options.project}".`);
      }
      return;
    }

    const store = new DecisionStore(projectStateDir);
    const filters: DecisionQueryFilters = {};
    if (options.author) filters.author = options.author;
    if (options.type) filters.type = options.type as DecisionType;
    if (options.status) filters.status = options.status as any;
    if (options.phase !== undefined) filters.phase = options.phase;
    if (options.since) filters.after = options.since;
    if (options.challenged) filters.challenged = true;

    let decisions = store.query(filters);

    if (decisions.length === 0) {
      if (useJson) {
        out.jsonOutput([]);
      } else {
        out.info('No decisions match the given filters.');
      }
      return;
    }

    // Sort by timestamp descending
    decisions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply limit for table format
    if (!useJson) {
      const limit = options.limit ?? 20;
      decisions = decisions.slice(0, limit);
    }

    if (useJson) {
      out.jsonOutput(decisions);
      return;
    }

    renderTable(decisions);
    return;
  }

  // No project specified — scan all project dirs (legacy behavior)
  let decisions = loadAllDecisions(stateDir);

  if (decisions.length === 0) {
    if (useJson) {
      out.jsonOutput([]);
    } else {
      out.info('No decisions recorded yet.');
    }
    return;
  }

  // Apply basic filters
  if (options.status) decisions = decisions.filter(d => d.status === options.status);
  if (options.type) decisions = decisions.filter(d => d.type === options.type);
  if (options.author) decisions = decisions.filter(d => d.author === options.author);
  if (options.challenged) decisions = decisions.filter(d => d.challenge_rounds > 0);
  if (options.phase !== undefined) decisions = decisions.filter(d => d.phase === options.phase);
  if (options.since) decisions = decisions.filter(d => d.timestamp >= options.since!);

  decisions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const limit = options.limit ?? 20;
  if (!useJson) decisions = decisions.slice(0, limit);

  if (decisions.length === 0) {
    if (useJson) {
      out.jsonOutput([]);
    } else {
      out.info('No decisions match the given filters.');
    }
    return;
  }

  if (useJson) {
    out.jsonOutput(decisions);
    return;
  }

  renderTable(decisions);
}

function renderTable(decisions: DecisionRecord[]): void {
  out.heading('Decision Log');
  console.log('');

  const rows = decisions.map(d => [
    d.id,
    d.timestamp.slice(0, 19).replace('T', ' '),
    d.author,
    d.type,
    truncate(d.summary, 40),
  ]);

  out.table(['ID', 'Timestamp', 'Author', 'Type', 'Summary'], rows);
  console.log('');
  out.dim(`Showing ${decisions.length} decision(s)`);
  console.log('');
}

function loadAllDecisions(stateDir: string): DecisionRecord[] {
  // Check for a flat decisions.json
  const flatFile = join(stateDir, 'decisions.json');
  if (existsSync(flatFile)) {
    try {
      return JSON.parse(readFileSync(flatFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  // Scan per-project state dirs
  const decisions: DecisionRecord[] = [];
  if (existsSync(stateDir)) {
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
