/**
 * AgentBoardroom CLI Tests — record-decision command
 *
 * Tests the record-decision command for recording governance decisions.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Test workspace
const TEST_DIR = join(import.meta.dirname ?? __dirname, '..', '.test-record-decision-workspace');

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

describe('CLI: record-decision command', () => {
  beforeEach(async () => {
    setupTestDir();
    // Initialize a project
    const { initCommand } = await import('../dist/cli/commands/init.js');
    await captureOutputAsync(() =>
      initCommand({ template: 'software-dev', project: 'test-project', dir: TEST_DIR, json: true })
    );
  });

  afterEach(cleanTestDir);

  it('records a CEO planning decision', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'planning',
          summary: 'Approve Phase 1 plan',
          rationale: 'Plan is well-structured and feasible',
          project: 'test-project',
          phase: 1,
          status: 'accepted',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, true);
      assert.ok(result.decision);
      assert.strictEqual(result.decision.author, 'ceo');
      assert.strictEqual(result.decision.type, 'plan_approval');
      assert.strictEqual(result.decision.status, 'accepted');
      assert.strictEqual(exitCode, 0);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }

    // Verify the decision was written to decisions.json
    const decisionsFile = join(TEST_DIR, 'state', 'test-project', 'decisions.json');
    assert.ok(existsSync(decisionsFile));
    const decisions = JSON.parse(readFileSync(decisionsFile, 'utf-8'));
    assert.strictEqual(decisions.length, 1);
    assert.strictEqual(decisions[0].author, 'ceo');
    assert.strictEqual(decisions[0].summary, 'Approve Phase 1 plan');
  });

  it('records a CTO architecture decision', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'cto',
          type: 'architecture',
          summary: 'Architecture review approved',
          rationale: 'Module boundaries are clean',
          project: 'test-project',
          phase: 1,
          status: 'accepted',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decision.type, 'cto_review');
      assert.strictEqual(exitCode, 0);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('records a QA gate verdict', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'qa',
          type: 'gate',
          summary: 'Phase 1 gate: PASS',
          rationale: 'All tests passing, coverage at 85%',
          project: 'test-project',
          phase: 1,
          status: 'accepted',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decision.type, 'qa_gate');
      assert.strictEqual(exitCode, 0);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('records a challenged decision', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'cto',
          type: 'architecture',
          summary: 'Challenge: Circular dependency detected',
          rationale: 'Module A depends on B which depends on A. Need to refactor.',
          project: 'test-project',
          phase: 1,
          status: 'challenged',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.decision.status, 'challenged');
      assert.strictEqual(exitCode, 0);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }

    const decisionsFile = join(TEST_DIR, 'state', 'test-project', 'decisions.json');
    const decisions = JSON.parse(readFileSync(decisionsFile, 'utf-8'));
    assert.strictEqual(decisions[0].status, 'challenged');
    assert.strictEqual(decisions[0].challenge_rounds, 1);
  });

  it('rejects missing required fields', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: '',
          type: 'planning',
          summary: '',
          rationale: '',
          project: '',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.length > 0);
      assert.strictEqual(exitCode, 1);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('rejects invalid author', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'invalid-author',
          type: 'planning',
          summary: 'Test',
          rationale: 'Test rationale',
          project: 'test-project',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e: string) => e.includes('Invalid author')));
      assert.strictEqual(exitCode, 1);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('rejects invalid type', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'invalid-type',
          summary: 'Test',
          rationale: 'Test rationale',
          project: 'test-project',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e: string) => e.includes('Invalid type')));
      assert.strictEqual(exitCode, 1);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('rejects nonexistent project', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    let exitCode = -1;
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'planning',
          summary: 'Test',
          rationale: 'Test rationale',
          project: 'nonexistent-project',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not found'));
      assert.strictEqual(exitCode, 1);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('maps type aliases correctly', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    process.exit = ((code: number) => { throw new Error('EXIT'); }) as any;

    const typeTests = [
      { input: 'planning', expected: 'plan_approval' },
      { input: 'architecture', expected: 'cto_review' },
      { input: 'gate', expected: 'qa_gate' },
      { input: 'challenge', expected: 'cto_review' },
    ];

    for (const test of typeTests) {
      // Clean decisions file before each test
      const decisionsFile = join(TEST_DIR, 'state', 'test-project', 'decisions.json');
      if (existsSync(decisionsFile)) rmSync(decisionsFile);

      try {
        const { stdout } = captureOutput(() =>
          recordDecisionCommand({
            author: 'ceo',
            type: test.input,
            summary: `Test ${test.input}`,
            rationale: 'Test rationale',
            project: 'test-project',
            phase: 0,
            status: 'accepted',
            dir: TEST_DIR,
            json: true,
          })
        );

        const result = JSON.parse(stdout);
        assert.strictEqual(result.decision.type, test.expected, `Type alias ${test.input} should map to ${test.expected}`);
      } catch (err: any) {
        if (err.message !== 'EXIT') throw err;
      }
    }

    process.exit = origExit;
  });

  it('maps status aliases correctly', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    process.exit = ((code: number) => { throw new Error('EXIT'); }) as any;

    // Clean decisions file
    const decisionsFile = join(TEST_DIR, 'state', 'test-project', 'decisions.json');
    if (existsSync(decisionsFile)) rmSync(decisionsFile);

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'planning',
          summary: 'Test pending status',
          rationale: 'Test rationale',
          project: 'test-project',
          phase: 0,
          status: 'pending',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.decision.status, 'proposed', 'Status "pending" should map to "proposed"');
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('defaults to phase 0 when not specified', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    process.exit = ((code: number) => { throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'planning',
          summary: 'Test default phase',
          rationale: 'Test rationale',
          project: 'test-project',
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.decision.phase, 0);
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('defaults to accepted status when not specified', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    process.exit = ((code: number) => { throw new Error('EXIT'); }) as any;

    try {
      const { stdout } = captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'planning',
          summary: 'Test default status',
          rationale: 'Test rationale',
          project: 'test-project',
          phase: 0,
          dir: TEST_DIR,
          json: true,
        })
      );

      const result = JSON.parse(stdout);
      assert.strictEqual(result.decision.status, 'accepted');
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }
  });

  it('writes decisions to correct project directory', async () => {
    const { recordDecisionCommand } = await import('../dist/cli/commands/record-decision.js');
    
    const origExit = process.exit;
    process.exit = ((code: number) => { throw new Error('EXIT'); }) as any;

    // Record first decision
    try {
      captureOutput(() =>
        recordDecisionCommand({
          author: 'ceo',
          type: 'planning',
          summary: 'Decision 1',
          rationale: 'Rationale 1',
          project: 'test-project',
          dir: TEST_DIR,
          json: true,
        })
      );
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    }

    // Record second decision
    try {
      captureOutput(() =>
        recordDecisionCommand({
          author: 'cto',
          type: 'architecture',
          summary: 'Decision 2',
          rationale: 'Rationale 2',
          project: 'test-project',
          dir: TEST_DIR,
          json: true,
        })
      );
    } catch (err: any) {
      if (err.message !== 'EXIT') throw err;
    } finally {
      process.exit = origExit;
    }

    const decisionsFile = join(TEST_DIR, 'state', 'test-project', 'decisions.json');
    assert.ok(existsSync(decisionsFile));
    const decisions = JSON.parse(readFileSync(decisionsFile, 'utf-8'));
    assert.strictEqual(decisions.length, 2);
    assert.strictEqual(decisions[0].summary, 'Decision 1');
    assert.strictEqual(decisions[1].summary, 'Decision 2');
  });
});
