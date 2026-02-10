# AgentBoardroom — Decision Intelligence Platform
## Packaging & Generalization Plan

**Origin:** `/mnt/e/Dev/TheBoard/` (prototype, OpenClaw-specific)
**Target:** `/mnt/e/Dev/DecisionEngines/AgentBoardroom/` (generalizable product)
**Author:** Cyberarctica Labs

---

## What This Is

A multi-agent decision intelligence platform that replaces hub-and-spoke task routing with committee-based autonomous governance. Agents don't just execute — they deliberate, challenge, and verify each other's work.

## What Makes It Different

| Existing Tools | AgentBoardroom |
|---|---|
| Single coordinator dispatches to workers | Executive committee with role-based judgment |
| Human decides, agents execute | Agents decide, human oversees |
| Task routing | Decision architecture |
| Work state tracking | Decision audit trails with lineage |
| Suggested governance (prompt instructions) | Enforced governance (structural constraints) |
| Flat worker pools | Federal model — sovereign agent teams with internal governance |
| "Build feature X" | "Here's the problem. Figure out the solution. Defend it." |

---

## Phase 1: Extract & Package (Week 1-2)

### 1.1 Extract from Prototype

Port from `/mnt/e/Dev/TheBoard/` — the master prompt, agent definitions, and architecture are the IP. Strip hardcoded references to specific Mattermost channel IDs, OpenClaw session keys, model names.

### 1.2 Define the Core Abstraction

**The AgentBoardroom Pattern:**
```
Board Chair (Human)
    │
    ▼
┌─ THE BOARDROOM ──────────────────────────┐
│  CEO ←→ CTO ←→ QA ←→ Auditor            │
└──┬───────────┬───────────┬───────────────┘
   │           │           │
   ▼           ▼           ▼
┌──────┐  ┌──────┐  ┌──────┐
│Team A│  │Team B│  │Team C│
└──────┘  └──────┘  └──────┘
```

The generalizable unit is the **role graph** — who challenges whom, who gates whom, who escalates to whom. The specific roles (CEO/CTO/QA/Auditor) are the default template. Other templates are possible:

- **Research Board:** PI, Methodologist, Reviewer, Fact-Checker, Research Teams
- **Content Board:** Editor-in-Chief, Writer, Fact-Checker, Style Auditor, Writer Teams
- **Investment Board:** Analyst, Risk Officer, Compliance, Portfolio Manager, Analyst Teams
- **Ops Board:** Incident Commander, SRE, Comms Lead, Auditor, Response Teams

### 1.3 Configuration Schema

```yaml
# board.yaml — defines an AgentBoardroom instance
name: "Software Development Board"
version: 1

roles:
  ceo:
    title: "The Strategist"
    responsibilities: [planning, decomposition, coordination, replanning, resource_allocation]
    challenges: [cto]        # Who this role's decisions are reviewed by
    gates: [qa, auditor]     # Who must approve before phase advances
    model_tier: high         # high | medium | low (mapped to available models)
    session_type: persistent

  cto:
    title: "The Architect"
    responsibilities: [architecture, design_review, technical_authority]
    challenges: [ceo]
    model_tier: high
    session_type: persistent

  qa:
    title: "The Gatekeeper"
    responsibilities: [testing, validation, gate_verdicts]
    gates: [teams]
    model_tier: medium
    session_type: spawned

  auditor:
    title: "The Watchdog"
    responsibilities: [budget, anomaly_detection, compliance]
    model_tier: low
    session_type: cron
    interval: 15m

# Agent teams are sovereign — internal structure is their business.
# The Boardroom only defines constraints, not internal organization.
teams:
  defaults:
    max_concurrent_members: 6
    model_tier: medium
    session_type: ephemeral
    self_governing: true  # Teams choose their own internal roles/structure

# Multi-project resource allocation
projects:
  max_concurrent: 10
  resource_competition: ceo  # CEO allocates when projects compete
  board_chair_override: true # Board Chair can override CEO allocation

channels:
  primary: "#theboard"           # Board Chair communication
  per_agent: true                # Each agent gets a visibility channel
  decision_log: "#decision-log"  # Append-only decision record

state:
  backend: git                   # git | filesystem | database
  directory: ./state/

governance:
  self_modification: prohibited  # Agents cannot modify governance assets
  protected_assets:              # Files no governed agent may modify
    - board.yaml
    - agents/*.md
    - CONSTITUTION.md
  challenge_rounds_max: 3
  auto_escalation: true          # Escalate to Board Chair after max rounds

runtime:
  platform: openclaw             # openclaw | standalone (future)
  messaging: mattermost          # mattermost | discord | slack | stdout
```

