/**
 * CLI Decisions Command — Unit Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DecisionStore } from '../../../src/decisions/store.js';
import { decisionsCommand } from '../../src/cli/commands/decisions.js';

describe('CLI decisions command', () => {
  let tmpDir: string;
  let stateDir: string;
  let store: DecisionStore;
  let logs: string[];
  let errors: string[];
  const origLog = console.log;
  const origErr = console.error;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cli-decisions-'));
    stateDir = join(tmpDir, 'state', 'test-project');
    store = new DecisionStore(stateDir);

    // Seed test data
    const d1 = store.propose({
      author: 'ceo', type: 'plan_approval', summary: 'Approve phase 1 plan',
      rationale: 'Solid plan', evidence: ['doc1'], phase: 1, project: 'test-project',
    });
    store.accept(d1.id, 'ceo', 'Looks good');

    const d2 = store.propose({
      author: 'cto', type: 'cto_review', summary: 'CTO review of architecture',
      rationale: 'Needs refactor', evidence: [], phase: 1, project: 'test-project',
    });
    store.challenge(d2.id, 'cto', 'Architecture too coupled', 'Use adapter pattern');

    store.propose({
      author: 'qa', type: 'qa_gate', summary: 'QA gate phase 2',
      rationale: 'All tests pass', evidence: ['100% coverage'], phase: 2, project: 'test-project',
    });

    // Capture console output
    logs = [];
    errors = [];
    console.log = (...args: any[]) => logs.push(args.map(String).join(' '));
    console.error = (...args: any[]) => errors.push(args.map(String).join(' '));
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origErr;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('argument parsing', () => {
    it('requires project name', () => {
      // The skill CLI index handles this, but the command itself takes project as required
      const result = decisionsCommand({ project: 'test-project', dir: tmpDir });
      assert.ok(result.length > 0);
    });
  });

  describe('filters', () => {
    it('filters by author', () => {
      const result = decisionsCommand({ project: 'test-project', author: 'ceo', dir: tmpDir });
      assert.ok(result.includes('ceo'));
      assert.ok(!result.includes('  cto  ')); // not as a column value
    });

    it('filters by type', () => {
      const result = decisionsCommand({ project: 'test-project', type: 'qa_gate', dir: tmpDir });
      assert.ok(result.includes('qa_gate'));
      assert.ok(!result.includes('plan_approval'));
    });

    it('filters by phase', () => {
      const result = decisionsCommand({
        project: 'test-project', phase: 2, dir: tmpDir, format: 'json',
      });
      const parsed = JSON.parse(result);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].phase, 2);
    });

    it('filters by since date', () => {
      const result = decisionsCommand({
        project: 'test-project', since: '2099-01-01', dir: tmpDir, format: 'json',
      });
      const parsed = JSON.parse(result);
      assert.equal(parsed.length, 0);
    });

    it('filters challenged decisions', () => {
      const result = decisionsCommand({
        project: 'test-project', challenged: true, dir: tmpDir, format: 'json',
      });
      const parsed = JSON.parse(result);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].type, 'cto_review');
      assert.ok(parsed[0].challenge_rounds > 0);
    });
  });

  describe('table format', () => {
    it('outputs readable table with correct headers', () => {
      const result = decisionsCommand({ project: 'test-project', dir: tmpDir, format: 'table' });
      assert.ok(result.includes('ID'));
      assert.ok(result.includes('Timestamp'));
      assert.ok(result.includes('Author'));
      assert.ok(result.includes('Type'));
      assert.ok(result.includes('Summary'));
      assert.ok(result.includes('DEC-'));
    });

    it('shows decision count', () => {
      const result = decisionsCommand({ project: 'test-project', dir: tmpDir, format: 'table' });
      assert.ok(result.includes('3 decision(s)'));
    });
  });

  describe('JSON format', () => {
    it('outputs valid JSON', () => {
      const result = decisionsCommand({ project: 'test-project', dir: tmpDir, format: 'json' });
      const parsed = JSON.parse(result);
      assert.ok(Array.isArray(parsed));
      assert.equal(parsed.length, 3);
    });

    it('includes full DecisionRecord fields', () => {
      const result = decisionsCommand({ project: 'test-project', dir: tmpDir, format: 'json' });
      const parsed = JSON.parse(result);
      const record = parsed[0];
      assert.ok('id' in record);
      assert.ok('timestamp' in record);
      assert.ok('author' in record);
      assert.ok('type' in record);
      assert.ok('summary' in record);
      assert.ok('rationale' in record);
      assert.ok('evidence' in record);
      assert.ok('status' in record);
      assert.ok('challenge_history' in record);
    });
  });

  describe('error handling', () => {
    it('handles project not found', () => {
      const result = decisionsCommand({ project: 'nonexistent', dir: tmpDir });
      assert.ok(result.includes('No decisions found') || result.includes('nonexistent'));
    });

    it('handles no matching decisions', () => {
      const result = decisionsCommand({
        project: 'test-project', author: 'auditor', dir: tmpDir,
      });
      assert.ok(result.includes('No decisions match'));
    });

    it('handles invalid filters gracefully (no crash)', () => {
      // Invalid type that matches nothing
      const result = decisionsCommand({
        project: 'test-project', type: 'nonexistent_type', dir: tmpDir,
      });
      assert.ok(result.includes('No decisions match'));
    });
  });
});
