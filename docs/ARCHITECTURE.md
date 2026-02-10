# Architecture

System design and module breakdown for AgentBoardroom.

---

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Board Chair (Human)                    │
│         Brief → Escalation Response → Review             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  THE BOARDROOM                           │
│                                                          │
│  ┌─────┐  challenge  ┌─────┐                            │
│  │ CEO │◄──────────►│ CTO │     Challenge Protocol      │
│  └──┬──┘             └──┬──┘     (structural, not       │
│     │                   │         advisory)              │
│     │    ┌─────┐  ┌─────────┐                           │
│     │    │ QA  │  │ Auditor │   Gate Enforcement        │
│     │    └──┬──┘  └────┬────┘   (FAIL blocks phase)     │
│     │       │          │                                 │
│  ┌──▼──────▼──────────▼──┐                              │
│  │    Decision Graph      │  Every decision recorded    │
│  │    Gate History        │  Every verdict queryable    │
│  └────────────────────────┘                              │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌────────┐    ┌────────┐    ┌────────┐
   │ Team A │    │ Team B │    │ Team C │   Sovereign,
   │(self-  │    │(self-  │    │(self-  │   self-governing
   │govern) │    │govern) │    │govern) │   within scope
   └────────┘    └────────┘    └────────┘
```

## Core Principle: Governance as Infrastructure

AgentBoardroom's defining principle: **governance is not a prompt suggestion, it's a code path.**

| Prompt-Based Governance | AgentBoardroom (Structural) |
|---|---|
| "You should get CTO approval" | Code blocks execution until CTO accepts |
| "Don't modify governance files" | File access control prevents writes |
| "QA should review before merging" | Phase state machine cannot advance without QA PASS |
| "Escalate if stuck" | Auto-escalation after max challenge rounds |

## Module Breakdown

### Phase 1: Core Types (`src/core/`)

- **`types.ts`** — Runtime-agnostic governance abstractions: `BoardConfig`, `DecisionRecord`, `GateVerdict`, `PhaseState`, `RuntimeAdapter`, `ChannelAdapter`
- **`config.ts`** — Board configuration loading and validation

### Phase 2: Decision Engine (`src/decisions/`, `src/challenges/`, `src/gates/`, `src/governance/`)

- **`decisions/store.ts`** — Append-only decision storage with auto-incrementing IDs, challenge tracking, query engine, and chain reconstruction
- **`challenges/protocol.ts`** — Structural challenge enforcement. `canExecute()` blocks execution until a decision is accepted or escalated
- **`gates/enforcement.ts`** — Phase transition enforcement. `advancePhase()` returns `advanced: false` if gate requirements aren't met. Supports PASS/FAIL/CONDITIONAL verdicts
- **`governance/protection.ts`** — Self-modification prevention. `checkWriteAccess()` blocks writes to protected governance assets

### Phase 3: Runtime Integration (`src/adapters/`, `src/dashboard/`, `src/projects/`)

- **`adapters/openclaw/`** — OpenClaw implementation of `RuntimeAdapter` (spawn agents, send messages, schedule cron) and `ChannelAdapter` (create channels, post messages, search)
- **`dashboard/`** — Text-based status board generator, channel-agnostic
- **`projects/registry.ts`** — Multi-project registry with priority management
- **`projects/allocator.ts`** — Resource allocation across competing projects
- **`projects/isolation.ts`** — Project isolation enforcement (Team A can't see Project B)

### Phase 4: Templates & CLI (`src/cli/`, `templates/`, `agents/templates/`)

- **`templates/*.yaml`** — 5 board templates (software-dev, research, content, ops-incident, custom)
- **`agents/templates/`** — 20 parameterized agent prompts using Handlebars-style variables
- **`src/cli/`** — CLI with 5 commands: `init`, `status`, `decisions`, `gates`, `projects`

## Adapter Pattern

AgentBoardroom separates governance logic from runtime/communication infrastructure via two adapter interfaces:

```typescript
interface RuntimeAdapter {
  spawnAgent(config): Promise<string>;
  sendToAgent(agentId, message): Promise<void>;
  postToChannel(channelId, message): Promise<void>;
  scheduleCron(config): Promise<string>;
  killAgent(sessionId): Promise<void>;
  getAgentStatus(agentId): Promise<AgentStatus>;
}

interface ChannelAdapter {
  createChannel(name, purpose): Promise<string>;
  postMessage(channelId, message, tags?): Promise<string>;
  updatePinnedPost(channelId, postId, content): Promise<void>;
  searchMessages(channelId, query): Promise<ChannelMessage[]>;
}
```

The current implementation targets OpenClaw + Mattermost. The interfaces are platform-agnostic — a standalone adapter (direct API calls, no OpenClaw) or different messaging platforms can be swapped in.

## Decision Graph

Every significant decision is a first-class object:

```
DEC-0001 (proposed) → challenged by CTO → DEC-0001 (accepted)
                                              │
DEC-0005 (supersedes DEC-0001) ◄──────────────┘
```

Features:
- **Append-only** — Decisions are never modified, only superseded
- **Queryable** — Filter by author, type, status, project, phase
- **Chain reconstruction** — Follow `supersedes` links to trace decision evolution
- **Challenge history** — Every challenge round (challenger, rationale, counter-proposal) is recorded

## Challenge Protocol

```
Proposer creates Decision Record (status: proposed)
    │
    ▼
Designated Challenger reviews
    │
    ├── ACCEPT → status: accepted → execution allowed
    │
    └── CHALLENGE → counter-proposal with rationale
            │
            ▼
        Proposer revises or escalates
            │
            ├── Revised → new round (max 3)
            │
            └── Escalated → Board Chair decides
```

**Structural enforcement:** `ChallengeProtocol.canExecute(decision)` returns `false` until the decision is accepted or escalated. Code paths that skip this check are governance violations.

## Gate Enforcement

```
Phase N work complete
    │
    ▼
QA reviews against acceptance criteria
    │
    ├── PASS → advancePhase() succeeds → Phase N+1
    │
    ├── CONDITIONAL → advance with tracked conditions
    │
    └── FAIL → advancePhase() returns { advanced: false }
               Phase status: gated_fail
               Work returned to previous owner
```

**Structural enforcement:** `GateEnforcement.advancePhase()` is the only code path for phase transitions. There is no bypass.

Gate verdicts include:
- Test results (run/passed/failed)
- Coverage percentage
- Blocking issues
- Warnings and conditions
- Recommendation

## Multi-Project Registry

The Boardroom can govern multiple projects simultaneously:

- Each project has its own teams, budget, phase tracking, and decision log
- Projects are isolated — Team A on Project 1 cannot see Project 2
- The CEO allocates shared resources (worker pool, model capacity) across projects
- The Board Chair can override priority and allocation decisions
- Projects are sorted by priority: `critical > high > normal > low`

## Federal Model

The relationship between the Boardroom and teams mirrors federalism:

- **Boardroom** (federal) → Sets policy, enforces gates, controls budget, resolves disputes
- **Teams** (sovereign) → Self-organize internally, choose own structure and coordination
- Teams are black boxes — the Boardroom cares about outcomes (acceptance criteria), not process
- When team decisions conflict with Boardroom policy, Boardroom policy prevails

## State Management

- Phase state persisted to `state/{project}/phase.json`
- Decision log persisted to `state/{project}/decisions.json` or `state/decisions.json`
- Gate history persisted to `state/_gate_history.json` (cross-project queryable)
- Project registry in `state/{project}/project.json`
- State survives restarts — file-based backend (git-tracked optional)
