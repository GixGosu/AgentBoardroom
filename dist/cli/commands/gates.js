"use strict";
/**
 * CLI Command: gates — Query gate verdict history.
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
exports.gatesCommand = gatesCommand;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const out = __importStar(require("../utils/output.js"));
function gatesCommand(options) {
    const targetDir = (0, node_path_1.resolve)(options.dir || '.');
    const stateDir = (0, node_path_1.join)(targetDir, 'state');
    let verdicts = loadGateHistory(stateDir);
    if (verdicts.length === 0) {
        if (options.json) {
            out.jsonOutput([]);
        }
        else {
            out.info('No gate verdicts recorded yet.');
        }
        return;
    }
    // Apply filters
    if (options.project) {
        verdicts = verdicts.filter(v => v.project === options.project);
    }
    if (options.status) {
        verdicts = verdicts.filter(v => v.verdict === options.status.toUpperCase());
    }
    if (options.phase !== undefined) {
        verdicts = verdicts.filter(v => v.phase === options.phase);
    }
    if (options.issuedBy) {
        verdicts = verdicts.filter(v => v.issued_by === options.issuedBy);
    }
    // Sort by timestamp descending
    verdicts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const limit = options.limit ?? 20;
    verdicts = verdicts.slice(0, limit);
    if (options.json) {
        out.jsonOutput(verdicts);
        return;
    }
    if (verdicts.length === 0) {
        out.info('No gate verdicts match the given filters.');
        return;
    }
    out.heading('Gate Verdicts');
    console.log('');
    const rows = verdicts.map(v => [
        v.gate_id,
        out.colorVerdict(v.verdict),
        v.issued_by,
        v.project,
        `Phase ${v.phase}`,
        `${v.tests_passed}/${v.tests_run}`,
        v.coverage,
    ]);
    out.table(['Gate', 'Verdict', 'Issuer', 'Project', 'Phase', 'Tests', 'Coverage'], rows);
    // Show blocking issues for FAILs
    const failures = verdicts.filter(v => v.verdict === 'FAIL' && v.blocking_issues.length > 0);
    if (failures.length > 0) {
        console.log('');
        out.heading('Blocking Issues');
        for (const f of failures) {
            console.log(`  ${out.red(f.gate_id)} (${f.project}):`);
            for (const issue of f.blocking_issues) {
                console.log(`    • ${issue}`);
            }
        }
    }
    console.log('');
}
function loadGateHistory(stateDir) {
    const historyFile = (0, node_path_1.join)(stateDir, '_gate_history.json');
    if ((0, node_fs_1.existsSync)(historyFile)) {
        try {
            const data = JSON.parse((0, node_fs_1.readFileSync)(historyFile, 'utf-8'));
            return data.verdicts ?? [];
        }
        catch {
            return [];
        }
    }
    return [];
}
//# sourceMappingURL=gates.js.map