# Content Template

Board configuration for content pipelines with quality gates and fact-checking.

**Template file:** `templates/content.yaml`

---

## Roles

| Role | Title | Session | Model Tier | Purpose |
|---|---|---|---|---|
| `editor_in_chief` | Editor-in-Chief | Persistent | High | Editorial direction, planning, coordination, resource allocation |
| `writer` | Writer | Persistent | High | Content creation, drafting, revision |
| `fact_checker` | Fact-Checker | Spawned | Medium | Source verification, claim validation, gate verdicts |
| `style_auditor` | Style Auditor | Cron (15m) | Low | Style compliance, tone consistency, brand alignment |

### Editor-in-Chief

Directs the editorial pipeline: decomposes content briefs, commissions writing teams, sets priorities, and coordinates the production cycle.

- **Challenged by:** Style Auditor
- **Gated by:** Fact-Checker, Style Auditor

### Writer

Creates content, drafts, and revises based on editorial direction. Also serves as design reviewer for content structure.

- **Challenges:** Editor-in-Chief

### Fact-Checker

Verifies factual claims and sources in content before publication. Spawned per check cycle.

- **Issues gate verdicts:** PASS, FAIL, CONDITIONAL
- Validates against external sources, not the writer's self-assessment

### Style Auditor

Monitors content for style guide compliance, tone consistency, and brand alignment on a 15-minute cron cycle.

- Detects style drift and tone inconsistencies
- Flags brand guideline violations

## Challenge Relationships

```
Editor-in-Chief ←──challenge──→ Writer
         ↑
    challenged by Style Auditor
```

## Phase Gates

| Transition | Gate | Required | Type |
|---|---|---|---|
| Brief → Drafting | `brief_to_drafting` | Editor-in-Chief | Advisory |
| Drafting → Review | `drafting_to_review` | Writer | Advisory |
| Review → Fact-Check | `review_to_fact_check` | Fact-Checker | **Structural** |
| Fact-Check → Publish | `fact_check_to_publish` | Editor-in-Chief, Fact-Checker, Style Auditor | **Structural** |

## Typical Workflow

```
1. Board Chair posts content brief
2. Editor-in-Chief plans content calendar and assigns topics
3. Writer drafts content
4. Fact-Checker verifies all claims → PASS/FAIL
5. Style Auditor checks tone and brand consistency
6. Full editorial review before publication
```

## Configuration Defaults

- **Max concurrent projects:** 8
- **Max team members:** 4 per team
- **Budget thresholds:** Medium at 50%, Low at 80%, Freeze at 100%
- **Channels:** `#content-board`, `#content-log`

## Quick Start

```bash
agentboardroom init --template content --project blog-pipeline
```