### 1.4 Deliverables

- [ ] `board.yaml` — default software development board template
- [ ] `templates/` — additional board configurations (research, content, ops)
- [ ] `agents/` — system prompts parameterized with `{{role}}`, `{{responsibilities}}`, `{{challenges}}`, `{{channel_id}}`
- [ ] `src/core/` — board initialization, role graph, state management
- [ ] `README.md` — what it is, why it exists, how to use it
- [ ] `CONSTITUTION.md` — formal governance specification

---

## Phase 2: Decision Engine Core (Week 3-4)

### 2.1 Decision Graph

The key abstraction. Every significant action produces a **Decision Record:**

```json
{
  "id": "DEC-0042",
  "timestamp": "2026-02-10T04:57:00Z",
  "author": "cto",
  "type": "architecture",
  "summary": "Use event-driven pattern for module communication",
  "rationale": "Avoids assembly cycles (see Unity pattern in prior project)",
  "challenged_by": null,
  "challenge_rounds": 0,
  "status": "accepted",
  "evidence": ["benchmark showing 40% less coupling", "prior project post-mortem"],
  "supersedes": "DEC-0038",
  "phase": 2,
  "project": "example-project"
}
```

This is the DI layer. Decisions are first-class objects with lineage, not just chat messages that scroll by.

### 2.2 Challenge Protocol Engine

Formalize what the prototype does informally — make it structural, not voluntary:

1. Agent proposes decision → writes Decision Record with status `proposed`
2. Designated challenger reviews → either `accepted` or `challenged` with counter-proposal
3. If challenged → original author revises or escalates to Board Chair
4. Max 3 challenge rounds before auto-escalation
5. All rounds recorded in decision graph
6. **Enforcement:** The system blocks execution until the challenge protocol completes. Not a prompt suggestion — a code path.

### 2.3 Gate Protocol Engine

Formalize QA/Auditor gates with structural enforcement:

- Gate definitions in `board.yaml` (which roles gate which transitions)
- Gate verdicts: `PASS`, `FAIL`, `CONDITIONAL` (pass with noted issues)
- Failed gates → automatic revert to previous phase owner
- **Enforcement:** Phase state machine physically cannot advance without gate approval. Not honor-system — code-enforced.
- Gate history queryable ("show me every QA failure in this project")

### 2.4 Self-Modification Prevention

Implement the Constitutional prohibition (Article IX) at the infrastructure level:

- File access controls scoping agents away from governance assets
- Agent prompts, board.yaml, Constitution, gate definitions are read-only to all governed agents
- Only Board Chair (human) or isolated maintenance system can modify governance
- This is the line between "suggested governance" and "enforced governance"

### 2.5 Deliverables

- [ ] `src/decisions/` — Decision Record schema, storage, query engine
- [ ] `src/challenges/` — Challenge protocol engine with round tracking and auto-escalation
- [ ] `src/gates/` — Gate definition, enforcement, and phase state machine
- [ ] `src/state/` — Phase machine, task registry, project lifecycle
- [ ] `src/governance/` — Self-modification prevention, access control enforcement

---

## Phase 3: Runtime Integration (Week 5-6)

### 3.1 OpenClaw Adapter

The prototype is OpenClaw-native. Extract the integration into an adapter so the core logic doesn't depend on OpenClaw directly:

```
src/
  core/           # Pure logic: decisions, challenges, gates, roles
  adapters/
    openclaw/     # sessions_spawn, sessions_send, cron, message
    standalone/   # Future: direct API calls, no gateway needed
  channels/
    mattermost/   # Channel creation, message routing, pinned status
    discord/      # Future
    slack/        # Future
    stdout/       # CLI mode — print to terminal
```

### 3.2 Dashboard (The Face)

A pinned/auto-updating status view per project:

