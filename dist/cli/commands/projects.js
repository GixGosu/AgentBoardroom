"use strict";
/**
 * CLI Command: projects — Multi-project management (list, prioritize).
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
exports.projectsCommand = projectsCommand;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const out = __importStar(require("../utils/output.js"));
const PRIORITY_ORDER = ['critical', 'high', 'normal', 'low'];
function projectsCommand(options) {
    const sub = options.subcommand ?? 'list';
    switch (sub) {
        case 'list':
            return listProjects(options);
        case 'prioritize':
            return prioritizeProject(options);
        default:
            out.error(`Unknown subcommand: ${sub}. Use: list, prioritize`);
            process.exit(1);
    }
}
function listProjects(options) {
    const targetDir = (0, node_path_1.resolve)(options.dir || '.');
    const stateDir = (0, node_path_1.join)(targetDir, 'state');
    const projects = loadProjects(stateDir);
    if (projects.length === 0) {
        if (options.json) {
            out.jsonOutput([]);
        }
        else {
            out.info('No projects found.');
        }
        return;
    }
    // Sort by priority
    projects.sort((a, b) => {
        const ai = PRIORITY_ORDER.indexOf(a.entry.priority);
        const bi = PRIORITY_ORDER.indexOf(b.entry.priority);
        return ai - bi;
    });
    if (options.json) {
        out.jsonOutput(projects.map(p => p.entry));
        return;
    }
    out.heading('Projects');
    console.log('');
    const rows = projects.map(p => {
        const budgetPct = p.entry.budget_total > 0
            ? Math.round((p.entry.budget_used / p.entry.budget_total) * 100)
            : 0;
        return [
            p.entry.name,
            out.colorStatus(p.entry.status),
            colorPriority(p.entry.priority),
            `Phase ${p.entry.current_phase}`,
            `${budgetPct}%`,
            `${p.entry.team_count}`,
            p.entry.started.split('T')[0],
        ];
    });
    out.table(['Project', 'Status', 'Priority', 'Phase', 'Budget', 'Teams', 'Started'], rows);
    console.log('');
}
function prioritizeProject(options) {
    const targetDir = (0, node_path_1.resolve)(options.dir || '.');
    const stateDir = (0, node_path_1.join)(targetDir, 'state');
    if (!options.project) {
        out.error('Project name required: agentboardroom projects prioritize <project> [--priority <level>]');
        process.exit(1);
    }
    const priority = options.priority ?? 'high';
    if (!PRIORITY_ORDER.includes(priority)) {
        out.error(`Invalid priority: ${priority}. Use: ${PRIORITY_ORDER.join(', ')}`);
        process.exit(1);
    }
    const projectFile = (0, node_path_1.join)(stateDir, options.project, 'project.json');
    if (!(0, node_fs_1.existsSync)(projectFile)) {
        out.error(`Project not found: ${options.project}`);
        process.exit(1);
    }
    const data = JSON.parse((0, node_fs_1.readFileSync)(projectFile, 'utf-8'));
    const oldPriority = data.entry.priority;
    data.entry.priority = priority;
    (0, node_fs_1.writeFileSync)(projectFile, JSON.stringify(data, null, 2));
    if (options.json) {
        out.jsonOutput({ project: options.project, oldPriority, newPriority: priority });
    }
    else {
        out.success(`Updated priority for "${options.project}": ${oldPriority} → ${priority}`);
    }
}
function colorPriority(p) {
    switch (p) {
        case 'critical': return out.red(p);
        case 'high': return out.yellow(p);
        case 'normal': return out.green(p);
        case 'low': return out.dim(p);
        default: return p;
    }
}
function loadProjects(stateDir) {
    if (!(0, node_fs_1.existsSync)(stateDir))
        return [];
    const projects = [];
    try {
        for (const dir of (0, node_fs_1.readdirSync)(stateDir)) {
            if (dir.startsWith('_'))
                continue;
            const projectFile = (0, node_path_1.join)(stateDir, dir, 'project.json');
            if ((0, node_fs_1.existsSync)(projectFile)) {
                try {
                    projects.push(JSON.parse((0, node_fs_1.readFileSync)(projectFile, 'utf-8')));
                }
                catch { /* skip */ }
            }
        }
    }
    catch { /* skip */ }
    return projects;
}
//# sourceMappingURL=projects.js.map