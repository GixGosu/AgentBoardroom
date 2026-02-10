"use strict";
/**
 * AgentBoardroom — Dashboard Generator
 *
 * Renders text-based status boards from aggregated snapshots.
 * Channel-agnostic: outputs plain text / light box-drawing that works
 * on Mattermost, Discord, Slack, and stdout.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardGenerator = void 0;
const DEFAULTS = {
    maxWidth: 55,
    showTeams: true,
    showDecisions: true,
    showGates: true,
    maxDecisions: 3,
    timeZone: 'UTC',
    codeBlock: false,
};
// ─── Status Icons ───────────────────────────────────────────────────
const STATUS_ICON = {
    active: '●',
    idle: '○',
    blocked: '■',
    stopped: '×',
};
// ─── Generator ──────────────────────────────────────────────────────
class DashboardGenerator {
    opts;
    constructor(options) {
        this.opts = { ...DEFAULTS, ...options };
    }
    /**
     * Render a full dashboard from a snapshot.
     */
    render(snapshot) {
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
    renderProject(project) {
        const w = this.opts.maxWidth;
        const lines = [];
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
    renderSummary(snapshot) {
        const lines = [];
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
    renderIncremental(snapshot, changedProjects) {
        const rendered = new Map();
        for (const project of snapshot.projects) {
            if (changedProjects.includes(project.name)) {
                rendered.set(project.name, this.renderProject(project));
            }
        }
        return rendered;
    }
    // ─── Private rendering helpers ────────────────────────────────────
    renderAgent(agent) {
        const icon = STATUS_ICON[agent.status] ?? '?';
        const role = agent.role.padEnd(4);
        const activity = agent.activity;
        return `${role} ${activity.padEnd(28)}| ${icon} ${agent.status}`;
    }
    renderTeam(team) {
        const bar = this.progressBar(team.progress, 8);
        return `  └ ${team.name}: ${team.modulePath} ${bar} ${team.progress}%`;
    }
    renderGate(gate) {
        const time = this.formatTime(gate.timestamp);
        return `Last Gate: ${gate.issuedBy} ${gate.verdict} (Phase ${gate.fromPhase} → Phase ${gate.toPhase}) at ${time}`;
    }
    renderEmpty() {
        const w = this.opts.maxWidth;
        return [
            this.headerLine('AGENTBOARDROOM', w),
            'No active projects.',
            this.footerLine(w),
        ].join('\n');
    }
    headerLine(title, width) {
        const pad = Math.max(0, width - title.length - 6);
        return `═══ ${title} ${'═'.repeat(pad)}`;
    }
    footerLine(width) {
        return '═'.repeat(width);
    }
    progressBar(percent, length) {
        const filled = Math.round((percent / 100) * length);
        const empty = length - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    }
    capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    formatTime(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: this.opts.timeZone,
                timeZoneName: 'short',
            });
        }
        catch {
            return iso;
        }
    }
    wrapCodeBlock(content) {
        if (this.opts.codeBlock) {
            return '```\n' + content + '\n```';
        }
        return content;
    }
}
exports.DashboardGenerator = DashboardGenerator;
//# sourceMappingURL=generator.js.map