/**
 * AgentBoardroom CLI Tests
 *
 * Tests CLI commands by importing modules directly and capturing output.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Test workspace
const TEST_DIR = join(import.meta.dirname ?? __dirname, '..', '.test-cli-workspace');

function setupTestDir(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
}

// Capture console output
function captureOutput(fn: () => void): { stdout: string; stderr: string } {
  const logs: string[] = [];
  const errs: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => errs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { stdout: logs.join('\n'), stderr: errs.join('\n') };
}

async function captureOutputAsync(fn: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  const logs: string[] = [];
  const errs: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => errs.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return { stdout: logs.join('\n'), stderr: errs.join('\n') };
}

// ─── Output Utils ────────────────────────────────────────────────

describe('CLI: output utils', () => {
  it('bold wraps text with ANSI codes', async () => {
    const { bold, red, green, yellow } = await import('../dist/cli/utils/output.js');
    assert.ok(bold('test').includes('test'));
    assert.ok(red('fail').includes('fail'));
    assert.ok(green('pass').includes('pass'));
    assert.ok(yellow('warn').includes('warn'));
  });

  it('colorVerdict maps verdicts correctly', async () => {
    const { colorVerdict } = await import('../dist/cli/utils/output.js');
    assert.ok(colorVerdict('PASS').includes('PASS'));
    assert.ok(colorVerdict('FAIL').includes('FAIL'));
    assert.ok(colorVerdict('CONDITIONAL').includes('CONDITIONAL'));
  });

  it('jsonOutput prints valid JSON', async () => {
    const { jsonOutput } = await import('../dist/cli/utils/output.js');
    const { stdout } = captureOutput(() => jsonOutput({ hello: 'world' }));
    assert.deepStrictEqual(JSON.parse(stdout), { hello: 'world' });
  });
});

// ─── Prompts Utils ───────────────────────────────────────────────

describe('CLI: prompts utils', () => {
  it('validates templates correctly', async () => {
    const { isValidTemplate, getAvailableTemplates } = await import('../dist/cli/utils/prompts.js');
    assert.ok(isValidTemplate('software-dev'));
    assert.ok(isValidTemplate('research'));
    assert.ok(isValidTemplate('content'));
    assert.ok(isValidTemplate('ops-incident'));
    assert.ok(isValidTemplate('custom'));
    assert.ok(!isValidTemplate('nonexistent'));
    assert.strictEqual(getAvailableTemplates().length, 5);
  });
});

// ─── Init Command ────────────────────────────────────────────────

describe('CLI: init command', () => {
  beforeEach(setupTestDir);
  afterEach(cleanTestDir);

  it('initializes a project with JSON output', async () => {
    const { initCommand } = await import('../dist/cli/commands/init.js');
    // Prevent process.exit
    const origExit = process.exit;
    process.exit = (() => { throw new Error('EXIT'); }) as any;

    const { stdout } = await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'test-app', dir: TEST_DIR, json: true })
    );
    process.exit = origExit;

    const result = JSON.parse(stdout);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.project, 'test-app');
    assert.strictEqual(result.template, 'software-dev');
  });

  it('creates board.yaml and directories', async () => {
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'test-app', dir: TEST_DIR, json: true })
    );

    assert.ok(existsSync(join(TEST_DIR, 'board.yaml')));
    assert.ok(existsSync(join(TEST_DIR, 'state')));
    assert.ok(existsSync(join(TEST_DIR, 'agents')));
    assert.ok(existsSync(join(TEST_DIR, 'state', 'test-app', 'project.json')));
  });

  it('customizes board name in board.yaml', async () => {
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'my-project', dir: TEST_DIR, json: true })
    );

    const content = readFileSync(join(TEST_DIR, 'board.yaml'), 'utf-8');
    assert.ok(content.includes('name: "my-project"'));
  });

  it('rejects invalid template', async () => {
    const { initCommand } = await import('../dist/cli/commands/init.js');
    const origExit = process.exit;
    let exited = false;
    process.exit = (() => { exited = true; throw new Error('EXIT'); }) as any;

    try {
      await captureOutputAsync(() =>
        initCommand({ template: 'nonexistent', project: 'foo', dir: TEST_DIR, json: false })
      );
    } catch { /* expected */ }

    process.exit = origExit;
    assert.ok(exited);
  });

  it('creates project state with correct metadata', async () => {
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'research', project: 'research-proj', dir: TEST_DIR, json: true })
    );

    const state = JSON.parse(readFileSync(join(TEST_DIR, 'state', 'research-proj', 'project.json'), 'utf-8'));
    assert.strictEqual(state.entry.name, 'research-proj');
    assert.strictEqual(state.entry.status, 'active');
    assert.strictEqual(state.metadata.template, 'research');
  });

  it('supports all five templates', async () => {
    const { initCommand } = await import('../dist/cli/commands/init.js');
    for (const tmpl of ['software-dev', 'research', 'content', 'ops-incident', 'custom']) {
      if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
      mkdirSync(TEST_DIR, { recursive: true });
      const { stdout } = await captureOutputAsync(() =>
        initCommand({ template: tmpl, project: `test-${tmpl}`, dir: TEST_DIR, json: true })
      );
      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, true, `Template ${tmpl} failed`);
    }
  });
});

