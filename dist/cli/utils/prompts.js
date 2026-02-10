"use strict";
/**
 * CLI Interactive Prompts — minimal readline-based prompts for template selection, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableTemplates = getAvailableTemplates;
exports.prompt = prompt;
exports.selectTemplate = selectTemplate;
exports.isValidTemplate = isValidTemplate;
exports.confirm = confirm;
const node_readline_1 = require("node:readline");
const TEMPLATES = ['software-dev', 'research', 'content', 'ops-incident', 'custom'];
function getAvailableTemplates() {
    return TEMPLATES;
}
async function prompt(question, defaultValue) {
    const rl = (0, node_readline_1.createInterface)({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    return new Promise((resolve) => {
        rl.question(`${question}${suffix}: `, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || '');
        });
    });
}
async function selectTemplate() {
    console.log('\nAvailable templates:');
    TEMPLATES.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t}`);
    });
    const answer = await prompt('\nSelect template (number or name)', 'software-dev');
    const num = parseInt(answer, 10);
    if (num >= 1 && num <= TEMPLATES.length) {
        return TEMPLATES[num - 1];
    }
    if (TEMPLATES.includes(answer)) {
        return answer;
    }
    throw new Error(`Unknown template: ${answer}. Available: ${TEMPLATES.join(', ')}`);
}
function isValidTemplate(name) {
    return TEMPLATES.includes(name);
}
async function confirm(question, defaultYes = true) {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await prompt(`${question} ${suffix}`);
    if (!answer)
        return defaultYes;
    return answer.toLowerCase().startsWith('y');
}
//# sourceMappingURL=prompts.js.map