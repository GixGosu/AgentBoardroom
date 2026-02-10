#!/usr/bin/env node
"use strict";
/**
 * AgentBoardroom CLI — Corporate governance for AI agents.
 *
 * Commands:
 *   init       Initialize a new board from a template
 *   status     Display board/project status
 *   decisions  Query decision log
 *   gates      Query gate verdict history
 *   projects   Multi-project management (list, prioritize)
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
const init_js_1 = require("./commands/init.js");
const status_js_1 = require("./commands/status.js");
const decisions_js_1 = require("./commands/decisions.js");
const gates_js_1 = require("./commands/gates.js");
const projects_js_1 = require("./commands/projects.js");
const out = __importStar(require("./utils/output.js"));
const VERSION = '0.1.0';
function parseArgs(argv) {
    const args = [];
    const flags = {};
    let command = '';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                flags[key] = next;
                i++;
            }
            else {
                flags[key] = true;
            }
        }
        else if (!command) {
            command = arg;
        }
        else {
            args.push(arg);
        }
    }
    return { command, args, flags };
}
function showHelp() {
    console.log(`
${out.bold('agentboardroom')} — Corporate governance for AI agents

${out.bold('Usage:')}
  agentboardroom <command> [options]

${out.bold('Commands:')}
  init         Initialize a new board from a template
  status       Display board/project status
  decisions    Query decision log
  gates        Query gate verdict history
  projects     Multi-project management

${out.bold('Global Options:')}
  --help       Show help
  --version    Show version
  --json       Machine-readable JSON output
  --dir <path> Working directory (default: current)

${out.bold('Examples:')}
  agentboardroom init --template software-dev --project my-app
  agentboardroom status
  agentboardroom decisions --project my-app --status accepted
  agentboardroom gates --project my-app --status failed
  agentboardroom projects list
  agentboardroom projects prioritize my-app --priority high
`);
}
async function main() {
    const { command, args, flags } = parseArgs(process.argv.slice(2));
    if (flags.version) {
        console.log(VERSION);
        return;
    }
    if (flags.help || !command) {
        showHelp();
        return;
    }
    const json = flags.json === true;
    const dir = typeof flags.dir === 'string' ? flags.dir : undefined;
    try {
        switch (command) {
            case 'init':
                await (0, init_js_1.initCommand)({
                    template: typeof flags.template === 'string' ? flags.template : undefined,
                    project: typeof flags.project === 'string' ? flags.project : undefined,
                    dir,
                    json,
                });
                break;
            case 'status':
                (0, status_js_1.statusCommand)({
                    project: typeof flags.project === 'string' ? flags.project : undefined,
                    dir,
                    json,
                });
                break;
            case 'decisions':
                (0, decisions_js_1.decisionsCommand)({
                    project: typeof flags.project === 'string' ? flags.project : undefined,
                    status: typeof flags.status === 'string' ? flags.status : undefined,
                    type: typeof flags.type === 'string' ? flags.type : undefined,
                    author: typeof flags.author === 'string' ? flags.author : undefined,
                    limit: typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : undefined,
                    dir,
                    json,
                });
                break;
            case 'gates':
                (0, gates_js_1.gatesCommand)({
                    project: typeof flags.project === 'string' ? flags.project : undefined,
                    status: typeof flags.status === 'string' ? flags.status : undefined,
                    phase: typeof flags.phase === 'string' ? parseInt(flags.phase, 10) : undefined,
                    issuedBy: typeof flags['issued-by'] === 'string' ? flags['issued-by'] : undefined,
                    limit: typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : undefined,
                    dir,
                    json,
                });
                break;
            case 'projects': {
                const subcommand = args[0] ?? 'list';
                const project = args[1] ?? (typeof flags.project === 'string' ? flags.project : undefined);
                (0, projects_js_1.projectsCommand)({
                    subcommand,
                    project,
                    priority: typeof flags.priority === 'string' ? flags.priority : undefined,
                    dir,
                    json,
                });
                break;
            }
            default:
                out.error(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    }
    catch (err) {
        out.error(err.message ?? String(err));
        process.exit(1);
    }
}
main().catch((err) => {
    out.error(err.message ?? String(err));
    process.exit(1);
});
//# sourceMappingURL=index.js.map