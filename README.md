# AgentBoardroom

[![npm version](https://img.shields.io/npm/v/agentboardroom)](https://www.npmjs.com/package/agentboardroom)
[![CI](https://github.com/cyberarctica/agentboardroom/actions/workflows/ci.yml/badge.svg)](https://github.com/cyberarctica/agentboardroom/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Corporate governance for AI agents.**

AgentBoardroom is a decision intelligence platform that applies governance patterns — adversarial review, gate enforcement, separation of powers, and audit trails — to autonomous multi-agent systems.

Agents fail. AgentBoardroom makes sure failures get caught, challenged, and corrected before they propagate.

---

## How It Works

AgentBoardroom is a governance layer that sits above your agent teams. It doesn't do the work — it governs the agents that do.

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

**The Boardroom governs. The teams build. The human oversees.**

### The Governance Cycle

1. **CEO** receives a project brief and decomposes it into phases and team requirements
2. **CTO** challenges the plan for technical feasibility — accepts or rejects with counter-proposal
3. **Agent teams** are commissioned and self-organize to execute
4. **QA** validates output against the original brief and acceptance criteria
5. **QA gates** phase transitions — FAIL structurally blocks advancement
6. **Auditor** monitors budget, scope creep, and compliance on a scheduled cron
7. Every decision, challenge, and gate verdict is recorded in the decision graph

### Key Concepts

- **Challenge Protocol** — Agents structurally challenge each other's decisions before execution. Not optional. Not a prompt suggestion. Built into the architecture.
- **Decision Records** — Every significant decision is a queryable object with author, rationale, challenge history, and lineage.
- **Gate Enforcement** — QA verdicts are structural. A FAIL blocks phase advancement and returns work to the previous owner.
- **Separation of Powers** — No single agent has unchecked authority. Every decision passes through at least two perspectives.

## Quick Start

```bash
# Install
npm install agentboardroom

# Initialize a new board
agentboardroom init --template software-dev --project my-app

# Check status
agentboardroom status

# Query decisions and gates
agentboardroom decisions --project my-app
agentboardroom gates --project my-app
```

For a complete walkthrough, see the **[Quick Start Guide](docs/QUICKSTART.md)**.

## Board Templates

AgentBoardroom ships with pre-built governance configurations for different domains:

| Template | Roles | Use Case | Guide |
|---|---|---|---|
| `software-dev` | CEO, CTO, QA, Auditor | Ship code autonomously | [→](docs/templates/software-dev.md) |
| `research` | PI, Methodologist, Reviewer, Fact-Checker | Deep research with verification | [→](docs/templates/research.md) |
| `content` | Editor, Writer, Fact-Checker, Style Auditor | Content pipelines with quality gates | [→](docs/templates/content.md) |
| `ops-incident` | Commander, SRE, Comms, Auditor | Incident response with coordination | [→](docs/templates/ops-incident.md) |
| `custom` | User-defined | Build your own governance structure | [→](docs/templates/custom.md) |

## CLI

The `agentboardroom` CLI provides 5 commands for managing boards and projects:

```bash
agentboardroom init         # Initialize a new board from a template
agentboardroom status       # Display board/project status
agentboardroom decisions    # Query decision log
agentboardroom gates        # Query gate verdict history
agentboardroom projects     # Multi-project management (list, prioritize)
```

Full reference: **[CLI Usage Guide](docs/CLI-USAGE.md)**

## Documentation

| Document | Description |
|---|---|
| **[Quick Start](docs/QUICKSTART.md)** | 10-minute setup guide |
| **[Architecture](docs/ARCHITECTURE.md)** | System design, module breakdown, adapter pattern |
| **[CLI Usage](docs/CLI-USAGE.md)** | Complete CLI reference with examples |
| **[Template Customization](docs/TEMPLATE-CUSTOMIZATION.md)** | How to customize and create templates |
| **[Constitution](CONSTITUTION.md)** | Formal governance specification |
| **[Playbook](PLAYBOOK.md)** | Origin story and design rationale |

### Template Guides

- [Software Development](docs/templates/software-dev.md)
- [Research](docs/templates/research.md)
- [Content](docs/templates/content.md)
- [Ops / Incident Response](docs/templates/ops-incident.md)
- [Custom](docs/templates/custom.md)

## Why Governance?

Most multi-agent systems use hub-and-spoke: one coordinator dispatches to workers. That's a management structure. It fails when the coordinator drifts, and nothing in the architecture prevents drift.

AgentBoardroom uses committee governance. The coordinator is challenged before execution, gated during transitions, and audited throughout. The architecture doesn't trust any single agent — including the one at the top.

The patterns aren't new. Separation of powers, adversarial review, independent audit, structural gates — these are centuries-old governance concepts. Applying them to AI agents is what's new.

## Built With

- [OpenClaw](https://github.com/openclaw/openclaw) — Agent runtime (session management, cross-agent messaging, cron, tool access)
- [Mattermost](https://mattermost.com/) — Communication and audit trail (also supports Discord, Slack)

## License

MIT

## Credits

Built by [Cyberarctica Labs](https://cyberarctica.com).

---

*"We built governments because people fail. We built AgentBoardroom because agents do too."*
