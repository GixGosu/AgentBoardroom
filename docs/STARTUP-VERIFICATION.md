# Startup Verification — Is AgentBoardroom Live?

After starting AgentBoardroom, run this 5-step smoke test to verify the full governance cycle is working.

## The Smoke Test

Post this brief to your board channel:

```
PROJECT BRIEF: Smoke Test

Create a single file at state/smoke-test/result.txt containing
"AgentBoardroom is live." One phase. Budget: 10k tokens.
Follow full governance cycle.
```

Then observe the 5 checkpoints:

### ✅ Test 1: CEO Responds to Brief

**What to watch:** The CEO picks up the brief from the board channel, decomposes it into a plan, and requests CTO review.

**Pass if:** CEO posts a plan with phases, acceptance criteria, and a CTO challenge request within 2 minutes.

**Fail if:** CEO doesn't respond, responds without a plan, or skips the CTO challenge.

### ✅ Test 2: CTO Challenge Fires

**What to watch:** The CTO reviews the CEO's plan and either accepts or counter-proposes.

**Pass if:** CTO posts a review to their channel with an explicit ACCEPT or CHALLENGE verdict.

**Fail if:** No CTO review occurs, or the CEO proceeds without waiting for CTO input.

### ✅ Test 3: Team Commissioned

**What to watch:** After CTO approval, the CEO spawns a worker team (subagent) to execute the task.

**Pass if:** A subagent session is created and begins work on the file.

**Fail if:** CEO writes the file directly (violates "CEO never writes production code" constraint).

### ✅ Test 4: QA Gate Verdict

**What to watch:** After the team delivers, QA reviews the output against the brief's acceptance criteria.

**Pass if:** QA posts a PASS or FAIL verdict with rationale. If FAIL, CEO replans (does not override).

**Fail if:** No QA review, or the project completes without a gate check.

### ✅ Test 5: Auditor Heartbeat

**What to watch:** The Auditor runs on its cron schedule (default: 15 minutes) and checks budget/compliance.

**Pass if:** Auditor posts a status check mentioning the smoke test project's budget usage.

**Fail if:** No Auditor activity after one cron cycle. Check cron configuration.

## Expected Timeline

| Step | Expected Time |
|---|---|
| CEO plan | < 2 min |
| CTO review | < 2 min |
| Team execution | < 3 min |
| QA gate | < 2 min |
| Auditor check | Next cron cycle (≤ 15 min) |

**Total: ~10 minutes** (excluding Auditor, which runs on its own schedule)

## Verification Complete

If all 5 tests pass, your AgentBoardroom instance is live and the governance cycle is working:

- **Separation of powers** — CEO planned, CTO challenged, QA gated, Auditor monitored
- **Structural enforcement** — CEO didn't write code, didn't skip CTO, didn't override QA
- **Audit trail** — All decisions and verdicts posted to channels
- **Team sovereignty** — Worker team self-organized to complete the task

Clean up: `rm -rf state/smoke-test/`

## Troubleshooting

| Symptom | Likely Cause |
|---|---|
| CEO doesn't respond | Agent session not running or not bound to channel |
| CTO never reviews | CTO session not running, or CEO not sending challenge via sessions_send |
| No team spawned | CEO lacks subagent permissions (`allowAgents: ["*"]` in config) |
| QA never gates | QA session not configured, or CEO skipping gate step |
| Auditor silent | Cron job not scheduled, or Auditor model offline |
