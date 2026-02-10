/**
 * AgentBoardroom — Dashboard Generator
 *
 * Renders text-based status boards from aggregated snapshots.
 * Channel-agnostic: outputs plain text / light box-drawing that works
 * on Mattermost, Discord, Slack, and stdout.
 */
import type { DashboardSnapshot, ProjectSnapshot } from './aggregator.js';
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
export declare class DashboardGenerator {
    private opts;
    constructor(options?: DashboardRenderOptions);
    /**
     * Render a full dashboard from a snapshot.
     */
    render(snapshot: DashboardSnapshot): string;
    /**
     * Render a single project's status board.
     */
    renderProject(project: ProjectSnapshot): string;
    /**
     * Render a summary line for all projects (compact multi-project view).
     */
    renderSummary(snapshot: DashboardSnapshot): string;
    /**
     * Render only the sections that changed between prev and next snapshots.
     * Returns the full board with unchanged sections cached from prev render.
     */
    renderIncremental(snapshot: DashboardSnapshot, changedProjects: string[]): Map<string, string>;
    private renderAgent;
    private renderTeam;
    private renderGate;
    private renderEmpty;
    private headerLine;
    private footerLine;
    private progressBar;
    private capitalize;
    private formatTime;
    private wrapCodeBlock;
}
//# sourceMappingURL=generator.d.ts.map