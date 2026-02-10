/**
 * Simple glob matching — avoids external dependency.
 * Supports * and ** patterns only (sufficient for governance asset paths).
 */

export function minimatch(filepath: string, pattern: string): boolean {
  // Exact match
  if (filepath === pattern) return true;

  // Convert glob to regex
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filepath);
}