// ─── Status Command ──────────────────────────────────────────────

describe('CLI: status command', () => {
  beforeEach(async () => {
    setupTestDir();
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'demo-app', dir: TEST_DIR, json: true })
    );
  });
  afterEach(cleanTestDir);

  it('shows status as JSON', async () => {
    const { statusCommand } = await import('../dist/cli/commands/status.js');
    const { stdout } = captureOutput(() =>
      statusCommand({ dir: TEST_DIR, json: true })
    );

    const result = JSON.parse(stdout);
    assert.ok(result.board);
    assert.ok(Array.isArray(result.projects));
    assert.strictEqual(result.projects.length, 1);
    assert.strictEqual(result.projects[0].entry.name, 'demo-app');
  });

  it('shows single project status as JSON', async () => {
    const { statusCommand } = await import('../dist/cli/commands/status.js');
    const { stdout } = captureOutput(() =>
      statusCommand({ project: 'demo-app', dir: TEST_DIR, json: true })
    );

    const result = JSON.parse(stdout);
    assert.strictEqual(result.entry.name, 'demo-app');
  });

  it('errors when no board.yaml exists', async () => {
    const { statusCommand } = await import('../dist/cli/commands/status.js');
    const emptyDir = join(TEST_DIR, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    const origExit = process.exit;
    let exited = false;
    process.exit = (() => { exited = true; throw new Error('EXIT'); }) as any;

    try {
      captureOutput(() => statusCommand({ dir: emptyDir }));
    } catch { /* expected */ }

    process.exit = origExit;
    assert.ok(exited);
  });
});

// ─── Decisions Command ───────────────────────────────────────────

