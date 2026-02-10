# AgentBoardroom Phase 3: Runtime Integration Guide

## Overview

Phase 3 bridges AgentBoardroom's governance framework (Phases 1-2) to a live runtime environment. It adds three capabilities:

1. **OpenClaw Adapter** — Spawns and manages agent sessions with governance enforcement baked in
2. **Dashboard Generator** — Renders real-time text-based status boards
3. **Multi-Project Registry** — Manages concurrent projects with resource allocation and isolation

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   AgentBoardroom                     │
│                                                      │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │  Governance   │  │  Decision  │  │    Gates     │ │
│  │  Protection   │  │   Graph    │  │  Enforcement │ │
│  └──────┬───────┘  └────────────┘  └──────────────┘ │
│         │                                            │
│  ───────┼──── Phase 3 ──────────────────────────     │
│         │                                            │
│  ┌──────▼───────┐  ┌────────────┐  ┌──────────────┐ │
│  │   OpenClaw    │  │ Dashboard  │  │  Multi-Proj  │ │
│  │   Adapter     │  │ Generator  │  │  Registry    │ │
│  │  (runtime.ts) │  │            │  │  + Allocator │ │
│  │  (channels.ts)│  │            │  │  + Isolation  │ │
│  └──────┬───────┘  └────────────┘  └──────────────┘ │
│         │                                            │
└─────────┼────────────────────────────────────────────┘
          │
          ▼
   OpenClaw Runtime (sessions, cron, messaging)
```

## Module Reference

### 1. OpenClaw Runtime Adapter (`src/adapters/openclaw/runtime.ts`)

Implements `RuntimeAdapter` interface using OpenClaw primitives.

**Key integration point:** Governance rules are translated into `FileAccessPolicy` objects that constrain spawned agent sessions at the infrastructure level.

```typescript
import { OpenClawRuntimeAdapter } from 'agent-boardroom/adapters/openclaw/runtime';
import { GovernanceProtection } from 'agent-boardroom/governance/protection';

const governance = new GovernanceProtection(config);
const adapter = new OpenClawRuntimeAdapter({
  tools: openClawToolsImpl,  // Implement OpenClawTools interface
  governance,
  defaultAllowedPaths: ['src/**', 'docs/**'],
});

// Spawn with governance enforcement
const sessionId = await adapter.spawnAgent({
  agentId: 'analyst-1',
  prompt: 'You are a data analyst...',
  task: 'Analyze Q4 metrics',
  model: 'high',  // ModelTier → resolved to concrete model
});

// File access checked through governance
const violation = adapter.checkFileAccess('analyst', 'CONSTITUTION.md');
// Returns ViolationReport if protected asset
```

**Model Tier Mapping:**
| Tier | Default Model |
|------|--------------|
| `high` | `anthropic/claude-opus-4-6` |
| `medium` | `anthropic/claude-sonnet-4-20250514` |
| `low` | `anthropic/claude-haiku-3-5` |
| `local_only` | `ollama/llama3` |

### 2. OpenClaw Channel Adapter (`src/adapters/openclaw/channels.ts`)

Implements `ChannelAdapter` for message routing, channel management, and pinned post updates.

```typescript
import { OpenClawChannelAdapter } from 'agent-boardroom/adapters/openclaw/channels';

const channels = new OpenClawChannelAdapter({ platform: platformImpl });
await channels.postMessage('boardroom', '📊 Decision recorded: Approve budget');
await channels.updatePinnedPost('status-board', dashboardContent);
```

### 3. Dashboard Generator (`src/dashboard/generator.ts`)

Renders text-based status boards from aggregated snapshots. Channel-agnostic output works on Discord, Slack, Mattermost, and stdout.

```typescript
import { DashboardAggregator } from 'agent-boardroom/dashboard/aggregator';
import { DashboardGenerator } from 'agent-boardroom/dashboard/generator';

const aggregator = new DashboardAggregator(decisionStore, gateEngine, config);
const snapshot = aggregator.snapshot();

