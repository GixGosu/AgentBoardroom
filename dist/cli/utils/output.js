"use strict";
/**
 * CLI Output Helpers — colorized, formatted output for terminal and JSON modes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bold = bold;
exports.dim = dim;
exports.red = red;
exports.green = green;
exports.yellow = yellow;
exports.blue = blue;
exports.cyan = cyan;
exports.colorVerdict = colorVerdict;
exports.colorStatus = colorStatus;
exports.heading = heading;
exports.keyValue = keyValue;
exports.table = table;
exports.jsonOutput = jsonOutput;
exports.error = error;
exports.success = success;
exports.warn = warn;
exports.info = info;
// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};
function bold(text) {
    return `${colors.bold}${text}${colors.reset}`;
}
function dim(text) {
    return `${colors.dim}${text}${colors.reset}`;
}
function red(text) {
    return `${colors.red}${text}${colors.reset}`;
}
function green(text) {
    return `${colors.green}${text}${colors.reset}`;
}
function yellow(text) {
    return `${colors.yellow}${text}${colors.reset}`;
}
function blue(text) {
    return `${colors.blue}${text}${colors.reset}`;
}
function cyan(text) {
    return `${colors.cyan}${text}${colors.reset}`;
}
function colorVerdict(verdict) {
    switch (verdict.toUpperCase()) {
        case 'PASS': return green('PASS');
        case 'FAIL': return red('FAIL');
        case 'CONDITIONAL': return yellow('CONDITIONAL');
        default: return verdict;
    }
}
function colorStatus(status) {
    switch (status) {
        case 'active':
        case 'accepted':
        case 'in_progress':
            return green(status);
        case 'paused':
        case 'proposed':
        case 'challenged':
        case 'awaiting_review':
        case 'awaiting_gate':
        case 'gated_conditional':
            return yellow(status);
        case 'completed':
        case 'complete':
            return cyan(status);
        case 'gated_fail':
        case 'rejected':
        case 'failed':
            return red(status);
        default:
            return status;
    }
}
function heading(text) {
    console.log(`\n${bold(text)}`);
    console.log(dim('─'.repeat(text.length + 4)));
}
function keyValue(key, value, indent = 0) {
    const pad = ' '.repeat(indent);
    console.log(`${pad}${dim(key + ':')} ${value}`);
}
function table(headers, rows) {
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => stripAnsi(r[i] ?? '').length)));
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
    const separator = widths.map(w => '─'.repeat(w)).join('──');
    console.log(bold(headerLine));
    console.log(dim(separator));
    for (const row of rows) {
        const line = row.map((cell, i) => {
            const visible = stripAnsi(cell);
            const padding = widths[i] - visible.length;
            return cell + ' '.repeat(Math.max(0, padding));
        }).join('  ');
        console.log(line);
    }
}
function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}
function jsonOutput(data) {
    console.log(JSON.stringify(data, null, 2));
}
function error(message) {
    console.error(`${red('Error:')} ${message}`);
}
function success(message) {
    console.log(`${green('✓')} ${message}`);
}
function warn(message) {
    console.log(`${yellow('⚠')} ${message}`);
}
function info(message) {
    console.log(`${blue('ℹ')} ${message}`);
}
//# sourceMappingURL=output.js.map