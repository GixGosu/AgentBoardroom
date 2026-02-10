/**
 * CLI Command: gates — Query gate verdict history.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as out from '../utils/output.js';

export interface GatesOptions {
  project?: string;
  status?: string;  // verdict filter: PASS, FAIL, CONDITIONAL
  phase?: number;
  issuedBy?: string;
  limit?: number;
  dir?: string;
  json?: boolean;
}

interface GateVerdict {
  gate_id: string;
  verdict: string;
  issued_by: string;
  timestamp: string;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  coverage: string;
  blocking_issues: string[];
  warnings: string[];
  recommendation: string;
  project: string;
  phase: number;
}

export function gatesCommand(options: GatesOptions): void {
  const targetDir = resolve(options.dir || '.');
  const stateDir = join(targetDir, 'state');

  let verdicts = loadGateHistory(stateDir);

  if (verdicts.length === 0) {
    if (options.json) {
      out.jsonOutput([]);
    } else {
      out.info('No gate verdicts recorded yet.');
    }
    return;
  }

  // Apply filters
  if (options.project) {
    verdicts = verdicts.filter(v => v.project === options.project);
  }
  if (options.status) {
    verdicts = verdicts.filter(v => v.verdict === options.status!.toUpperCase());
  }
  if (options.phase !== undefined) {
    verdicts = verdicts.filter(v => v.phase === options.phase);
  }
  if (options.issuedBy) {
    verdicts = verdicts.filter(v => v.issued_by === options.issuedBy);
  }

  // Sort by timestamp descending
  verdicts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const limit = options.limit ?? 20;
  verdicts = verdicts.slice(0, limit);

  if (options.json) {
    out.jsonOutput(verdicts);
    return;
  }

  if (verdicts.length === 0) {
    out.info('No gate verdicts match the given filters.');
    return;
  }

  out.heading('Gate Verdicts');
  console.log('');

  const rows = verdicts.map(v => [
    v.gate_id,
    out.colorVerdict(v.verdict),
    v.issued_by,
    v.project,
    `Phase ${v.phase}`,
    `${v.tests_passed}/${v.tests_run}`,
    v.coverage,
  ]);

  out.table(['Gate', 'Verdict', 'Issuer', 'Project', 'Phase', 'Tests', 'Coverage'], rows);

  // Show blocking issues for FAILs
  const failures = verdicts.filter(v => v.verdict === 'FAIL' && v.blocking_issues.length > 0);
  if (failures.length > 0) {
    console.log('');
    out.heading('Blocking Issues');
    for (const f of failures) {
      console.log(`  ${out.red(f.gate_id)} (${f.project}):`);
      for (const issue of f.blocking_issues) {
        console.log(`    • ${issue}`);
      }
    }
  }
  console.log('');
}

function loadGateHistory(stateDir: string): GateVerdict[] {
  const historyFile = join(stateDir, '_gate_history.json');
  if (existsSync(historyFile)) {
    try {
      const data = JSON.parse(readFileSync(historyFile, 'utf-8'));
      return data.verdicts ?? [];
    } catch {
      return [];
    }
  }
  return [];
}
