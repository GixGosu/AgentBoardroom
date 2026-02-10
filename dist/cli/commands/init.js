"use strict";
/**
 * CLI Command: init — Initialize a new board from a template.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const prompts_js_1 = require("../utils/prompts.js");
const out = __importStar(require("../utils/output.js"));
async function initCommand(options) {
    // Resolve template
    let template = options.template;
    if (!template) {
        template = await (0, prompts_js_1.selectTemplate)();
    }
    if (!(0, prompts_js_1.isValidTemplate)(template)) {
        out.error(`Unknown template: ${template}`);
        out.info(`Available: software-dev, research, content, ops-incident, custom`);
        process.exit(1);
    }
    // Resolve project name
    let project = options.project;
    if (!project) {
        project = await (0, prompts_js_1.prompt)('Project name');
    }
    if (!project) {
        out.error('Project name is required');
        process.exit(1);
    }
    // Resolve target directory
    const targetDir = (0, node_path_1.resolve)(options.dir || '.');
    // Find template file — search relative to package root
    const packageRoot = findPackageRoot();
    const templatePath = (0, node_path_1.join)(packageRoot, 'templates', `${template}.yaml`);
    if (!(0, node_fs_1.existsSync)(templatePath)) {
        out.error(`Template file not found: ${templatePath}`);
        process.exit(1);
    }
    // Create project structure
    const boardFile = (0, node_path_1.join)(targetDir, 'board.yaml');
    const stateDir = (0, node_path_1.join)(targetDir, 'state');
    const agentsDir = (0, node_path_1.join)(targetDir, 'agents');
    const projectStateDir = (0, node_path_1.join)(stateDir, project);
    if ((0, node_fs_1.existsSync)(boardFile) && !options.json) {
        out.warn('board.yaml already exists, will be overwritten');
    }
    // Read and customize template
    let templateContent = (0, node_fs_1.readFileSync)(templatePath, 'utf-8');
    // Replace template name with project-specific name
    templateContent = templateContent.replace(/^name:\s*".*"/m, `name: "${project}"`);
    // Create directories
    (0, node_fs_1.mkdirSync)(stateDir, { recursive: true });
    (0, node_fs_1.mkdirSync)(agentsDir, { recursive: true });
    (0, node_fs_1.mkdirSync)(projectStateDir, { recursive: true });
    // Write board.yaml
    (0, node_fs_1.writeFileSync)(boardFile, templateContent);
    // Copy agent prompts if they exist in template agents dir
    const templateAgentsDir = (0, node_path_1.join)(packageRoot, 'agents', 'templates', template.replace('software-dev', 'generic'));
    if ((0, node_fs_1.existsSync)(templateAgentsDir)) {
        const { readdirSync } = await import('node:fs');
        for (const file of readdirSync(templateAgentsDir)) {
            const src = (0, node_path_1.join)(templateAgentsDir, file);
            const dest = (0, node_path_1.join)(agentsDir, file);
            if (!(0, node_fs_1.existsSync)(dest)) {
                (0, node_fs_1.copyFileSync)(src, dest);
            }
        }
    }
    // Also copy base agent files if they exist
    const baseAgentsDir = (0, node_path_1.join)(packageRoot, 'agents');
    if ((0, node_fs_1.existsSync)(baseAgentsDir)) {
        const { readdirSync, statSync } = await import('node:fs');
        for (const file of readdirSync(baseAgentsDir)) {
            const src = (0, node_path_1.join)(baseAgentsDir, file);
            if (file.endsWith('.md') && statSync(src).isFile()) {
                const dest = (0, node_path_1.join)(agentsDir, file);
                if (!(0, node_fs_1.existsSync)(dest)) {
                    (0, node_fs_1.copyFileSync)(src, dest);
                }
            }
        }
    }
    // Initialize project state
    const projectState = {
        entry: {
            name: project,
            status: 'active',
            channel: `#${project}`,
            priority: 'normal',
            budget_total: 100,
            budget_used: 0,
            started: new Date().toISOString(),
            team_count: 0,
            current_phase: 0,
        },
        stateDir: projectStateDir,
        teams: [],
        metadata: { template, initialized_at: new Date().toISOString() },
    };
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(projectStateDir, 'project.json'), JSON.stringify(projectState, null, 2));
    if (options.json) {
        out.jsonOutput({
            success: true,
            project,
            template,
            directory: targetDir,
            files: ['board.yaml', 'state/', 'agents/'],
        });
    }
    else {
        out.success(`Initialized project "${project}" from template "${template}"`);
        out.keyValue('Directory', targetDir);
        out.keyValue('Template', template);
        out.keyValue('Board config', 'board.yaml');
        out.keyValue('State dir', 'state/');
        out.keyValue('Agents dir', 'agents/');
        console.log('');
        out.info('Next: agentboardroom status');
    }
}
function findPackageRoot() {
    let dir = __dirname;
    for (let i = 0; i < 10; i++) {
        if ((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, 'package.json')))
            return dir;
        const parent = (0, node_path_1.join)(dir, '..');
        if (parent === dir)
            break;
        dir = parent;
    }
    return process.cwd();
}
//# sourceMappingURL=init.js.map