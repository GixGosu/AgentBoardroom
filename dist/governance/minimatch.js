"use strict";
/**
 * Simple glob matching — avoids external dependency.
 * Supports * and ** patterns only (sufficient for governance asset paths).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimatch = minimatch;
function minimatch(filepath, pattern) {
    // Exact match
    if (filepath === pattern)
        return true;
    // Convert glob to regex
    const regexStr = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\{\{GLOBSTAR\}\}/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(filepath);
}
//# sourceMappingURL=minimatch.js.map