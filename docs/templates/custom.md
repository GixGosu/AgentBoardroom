# Custom Template

A blank-slate template with placeholder roles for building your own governance structure.

**Template file:** `templates/custom.yaml`

---

## Default Roles

The custom template ships with four generic roles that map to the governance archetypes:

| Role | Title | Archetype | Session | Purpose |
|---|---|---|---|---|
| `lead` | Lead | Leader | Persistent | Planning, coordination, resource allocation |
| `advisor` | Advisor | Technical Authority | Persistent | Domain expertise, challenge capability |
| `reviewer` | Reviewer | Gatekeeper | Spawned | Quality gates, pass/fail verdicts |
| `monitor` | Monitor | Watchdog | Cron (15m) | Compliance, anomaly detection, budget |

These are starting points. Rename, replace, or add roles to match your domain.

## Governance Archetypes

Every AgentBoardroom template follows four archetypes. When building a custom board, ensure you have at least one role per archetype:

| Archetype | Purpose | Key Property |
|---|---|---|
| **Leader** | Plans and coordinates | Challenged before execution |
| **Technical Authority** | Domain expert, challenges plans | Independent review power |
| **Gatekeeper** | Validates output | Gate verdicts block/allow advancement |
| **Watchdog** | Monitors compliance | Periodic audit, can freeze |

## Phase Gates

The custom template uses generic phase names:

| Transition | Gate | Required | Type |
|---|---|---|---|
| Phase 1 → Phase 2 | `phase_1_to_phase_2` | Lead, Advisor | Advisory |
| Phase 2 → Phase 3 | `phase_2_to_phase_3` | Advisor | Advisory |
| Phase 3 → Phase 4 | `phase_3_to_phase_4` | Reviewer | **Structural** |
| Phase 4 → Complete | `phase_4_to_complete` | Lead, Advisor, Reviewer, Monitor | **Structural** |

Rename these gates and adjust the required approvers for your workflow.

## How to Customize

### 1. Rename Roles

Edit `board.yaml`:

```yaml
roles:
  director:                          # was: lead
    title: "Director"
    prompt: agents/director.md
    responsibilities:
      - planning
      - coordination
      - resource_allocation
    challenges: [analyst]            # was: advisor
    model_tier: high
    session_type: persistent

  analyst:                           # was: advisor
    title: "Analyst"
    prompt: agents/analyst.md
    responsibilities:
      - design_review
      - technical_authority
    challenges: [director]
    model_tier: high
    session_type: persistent
```

### 2. Add Roles

Add new role entries and update `challenges` / `gates` references:

```yaml
roles:
  # ... existing roles ...
  
  compliance_officer:
    title: "Compliance Officer"
    prompt: agents/compliance-officer.md
    responsibilities:
      - regulatory_review
      - compliance
    model_tier: medium
    session_type: spawned
```

### 3. Customize Gates

Match your workflow phases:

```yaml
gates:
  design_to_build:
    required: [director, analyst]
  build_to_test:
    required: [analyst]
  test_to_deploy:
    required: [reviewer, compliance_officer]
    verdict_type: structural
```

### 4. Create Prompts

Create agent prompt files in `agents/`. Use template variables:

```markdown
# {{role_title}} — {{board_name}}

You are the {{role_title}} of the {{board_name}} boardroom.

## Responsibilities
- Planning and coordination
- Resource allocation across projects

## Challenge Protocol
You are challenged by {{challenger_role}} before execution.
Max {{max_challenge_rounds}} rounds.
```

See the [generic prompt templates](../../agents/templates/generic/) for starting points.

## Quick Start

```bash
agentboardroom init --template custom --project my-project
```

Then edit `board.yaml` and the files in `agents/` to define your governance structure.

## Full Customization Reference

See the [Template Customization Guide](../TEMPLATE-CUSTOMIZATION.md) for:
- Template variable reference
- Gate configuration details
- Budget threshold tuning
- Creating prompts with Handlebars-style variables
