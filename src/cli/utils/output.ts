/**
 * CLI Output Helpers — colorized, formatted output for terminal and JSON modes.
 */

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
} as const;

export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

export function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

export function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

export function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

export function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

export function blue(text: string): string {
  return `${colors.blue}${text}${colors.reset}`;
}

export function cyan(text: string): string {
  return `${colors.cyan}${text}${colors.reset}`;
}

export function colorVerdict(verdict: string): string {
  switch (verdict.toUpperCase()) {
    case 'PASS': return green('PASS');
    case 'FAIL': return red('FAIL');
    case 'CONDITIONAL': return yellow('CONDITIONAL');
    default: return verdict;
  }
}

export function colorStatus(status: string): string {
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

export function heading(text: string): void {
  console.log(`\n${bold(text)}`);
  console.log(dim('─'.repeat(text.length + 4)));
}

export function keyValue(key: string, value: string, indent = 0): void {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${dim(key + ':')} ${value}`);
}

export function table(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => stripAnsi(r[i] ?? '').length))
  );

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

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function error(message: string): void {
  console.error(`${red('Error:')} ${message}`);
}

export function success(message: string): void {
  console.log(`${green('✓')} ${message}`);
}

export function warn(message: string): void {
  console.log(`${yellow('⚠')} ${message}`);
}

export function info(message: string): void {
  console.log(`${blue('ℹ')} ${message}`);
}
