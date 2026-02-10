"use strict";
/**
 * AgentBoardroom — Configuration Loader
 *
 * Loads and validates board.yaml configuration files.
 * Handles template variable resolution for agent prompts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const yaml_1 = require("yaml");
class ConfigLoader {
    configPath;
    baseDir;
    constructor(configPath) {
        this.configPath = (0, node_path_1.resolve)(configPath);
        this.baseDir = (0, node_path_1.dirname)(this.configPath);
    }
    /**
     * Load and validate the board configuration.
     */
    load() {
        if (!(0, node_fs_1.existsSync)(this.configPath)) {
            throw new Error(`Board config not found: ${this.configPath}`);
        }
        const raw = (0, node_fs_1.readFileSync)(this.configPath, 'utf-8');
        const config = (0, yaml_1.parse)(raw);
        this.validate(config);
        return config;
    }
    /**
     * Resolve template variables in an agent prompt file.
     * Replaces {{variable}} placeholders with values from the board config.
     */
    resolvePrompt(promptPath, role, config, channelIds = {}) {
        const fullPath = (0, node_path_1.resolve)(this.baseDir, promptPath);
        if (!(0, node_fs_1.existsSync)(fullPath)) {
            throw new Error(`Prompt template not found: ${fullPath}`);
        }
        let template = (0, node_fs_1.readFileSync)(fullPath, 'utf-8');
        const roleConfig = config.roles[role];
        if (!roleConfig) {
            throw new Error(`Role "${role}" not found in board config`);
        }
        // Build template variables
        const vars = this.buildTemplateVars(role, roleConfig, config, channelIds);
        // Replace simple {{variable}} placeholders
        for (const [key, value] of Object.entries(vars)) {
            template = template.replaceAll(`{{${key}}}`, String(value));
        }
        // Handle {{#each agents}} block
        template = this.resolveAgentDirectory(template, config, channelIds);
        return template;
    }
    buildTemplateVars(role, roleConfig, config, channelIds) {
        const challengerRole = roleConfig.challenges?.[0];
        const challengerConfig = challengerRole ? config.roles[challengerRole] : undefined;
        const gatekeeperRole = Object.entries(config.roles).find(([_, r]) => r.responsibilities.includes('gate_verdicts') || r.responsibilities.includes('validation'));
        const vars = {
            role_title: roleConfig.title,
            role_name: role,
            responsibilities: roleConfig.responsibilities.join(', '),
            messaging_platform: config.channels.messaging_platform,
            messaging_channel: config.channels.messaging_platform,
            primary_channel: config.channels.primary,
            max_challenge_rounds: String(config.challenge.max_rounds),
        };
        // Role-specific references
        if (challengerRole && challengerConfig) {
            vars.challenger_role = challengerConfig.title;
        }
        if (gatekeeperRole) {
            vars.gatekeeper_role = gatekeeperRole[1].title;
        }
        // Find strategist and architect roles by responsibility
        const strategist = Object.entries(config.roles).find(([_, r]) => r.responsibilities.includes('planning'));
        const architect = Object.entries(config.roles).find(([_, r]) => r.responsibilities.includes('architecture') || r.responsibilities.includes('design_review'));
        if (strategist)
            vars.strategist_role = strategist[1].title;
        if (architect)
            vars.architect_role = architect[1].title;
        // Channel IDs
        for (const [channelRole, channelId] of Object.entries(channelIds)) {
            vars[`${channelRole}_channel_id`] = channelId;
        }
        return vars;
    }
    resolveAgentDirectory(template, config, channelIds) {
        const eachMatch = template.match(/\{\{#each agents\}\}([\s\S]*?)\{\{\/each\}\}/);
        if (!eachMatch)
            return template;
        const rowTemplate = eachMatch[1].trim();
        const rows = Object.entries(config.roles).map(([roleKey, roleConfig]) => {
            return rowTemplate
                .replaceAll('{{this.role}}', roleConfig.title)
                .replaceAll('{{this.agent_id}}', `board-${roleKey}`)
                .replaceAll('{{this.description}}', roleConfig.responsibilities.join(', '));
        });
        return template.replace(eachMatch[0], rows.join('\n'));
    }
    validate(config) {
        if (!config.name)
            throw new Error('Board config missing "name"');
        if (!config.roles || Object.keys(config.roles).length === 0) {
            throw new Error('Board config must define at least one role');
        }
        if (!config.governance?.self_modification) {
            throw new Error('Board config must define governance.self_modification');
        }
        // Validate challenge relationships reference existing roles
        for (const [roleName, role] of Object.entries(config.roles)) {
            if (role.challenges) {
                for (const target of role.challenges) {
                    if (!config.roles[target]) {
                        throw new Error(`Role "${roleName}" challenges non-existent role "${target}"`);
                    }
                }
            }
        }
        // Validate gate definitions reference existing roles
        if (config.gates) {
            for (const [gateName, gate] of Object.entries(config.gates)) {
                for (const required of gate.required) {
                    if (!config.roles[required]) {
                        throw new Error(`Gate "${gateName}" requires non-existent role "${required}"`);
                    }
                }
            }
        }
    }
}
exports.ConfigLoader = ConfigLoader;
//# sourceMappingURL=config.js.map