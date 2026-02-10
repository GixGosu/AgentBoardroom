# Research Template

Board configuration for deep research projects with verification pipelines.

**Template file:** `templates/research.yaml`

---

## Roles

| Role | Title | Session | Model Tier | Purpose |
|---|---|---|---|---|
| `pi` | Principal Investigator | Persistent | High | Research planning, hypothesis formation, coordination, resource allocation |
| `methodologist` | Methodologist | Persistent | High | Methodology design, statistical rigor, challenge authority |
| `reviewer` | Reviewer | Spawned | Medium | Peer review, quality assessment, gate verdicts |
| `fact_checker` | Fact-Checker | Cron (15m) | Medium | Source verification, citation audit, compliance |

### Principal Investigator (PI)

The PI formulates research questions and hypotheses, decomposes projects into research phases, commissions research teams, and allocates resources. Equivalent to the CEO role in software-dev.

- **Challenged by:** Methodologist
- **Gated by:** Reviewer, Fact-Checker

### Methodologist

The Methodologist reviews research design for methodological soundness and statistical rigor. They challenge the PI's plans and review team output for design compliance.

- **Challenges:** PI

### Reviewer

The Reviewer conducts peer review of research output against the original research questions and acceptance criteria. Spawned per review cycle to prevent bias.

- **Issues gate verdicts:** PASS, FAIL, CONDITIONAL

### Fact-Checker

The Fact-Checker verifies sources, validates claims against cited evidence, and audits citations. Runs on a 15-minute cron cycle.

- Verifies all factual claims have valid sources
- Monitors for citation integrity and anomalies

## Challenge Relationships

```
PI ←──challenge──→ Methodologist
```

## Phase Gates

| Transition | Gate | Required | Type |
|---|---|---|---|
| Hypothesis → Methodology | `hypothesis_to_methodology` | PI, Methodologist | Advisory |
| Methodology → Research | `methodology_to_research` | Methodologist | Advisory |
| Research → Review | `research_to_review` | Reviewer | **Structural** |
| Review → Publication | `review_to_publication` | PI, Methodologist, Reviewer, Fact-Checker | **Structural** |

## Typical Workflow

```
1. Board Chair posts research brief
2. PI formulates hypotheses and research plan
3. Methodologist challenges for rigor → accepted or revised
4. PI commissions research teams
5. Teams gather data, analyze, draft findings
6. Reviewer peer-reviews output → PASS/FAIL
7. Fact-Checker verifies sources and citations
8. Full board review before publication
```

## Configuration Defaults

- **Max concurrent projects:** 5
- **Max team members:** 4 per team
- **Budget thresholds:** Medium at 50%, Low at 80%, Freeze at 100%
- **Channels:** `#research-board`, `#research-log`

## Quick Start

```bash
agentboardroom init --template research --project my-study
```