```
═══ AGENTBOARDROOM — Project: DecisionEngines ═══
Phase: 2 (Implementation) | Budget: 34% used
CEO: Planning Phase 3         | ● active
CTO: Reviewing module-auth    | ● active  
QA:  Waiting for submission   | ○ idle
Auditor: Last check 12m ago   | ○ idle
Teams: 3 active (12 agents total)
  └ Team Alpha: src/core/decisions    [██████░░] 75%
  └ Team Beta:  src/adapters/openclaw [████░░░░] 50%
  └ Team Gamma: src/state/phases      [██░░░░░░] 25%
Recent Decisions: DEC-0042 (accepted), DEC-0041 (accepted)
Last Gate: QA PASS (Phase 1 → Phase 2) at 03:42 EST
═══════════════════════════════════════════════════
```

### 3.3 Multi-Project Resource Management

Implement the federal model for concurrent projects:

- Project registry with independent state, budgets, and teams per project
- CEO resource allocation when projects compete (worker pool, model capacity, token budget)
- Board Chair override on allocation decisions
- Cross-project isolation — teams cannot see or affect other projects
- Aggregate budget tracking across all projects (Auditor)

### 3.4 Deliverables

- [ ] `src/adapters/openclaw/` — OpenClaw integration adapter
- [ ] `src/channels/mattermost/` — Mattermost channel management + dashboard
- [ ] `src/dashboard/` — Status board generator (text-based, channel-agnostic)
- [ ] `src/projects/` — Multi-project registry, resource allocation, isolation

---

## Phase 4: Generalization & Templates (Week 7-8)

### 4.1 Board Templates

Package pre-built board configurations:

| Template | Roles | Use Case |
|---|---|---|
| `software-dev` | CEO, CTO, QA, Auditor + Dev teams | Default. Ship code autonomously. |
| `research` | PI, Methodologist, Reviewer, Fact-Checker + Research teams | Deep research with verification. |
| `content` | Editor, Writer, Fact-Checker, Style Auditor + Writer teams | Content pipelines with quality gates. |
| `ops-incident` | Incident Commander, SRE, Comms, Auditor + Response teams | Incident response with coordination. |
| `investment` | Analyst, Risk, Compliance, PM + Analyst teams | Investment analysis with checks. |
| `custom` | User-defined | Blank template, user fills roles. |

### 4.2 CLI

```bash
# Initialize a new board
agentboardroom init --template software-dev --project my-app

# Start the Boardroom
agentboardroom start

# Check status
agentboardroom status

# View decision log
agentboardroom decisions --project my-app

# View gate history
agentboardroom gates --project my-app --status failed

# Multi-project management
agentboardroom projects list
agentboardroom projects prioritize my-app
```

### 4.3 Deliverables

- [ ] `templates/` — Board YAML files for each template
- [ ] `agents/templates/` — Parameterized system prompts per template
- [ ] `bin/agentboardroom` — CLI entrypoint
- [ ] Documentation: README, QUICKSTART, ARCHITECTURE

---

## Phase 5: The Meta Move (Week 9-10)

### Have AgentBoardroom Build Itself

Once Phases 1-2 are implemented, use AgentBoardroom to build Phases 3-5. The CEO plans the remaining work, CTO architects the adapters, agent teams implement, QA validates. The project becomes its own proof of concept.

Document this process publicly. "We built a decision intelligence platform, then had it finish building itself." That's the demo.

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | OpenClaw is Node-based, skills are TS/JS, ecosystem alignment |
| State backend | Git (files + commits) | Already proven in prototype, audit trail for free |
| Config format | YAML | Human-readable, supports comments, familiar to DevOps audience |
| Primary channel | Mattermost | Already deployed, self-hosted, API-rich |
| Package format | npm (OpenClaw skill) | Distributable via ClawHub, installable with one command |

---

## Success Criteria

1. A non-Brine human can `agentboardroom init --template software-dev` and have a working autonomous dev team in 10 minutes
2. Decision records are queryable and form a complete audit trail
3. The challenge protocol catches at least one real architectural mistake per project
4. Gate enforcement is structural — agents cannot bypass gates, only humans can override
5. Self-modification prevention is infrastructure-enforced, not prompt-suggested
6. The dashboard gives at-a-glance project status without reading chat history
7. At least 2 board templates work end-to-end (software-dev + one other)
8. Multi-project resource competition works — CEO allocates, Board Chair overrides

---

*This plan was last updated 2026-02-10. Phase 1 execution begins now.*
