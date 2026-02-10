import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { ConfigLoader } from '../dist/core/config.js';

const TEMPLATES_DIR = resolve(import.meta.dirname, '../templates');
const AGENTS_DIR = resolve(import.meta.dirname, '../agents/templates');

const TEMPLATE_FILES = ['software-dev.yaml', 'research.yaml', 'content.yaml', 'ops-incident.yaml', 'custom.yaml'];

describe('Board Templates', () => {
  // --- Template loading & validation ---

  for (const file of TEMPLATE_FILES) {
    const templateName = file.replace('.yaml', '');

    it(`loads and validates ${templateName} template`, () => {
      const path = resolve(TEMPLATES_DIR, file);
      assert.ok(existsSync(path), `Template file missing: ${file}`);
      const loader = new ConfigLoader(path);
      const config = loader.load();
      assert.ok(config.name, 'Template must have a name');
      assert.ok(Object.keys(config.roles).length >= 2, 'Template must have at least 2 roles');
    });
  }

  // --- Role archetype coverage ---

  it('research template has correct roles', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'research.yaml'));
    const config = loader.load();
    assert.ok(config.roles.pi, 'Missing PI role');
    assert.ok(config.roles.methodologist, 'Missing Methodologist role');
    assert.ok(config.roles.reviewer, 'Missing Reviewer role');
    assert.ok(config.roles.fact_checker, 'Missing Fact-Checker role');
  });

  it('content template has correct roles', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'content.yaml'));
    const config = loader.load();
    assert.ok(config.roles.editor_in_chief, 'Missing Editor-in-Chief role');
    assert.ok(config.roles.writer, 'Missing Writer role');
    assert.ok(config.roles.fact_checker, 'Missing Fact-Checker role');
    assert.ok(config.roles.style_auditor, 'Missing Style Auditor role');
  });

  it('ops-incident template has correct roles', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'ops-incident.yaml'));
    const config = loader.load();
    assert.ok(config.roles.incident_commander, 'Missing Incident Commander role');
    assert.ok(config.roles.sre, 'Missing SRE role');
    assert.ok(config.roles.comms_lead, 'Missing Communications Lead role');
    assert.ok(config.roles.auditor, 'Missing Auditor role');
  });

  it('custom template has placeholder roles', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'custom.yaml'));
    const config = loader.load();
    assert.ok(config.roles.lead, 'Missing Lead role');
    assert.ok(config.roles.advisor, 'Missing Advisor role');
    assert.ok(config.roles.reviewer, 'Missing Reviewer role');
    assert.ok(config.roles.monitor, 'Missing Monitor role');
  });

  // --- Challenge relationships are valid ---

  for (const file of TEMPLATE_FILES) {
    const templateName = file.replace('.yaml', '');

    it(`${templateName} challenge relationships reference existing roles`, () => {
      const loader = new ConfigLoader(resolve(TEMPLATES_DIR, file));
      const config = loader.load();
      for (const [roleName, role] of Object.entries(config.roles)) {
        if (role.challenges) {
          for (const target of role.challenges) {
            assert.ok(config.roles[target],
              `Role "${roleName}" challenges non-existent role "${target}" in ${templateName}`);
          }
        }
      }
    });
  }

  // --- Gate definitions reference existing roles ---

  for (const file of TEMPLATE_FILES) {
    const templateName = file.replace('.yaml', '');

    it(`${templateName} gate definitions reference existing roles`, () => {
      const loader = new ConfigLoader(resolve(TEMPLATES_DIR, file));
      const config = loader.load();
      if (config.gates) {
        for (const [gateName, gate] of Object.entries(config.gates)) {
          for (const required of gate.required) {
            assert.ok(config.roles[required],
              `Gate "${gateName}" requires non-existent role "${required}" in ${templateName}`);
          }
        }
      }
    });
  }

  // --- Governance protection is set ---

  for (const file of TEMPLATE_FILES) {
    const templateName = file.replace('.yaml', '');

    it(`${templateName} has governance self-modification prohibited`, () => {
      const loader = new ConfigLoader(resolve(TEMPLATES_DIR, file));
      const config = loader.load();
      assert.equal(config.governance.self_modification, 'prohibited');
    });
  }
});

describe('Agent Prompt Templates', () => {
  // --- Prompt files exist for each template role ---

  it('research template prompt files exist', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'research.yaml'));
    const config = loader.load();
    for (const [key, role] of Object.entries(config.roles)) {
      const promptPath = resolve(TEMPLATES_DIR, '..', role.prompt);
      assert.ok(existsSync(promptPath),
        `Prompt file missing for research/${key}: ${role.prompt}`);
    }
  });

  it('content template prompt files exist', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'content.yaml'));
    const config = loader.load();
    for (const [key, role] of Object.entries(config.roles)) {
      const promptPath = resolve(TEMPLATES_DIR, '..', role.prompt);
      assert.ok(existsSync(promptPath),
        `Prompt file missing for content/${key}: ${role.prompt}`);
    }
  });

  it('ops-incident template prompt files exist', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'ops-incident.yaml'));
    const config = loader.load();
    for (const [key, role] of Object.entries(config.roles)) {
      const promptPath = resolve(TEMPLATES_DIR, '..', role.prompt);
      assert.ok(existsSync(promptPath),
        `Prompt file missing for ops-incident/${key}: ${role.prompt}`);
    }
  });

  it('custom template prompt files exist', () => {
    const loader = new ConfigLoader(resolve(TEMPLATES_DIR, 'custom.yaml'));
    const config = loader.load();
    for (const [key, role] of Object.entries(config.roles)) {
      const promptPath = resolve(TEMPLATES_DIR, '..', role.prompt);
      assert.ok(existsSync(promptPath),
        `Prompt file missing for custom/${key}: ${role.prompt}`);
    }
  });

  // --- Prompt files contain template variables ---

  it('prompt files use Handlebars template variables', () => {
    const templateDirs = readdirSync(AGENTS_DIR);
    for (const dir of templateDirs) {
      const dirPath = resolve(AGENTS_DIR, dir);
      const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = readFileSync(resolve(dirPath, file), 'utf-8');
        assert.ok(content.includes('{{role_title}}'),
          `${dir}/${file} missing {{role_title}} template variable`);
      }
    }
  });

  // --- Generic templates exist ---

  it('generic prompt templates exist for all archetypes', () => {
    const genericDir = resolve(AGENTS_DIR, 'generic');
    assert.ok(existsSync(genericDir), 'Generic templates directory missing');
    const expected = ['leader.md', 'technical-authority.md', 'gatekeeper.md', 'monitor.md'];
    for (const file of expected) {
      assert.ok(existsSync(resolve(genericDir, file)),
        `Generic template missing: ${file}`);
    }
  });
});
