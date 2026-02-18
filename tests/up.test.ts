/**
 * AgentBoardroom CLI — `up` command tests
 *
 * Tests the `upCommand` orchestration:
 *   - init (conditional) + setup + start sequence
 *   - Skipping init when board.yaml already exists
 *   - --dry-run propagation to startCommand
 *   - --template selection
 *   - Missing token warning (non-fatal)
 *   - Init failure stops the chain early
 *
 * ENVIRONMENT NOTES:
 *
 * 1. All tests that reach startCommand use `dryRun: true`. The dry-run path in
 *    startCommand (after agent check) hits `printStartPlan(config); return` and
 *    exits cleanly — no keep-alive loop, no real sessions spawned.
 *
 * 2. OPENCLAW_GATEWAY_TOKEN is cleared in runUp() so setupCommand always runs
 *    in dryRun mode (writes openclaw-agents.json to disk, no REST calls, no
 *    30-second timeout risk).
 *
 * 3. For the "init failure" test, startCommand is never reached — init bails
 *    before board.yaml is created, so dryRun doesn't matter there.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(import.meta.dirname ?? __dirname, '..', '.test-up-workspace');

function setupTestDir(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
}

// ─── Helper: run upCommand with safe test defaults ──────────────────

interface RunResult {
  logs: string[];
  exitCode: number | undefined;
}

/**
 * Runs upCommand with:
 *   - OPENCLAW_GATEWAY_TOKEN cleared → setup uses dry-run (no REST calls)
 *   - process.exit mocked → throws instead of exiting the process
 *   - console output captured into logs[]
 */
