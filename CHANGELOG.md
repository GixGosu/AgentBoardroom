# Changelog

All notable changes to AgentBoardroom will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-10

### Verified
- **End-to-end governance cycle** — AgentBoardroom built itself: 5 phases, 224 tests, 0 failures, ~8.5 hours of autonomous work with minimal human intervention
- **Full smoke test coverage** — Complete governance cycle (Brief → CEO → CTO → QA → Gate) executes in 2-3 minutes
- **Async inter-agent coordination** — Challenge protocol, gate enforcement, and decision routing work reliably across OpenClaw sessions
- **Mandatory milestone posting** — All decision records, gate verdicts, and phase transitions are posted to audit channels and persisted to state
- **Reply routing between agents** — Cross-agent messages correctly delivered via Mattermost/Discord channel adapters

### Changed
- Reframed documentation to emphasize **completion enablement** over failure prevention
- Updated README hero section to lead with outcomes: "The difference between an agent that starts a project and one that finishes it"

## [0.1.0] - 2026-02-10

### Added

#### Phase 1 — Core Abstractions
- Board configuration system with `ConfigLoader`
- Core type system: `BoardConfig`, `RoleConfig`, `DecisionRecord`, `GateVerdict`, `PhaseState`
- Parameterized Handlebars prompt templates for all agent archetypes
- 5 board templates: `software-dev`, `research`, `content`, `ops-incident`, `custom`
- Decision engine with `DecisionStore` — create, query, link, and export decisions

#### Phase 2 — Governance Engine
- `ChallengeProtocol` with adversarial review, counter-proposals, and enforcement
- `GateEnforcement` engine — structural phase gating with verdict history
- `GovernanceProtection` — access control, self-modification prevention, audit logging
- Decision graph with lineage tracking and query engine

#### Phase 3 — OpenClaw Integration
- `OpenClawRuntimeAdapter` — session management, file access policies, tool routing
- `OpenClawChannelAdapter` — cross-agent messaging with Mattermost/Discord/Slack
- `DashboardAggregator` and `DashboardGenerator` — text-based status boards

#### Phase 4 — CLI & Multi-Project
- `agentboardroom` CLI with 5 commands: `init`, `status`, `decisions`, `gates`, `projects`
- `ProjectRegistry` — multi-project lifecycle management
- `ResourceAllocator` — budget and resource allocation across projects
- `IsolationEnforcer` — cross-project data isolation with access control
- Comprehensive documentation suite

#### Phase 5 — Release Preparation
- MIT LICENSE file
- GitHub Actions CI workflow
- Integration test suite
- CHANGELOG documentation
- npm packaging configuration

### Technical Summary
- 190 tests passing across 35 suites
- Full ESM module system with Node16 resolution
- Zero runtime dependencies beyond `yaml`
- TypeScript strict mode throughout

[0.1.0]: https://github.com/GixGosu/AgentBoardroom/releases/tag/v0.1.0
