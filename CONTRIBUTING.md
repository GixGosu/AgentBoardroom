# Contributing to AgentBoardroom

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/GixGosu/AgentBoardroom.git
cd agentboardroom

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

**Requirements:** Node.js >= 20.0.0

## Making Changes

1. **Fork** the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `npm test` — all tests must pass
5. Run `npm run lint` — no type errors
6. Commit with a clear message (see below)
7. Open a Pull Request

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add custom template loader
fix: gate enforcement rejects on missing verdict
docs: update CLI usage examples
test: add challenge protocol edge cases
```

Prefixes: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

## Code Style

- **TypeScript** — strict mode, no `any` unless absolutely necessary
- **ESM** — all imports use `.js` extensions
- **No external runtime deps** beyond what's in `package.json` (currently just `yaml`)
- **Tests** — use Node.js built-in test runner (`node --test`)

## Project Structure

```
src/
  core/          # Config, types
  decisions/     # Decision store
  challenges/    # Challenge protocol
  gates/         # Gate enforcement
  governance/    # Governance protection, audit
  dashboard/     # Dashboard generation
  projects/      # Multi-project management
  adapters/      # Runtime/channel adapters
  cli/           # CLI commands
tests/           # All tests
templates/       # Board templates (YAML)
```

## Testing

```bash
# Run all tests
npm test

# Run a specific test file
node --test tests/decisions.test.ts
```

Tests use `node:test` and `node:assert`. No test frameworks needed.

## Pull Request Process

1. PRs are reviewed by maintainers
2. All CI checks must pass
3. One approval required to merge
4. Squash merge preferred for clean history

## Reporting Issues

Use [GitHub Issues](https://github.com/GixGosu/AgentBoardroom/issues) with the provided templates for bugs and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
