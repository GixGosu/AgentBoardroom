# CLI Usage

Complete reference for the `agentboardroom` command-line interface.

---

## Global Options

| Option | Description |
|---|---|
| `--help` | Show help |
| `--version` | Show version |
| `--json` | Machine-readable JSON output |
| `--dir <path>` | Working directory (default: current directory) |

## Commands

### `init` — Initialize a New Board

Create a new board from a template with project scaffolding.

```bash
agentboardroom init --template <template> --project <name>
```

**Options:**

| Option | Description |
|---|---|
| `--template <name>` | Template to use (prompted if omitted) |
| `--project <name>` | Project name (prompted if omitted) |

**Templates:** `software-dev`, `research`, `content`, `ops-incident`, `custom`

**What it creates:**

```
./
├── board.yaml              # Board configuration
├── agents/                 # Agent prompt files
│   ├── ceo.md
│   ├── cto.md
│   ├── qa.md
│   └── auditor.md
└── state/
    └── <project>/
        └── project.json    # Project state
```

**Examples:**

```bash
# Interactive (prompts for template and project name)
agentboardroom init

# Explicit
agentboardroom init --template software-dev --project my-app

# In a specific directory
agentboardroom init --template research --project thesis --dir ~/projects/thesis

# JSON output (for scripting)
agentboardroom init --template content --project blog --json
```

---

### `status` — Display Board Status

Show the current state of all projects or a specific project.

```bash
agentboardroom status [--project <name>]
```

**Options:**

| Option | Description |
|---|---|
| `--project <name>` | Show detailed status for a specific project |

**Examples:**

```bash
# All projects
agentboardroom status

# Output:
# ═══ Board: Software Development Board ═══
#
# Project   Status   Phase    Priority   Budget    Teams
# my-app    active   Phase 2  normal     34/100    2 teams

# Single project detail
agentboardroom status --project my-app

# JSON output
agentboardroom status --json
```

---

### `decisions` — Query Decision Log

Search and filter the decision log across all projects.

```bash
agentboardroom decisions [filters...]
```

**Options:**

| Option | Description |
|---|---|
| `--project <name>` | Filter by project |
| `--status <status>` | Filter by status: `proposed`, `accepted`, `challenged`, `escalated`, `superseded`, `rejected` |
| `--type <type>` | Filter by type: `architecture`, `planning`, `resource`, `scope`, `technical`, `process` |
| `--author <role>` | Filter by author role |
| `--limit <n>` | Max results (default: 20) |

**Examples:**

```bash
# All recent decisions
agentboardroom decisions

# Decisions for a specific project
agentboardroom decisions --project my-app

# Only accepted architecture decisions
agentboardroom decisions --status accepted --type architecture

# CTO's decisions
agentboardroom decisions --author cto

# Challenged decisions (shows challenge count)
agentboardroom decisions --status challenged

# Last 5 decisions as JSON
agentboardroom decisions --limit 5 --json
```

---

### `record-decision` — Record a Governance Decision

Record a formal decision record. This command is primarily used by agents to create decision records via exec commands.

```bash
agentboardroom record-decision \
  --author <role> \
  --type <type> \
  --summary "Brief decision summary" \
  --rationale "Detailed reasoning" \
  --project <name> \
  [--phase <n>] \
  [--status <status>]
```

**Required Options:**

| Option | Description |
|---|---|
| `--author <role>` | Decision author: `ceo`, `cto`, `qa` |
| `--type <type>` | Decision type: `planning`, `architecture`, `gate`, `challenge`, `resource`, `scope`, `technical`, `process` |
| `--summary <text>` | Brief decision summary (one line) |
| `--rationale <text>` | Detailed reasoning and justification |
| `--project <name>` | Target project name |

**Optional:**

| Option | Description |
|---|---|
| `--phase <n>` | Phase number (default: 0) |
| `--status <status>` | Decision status: `accepted`, `challenged`, `pending` (default: `accepted`) |
| `--evidence <text>` | Supporting evidence (can be repeated) |
| `--dependencies <ids>` | Comma-separated decision IDs this depends on |

**Type Aliases:**

- `planning` → maps to `plan_approval`
- `architecture` → maps to `cto_review`
- `gate` → maps to `qa_gate`
- `challenge` → maps to `cto_review`

**Status Aliases:**

- `pending` → maps to `proposed`

**Examples:**

```bash
# CEO approves a phase plan
agentboardroom record-decision \
  --author ceo \
  --type planning \
  --summary "Approve Phase 1 implementation plan" \
  --rationale "Plan is well-structured with clear parallelization opportunities. Resource estimates are within budget. All prerequisites completed." \
  --project my-app \
  --phase 1 \
  --status accepted

# CTO challenges architecture
agentboardroom record-decision \
  --author cto \
  --type architecture \
  --summary "Challenge: Circular dependency detected in module structure" \
  --rationale "Module A imports from module B which imports from module A. This creates a circular dependency that will cause issues during testing. Recommend extracting shared types to a common module and reversing the dependency direction." \
  --project my-app \
  --phase 1 \
  --status challenged

# QA records gate verdict (PASS)
agentboardroom record-decision \
  --author qa \
  --type gate \
  --summary "Phase 2 gate: PASS (95/100 tests, 82% coverage)" \
  --rationale "All critical tests passing. Coverage above 70% threshold. No blocking issues. Minor warnings on edge case handling documented for next phase." \
  --project my-app \
  --phase 2 \
  --status accepted

# QA records gate verdict (FAIL)
agentboardroom record-decision \
  --author qa \
  --type gate \
  --summary "Phase 1 gate: FAIL (45/100 tests, 58% coverage)" \
  --rationale "Critical integration tests failing. Coverage below threshold. Blocking issues: auth module tests timeout, data integrity checks fail on edge cases. Recommend replan with focus on test infrastructure." \
  --project my-app \
  --phase 1 \
  --status challenged

# Resource allocation decision
agentboardroom record-decision \
  --author ceo \
  --type resource \
  --summary "Reallocate 2 workers from project-alpha to project-beta" \
  --rationale "Project-beta blocked on understaffing; alpha ahead of schedule by 2 days. This reallocation unblocks beta while maintaining alpha timeline." \
  --project my-app \
  --phase 2 \
  --status accepted

# JSON output (for scripting)
agentboardroom record-decision \
  --author ceo \
  --type planning \
  --summary "Test decision" \
  --rationale "Testing CLI" \
  --project my-app \
  --json
```

