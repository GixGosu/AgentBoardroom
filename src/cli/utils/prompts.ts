/**
 * CLI Interactive Prompts — minimal readline-based prompts for template selection, etc.
 */

import { createInterface } from 'node:readline';

const TEMPLATES = ['software-dev', 'research', 'content', 'ops-incident', 'custom'] as const;
export type TemplateName = typeof TEMPLATES[number];

export function getAvailableTemplates(): readonly string[] {
  return TEMPLATES;
}

export async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise<string>((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

export async function selectTemplate(): Promise<string> {
  console.log('\nAvailable templates:');
  TEMPLATES.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t}`);
  });
  const answer = await prompt('\nSelect template (number or name)', 'software-dev');
  const num = parseInt(answer, 10);
  if (num >= 1 && num <= TEMPLATES.length) {
    return TEMPLATES[num - 1];
  }
  if (TEMPLATES.includes(answer as TemplateName)) {
    return answer;
  }
  throw new Error(`Unknown template: ${answer}. Available: ${TEMPLATES.join(', ')}`);
}

export function isValidTemplate(name: string): boolean {
  return TEMPLATES.includes(name as TemplateName);
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${suffix}`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}
