# Template Customization Guide

AgentBoardroom ships with 5 board templates for different governance domains. This guide explains how to use, customize, and create your own templates.

## Available Templates

| Template | File | Use Case |
|----------|------|----------|
| **Software Development** | `templates/software-dev.yaml` | Autonomous software projects with CEO/CTO/QA/Auditor |
| **Research** | `templates/research.yaml` | Deep research with PI/Methodologist/Reviewer/Fact-Checker |
| **Content** | `templates/content.yaml` | Content pipelines with Editor/Writer/Fact-Checker/Style Auditor |
| **Ops Incident** | `templates/ops-incident.yaml` | Incident response with IC/SRE/Comms Lead/Auditor |
| **Custom** | `templates/custom.yaml` | Blank template with placeholder roles — fill in your own |

## Quick Start

1. Copy the template closest to your use case:
   ```bash
   cp templates/research.yaml board.yaml
   ```

2. Edit `board.yaml` to customize roles, gates, and settings.

3. Run your board:
   ```bash
   agentboardroom start --config board.yaml
   ```

## Template Structure

Every template follows the same YAML schema:

```yaml
name: "Board Name"        # Human-readable board name
version: 1                 # Schema version

roles:                     # Board member definitions
  role_key:
    title: "Display Name"
    prompt: agents/path/to/prompt.md
    responsibilities: [list, of, capabilities]
    challenges: [role_keys]       # Who this role can challenge
    gates: [role_keys]            # Who gates this role's output
    model_tier: high|medium|low
    session_type: persistent|spawned|cron|ephemeral
    interval: 15m                 # For cron session types only

teams:                     # Team defaults
  defaults:
    max_concurrent_members: 6
    model_tier: medium
    session_type: ephemeral
    self_governing: true

projects:                  # Multi-project settings
  max_concurrent: 10
  resource_competition: role_key  # Who allocates when projects compete
  board_chair_override: true

challenge:                 # Challenge protocol settings
  max_rounds: 3
  auto_escalation: true
  default_action: challenge

gates:                     # Phase transition gates
  gate_name:
    required: [role_keys]
    verdict_type: advisory|structural

budget:                    # Budget tiers and thresholds
governance:                # Self-modification protection
channels:                  # Communication configuration
state:                     # State backend
runtime:                   # Runtime platform
```

## Template Variables (Handlebars)

Agent prompts use `{{variable}}` placeholders that are resolved at load time from the board config.

### Available Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `{{role_title}}` | `roles.{key}.title` | The role's display name |
| `{{role_name}}` | Role key | The role's config key |
| `{{responsibilities}}` | `roles.{key}.responsibilities` | Comma-separated list |
| `{{messaging_platform}}` | `channels.messaging_platform` | e.g., "mattermost" |
| `{{messaging_channel}}` | `channels.messaging_platform` | Same as platform |
| `{{primary_channel}}` | `channels.primary` | Main board channel |
| `{{max_challenge_rounds}}` | `challenge.max_rounds` | Challenge round limit |
| `{{challenger_role}}` | First entry in `challenges` | Who this role challenges with |
| `{{gatekeeper_role}}` | Role with `gate_verdicts` responsibility | Quality gate issuer |
| `{{strategist_role}}` | Role with `planning` responsibility | Strategic leader |
| `{{architect_role}}` | Role with `architecture`/`design_review` | Technical authority |
| `{{*_channel_id}}` | Runtime-provided | Channel IDs per role |

### Block Helpers

```handlebars
{{#each agents}}
| {{this.role}} | `{{this.agent_id}}` | {{this.description}} |
{{/each}}
```

Iterates over all roles in the board config, providing:
- `this.role` — Role title
- `this.agent_id` — Agent session ID (`board-{key}`)
- `this.description` — Comma-separated responsibilities

## Customizing a Template

### Adding a Role

1. Add the role definition in `roles:`:
   ```yaml
   roles:
     new_role:
       title: "New Role"
       prompt: agents/templates/custom/new-role.md
       responsibilities: [specific, capabilities]
       model_tier: medium
       session_type: spawned
   ```

2. Create the prompt file using template variables.

3. Update `gates:` if the new role participates in gate reviews.

4. Update existing role `challenges:` arrays if the new role should participate in challenges.

### Modifying Gates

Gates define what approvals are needed for phase transitions:

```yaml
gates:
  phase_a_to_phase_b:
    required: [role1, role2]        # All must approve
    verdict_type: structural        # FAIL blocks advancement
```

- `required` — list of role keys that must issue verdicts
- `verdict_type` — `structural` (FAIL blocks) or `advisory` (FAIL is a warning)

### Adjusting Budget Thresholds

```yaml
budget:
  thresholds:
    medium_at: 50    # Switch to medium tier at 50% budget
    low_at: 80       # Switch to low tier at 80%
    freeze_at: 100   # Freeze at 100%
```

For incident response, you may want higher thresholds (e.g., `medium_at: 60`) since speed matters more than cost.

## Creating a New Template from Scratch

1. Start from `templates/custom.yaml`
2. Define your domain-specific roles with clear responsibilities
3. Design your phase gates to match your workflow
4. Create prompt files in `agents/templates/{your-template}/`
5. Use the generic prompts (`agents/templates/generic/`) as starting points

### Role Design Pattern

Every board should have at least these archetypes:

| Archetype | Purpose | Session Type |
|-----------|---------|--------------|
| **Leader** | Strategic coordination, planning, resource allocation | persistent |
| **Technical Authority** | Domain expertise, quality standards, challenge capability | persistent |
| **Gatekeeper** | Quality gates, pass/fail verdicts | spawned |
| **Monitor** | Compliance, anomaly detection, periodic audits | cron |

### Generic Prompts

Generic prompt templates are available in `agents/templates/generic/`:
- `leader.md` — For strategic leadership roles
- `technical-authority.md` — For domain expert roles
- `gatekeeper.md` — For quality gate roles
- `monitor.md` — For compliance/audit roles

These can be used directly or as starting points for domain-specific prompts.

## Validation

Templates are validated on load. The following rules are enforced:

1. `name` must be non-empty
2. At least one role must be defined
3. `governance.self_modification` must be set
4. All `challenges` references must point to existing roles
5. All `gates.required` references must point to existing roles

Run tests to validate your template:
```bash
node --test tests/templates.test.ts
```