**Output (non-JSON):**

```
✓ Decision DEC-0042 recorded successfully

ID        DEC-0042
Author    ceo
Type      plan_approval
Status    accepted
Summary   Approve Phase 1 implementation plan
Project   my-app
Phase     1
```

**Error Handling:**

The command validates all inputs and returns appropriate exit codes:

- Exit code `0`: Success
- Exit code `1`: Validation error or project not found

```bash
# Missing required field
agentboardroom record-decision --author ceo --type planning --project my-app
# Error: --summary is required

# Invalid author
agentboardroom record-decision --author unknown --type planning --summary "Test" --rationale "Test" --project my-app
# Error: Invalid author: unknown. Must be one of: ceo, cto, qa

# Project doesn't exist
agentboardroom record-decision --author ceo --type planning --summary "Test" --rationale "Test" --project nonexistent
# Error: Project "nonexistent" not found. Initialize it first with 'agentboardroom init'.
```

**Use in Agent Prompts:**

Agents call this command via exec to formally record decisions:

```typescript
// In agent code
exec(`agentboardroom record-decision \
  --author ceo \
  --type planning \
  --summary "Phase 1 approved" \
  --rationale "Plan meets all criteria" \
  --project ${projectName} \
  --phase 1 \
  --status accepted`);
```

All decisions are written to `state/<project>/decisions.json` with full lineage tracking.

---

### `gates` — Query Gate Verdict History

Search and filter gate verdicts across all projects.

```bash
agentboardroom gates [filters...]
```

**Options:**

| Option | Description |
|---|---|
| `--project <name>` | Filter by project |
| `--status <verdict>` | Filter by verdict: `PASS`, `FAIL`, `CONDITIONAL` |
| `--phase <n>` | Filter by phase number |
| `--issued-by <role>` | Filter by issuing role |
| `--limit <n>` | Max results (default: 20) |

**Examples:**

```bash
# All gate verdicts
agentboardroom gates

# Verdicts for a specific project
agentboardroom gates --project my-app

# Only failures (shows blocking issues)
agentboardroom gates --status FAIL

# Phase 2 verdicts
agentboardroom gates --phase 2

# QA-issued verdicts
agentboardroom gates --issued-by qa

# JSON output
agentboardroom gates --project my-app --json
```

**Failure details:** When FAIL verdicts are present, the CLI shows blocking issues below the table:

```
Gate                  Verdict  Issuer  Project  Phase  Tests  Coverage
impl_to_integration   FAIL     qa      my-app   2      8/12   67%

Blocking Issues
  impl_to_integration (my-app):
    • 4 tests failing in auth module
    • No error handling for API timeouts
```

---

### `projects` — Multi-Project Management

List projects and manage priorities.

#### `projects list`

```bash
agentboardroom projects list
```

Shows all projects sorted by priority with status, phase, budget usage, team count, and start date.

```
Projects

Project    Status  Priority  Phase    Budget  Teams  Started
critical1  active  critical  Phase 3  72%     4      2026-02-01
my-app     active  normal    Phase 2  34%     2      2026-02-05
backlog    active  low       Phase 0  0%      0      2026-02-10
```

#### `projects prioritize`

```bash
agentboardroom projects prioritize <project> --priority <level>
```

**Priority levels:** `critical`, `high`, `normal`, `low`

**Examples:**

```bash
# Set high priority
agentboardroom projects prioritize my-app --priority high

# Mark as critical
agentboardroom projects prioritize my-app --priority critical

# JSON output
agentboardroom projects prioritize my-app --priority high --json
```

---

## Multi-Project Workflows

### Managing several projects simultaneously

```bash
# Initialize multiple projects
agentboardroom init --template software-dev --project api-server
agentboardroom init --template software-dev --project web-frontend
agentboardroom init --template content --project docs-site

# Set priorities
agentboardroom projects prioritize api-server --priority high
agentboardroom projects prioritize web-frontend --priority normal
agentboardroom projects prioritize docs-site --priority low

# Overview
agentboardroom projects list

# Check a specific project
agentboardroom status --project api-server
agentboardroom decisions --project api-server
agentboardroom gates --project api-server
```

### Scripting with JSON output

```bash
# Get project data as JSON for scripts
agentboardroom status --json | jq '.projects[].entry.name'

# Get failed gates
agentboardroom gates --status FAIL --json | jq '.[].blocking_issues'

# Count challenged decisions per project
agentboardroom decisions --status challenged --json | jq 'group_by(.project) | map({project: .[0].project, count: length})'
```

## Template Selection Guide

| You want to... | Use template |
|---|---|
| Build software with full governance | `software-dev` |
| Conduct research with methodology review | `research` |
| Run a content pipeline with fact-checking | `content` |
| Respond to incidents with coordination | `ops-incident` |
| Define your own governance structure | `custom` |

See the [template guides](templates/) for detailed role descriptions and workflows for each template.
