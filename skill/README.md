# AgentBoardroom Skill

Runtime skill layer providing agent integration, CLI commands, and the DecisionStore bridge.

## Structure

```
skill/
├── src/
│   ├── runtime/
│   │   └── DecisionStoreAdapter.ts    # Bridge: agents → DecisionStore
│   └── cli/
│       └── commands/
│           └── decisions.ts           # CLI: query decisions
├── tests/
│   ├── runtime/
│   │   └── DecisionStoreAdapter.test.ts   # 11 unit tests
│   ├── integration/
│   │   ├── decision-workflow.test.ts      # 4 workflow tests
│   │   └── full-cycle-decisions.test.ts   # 3 full-cycle integration tests
│   └── cli/
│       └── decisions.test.ts              # 13 CLI command tests
```

## DecisionStoreAdapter Usage

```typescript
import { DecisionStoreAdapter } from './src/runtime/DecisionStoreAdapter.js';

const adapter = new DecisionStoreAdapter();

// CEO records a plan approval (auto-accepted)
const plan = adapter.recordPlanApproval('my-project', './state', {
  phase: 1,
  summary: 'Phase 1: implement core module',
  rationale: 'Within budget, parallelizable',
  evidence: ['WBS analysis'],
  dependencies: ['ARCHITECTURE.md finalized'],
});

// CTO challenges
const challenged = adapter.recordCTOReview('my-project', './state', {
  decisionId: plan.id,   // Note: use store.propose() for non-auto-accepted proposals
  action: 'challenge',
  rationale: 'Circular dependency risk',
  counterProposal: 'Extract shared types first',
});

// CTO accepts (after revision)
adapter.recordCTOReview('my-project', './state', {
  decisionId: plan.id,
  action: 'accept',
  rationale: 'Architecture is sound after revision',
});

// QA gate verdict (auto-accepted)
adapter.recordGateVerdict('my-project', './state', {
  gate_id: 'phase-1-gate',
  verdict: 'PASS',
  issued_by: 'qa',
  timestamp: new Date().toISOString(),
  tests_run: 50, tests_passed: 50, tests_failed: 0,
  coverage: '92%',
  blocking_issues: [],
  warnings: [],
  recommendation: 'Proceed to Phase 2',
  project: 'my-project',
  phase: 1,
});
```

## CLI: Query Decisions

```bash
# All decisions for a project
agentboardroom decisions my-project

# Filter by author
agentboardroom decisions my-project --author ceo

# Only challenged decisions
agentboardroom decisions my-project --challenged

# JSON output
agentboardroom decisions my-project --format json

# Combine filters
agentboardroom decisions my-project --author cto --phase 1 --format json
```

## Running Tests

```bash
# All project tests (224 existing + 31 new)
npm test

# Skill tests only
npx tsx --test skill/tests/runtime/DecisionStoreAdapter.test.ts \
  skill/tests/integration/decision-workflow.test.ts \
  skill/tests/cli/decisions.test.ts \
  skill/tests/integration/full-cycle-decisions.test.ts
```
