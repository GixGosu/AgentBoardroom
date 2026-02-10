import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { DecisionStore } from '../dist/decisions/store.js';

const TEST_DIR = resolve(import.meta.dirname, '_test_graph_state');

describe('DecisionStore — Graph Lineage', () => {
  before(() => { mkdirSync(TEST_DIR, { recursive: true }); });
  after(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

  it('creates decisions with dependencies', () => {
    const store = new DecisionStore(TEST_DIR);
    const d1 = store.propose({ author: 'ceo', type: 'architecture', summary: 'Use microservices', rationale: 'Scalability', phase: 1, project: 'alpha' });
    const d2 = store.propose({ author: 'cto', type: 'technical', summary: 'Use Kubernetes', rationale: 'Orchestration', phase: 1, project: 'alpha', dependencies: [d1.id] });
    assert.deepEqual(d2.dependencies, ['DEC-0001']);
  });

  it('tracks forward chain (supersededBy)', () => {
    const store = new DecisionStore(TEST_DIR);
    const d3 = store.propose({ author: 'ceo', type: 'architecture', summary: 'Revised microservices v2', rationale: 'Updated', phase: 2, project: 'alpha', supersedes: 'DEC-0001' });
    store.supersede('DEC-0001', d3.id);
    const fwd = store.forwardChain('DEC-0001');
    assert.equal(fwd.length, 1);
    assert.equal(fwd[0].id, d3.id);
  });

  it('tracks dependents (forward dependency)', () => {
    const store = new DecisionStore(TEST_DIR);
    const deps = store.dependents('DEC-0001');
    assert.equal(deps.length, 1);
    assert.equal(deps[0].id, 'DEC-0002');
  });

  it('computes backward dependency graph', () => {
    const store = new DecisionStore(TEST_DIR);
    // DEC-0002 depends on DEC-0001
    const graph = store.dependencyGraph('DEC-0002');
    assert.equal(graph.length, 1);
    assert.equal(graph[0].id, 'DEC-0001');
  });

  it('chain follows supersedes backward', () => {
    const store = new DecisionStore(TEST_DIR);
    // DEC-0003 supersedes DEC-0001
    const ch = store.chain('DEC-0003');
    assert.equal(ch.length, 2);
    assert.equal(ch[0].id, 'DEC-0001');
    assert.equal(ch[1].id, 'DEC-0003');
  });

  it('forward chain with multiple successors', () => {
    const store = new DecisionStore(TEST_DIR);
    store.propose({ author: 'ceo', type: 'architecture', summary: 'Revised microservices v3', rationale: 'More updates', phase: 3, project: 'alpha', supersedes: 'DEC-0003' });
    const fwd = store.forwardChain('DEC-0001');
    // DEC-0001 → DEC-0003 → DEC-0004
    assert.equal(fwd.length, 2);
  });
});

describe('DecisionStore — Advanced Query', () => {
  const dir = resolve(TEST_DIR, 'query');
  before(() => { mkdirSync(dir, { recursive: true }); });

  it('queries by author', () => {
    const store = new DecisionStore(dir);
    store.propose({ author: 'ceo', type: 'planning', summary: 'A', rationale: 'R', phase: 1, project: 'p1' });
    store.propose({ author: 'cto', type: 'technical', summary: 'B', rationale: 'R', phase: 1, project: 'p1' });
    store.propose({ author: 'ceo', type: 'scope', summary: 'C', rationale: 'R', phase: 2, project: 'p2' });
    assert.equal(store.query({ author: 'ceo' }).length, 2);
  });

  it('queries by type', () => {
    const store = new DecisionStore(dir);
    assert.equal(store.query({ type: 'technical' }).length, 1);
  });

  it('queries by project', () => {
    const store = new DecisionStore(dir);
    assert.equal(store.query({ project: 'p2' }).length, 1);
  });

  it('queries by phase', () => {
    const store = new DecisionStore(dir);
    assert.equal(store.query({ phase: 1 }).length, 2);
  });

  it('queries by challenge status', () => {
    const store = new DecisionStore(dir);
    store.challenge('DEC-0001', 'cto', 'Disagree');
    const challenged = store.query({ challenged: true });
    assert.equal(challenged.length, 1);
    assert.equal(challenged[0].id, 'DEC-0001');
  });

  it('queries by dependsOn', () => {
    const depDir = resolve(TEST_DIR, 'dep-query');
    mkdirSync(depDir, { recursive: true });
    const store = new DecisionStore(depDir);
    const d1 = store.propose({ author: 'ceo', type: 'planning', summary: 'Base', rationale: 'R', phase: 1, project: 'x' });
    store.propose({ author: 'cto', type: 'technical', summary: 'Depends', rationale: 'R', phase: 1, project: 'x', dependencies: [d1.id] });
    store.propose({ author: 'cto', type: 'technical', summary: 'Independent', rationale: 'R', phase: 1, project: 'x' });
    assert.equal(store.query({ dependsOn: d1.id }).length, 1);
  });

  it('combines multiple filters', () => {
    const store = new DecisionStore(dir);
    const result = store.query({ author: 'ceo', phase: 2 });
    assert.equal(result.length, 1);
    assert.equal(result[0].summary, 'C');
  });
});

describe('DecisionStore — Export', () => {
  const dir = resolve(TEST_DIR, 'export');
  before(() => { mkdirSync(dir, { recursive: true }); });

  it('exports JSON', () => {
    const store = new DecisionStore(dir);
    store.propose({ author: 'ceo', type: 'planning', summary: 'Plan A', rationale: 'Because', phase: 1, project: 'proj', evidence: ['doc1'] });
    store.propose({ author: 'cto', type: 'technical', summary: 'Tech B', rationale: 'Better', phase: 1, project: 'proj', dependencies: ['DEC-0001'] });
    const json = store.exportJSON();
    const parsed = JSON.parse(json);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].id, 'DEC-0001');
  });

  it('exports filtered JSON', () => {
    const store = new DecisionStore(dir);
    const json = store.exportJSON({ author: 'cto' });
    const parsed = JSON.parse(json);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].author, 'cto');
  });

  it('exports markdown audit trail', () => {
    const store = new DecisionStore(dir);
    const md = store.exportMarkdown();
    assert.ok(md.includes('# Decision Audit Trail'));
    assert.ok(md.includes('## DEC-0001: Plan A'));
    assert.ok(md.includes('## DEC-0002: Tech B'));
    assert.ok(md.includes('**Dependencies:** DEC-0001'));
  });

  it('exports filtered markdown', () => {
    const store = new DecisionStore(dir);
    const md = store.exportMarkdown({ author: 'ceo' });
    assert.ok(md.includes('DEC-0001'));
    assert.ok(!md.includes('DEC-0002'));
  });

  it('markdown includes challenge history', () => {
    const store = new DecisionStore(dir);
    store.challenge('DEC-0001', 'cto', 'I disagree', 'Alt proposal');
    const md = store.exportMarkdown({ status: 'challenged' });
    assert.ok(md.includes('Challenge History'));
    assert.ok(md.includes('Counter-proposal: Alt proposal'));
  });
});
