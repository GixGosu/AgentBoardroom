"use strict";
/**
 * AgentBoardroom — Corporate Governance for AI Agents
 *
 * A decision intelligence platform that applies governance patterns —
 * adversarial review, gate enforcement, separation of powers, and audit trails —
 * to autonomous multi-agent systems.
 *
 * @module agentboardroom
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GovernanceProtection = exports.GateEnforcement = exports.ChallengeProtocol = exports.DecisionStore = exports.ConfigLoader = void 0;
// Core
var config_js_1 = require("./core/config.js");
Object.defineProperty(exports, "ConfigLoader", { enumerable: true, get: function () { return config_js_1.ConfigLoader; } });
// Decisions
var store_js_1 = require("./decisions/store.js");
Object.defineProperty(exports, "DecisionStore", { enumerable: true, get: function () { return store_js_1.DecisionStore; } });
// Challenge Protocol
var protocol_js_1 = require("./challenges/protocol.js");
Object.defineProperty(exports, "ChallengeProtocol", { enumerable: true, get: function () { return protocol_js_1.ChallengeProtocol; } });
// Gate Enforcement
var enforcement_js_1 = require("./gates/enforcement.js");
Object.defineProperty(exports, "GateEnforcement", { enumerable: true, get: function () { return enforcement_js_1.GateEnforcement; } });
// Governance
var protection_js_1 = require("./governance/protection.js");
Object.defineProperty(exports, "GovernanceProtection", { enumerable: true, get: function () { return protection_js_1.GovernanceProtection; } });
//# sourceMappingURL=index.js.map