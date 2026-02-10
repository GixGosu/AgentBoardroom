/**
 * AgentBoardroom Quick Start Example
 *
 * Demonstrates core governance primitives:
 * - Decision records
 * - Challenge protocol
 * - Gate enforcement
 */

import {
  DecisionStore,
  GateEnforcement,
  ConfigLoader,
} from 'agentboardroom';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- 1. Initialize core components ---

// Use a temp directory for state (in a real project, use a persistent path)
const stateDir = mkdtempSync(join(tmpdir(), 'agentboardroom-'));

const decisions = new DecisionStore(stateDir);
const gates = new GateEnforcement(decisions, stateDir);

console.log('✅ Core components initialized\n');

// --- 2. Record a decision ---

const decision = decisions.record({
  type: 'architectural',
  author: 'ceo',
  title: 'Use microservices architecture',
  rationale: 'Better scalability for the expected load profile',
  project: 'my-app',
});

console.log(`📋 Decision recorded: "${decision.title}" by ${decision.author}`);
console.log(`   ID: ${decision.id}\n`);

// --- 3. Record a gate verdict ---

const verdict = gates.recordVerdict({
  project: 'my-app',
  phase: 'design',
  gate: 'design-review',
  verdict: 'PASS',
  reviewer: 'qa',
  rationale: 'Architecture decision was challenged and defended. Design is sound.',
});

console.log(`🚦 Gate verdict: ${verdict.verdict} (${verdict.gate})`);
console.log(`   Reviewer: ${verdict.reviewer}\n`);

// --- 5. Query the decision graph ---

const allDecisions = decisions.query({ project: 'my-app' });
console.log(`📊 Total decisions for my-app: ${allDecisions.length}`);

const gateHistory = gates.history({ project: 'my-app' });
console.log(`📊 Total gate verdicts for my-app: ${gateHistory.length}`);

console.log('\n🎉 AgentBoardroom governance cycle complete!');
console.log('   Every decision challenged. Every transition gated. Everything recorded.');
