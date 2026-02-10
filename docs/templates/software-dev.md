# Software Development Template

The default AgentBoardroom template for autonomous software development projects.

**Template file:** `templates/software-dev.yaml`

---

## Roles

| Role | Title | Session | Model Tier | Purpose |
|---|---|---|---|---|
| `ceo` | CEO | Persistent | High | Strategic planning, decomposition, team commissioning, resource allocation |
| `cto` | CTO | Persistent | High | Architecture, technical review, challenge authority |
| `qa` | QA | Spawned | Medium | Validation, gate verdicts (PASS/FAIL/CONDITIONAL) |
| `auditor` | Auditor | Cron (15m) | Low | Budget monitoring, anomaly detection, compliance |

### CEO (Strategist)

The CEO receives project briefs and breaks them into phases, tasks, and team requirements. They commission agent teams, monitor progress, replan when conditions change, and allocate resources across concurrent projects.

- **Challenged by:** CTO
- **Gated by:** QA, Auditor

### CTO (Architect)

The CTO defines technical architecture and module boundaries. They challenge CEO plans for technical feasibility and review team output for architectural compliance.

- **Challenges:** CEO
- Must provide substantive rationale — bare rejections are invalid

### QA (Gatekeeper)

QA validates team output against the original brief and acceptance criteria. QA is spawned per validation cycle (not persistent) to prevent context contamination.

- **Issues gate verdicts:** PASS, FAIL, CONDITIONAL
- FAIL verdicts structurally block phase advancement

### Auditor (Watchdog)

The Auditor runs on a 15-minute cron cycle, monitoring budget consumption, detecting anomalies (infinite loops, scope creep, rogue spawning), and enforcing compliance.

- **Read-only** access to all project state
- Can freeze the system and escalate to Board Chair

## Challenge Relationships

```
CEO ←──challenge──→ CTO
```

Max 3 rounds. Auto-escalates to Board Chair if unresolved.

## Phase Gates

| Transition | Gate | Required | Type |
|---|---|---|---|
| Planning → Architecture | `planning_to_architecture` | CEO, CTO | Advisory |
| Architecture → Implementation | `architecture_to_implementation` | CTO | Advisory |
| Implementation → Integration | `implementation_to_integration` | QA | **Structural** |
| Integration → Delivery | `integration_to_delivery` | CEO, CTO, QA, Auditor | **Structural** |

**Structural** gates block phase advancement on FAIL. Advisory gates are logged but don't block.

## Typical Workflow

```
1. Board Chair posts project brief to #theboard
2. CEO decomposes into phases and tasks
3. CTO challenges the plan → accepted or revised
4. CEO commissions agent teams for Phase 1
5. Teams self-organize and execute
6. QA validates output → PASS/FAIL/CONDITIONAL
7. If PASS → advance to next phase
8. If FAIL → work returned to teams with specific failures
9. Auditor monitors budget every 15 minutes
10. Repeat until delivery gate passes
```

## Configuration Defaults

- **Max concurrent projects:** 10
- **Max team members:** 6 per team
- **Team model tier:** Medium
- **Budget thresholds:** Medium at 50%, Low at 80%, Freeze at 100%
- **Channels:** `#theboard` (primary), `#decision-log`, per-agent channels

## Quick Start

```bash
agentboardroom init --template software-dev --project my-app
```

Then edit `board.yaml` to set your channel IDs and any customizations.

## Customization

See the [Template Customization Guide](../TEMPLATE-CUSTOMIZATION.md) for adding roles, modifying gates, and adjusting budget thresholds.
