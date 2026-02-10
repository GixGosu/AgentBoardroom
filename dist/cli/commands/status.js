"use strict";
/**
 * CLI Command: status — Display board/project status.
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
exports.statusCommand = statusCommand;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const out = __importStar(require("../utils/output.js"));
function statusCommand(options) {
    const targetDir = (0, node_path_1.resolve)(options.dir || '.');
    const boardFile = (0, node_path_1.join)(targetDir, 'board.yaml');
    const stateDir = (0, node_path_1.join)(targetDir, 'state');
    if (!(0, node_fs_1.existsSync)(boardFile)) {
        out.error('No board.yaml found. Run `agentboardroom init` first.');
        process.exit(1);
    }
    // Read board config (basic YAML parsing for name)
    const boardContent = (0, node_fs_1.readFileSync)(boardFile, 'utf-8');
    const nameMatch = boardContent.match(/^name:\s*"?([^"\n]+)"?/m);
    const boardName = nameMatch?.[1] ?? 'Unknown Board';
    // Scan projects from state directory
    const projects = loadProjects(stateDir);
    if (options.project) {
        const proj = projects.find(p => p.entry.name === options.project);
        if (!proj) {
            out.error(`Project not found: ${options.project}`);
            process.exit(1);
        }
        if (options.json) {
            out.jsonOutput(proj);
        }
        else {
            showProjectStatus(proj);
        }
        return;
    }
    if (options.json) {
        out.jsonOutput({ board: boardName, projects });
        return;
    }
    out.heading(`Board: ${boardName}`);
    console.log('');
    if (projects.length === 0) {
        out.info('No projects initialized yet.');
        return;
    }
    const rows = projects.map(p => [
        p.entry.name,
        out.colorStatus(p.entry.status),
        `Phase ${p.entry.current_phase}`,
        p.entry.priority,
        `${p.entry.budget_used}/${p.entry.budget_total}`,
        `${p.entry.team_count} teams`,
    ]);
    out.table(['Project', 'Status', 'Phase', 'Priority', 'Budget', 'Teams'], rows);
    console.log('');
}
function showProjectStatus(proj) {
    out.heading(`Project: ${proj.entry.name}`);
    console.log('');
    out.keyValue('Status', out.colorStatus(proj.entry.status));
    out.keyValue('Phase', String(proj.entry.current_phase));
    out.keyValue('Priority', proj.entry.priority);
    out.keyValue('Budget', `${proj.entry.budget_used}/${proj.entry.budget_total}`);
    out.keyValue('Teams', String(proj.entry.team_count));
    out.keyValue('Started', proj.entry.started);
    if (proj.metadata?.template) {
        out.keyValue('Template', String(proj.metadata.template));
    }
    console.log('');
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
                    const data = JSON.parse((0, node_fs_1.readFileSync)(projectFile, 'utf-8'));
                    projects.push(data);
                }
                catch {
                    // skip corrupted
                }
            }
        }
    }
    catch {
        // state dir might not be readable
    }
    return projects;
}
//# sourceMappingURL=status.js.map