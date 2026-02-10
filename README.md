# AgentBoardroom

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
6. **Auditor** monitors budget, scope creep, and compliance on a 15-minute cron
7. Every decision, challenge, and gate verdict is recorded in the decision graph

### Key Concepts

- **Challenge Protocol** — Agents structurally challenge each other's decisions before execution. Not optional. Not a prompt suggestion. Built into the architecture.
- **Decision Records** — Every significant decision is a queryable object with author, rationale, challenge history, and lineage.
- **Gate Enforcement** — QA verdicts are structural. A FAIL blocks phase advancement and returns work to the previous owner.
- **Separation of Powers** — No single agent has unchecked authority. Every decision passes through at least two perspectives.

## Quick Start

### Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) (agent runtime)
- [Mattermost](https://mattermost.com/) (or Discord/Slack — agent communication layer)

### Setup

```bash
# Clone the repo
git clone https://github.com/cyberarctica/agentboardroom.git
cd agentboardroom

# Configure your board
cp templates/software-dev.yaml board.yaml
# Edit board.yaml with your project details and channel IDs

# Start the Boardroom
# (detailed setup guide in docs/)
```

### Usage

1. Post a project brief to your Boardroom channel
2. The CEO decomposes it, the CTO challenges it, teams are commissioned
3. Monitor progress in real-time via your chat platform
4. Review the decision log and deliverables when complete

## Board Templates

AgentBoardroom ships with pre-built governance configurations:

| Template | Roles | Use Case |
|---|---|---|
| `software-dev` | CEO, CTO, QA, Auditor + Dev teams | Ship code autonomously |
| `research` | PI, Methodologist, Reviewer, Fact-Checker + Research teams | Deep research with verification |
| `content` | Editor, Writer, Fact-Checker, Style Auditor + Writer teams | Content pipelines with quality gates |
| `ops-incident` | Commander, SRE, Comms, Auditor + Response teams | Incident response with coordination |
| `custom` | User-defined | Build your own governance structure |

## Documentation

- **[CONSTITUTION.md](CONSTITUTION.md)** — The formal governance specification. The rules, roles, and protocols that define how AgentBoardroom operates.
- **[PLAYBOOK.md](PLAYBOOK.md)** — The origin story. Why this exists, what we learned building it 25 times, and the failure modes that shaped the architecture.
- **[PLAN.md](PLAN.md)** — Development roadmap and packaging plan.

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
