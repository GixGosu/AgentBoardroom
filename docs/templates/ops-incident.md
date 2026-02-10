# Ops / Incident Response Template

Board configuration for incident response with coordination, communication, and post-mortem.

**Template file:** `templates/ops-incident.yaml`

---

## Roles

| Role | Title | Session | Model Tier | Purpose |
|---|---|---|---|---|
| `incident_commander` | Incident Commander | Persistent | High | Triage, coordination, escalation management, resource allocation |
| `sre` | SRE | Persistent | High | Root cause analysis, remediation, technical authority |
| `comms_lead` | Communications Lead | Spawned | Medium | Stakeholder updates, status communication, gate verdicts |
| `auditor` | Auditor | Cron (10m) | Low | Compliance, timeline tracking, post-mortem, budget |

### Incident Commander (IC)

Coordinates the incident response: triages the issue, decomposes into investigation and remediation tasks, manages escalation, and allocates response teams.

- **Challenged by:** SRE
- **Gated by:** SRE, Auditor

### SRE

Performs root cause analysis, designs remediation, and validates fixes. Serves as the technical authority during incidents.

- **Challenges:** Incident Commander

### Communications Lead

Manages stakeholder communication and status updates. Issues gate verdicts on whether remediation is ready for external communication.

- **Issues gate verdicts:** PASS, FAIL, CONDITIONAL

### Auditor

Runs on a **10-minute** cron cycle (faster than other templates). Tracks incident timeline, monitors compliance with response procedures, and compiles post-mortem data.

## Key Differences from Other Templates

- **Faster audit cycle:** 10 minutes instead of 15 (incidents need quicker feedback)
- **Higher team budget:** Teams get `high` model tier during peak budget (speed > cost)
- **Fewer max rounds:** Challenge protocol limited to 2 rounds (urgency demands faster decisions)
- **Higher budget thresholds:** Medium tier at 60%, Low at 85% (more runway before degradation)
- **Fewer concurrent projects:** Max 3 (incidents demand focused attention)
- **Larger teams:** Up to 8 members per team

## Challenge Relationships

```
Incident Commander ←──challenge──→ SRE
```

Max 2 rounds. Auto-escalates to Board Chair if unresolved.

## Phase Gates

| Transition | Gate | Required | Type |
|---|---|---|---|
| Triage → Investigation | `triage_to_investigation` | IC, SRE | Advisory |
| Investigation → Remediation | `investigation_to_remediation` | SRE | Advisory |
| Remediation → Verification | `remediation_to_verification` | Comms Lead | **Structural** |
| Verification → Resolved | `verification_to_resolved` | IC, SRE, Comms Lead, Auditor | **Structural** |

## Typical Workflow

```
1. Incident triggered (alert or manual report)
2. IC triages severity and impact
3. SRE challenges triage assessment → accepted or revised
4. IC commissions investigation teams
5. Teams investigate root cause
6. SRE designs remediation → reviewed by IC
7. Teams implement fix
8. Comms Lead verifies fix is communicable → PASS/FAIL
9. Full board review before marking resolved
10. Auditor compiles post-mortem timeline
```

## Configuration Defaults

- **Max concurrent projects:** 3
- **Max team members:** 8 per team
- **Challenge rounds:** 2 (faster than default 3)
- **Budget thresholds:** Medium at 60%, Low at 85%, Freeze at 100%
- **Channels:** `#incident-room`, `#incident-log`

## Quick Start

```bash
agentboardroom init --template ops-incident --project outage-2026-02
```
