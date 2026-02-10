/**
 * CLI Command: projects — Multi-project management (list, prioritize).
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as out from '../utils/output.js';

export interface ProjectsOptions {
  subcommand?: string;  // list | prioritize
  project?: string;     // for prioritize
  priority?: string;    // critical | high | normal | low
  dir?: string;
  json?: boolean;
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
  stateDir: string;
  teams: string[];
  metadata?: Record<string, unknown>;
}

const PRIORITY_ORDER = ['critical', 'high', 'normal', 'low'];

export function projectsCommand(options: ProjectsOptions): void {
  const sub = options.subcommand ?? 'list';

  switch (sub) {
    case 'list':
      return listProjects(options);
    case 'prioritize':
      return prioritizeProject(options);
    default:
      out.error(`Unknown subcommand: ${sub}. Use: list, prioritize`);
      process.exit(1);
  }
}

function listProjects(options: ProjectsOptions): void {
  const targetDir = resolve(options.dir || '.');
  const stateDir = join(targetDir, 'state');
  const projects = loadProjects(stateDir);

  if (projects.length === 0) {
    if (options.json) {
      out.jsonOutput([]);
    } else {
      out.info('No projects found.');
    }
    return;
  }

  // Sort by priority
  projects.sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.entry.priority);
    const bi = PRIORITY_ORDER.indexOf(b.entry.priority);
    return ai - bi;
  });

  if (options.json) {
    out.jsonOutput(projects.map(p => p.entry));
    return;
  }

  out.heading('Projects');
  console.log('');

  const rows = projects.map(p => {
    const budgetPct = p.entry.budget_total > 0
      ? Math.round((p.entry.budget_used / p.entry.budget_total) * 100)
      : 0;
    return [
      p.entry.name,
      out.colorStatus(p.entry.status),
      colorPriority(p.entry.priority),
      `Phase ${p.entry.current_phase}`,
      `${budgetPct}%`,
      `${p.entry.team_count}`,
      p.entry.started.split('T')[0],
    ];
  });

  out.table(['Project', 'Status', 'Priority', 'Phase', 'Budget', 'Teams', 'Started'], rows);
  console.log('');
}

function prioritizeProject(options: ProjectsOptions): void {
  const targetDir = resolve(options.dir || '.');
  const stateDir = join(targetDir, 'state');

  if (!options.project) {
    out.error('Project name required: agentboardroom projects prioritize <project> [--priority <level>]');
    process.exit(1);
  }

  const priority = options.priority ?? 'high';
  if (!PRIORITY_ORDER.includes(priority)) {
    out.error(`Invalid priority: ${priority}. Use: ${PRIORITY_ORDER.join(', ')}`);
    process.exit(1);
  }

  const projectFile = join(stateDir, options.project, 'project.json');
  if (!existsSync(projectFile)) {
    out.error(`Project not found: ${options.project}`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(projectFile, 'utf-8')) as ProjectState;
  const oldPriority = data.entry.priority;
  data.entry.priority = priority;
  writeFileSync(projectFile, JSON.stringify(data, null, 2));

  if (options.json) {
    out.jsonOutput({ project: options.project, oldPriority, newPriority: priority });
  } else {
    out.success(`Updated priority for "${options.project}": ${oldPriority} → ${priority}`);
  }
}

function colorPriority(p: string): string {
  switch (p) {
    case 'critical': return out.red(p);
    case 'high': return out.yellow(p);
    case 'normal': return out.green(p);
    case 'low': return out.dim(p);
    default: return p;
  }
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
          projects.push(JSON.parse(readFileSync(projectFile, 'utf-8')));
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return projects;
}
