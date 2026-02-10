/**
 * CLI Command: status — Display board/project status.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as out from '../utils/output.js';

export interface StatusOptions {
  project?: string;
  dir?: string;
  json?: boolean;
}

export function statusCommand(options: StatusOptions): void {
  const targetDir = resolve(options.dir || '.');
  const boardFile = join(targetDir, 'board.yaml');
  const stateDir = join(targetDir, 'state');

  if (!existsSync(boardFile)) {
    out.error('No board.yaml found. Run `agentboardroom init` first.');
    process.exit(1);
  }

  // Read board config (basic YAML parsing for name)
  const boardContent = readFileSync(boardFile, 'utf-8');
  const nameMatch = boardContent.match(/^name:\s*"?([^"\n]+)"?/m);
  const boardName = nameMatch?.[1] ?? 'Unknown Board';

  // Scan projects from state directory
  const projects = loadProjects(stateDir);

  if (options.project) {
    const proj = projects.find(p => p.entry.name === options.project);
    if (!proj) {
      out.error(`Project not found: ${options.project}`);
      process.exit(1);
    }
    if (options.json) {
      out.jsonOutput(proj);
    } else {
      showProjectStatus(proj);
    }
    return;
  }

  if (options.json) {
    out.jsonOutput({ board: boardName, projects });
    return;
  }

  out.heading(`Board: ${boardName}`);
  console.log('');

  if (projects.length === 0) {
    out.info('No projects initialized yet.');
    return;
  }

  const rows = projects.map(p => [
    p.entry.name,
    out.colorStatus(p.entry.status),
    `Phase ${p.entry.current_phase}`,
    p.entry.priority,
    `${p.entry.budget_used}/${p.entry.budget_total}`,
    `${p.entry.team_count} teams`,
  ]);

  out.table(
    ['Project', 'Status', 'Phase', 'Priority', 'Budget', 'Teams'],
    rows
  );
  console.log('');
}

function showProjectStatus(proj: ProjectState): void {
  out.heading(`Project: ${proj.entry.name}`);
  console.log('');
  out.keyValue('Status', out.colorStatus(proj.entry.status));
  out.keyValue('Phase', String(proj.entry.current_phase));
  out.keyValue('Priority', proj.entry.priority);
  out.keyValue('Budget', `${proj.entry.budget_used}/${proj.entry.budget_total}`);
  out.keyValue('Teams', String(proj.entry.team_count));
  out.keyValue('Started', proj.entry.started);
  if (proj.metadata?.template) {
    out.keyValue('Template', String(proj.metadata.template));
  }
  console.log('');
}

interface ProjectState {
  entry: {
    name: string;
    status: string;
    channel: string;
    priority: string;
    budget_total: number;
    budget_used: number;
    started: string;
    team_count: number;
    current_phase: number;
  };
  teams: string[];
  metadata?: Record<string, unknown>;
}

function loadProjects(stateDir: string): ProjectState[] {
  if (!existsSync(stateDir)) return [];

  const projects: ProjectState[] = [];
  try {
    for (const dir of readdirSync(stateDir)) {
      if (dir.startsWith('_')) continue;
      const projectFile = join(stateDir, dir, 'project.json');
      if (existsSync(projectFile)) {
        try {
          const data = JSON.parse(readFileSync(projectFile, 'utf-8'));
          projects.push(data);
        } catch {
          // skip corrupted
        }
      }
    }
  } catch {
    // state dir might not be readable
  }
  return projects;
}
