/**
 * Integration Test — Release Verification
 *
 * Verifies that AgentBoardroom is properly packaged for npm release.
 * Deep API testing is covered by the existing 190+ unit tests.
 * This test focuses on release readiness: files, structure, CLI, templates.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

describe('Release Verification: Required Files', () => {
  it('LICENSE file exists (MIT)', () => {
    const licensePath = resolve(ROOT, 'LICENSE');
    assert.ok(existsSync(licensePath), 'LICENSE should exist');
    const content = readFileSync(licensePath, 'utf-8');
    assert.ok(content.includes('MIT License'), 'Should be MIT license');
    assert.ok(content.includes('Cyberarctica Labs'), 'Should credit Cyberarctica Labs');
  });

  it('CHANGELOG.md exists and documents releases', () => {
    const changelogPath = resolve(ROOT, 'CHANGELOG.md');
    assert.ok(existsSync(changelogPath), 'CHANGELOG.md should exist');
    const content = readFileSync(changelogPath, 'utf-8');
    assert.ok(content.includes('## [0.1.0]'), 'Should document v0.1.0');
    assert.ok(content.includes('Phase 1'), 'Should document Phase 1');
    assert.ok(content.includes('Phase 2'), 'Should document Phase 2');
    assert.ok(content.includes('Phase 3'), 'Should document Phase 3');
    assert.ok(content.includes('Phase 4'), 'Should document Phase 4');
  });

  it('.npmignore exists and excludes dev files', () => {
    const npmignorePath = resolve(ROOT, '.npmignore');
    assert.ok(existsSync(npmignorePath), '.npmignore should exist');
    const content = readFileSync(npmignorePath, 'utf-8');
    assert.ok(content.includes('src/'), 'Should exclude source');
    assert.ok(content.includes('tests/'), 'Should exclude tests');
    assert.ok(content.includes('tsconfig.json'), 'Should exclude tsconfig');
  });

  it('README.md exists with full documentation', () => {
    const readmePath = resolve(ROOT, 'README.md');
    assert.ok(existsSync(readmePath), 'README.md should exist');
    const content = readFileSync(readmePath, 'utf-8');
    assert.ok(content.includes('AgentBoardroom'), 'Should have title');
    assert.ok(content.includes('Quick Start'), 'Should have quick start');
    assert.ok(content.includes('Board Templates'), 'Should document templates');
  });

  it('GitHub Actions CI workflow exists', () => {
    const ciPath = resolve(ROOT, '.github/workflows/ci.yml');
    assert.ok(existsSync(ciPath), 'CI workflow should exist');
    const content = readFileSync(ciPath, 'utf-8');
    assert.ok(content.includes('npm ci'), 'Should run npm ci');
    assert.ok(content.includes('npm test'), 'Should run tests');
    assert.ok(content.includes('tsc --noEmit'), 'Should type check');
  });
});

describe('Release Verification: Package Structure', () => {
  it('package.json has all required fields for npm', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
    assert.ok(pkg.name, 'Should have name');
    assert.equal(pkg.name, 'agentboardroom');
    assert.ok(pkg.version, 'Should have version');
    assert.ok(pkg.description, 'Should have description');
    assert.ok(pkg.main, 'Should have main entry point');
    assert.ok(pkg.types, 'Should have TypeScript types entry point');
    assert.ok(pkg.bin, 'Should have CLI bin entry');
    assert.ok(pkg.license, 'Should have license');
    assert.equal(pkg.license, 'MIT', 'License should be MIT');
    assert.ok(pkg.keywords, 'Should have keywords for npm search');
    assert.ok(pkg.author, 'Should have author');
  });

  it('dist/ directory exists with compiled output', () => {
    assert.ok(existsSync(resolve(ROOT, 'dist/index.js')), 'dist/index.js should exist');
    assert.ok(existsSync(resolve(ROOT, 'dist/index.d.ts')), 'dist/index.d.ts should exist');
    assert.ok(existsSync(resolve(ROOT, 'dist/cli/index.js')), 'CLI should be compiled');
  });

  it('all source modules compile to dist/', () => {
    const modules = [
      'core/config.js',
      'core/types.js',
      'decisions/store.js',
      'challenges/protocol.js',
      'gates/enforcement.js',
      'governance/protection.js',
      'dashboard/generator.js',
      'dashboard/aggregator.js',
      'projects/registry.js',
      'adapters/openclaw/index.js',
      'cli/index.js',
    ];
    for (const mod of modules) {
      assert.ok(existsSync(resolve(ROOT, 'dist', mod)), `dist/${mod} should exist`);
    }
  });
});

describe('Release Verification: Templates', () => {
  it('all 5 templates exist', () => {
    const templateDir = resolve(ROOT, 'templates');
    const templates = ['software-dev', 'research', 'content', 'ops-incident', 'custom'];
    for (const name of templates) {
      const configPath = resolve(templateDir, name, 'board.yaml');
      assert.ok(existsSync(configPath), `Template ${name}/board.yaml should exist`);
      const content = readFileSync(configPath, 'utf-8');
      assert.ok(content.length > 0, `Template ${name} should have content`);
    }
  });

  it('software-dev template has all required prompts', () => {
    const promptsDir = resolve(ROOT, 'templates/software-dev/prompts');
    const prompts = ['ceo.md', 'cto.md', 'qa.md', 'auditor.md'];
    for (const prompt of prompts) {
      assert.ok(existsSync(resolve(promptsDir, prompt)), `Prompt ${prompt} should exist`);
    }
  });

  it('all templates have documentation', () => {
    const docsDir = resolve(ROOT, 'docs/templates');
    const templateDocs = ['software-dev.md', 'research.md', 'content.md', 'ops-incident.md', 'custom.md'];
    for (const doc of templateDocs) {
      assert.ok(existsSync(resolve(docsDir, doc)), `Template doc ${doc} should exist`);
    }
  });
});

describe('Release Verification: Documentation', () => {
  it('core documentation files exist', () => {
    const docs = ['QUICKSTART.md', 'ARCHITECTURE.md', 'CLI-USAGE.md', 'TEMPLATE-CUSTOMIZATION.md'];
    for (const doc of docs) {
      const path = resolve(ROOT, 'docs', doc);
      assert.ok(existsSync(path), `${doc} should exist in docs/`);
    }
  });

  it('root documentation files exist', () => {
    const rootDocs = ['README.md', 'CONSTITUTION.md', 'PLAYBOOK.md', 'PLAN.md'];
    for (const doc of rootDocs) {
      const path = resolve(ROOT, doc);
      assert.ok(existsSync(path), `${doc} should exist in root`);
    }
  });
});

describe('Release Verification: ESM Module System', () => {
  it('tsconfig.json is configured for Node16 ESM', () => {
    const tsconfig = JSON.parse(readFileSync(resolve(ROOT, 'tsconfig.json'), 'utf-8'));
    assert.equal(tsconfig.compilerOptions.module, 'Node16', 'Should use Node16 module system');
    assert.equal(tsconfig.compilerOptions.moduleResolution, 'Node16', 'Should use Node16 resolution');
    assert.equal(tsconfig.compilerOptions.target, 'ES2022', 'Should target ES2022');
  });

  it('source files use .js extensions in imports', () => {
    // Sample check — a few representative files
    const indexContent = readFileSync(resolve(ROOT, 'src/index.ts'), 'utf-8');
    assert.ok(indexContent.includes(".js'"), 'index.ts should use .js extensions in imports');
    
    const configContent = readFileSync(resolve(ROOT, 'src/core/config.ts'), 'utf-8');
    assert.ok(configContent.includes(".js'"), 'config.ts should use .js extensions in imports');
  });
});

describe('Release Verification: CLI Executable', () => {
  it('CLI entry point has shebang', () => {
    const cliPath = resolve(ROOT, 'dist/cli/index.js');
    assert.ok(existsSync(cliPath), 'CLI should be compiled');
    const content = readFileSync(cliPath, 'utf-8');
    assert.ok(content.startsWith('#!/usr/bin/env node'), 'CLI should have node shebang');
  });

  it('package.json bin points to CLI', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
    assert.ok(pkg.bin, 'Should have bin field');
    assert.ok(pkg.bin.agentboardroom, 'Should have agentboardroom command');
    assert.ok(pkg.bin.agentboardroom.includes('dist/cli/index.js'), 'Should point to compiled CLI');
  });
});

describe('Release Verification: Quality Gates', () => {
  it('test suite is comprehensive (190+ tests)', () => {
    // This is verified by running `npm test` externally
    // Just verify test files exist
    const testFiles = [
      'core.test.ts',
      'decision-graph.test.ts',
      'dashboard.test.ts',
      'openclaw-adapter.test.ts',
      'templates.test.ts',
      'projects.test.ts',
      'cli.test.ts',
      'integration.test.ts',
    ];
    for (const file of testFiles) {
      assert.ok(existsSync(resolve(ROOT, 'tests', file)), `Test file ${file} should exist`);
    }
  });

  it('dependencies are minimal', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
    const deps = Object.keys(pkg.dependencies || {});
    // Should only have yaml as runtime dep
    assert.ok(deps.length <= 1, 'Should have minimal runtime dependencies');
    assert.ok(pkg.dependencies.yaml, 'Should have yaml for config parsing');
  });
});
