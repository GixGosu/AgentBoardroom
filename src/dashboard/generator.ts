/**
 * AgentBoardroom — Dashboard Generator
 *
 * Renders text-based status boards from aggregated snapshots.
 * Channel-agnostic: outputs plain text / light box-drawing that works
 * on Mattermost, Discord, Slack, and stdout.
 */

import type {
  DashboardSnapshot,
  ProjectSnapshot,
  AgentSnapshot,
  TeamSnapshot,
  DecisionSnapshot,
  GateSnapshot,
} from './aggregator.js';

// ─── Render Options ─────────────────────────────────────────────────

export interface DashboardRenderOptions {
  /** Maximum width in characters (default 55). */
  maxWidth?: number;
  /** Show teams section (default true). */
  showTeams?: boolean;
  /** Show decisions section (default true). */
  showDecisions?: boolean;
  /** Show gate section (default true). */
  showGates?: boolean;
  /** Maximum recent decisions to show (default 3). */
  maxDecisions?: number;
  /** Time zone for timestamps (default 'UTC'). */
  timeZone?: string;
  /** Wrap output in a code block for chat platforms (default false). */
  codeBlock?: boolean;
}

const DEFAULTS: Required<DashboardRenderOptions> = {
  maxWidth: 55,
  showTeams: true,
  showDecisions: true,
  showGates: true,
  maxDecisions: 3,
  timeZone: 'UTC',
  codeBlock: false,
};

// ─── Status Icons ───────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  active: '●',
  idle: '○',
  blocked: '■',
  stopped: '×',
};

// ─── Generator ──────────────────────────────────────────────────────

export class DashboardGenerator {
  private opts: Required<DashboardRenderOptions>;

  constructor(options?: DashboardRenderOptions) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /**
   * Render a full dashboard from a snapshot.
   */
  render(snapshot: DashboardSnapshot): string {
    if (snapshot.projects.length === 0) {
      return this.wrapCodeBlock(this.renderEmpty());
    }

    const sections = snapshot.projects.map(p => this.renderProject(p));
    const board = sections.join('\n');
    return this.wrapCodeBlock(board);
  }

  /**
   * Render a single project's status board.
   */
  renderProject(project: ProjectSnapshot): string {
    const w = this.opts.maxWidth;
    const lines: string[] = [];

    // Header
    const title = `AGENTBOARDROOM — Project: ${project.name}`;
    lines.push(this.headerLine(title, w));

    // Phase + Budget
    const phaseStr = `Phase: ${project.currentPhase} (${this.capitalize(project.phaseName)})`;
    const budgetStr = `Budget: ${project.budgetPercent}% used`;
    lines.push(`${phaseStr} | ${budgetStr}`);

    // Agents
    for (const agent of project.agents) {
      lines.push(this.renderAgent(agent));
    }

    // Teams
    if (this.opts.showTeams && project.teams.length > 0) {
      const activeTeams = project.teams.filter(t => t.status === 'active').length;
      const totalMembers = project.teams.reduce((n, t) => n + t.memberCount, 0);
      lines.push(`Teams: ${activeTeams} active (${totalMembers} agents total)`);
      for (const team of project.teams) {
        lines.push(this.renderTeam(team));
      }
    }

    // Recent decisions
    if (this.opts.showDecisions && project.recentDecisions.length > 0) {
      const decs = project.recentDecisions.slice(0, this.opts.maxDecisions);
      const decStr = decs.map(d => `${d.id} (${d.status})`).join(', ');
      lines.push(`Recent Decisions: ${decStr}`);
    }

    // Last gate
    if (this.opts.showGates && project.lastGate) {
      lines.push(this.renderGate(project.lastGate));
    }

    // Footer
    lines.push(this.footerLine(w));

    return lines.join('\n');
  }

  /**
   * Render a summary line for all projects (compact multi-project view).
   */
  renderSummary(snapshot: DashboardSnapshot): string {
    const lines: string[] = [];
    const w = this.opts.maxWidth;

    lines.push(this.headerLine('AGENTBOARDROOM — Summary', w));
    lines.push(`Projects: ${snapshot.projects.length} | Agents: ${snapshot.totalAgents} (${snapshot.activeAgents} active, ${snapshot.idleAgents} idle, ${snapshot.blockedAgents} blocked)`);
    lines.push('');

    for (const p of snapshot.projects) {
      const phaseStr = `P${p.currentPhase}`;
      const budgetStr = `${p.budgetPercent}%`;
      const agentStr = `${p.agents.filter(a => a.status === 'active').length}/${p.agents.length}`;
      lines.push(`  ${p.name.padEnd(20)} ${phaseStr.padEnd(4)} | budget ${budgetStr.padEnd(5)} | agents ${agentStr}`);
    }

    lines.push(this.footerLine(w));
    return this.wrapCodeBlock(lines.join('\n'));
  }

  /**
   * Render only the sections that changed between prev and next snapshots.
   * Returns the full board with unchanged sections cached from prev render.
   */
  renderIncremental(
    snapshot: DashboardSnapshot,
    changedProjects: string[]
  ): Map<string, string> {
    const rendered = new Map<string, string>();
    for (const project of snapshot.projects) {
      if (changedProjects.includes(project.name)) {
        rendered.set(project.name, this.renderProject(project));
      }
    }
    return rendered;
  }

  // ─── Private rendering helpers ────────────────────────────────────

  private renderAgent(agent: AgentSnapshot): string {
    const icon = STATUS_ICON[agent.status] ?? '?';
    const role = agent.role.padEnd(4);
    const activity = agent.activity;
    return `${role} ${activity.padEnd(28)}| ${icon} ${agent.status}`;
  }

  private renderTeam(team: TeamSnapshot): string {
    const bar = this.progressBar(team.progress, 8);
    return `  └ ${team.name}: ${team.modulePath} ${bar} ${team.progress}%`;
  }

  private renderGate(gate: GateSnapshot): string {
    const time = this.formatTime(gate.timestamp);
    return `Last Gate: ${gate.issuedBy} ${gate.verdict} (Phase ${gate.fromPhase} → Phase ${gate.toPhase}) at ${time}`;
  }

  private renderEmpty(): string {
    const w = this.opts.maxWidth;
    return [
      this.headerLine('AGENTBOARDROOM', w),
      'No active projects.',
      this.footerLine(w),
    ].join('\n');
  }

  private headerLine(title: string, width: number): string {
    const pad = Math.max(0, width - title.length - 6);
    return `═══ ${title} ${'═'.repeat(pad)}`;
  }

  private footerLine(width: number): string {
    return '═'.repeat(width);
  }

  private progressBar(percent: number, length: number): string {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: this.opts.timeZone,
        timeZoneName: 'short',
      });
    } catch {
      return iso;
    }
  }

  private wrapCodeBlock(content: string): string {
    if (this.opts.codeBlock) {
      return '```\n' + content + '\n```';
    }
    return content;
  }
}