describe('CLI: decisions command', () => {
  beforeEach(async () => {
    setupTestDir();
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'demo-app', dir: TEST_DIR, json: true })
    );
    const decisions = [
      { id: 'DEC-0001', timestamp: '2025-01-01T00:00:00Z', author: 'ceo', type: 'planning', summary: 'Initial plan', status: 'accepted', challenge_rounds: 0, project: 'demo-app', phase: 0 },
      { id: 'DEC-0002', timestamp: '2025-01-02T00:00:00Z', author: 'cto', type: 'architecture', summary: 'Use microservices', status: 'challenged', challenge_rounds: 2, project: 'demo-app', phase: 1 },
      { id: 'DEC-0003', timestamp: '2025-01-03T00:00:00Z', author: 'ceo', type: 'resource', summary: 'Add team member', status: 'proposed', challenge_rounds: 0, project: 'other-app', phase: 0 },
    ];
    writeFileSync(join(TEST_DIR, 'state', 'decisions.json'), JSON.stringify(decisions));
    // Also write per-project decisions for project-filtered queries
    const demoAppDir = join(TEST_DIR, 'state', 'demo-app');
    mkdirSync(demoAppDir, { recursive: true });
    writeFileSync(join(demoAppDir, 'decisions.json'), JSON.stringify(decisions.filter(d => d.project === 'demo-app')));
    const otherAppDir = join(TEST_DIR, 'state', 'other-app');
    mkdirSync(otherAppDir, { recursive: true });
    writeFileSync(join(otherAppDir, 'decisions.json'), JSON.stringify(decisions.filter(d => d.project === 'other-app')));
  });
  afterEach(cleanTestDir);

  it('lists all decisions as JSON', async () => {
    const { decisionsCommand } = await import('../dist/cli/commands/decisions.js');
    const { stdout } = captureOutput(() =>
      decisionsCommand({ dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.length, 3);
  });

  it('filters by project', async () => {
    const { decisionsCommand } = await import('../dist/cli/commands/decisions.js');
    const { stdout } = captureOutput(() =>
      decisionsCommand({ project: 'demo-app', dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.length, 2);
  });

  it('filters by status', async () => {
    const { decisionsCommand } = await import('../dist/cli/commands/decisions.js');
    const { stdout } = captureOutput(() =>
      decisionsCommand({ status: 'accepted', dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'DEC-0001');
  });
});

// ─── Gates Command ───────────────────────────────────────────────

describe('CLI: gates command', () => {
  beforeEach(async () => {
    setupTestDir();
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'demo-app', dir: TEST_DIR, json: true })
    );
    const verdicts = {
      verdicts: [
        { gate_id: 'planning_to_arch', verdict: 'PASS', issued_by: 'ceo', timestamp: '2025-01-01T00:00:00Z', tests_run: 10, tests_passed: 10, tests_failed: 0, coverage: '90%', blocking_issues: [], warnings: [], recommendation: 'Proceed', project: 'demo-app', phase: 0 },
        { gate_id: 'arch_to_impl', verdict: 'FAIL', issued_by: 'qa', timestamp: '2025-01-02T00:00:00Z', tests_run: 20, tests_passed: 15, tests_failed: 5, coverage: '75%', blocking_issues: ['Missing error handling'], warnings: [], recommendation: 'Fix', project: 'demo-app', phase: 1 },
        { gate_id: 'impl_to_int', verdict: 'CONDITIONAL', issued_by: 'cto', timestamp: '2025-01-03T00:00:00Z', tests_run: 30, tests_passed: 28, tests_failed: 2, coverage: '85%', blocking_issues: [], warnings: ['Perf'], recommendation: 'Caution', project: 'demo-app', phase: 2 },
      ],
    };
    writeFileSync(join(TEST_DIR, 'state', '_gate_history.json'), JSON.stringify(verdicts));
  });
  afterEach(cleanTestDir);

  it('lists all gate verdicts as JSON', async () => {
    const { gatesCommand } = await import('../dist/cli/commands/gates.js');
    const { stdout } = captureOutput(() =>
      gatesCommand({ dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.length, 3);
  });

  it('filters by verdict status', async () => {
    const { gatesCommand } = await import('../dist/cli/commands/gates.js');
    const { stdout } = captureOutput(() =>
      gatesCommand({ status: 'fail', dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].verdict, 'FAIL');
  });
});

// ─── Projects Command ────────────────────────────────────────────

describe('CLI: projects command', () => {
  beforeEach(async () => {
    setupTestDir();
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'alpha', dir: TEST_DIR, json: true })
    );
    await captureOutputAsync(() =>
      initCommand({ template: 'research', project: 'beta', dir: TEST_DIR, json: true })
    );
  });
  afterEach(cleanTestDir);

  it('lists projects as JSON', async () => {
    const { projectsCommand } = await import('../dist/cli/commands/projects.js');
    const { stdout } = captureOutput(() =>
      projectsCommand({ subcommand: 'list', dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.length, 2);
  });

  it('prioritizes a project', async () => {
    const { projectsCommand } = await import('../dist/cli/commands/projects.js');
    const { stdout } = captureOutput(() =>
      projectsCommand({ subcommand: 'prioritize', project: 'alpha', priority: 'critical', dir: TEST_DIR, json: true })
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.newPriority, 'critical');

    const state = JSON.parse(readFileSync(join(TEST_DIR, 'state', 'alpha', 'project.json'), 'utf-8'));
    assert.strictEqual(state.entry.priority, 'critical');
  });

  it('rejects invalid priority', async () => {
    const { projectsCommand } = await import('../dist/cli/commands/projects.js');
    const origExit = process.exit;
    let exited = false;
    process.exit = (() => { exited = true; throw new Error('EXIT'); }) as any;

    try {
      captureOutput(() =>
        projectsCommand({ subcommand: 'prioritize', project: 'alpha', priority: 'mega', dir: TEST_DIR })
      );
    } catch { /* expected */ }

    process.exit = origExit;
    assert.ok(exited);
  });
});
