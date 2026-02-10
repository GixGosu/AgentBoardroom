/**
 * CLI Command: init — Initialize a new board from a template.
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isValidTemplate, selectTemplate, prompt } from '../utils/prompts.js';
import * as out from '../utils/output.js';

export interface InitOptions {
  template?: string;
  project?: string;
  dir?: string;
  json?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Resolve template
  let template = options.template;
  if (!template) {
    template = await selectTemplate();
  }
  if (!isValidTemplate(template)) {
    out.error(`Unknown template: ${template}`);
    out.info(`Available: software-dev, research, content, ops-incident, custom`);
    process.exit(1);
  }

  // Resolve project name
  let project = options.project;
  if (!project) {
    project = await prompt('Project name');
  }
  if (!project) {
    out.error('Project name is required');
    process.exit(1);
  }

  // Resolve target directory
  const targetDir = resolve(options.dir || '.');

  // Find template file — search relative to package root
  const packageRoot = findPackageRoot();
  const templatePath = join(packageRoot, 'templates', `${template}.yaml`);

  if (!existsSync(templatePath)) {
    out.error(`Template file not found: ${templatePath}`);
    process.exit(1);
  }

  // Create project structure
  const boardFile = join(targetDir, 'board.yaml');
  const stateDir = join(targetDir, 'state');
  const agentsDir = join(targetDir, 'agents');
  const projectStateDir = join(stateDir, project);

  if (existsSync(boardFile) && !options.json) {
    out.warn('board.yaml already exists, will be overwritten');
  }

  // Read and customize template
  let templateContent = readFileSync(templatePath, 'utf-8');
  // Replace template name with project-specific name
  templateContent = templateContent.replace(
    /^name:\s*".*"/m,
    `name: "${project}"`
  );

  // Create directories
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(agentsDir, { recursive: true });
  mkdirSync(projectStateDir, { recursive: true });

  // Write board.yaml
  writeFileSync(boardFile, templateContent);

  // Copy agent prompts if they exist in template agents dir
  const templateAgentsDir = join(packageRoot, 'agents', 'templates', template.replace('software-dev', 'generic'));
  if (existsSync(templateAgentsDir)) {
    const { readdirSync } = await import('node:fs');
    for (const file of readdirSync(templateAgentsDir)) {
      const src = join(templateAgentsDir, file);
      const dest = join(agentsDir, file);
      if (!existsSync(dest)) {
        copyFileSync(src, dest);
      }
    }
  }

  // Also copy base agent files if they exist
  const baseAgentsDir = join(packageRoot, 'agents');
  if (existsSync(baseAgentsDir)) {
    const { readdirSync, statSync } = await import('node:fs');
    for (const file of readdirSync(baseAgentsDir)) {
      const src = join(baseAgentsDir, file);
      if (file.endsWith('.md') && statSync(src).isFile()) {
        const dest = join(agentsDir, file);
        if (!existsSync(dest)) {
          copyFileSync(src, dest);
        }
      }
    }
  }

  // Initialize project state
  const projectState = {
    entry: {
      name: project,
      status: 'active',
      channel: `#${project}`,
      priority: 'normal',
      budget_total: 100,
      budget_used: 0,
      started: new Date().toISOString(),
      team_count: 0,
      current_phase: 0,
    },
    stateDir: projectStateDir,
    teams: [],
    metadata: { template, initialized_at: new Date().toISOString() },
  };
  writeFileSync(
    join(projectStateDir, 'project.json'),
    JSON.stringify(projectState, null, 2)
  );

  if (options.json) {
    out.jsonOutput({
      success: true,
      project,
      template,
      directory: targetDir,
      files: ['board.yaml', 'state/', 'agents/'],
    });
  } else {
    out.success(`Initialized project "${project}" from template "${template}"`);
    out.keyValue('Directory', targetDir);
    out.keyValue('Template', template);
    out.keyValue('Board config', 'board.yaml');
    out.keyValue('State dir', 'state/');
    out.keyValue('Agents dir', 'agents/');
    console.log('');
    out.info('Next: agentboardroom status');
  }
}

function findPackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
