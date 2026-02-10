# AgentBoardroom — OpenClaw Skill

Corporate governance for AI agents. A decision intelligence platform that applies governance patterns — adversarial review, gate enforcement, separation of powers, and audit trails — to autonomous multi-agent systems.

## Quick Start

```bash
# 1. Initialize a board from a template
agentboardroom init --template software-dev --project my-app

# 2. Start the Boardroom runtime
agentboardroom start

# 3. The board agents (CEO, CTO, QA, Auditor) are now running
# 4. Commission a project via the CEO agent
```

## Commands

| Command | Description |
|---------|-------------|
| `agentboardroom init` | Initialize a new board from a template |
| `agentboardroom start` | Launch the Boardroom runtime |
| `agentboardroom stop` | Gracefully stop the Boardroom |
| `agentboardroom status` | Display board/project status |
| `agentboardroom decisions` | Query decision log |
| `agentboardroom gates` | Query gate verdict history |
| `agentboardroom projects` | Multi-project management |

## Start Options

```bash
agentboardroom start                    # Use board.yaml in current directory
agentboardroom start --config path.yaml # Explicit config
agentboardroom start --dry-run          # Show what would happen
agentboardroom start --verbose          # Detailed logging
```

## Architecture

The Boardroom consists of four governance roles:

- **CEO (The Strategist)** — Strategic planning, task decomposition, team commissioning
- **CTO (The Architect)** — Architecture decisions, technical authority, design review
- **QA (The Gatekeeper)** — Gate verdicts, testing, validation (spawned on-demand)
- **Auditor (The Watchdog)** — Budget monitoring, anomaly detection, compliance (cron)

### How It Works

1. `agentboardroom start` reads `board.yaml` and activates each agent
2. Persistent agents (CEO, CTO) get OpenClaw sessions via `openclaw agent`
3. The Auditor runs on a cron schedule via `openclaw cron`
4. QA is spawned on-demand when gate reviews are needed
5. Agents communicate via `sessions_send` (internal) and `message` (external channels)
6. All decisions go through adversarial challenge protocol
7. Phase transitions require gate verdicts (structural enforcement)
8. Governance assets are protected by `GovernanceProtection` (cannot be modified by agents)

### State Persistence

State is persisted to `./state/`:
- `runtime.json` — Active sessions, cron jobs, PID
- `decisions.json` — Full decision audit trail
- `<project>/phase.json` — Gate state per project
- `<project>/project.json` — Project registry entries

Restarting `agentboardroom start` resumes from persisted state.

## Prerequisites

- OpenClaw gateway running (`openclaw gateway start`)
- Board agents configured (`openclaw agents add board-ceo`, etc.)
- Model providers configured in OpenClaw

## Templates

Available board templates:
- `software-dev` — Software development (CEO/CTO/QA/Auditor)
- `research` — Research projects (PI/Methodologist/Reviewer)
- `content` — Content creation (Editor-in-Chief/Writer/Fact-Checker)
- `ops-incident` — Incident response (IC/SRE/Comms)
- `custom` — Blank template for custom boards

## Configuration

See `board.yaml` for full configuration reference. Key sections:
- `roles` — Board member definitions, prompts, model tiers
- `gates` — Phase transition requirements
- `challenge` — Adversarial review protocol settings
- `governance` — Self-modification protection
- `channels` — Communication platform settings
- `budget` — Model tier routing and spending limits