const generator = new DashboardGenerator({ maxWidth: 55, codeBlock: true });
const board = generator.render(snapshot);
// Posts a formatted text status board
```

### 4. Multi-Project Registry (`src/projects/registry.ts`)

Manages concurrent project lifecycle with status tracking and budget management.

```typescript
import { ProjectRegistry } from 'agent-boardroom/projects/registry';

const registry = new ProjectRegistry();
registry.register({
  name: 'alpha',
  owner: 'ceo',
  priority: 'high',
  stateDir: '/state/alpha',
  budget: { allocated: 100000, used: 0 },
});
```

### 5. Resource Allocator (`src/projects/allocator.ts`)

CEO-managed resource allocation with priority-based reallocation.

```typescript
import { ResourceAllocator } from 'agent-boardroom/projects/allocator';

const allocator = new ResourceAllocator(registry, {
  workers: 10, modelCapacity: 5, tokenBudget: 1_000_000,
});

const result = allocator.allocate({
  projectName: 'alpha',
  workers: 3, modelCapacity: 2, tokenBudget: 500_000,
  priority: 'high',
  requestedBy: 'ceo',
});

// Force allocate (Board Chair override)
const override = allocator.forceAllocate({ ... });
```

### 6. Isolation Enforcer (`src/projects/isolation.ts`)

Ensures cross-project sovereignty. No project can access another's state without explicit grants.

```typescript
import { IsolationEnforcer } from 'agent-boardroom/projects/isolation';

const enforcer = new IsolationEnforcer(registry);

// Same-project: allowed
enforcer.checkAccess({ source: { projectName: 'alpha', agentId: 'a1' }, targetProject: 'alpha', operation: 'read', resource: '/state/alpha/data' });

// Cross-project: denied, violation recorded
enforcer.checkAccess({ source: { projectName: 'alpha', agentId: 'a1' }, targetProject: 'beta', operation: 'write', resource: '/state/beta/config' });

// Explicit grant (CEO/Board Chair)
enforcer.grantCrossProjectAccess('alpha', 'beta', ['read']);
```

## Implementing OpenClawTools

The `OpenClawTools` interface must be implemented for your environment:

```typescript
const tools: OpenClawTools = {
  async sessionsSpawn(config) {
    // Map to: openclaw sessions spawn --label ... --model ...
    return { session_id: 'sess_xxx' };
  },
  async sessionsSend(sessionId, message) {
    // Map to: openclaw sessions send <id> <message>
  },
  async sessionsStatus(sessionId) {
    // Map to: openclaw sessions status <id>
    return { session_id: sessionId, state: 'running', last_activity_at: new Date().toISOString() };
  },
  async sessionsKill(sessionId) {
    // Map to: openclaw sessions kill <id>
  },
  async cronSchedule(config) {
    // Map to: openclaw cron add --name ... --schedule ...
    return 'cron_xxx';
  },
  async messagePost(channel, message) {
    // Map to: openclaw message send --target <channel> --message ...
  },
};
```

## End-to-End Workflow

1. **Create project** → `ProjectRegistry.register()`
2. **Allocate resources** → `ResourceAllocator.allocate()`
3. **Spawn agents** → `OpenClawRuntimeAdapter.spawnAgent()` (governance auto-enforced)
4. **Monitor** → `DashboardAggregator.snapshot()` → `DashboardGenerator.render()`
5. **Cross-project** → `IsolationEnforcer.grantCrossProjectAccess()` if needed
6. **Teardown** → `adapter.killAgent()`, `allocator.release()`

## Configuration

All Phase 3 modules are re-exported from `src/index.ts`:

```typescript
import {
  OpenClawRuntimeAdapter,
  OpenClawChannelAdapter,
  DashboardGenerator,
  DashboardAggregator,
  ProjectRegistry,
  ResourceAllocator,
  IsolationEnforcer,
} from 'agent-boardroom';
```
