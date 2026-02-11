/**
 * CLI Command: record-decision — Record a governance decision.
 *
 * Usage:
 *   agentboardroom record-decision \
 *     --author <ceo|cto|qa> \
 *     --type <planning|architecture|gate|challenge> \
 *     --summary "Brief decision summary" \
 *     --rationale "Detailed reasoning" \
 *     --project <project-name> \
 *     --phase <phase-id> \
 *     --status <accepted|challenged|pending>
 *
 * This command wraps DecisionStore operations to provide a simple interface
 * for agents to record decisions via exec commands.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DecisionStore } from '../../decisions/store.js';
import type { DecisionType, DecisionStatus } from '../../core/types.js';
import * as out from '../utils/output.js';

export interface RecordDecisionOptions {
  author: string;
  type: string;
  summary: string;
  rationale: string;
  project: string;
  phase?: number;
  status?: string;
  evidence?: string[];
  dependencies?: string[];
  dir?: string;
  json?: boolean;
}

const VALID_AUTHORS = ['ceo', 'cto', 'qa'];
const TYPE_ALIASES: Record<string, DecisionType> = {
  'planning': 'plan_approval',
  'architecture': 'cto_review',
  'gate': 'qa_gate',
  'challenge': 'cto_review',
  'plan_approval': 'plan_approval',
  'cto_review': 'cto_review',
  'qa_gate': 'qa_gate',
  'resource': 'resource_allocation',
  'escalation': 'escalation',
  'scope': 'scope',
  'technical': 'technical',
  'process': 'process',
};

const STATUS_MAP: Record<string, DecisionStatus> = {
  'pending': 'proposed',
  'proposed': 'proposed',
  'accepted': 'accepted',
  'challenged': 'challenged',
  'escalated': 'escalated',
  'superseded': 'superseded',
  'rejected': 'rejected',
};

/**
 * Validate and record a governance decision.
 */
export function recordDecisionCommand(options: RecordDecisionOptions): void {
  const targetDir = resolve(options.dir || '.');
  const stateDir = join(targetDir, 'state');

  // Validation
  const errors: string[] = [];

  if (!options.author) {
    errors.push('--author is required');
  } else if (!VALID_AUTHORS.includes(options.author.toLowerCase())) {
    errors.push(`Invalid author: ${options.author}. Must be one of: ${VALID_AUTHORS.join(', ')}`);
  }

  if (!options.type) {
    errors.push('--type is required');
  } else if (!TYPE_ALIASES[options.type.toLowerCase()]) {
    errors.push(`Invalid type: ${options.type}. Must be one of: ${Object.keys(TYPE_ALIASES).join(', ')}`);
  }

  if (!options.summary) {
    errors.push('--summary is required');
  }

  if (!options.rationale) {
    errors.push('--rationale is required');
  }

  if (!options.project) {
    errors.push('--project is required');
  }

  if (options.phase !== undefined && (isNaN(options.phase) || options.phase < 0)) {
    errors.push('--phase must be a non-negative integer');
  }

  if (options.status && !STATUS_MAP[options.status.toLowerCase()]) {
    errors.push(`Invalid status: ${options.status}. Must be one of: ${Object.keys(STATUS_MAP).join(', ')}`);
  }

  if (errors.length > 0) {
    if (options.json) {
      out.jsonOutput({ success: false, errors });
    } else {
      for (const err of errors) {
        out.error(err);
      }
    }
    process.exit(1);
  }

  // Check project exists
  const projectStateDir = join(stateDir, options.project);
  if (!existsSync(projectStateDir)) {
    if (options.json) {
      out.jsonOutput({ 
        success: false, 
        error: `Project "${options.project}" not found. Initialize it first with 'agentboardroom init'.` 
      });
    } else {
      out.error(`Project "${options.project}" not found.`);
      out.info(`Initialize the project first with: agentboardroom init --project ${options.project}`);
    }
    process.exit(1);
  }

  try {
    // Initialize DecisionStore for the project
    const store = new DecisionStore(projectStateDir);

    // Map inputs to canonical types
    const decisionType = TYPE_ALIASES[options.type.toLowerCase()];
    const phase = options.phase ?? 0;
    const status = options.status ? STATUS_MAP[options.status.toLowerCase()] : 'accepted';

    // Create the decision record
    const record = store.propose({
      author: options.author.toLowerCase(),
      type: decisionType,
      summary: options.summary,
      rationale: options.rationale,
      evidence: options.evidence ?? [],
      phase,
      project: options.project,
      dependencies: options.dependencies ?? [],
    });

    // Apply the status
    if (status === 'accepted') {
      store.accept(record.id, options.author.toLowerCase(), options.rationale);
    } else if (status === 'challenged') {
      store.challenge(record.id, options.author.toLowerCase(), options.rationale);
    } else if (status === 'escalated') {
      store.escalate(record.id);
    }
    // 'proposed' is the default, no action needed

    // Reload the record to get updated state
    const finalRecord = store.get(record.id);

    if (options.json) {
      out.jsonOutput({ success: true, decision: finalRecord });
    } else {
      out.success(`Decision ${finalRecord!.id} recorded successfully`);
      console.log('');
      out.keyValue('ID', finalRecord!.id);
      out.keyValue('Author', finalRecord!.author);
      out.keyValue('Type', finalRecord!.type);
      out.keyValue('Status', finalRecord!.status);
      out.keyValue('Summary', finalRecord!.summary);
      out.keyValue('Project', finalRecord!.project);
      out.keyValue('Phase', String(finalRecord!.phase));
      console.log('');
    }

    process.exit(0);
  } catch (err: any) {
    if (options.json) {
      out.jsonOutput({ success: false, error: err.message ?? String(err) });
    } else {
      out.error(`Failed to record decision: ${err.message ?? String(err)}`);
    }
    process.exit(1);
  }
}