async function runUp(opts: Record<string, unknown>): Promise<RunResult> {
  const { upCommand } = await import('../dist/cli/commands/up.js');

  const logs: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => logs.push(args.join(' '));
  console.warn = (...args: any[]) => logs.push(args.join(' '));

  const origExit = process.exit;
  let exitCode: number | undefined;
  process.exit = ((code: number) => {
    exitCode = code ?? 0;
    throw new Error(`EXIT:${code ?? 0}`);
  }) as any;

  // Clear token so setupCommand uses dry-run (writes file, no REST)
  const savedToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  delete process.env.OPENCLAW_GATEWAY_TOKEN;

  try {
    await upCommand(opts);
  } catch {
    // Swallow — comes from mocked process.exit or expected command errors
  } finally {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
    process.exit = origExit;
    if (savedToken !== undefined) {
      process.env.OPENCLAW_GATEWAY_TOKEN = savedToken;
    }
  }

  return { logs, exitCode };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('CLI: up command', () => {
  beforeEach(setupTestDir);
  afterEach(cleanTestDir);

  // ── Init step ──────────────────────────────────────────────────

  it('no board.yaml → runs init and creates board.yaml', async () => {
    const { logs } = await runUp({
      template: 'software-dev',
      project: 'my-new-app',
      dir: TEST_DIR,
      dryRun: true, // avoids keep-alive in startCommand
    });

    assert.ok(existsSync(join(TEST_DIR, 'board.yaml')), 'board.yaml should be created by init');

    const output = logs.join('\n');
    assert.ok(output.includes('[1/3]'), 'Should print [1/3] step');
    assert.ok(
      output.includes('Initializing') || output.includes('initializ'),
      'Should print init message'
    );
  });

  it('existing board.yaml → skips init, still runs setup and start', async () => {
    // Pre-initialize so board.yaml already exists
    const { initCommand } = await import('../dist/cli/commands/init.js');
    const origExit = process.exit;
    process.exit = (() => { throw new Error('EXIT'); }) as any;
    try {
      await initCommand({ template: 'software-dev', project: 'pre-init', dir: TEST_DIR, json: true });
    } catch { /* ignore */ } finally {
      process.exit = origExit;
    }

    assert.ok(existsSync(join(TEST_DIR, 'board.yaml')), 'Precondition: board.yaml must exist');

    const { logs } = await runUp({
      template: 'software-dev',
      project: 'pre-init',
      dir: TEST_DIR,
      dryRun: true,
    });

    const output = logs.join('\n');
    assert.ok(output.includes('already initialized'), 'Should say board already initialized');
    assert.ok(!output.includes('Initializing board'), 'Should NOT re-run init');
    assert.ok(output.includes('[2/3]'), 'Should still run [2/3] setup');
    assert.ok(output.includes('[3/3]'), 'Should still run [3/3] start');
  });

  // ── Setup step ─────────────────────────────────────────────────

  it('setup step creates openclaw-agents.json', async () => {
    const { logs } = await runUp({
      template: 'software-dev',
      project: 'setup-test',
      dir: TEST_DIR,
      dryRun: true,
    });

    assert.ok(
      existsSync(join(TEST_DIR, 'openclaw-agents.json')),
      'setup should create openclaw-agents.json'
    );
    const output = logs.join('\n');
    assert.ok(output.includes('[2/3]'), 'Should print [2/3] Configuring agents');
  });

  // ── Start step ─────────────────────────────────────────────────

  it('start step is attempted after init + setup', async () => {
    const { logs } = await runUp({
      template: 'software-dev',
      project: 'start-test',
      dir: TEST_DIR,
      dryRun: true,
    });

    const output = logs.join('\n');
    assert.ok(output.includes('[3/3]'), 'Should print [3/3] Starting boardroom');
  });

  // ── --dry-run propagation ──────────────────────────────────────

  it('--dry-run: all three steps printed, board.yaml created, no real start', async () => {
    const { logs } = await runUp({
      template: 'software-dev',
      project: 'dry-run-test',
      dir: TEST_DIR,
      dryRun: true,
    });

    const output = logs.join('\n');
    assert.ok(output.includes('[1/3]'), 'Should print [1/3]');
    assert.ok(output.includes('[2/3]'), 'Should print [2/3]');
    assert.ok(output.includes('[3/3]'), 'Should print [3/3]');
    assert.ok(existsSync(join(TEST_DIR, 'board.yaml')), 'board.yaml should exist after dry-run');
    // Dry-run in startCommand prints the plan, not "Boardroom is running"
    assert.ok(!output.includes('Boardroom is running'), 'Should not claim board is running');
  });

  // ── --template selection ───────────────────────────────────────

  it('--template research: uses research template for board.yaml', async () => {
    await runUp({
      template: 'research',
      project: 'my-research',
      dir: TEST_DIR,
      dryRun: true,
    });

    assert.ok(existsSync(join(TEST_DIR, 'board.yaml')), 'board.yaml should be created');
    const boardYaml = readFileSync(join(TEST_DIR, 'board.yaml'), 'utf-8');
    assert.ok(boardYaml.includes('my-research'), 'board.yaml should contain project name');

    const stateFile = join(TEST_DIR, 'state', 'my-research', 'project.json');
    assert.ok(existsSync(stateFile), 'Project state file should exist');
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    assert.strictEqual(state.metadata.template, 'research', 'Should record research template');
  });

  // ── Missing token ──────────────────────────────────────────────

  it('missing OPENCLAW_GATEWAY_TOKEN: warns but continues through all steps', async () => {
    // runUp() already clears the token; this test just verifies the warning is printed
    const { logs } = await runUp({
      template: 'software-dev',
      project: 'no-token-test',
      dir: TEST_DIR,
      dryRun: true,
    });

    const output = logs.join('\n');
    assert.ok(
      output.includes('OPENCLAW_GATEWAY_TOKEN') || output.includes('token'),
      'Should print token warning when token is absent'
    );
    assert.ok(output.includes('[2/3]'), 'Should still run setup despite missing token');
    assert.ok(output.includes('[3/3]'), 'Should still run start despite missing token');
  });

  // ── Init failure ───────────────────────────────────────────────

  it('init failure: stops early — no setup or start runs', async () => {
    // Invalid template causes initCommand to exit(1) before creating board.yaml
    const { logs, exitCode } = await runUp({
      template: 'nonexistent-invalid-template',
      project: 'bad-template-test',
      dir: TEST_DIR,
      // no dryRun needed — init fails before startCommand is ever called
    });

    assert.ok(
      !existsSync(join(TEST_DIR, 'board.yaml')),
      'board.yaml must NOT be created when init fails'
    );
    assert.ok(exitCode !== undefined && exitCode !== 0, 'Should exit with non-zero code');

    const output = logs.join('\n');
    assert.ok(!output.includes('[2/3]'), 'Should NOT reach setup step after init failure');
    assert.ok(!output.includes('[3/3]'), 'Should NOT reach start step after init failure');
  });

  // ── Module shape ───────────────────────────────────────────────

  it('upCommand is exported as a function from the compiled module', async () => {
    const mod = await import('../dist/cli/commands/up.js');
    assert.strictEqual(typeof mod.upCommand, 'function', 'upCommand should be a function export');
  });
});
