# Quick Start Guide

Get AgentBoardroom running in 10 minutes.

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **OpenClaw** — Agent runtime ([installation guide](https://github.com/openclaw/openclaw))
- **Mattermost**, **Discord**, or **Slack** — Communication layer for agent messaging

## Step 1: Install

```bash
npm install agentboardroom
```

Or clone the repo:

```bash
git clone https://github.com/GixGosu/AgentBoardroom.git
cd agentboardroom
npm install
npm run build
```

## Step 2: Initialize a Board

Pick a template and create your first project:

```bash
agentboardroom init --template software-dev --project my-app
```

This creates:
- `board.yaml` — Board configuration (roles, gates, budget, channels)
- `agents/` — Agent prompt files (CEO, CTO, QA, Auditor)
- `state/` — Project state directory

If you omit `--template` or `--project`, the CLI prompts you interactively.

### Available Templates

| Template | Best For |
|---|---|
| `software-dev` | Building software with CEO/CTO/QA/Auditor governance |
| `research` | Research projects with PI/Methodologist/Reviewer/Fact-Checker |
| `content` | Content pipelines with Editor/Writer/Fact-Checker/Style Auditor |
| `ops-incident` | Incident response with IC/SRE/Comms/Auditor |
| `custom` | Blank slate — define your own roles |

## Step 3: Configure Channels

Edit `board.yaml` to set your messaging channels:

```yaml
channels:
  primary: "#my-app-board"       # Main boardroom channel
  per_agent: true                # Each agent gets their own channel
  decision_log: "#my-app-log"   # Where decisions are posted
  messaging_platform: mattermost # or discord, slack
```

Create these channels in your messaging platform before starting the board.

## Step 4: Configure OpenClaw

Ensure OpenClaw is running and configured to connect to your messaging platform. AgentBoardroom uses OpenClaw for:

- Spawning agent sessions (CEO, CTO, QA, Auditor, teams)
- Cross-agent messaging
- Cron scheduling (Auditor heartbeat)
- Tool access (file operations, web search, etc.)

## Step 5: Post a Project Brief

Post a project brief to your boardroom channel. The CEO will:

1. Decompose it into phases and tasks
2. Submit the plan to the CTO for challenge review
3. Commission agent teams after the plan is accepted
4. Coordinate execution through phase gates

### Example Brief

```
PROJECT BRIEF: Personal Finance Dashboard

Build a web-based personal finance dashboard with:
- Bank account integration via Plaid API
- Transaction categorization (ML-based)
- Monthly budget tracking with alerts
- Responsive UI (React + Tailwind)

Acceptance criteria:
- Users can link bank accounts and see transactions
- Auto-categorization accuracy > 85%
- Budget alerts via email when threshold exceeded
- Mobile-friendly responsive design
```

## Step 6: Monitor Progress

### Check Status

```bash
agentboardroom status
```

Shows all projects with their phase, priority, budget usage, and team count.

### Watch Decisions

```bash
agentboardroom decisions --project my-app
```

See every decision made — who proposed it, whether it was challenged, and the outcome.

### Check Gate Verdicts

```bash
agentboardroom gates --project my-app
```

See phase transition verdicts: which passed, which failed, and blocking issues.

### Manage Multiple Projects

```bash
agentboardroom projects list
agentboardroom projects prioritize my-app --priority high
```

## What Happens Next

Once the brief is posted, the governance cycle runs autonomously:

```
Brief → CEO decomposes → CTO challenges → Teams execute
  → QA gates each phase → Auditor monitors budget/scope
  → Repeat until delivery
```

You (the Board Chair) are notified when:
- The challenge protocol reaches max rounds without resolution
- QA issues a FAIL verdict that blocks progress
- The Auditor detects anomalies (budget overrun, scope creep, infinite loops)
- The project reaches delivery

## Next Steps

- **[CLI Usage](CLI-USAGE.md)** — Full command reference
- **[Architecture](ARCHITECTURE.md)** — How the system works under the hood
- **[Template Customization](TEMPLATE-CUSTOMIZATION.md)** — Modify templates or build your own
- **Template Guides** — Deep dive into each template:
  [software-dev](templates/software-dev.md) ·
  [research](templates/research.md) ·
  [content](templates/content.md) ·
  [ops-incident](templates/ops-incident.md) ·
  [custom](templates/custom.md)
