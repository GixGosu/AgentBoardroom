"use strict";
/**
 * CLI Command: decisions — Query decision log.
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
exports.decisionsCommand = decisionsCommand;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const out = __importStar(require("../utils/output.js"));
function decisionsCommand(options) {
    const targetDir = (0, node_path_1.resolve)(options.dir || '.');
    const stateDir = (0, node_path_1.join)(targetDir, 'state');
    // Load decisions from state directory
    let decisions = loadDecisions(stateDir);
    if (decisions.length === 0) {
        if (options.json) {
            out.jsonOutput([]);
        }
        else {
            out.info('No decisions recorded yet.');
        }
        return;
    }
    // Apply filters
    if (options.project) {
        decisions = decisions.filter(d => d.project === options.project);
    }
    if (options.status) {
        decisions = decisions.filter(d => d.status === options.status);
    }
    if (options.type) {
        decisions = decisions.filter(d => d.type === options.type);
    }
    if (options.author) {
        decisions = decisions.filter(d => d.author === options.author);
    }
    // Sort by timestamp descending
    decisions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    // Apply limit
    const limit = options.limit ?? 20;
    decisions = decisions.slice(0, limit);
    if (options.json) {
        out.jsonOutput(decisions);
        return;
    }
    if (decisions.length === 0) {
        out.info('No decisions match the given filters.');
        return;
    }
    out.heading('Decision Log');
    console.log('');
    const rows = decisions.map(d => [
        d.id,
        out.colorStatus(d.status),
        d.type,
        d.author,
        truncate(d.summary, 40),
        d.challenge_rounds > 0 ? out.yellow(`${d.challenge_rounds}x`) : out.dim('-'),
    ]);
    out.table(['ID', 'Status', 'Type', 'Author', 'Summary', 'Challenged'], rows);
    console.log('');
    out.dim(`Showing ${decisions.length} decision(s)`);
    console.log('');
}
function loadDecisions(stateDir) {
    const decisionsFile = (0, node_path_1.join)(stateDir, 'decisions.json');
    if ((0, node_fs_1.existsSync)(decisionsFile)) {
        try {
            return JSON.parse((0, node_fs_1.readFileSync)(decisionsFile, 'utf-8'));
        }
        catch {
            return [];
        }
    }
    // Also check per-project state dirs
    const decisions = [];
    if ((0, node_fs_1.existsSync)(stateDir)) {
        const { readdirSync } = require('node:fs');
        for (const dir of readdirSync(stateDir)) {
            if (dir.startsWith('_'))
                continue;
            const file = (0, node_path_1.join)(stateDir, dir, 'decisions.json');
            if ((0, node_fs_1.existsSync)(file)) {
                try {
                    const data = JSON.parse((0, node_fs_1.readFileSync)(file, 'utf-8'));
                    decisions.push(...(Array.isArray(data) ? data : []));
                }
                catch {
                    // skip
                }
            }
        }
    }
    return decisions;
}
function truncate(s, max) {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
//# sourceMappingURL=decisions.js.map