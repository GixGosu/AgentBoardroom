"use strict";
/**
 * AgentBoardroom — Projects Module
 *
 * Multi-project registry, resource allocation, and isolation enforcement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsolationEnforcer = exports.ResourceAllocator = exports.ProjectRegistry = void 0;
var registry_js_1 = require("./registry.js");
Object.defineProperty(exports, "ProjectRegistry", { enumerable: true, get: function () { return registry_js_1.ProjectRegistry; } });
var allocator_js_1 = require("./allocator.js");
Object.defineProperty(exports, "ResourceAllocator", { enumerable: true, get: function () { return allocator_js_1.ResourceAllocator; } });
var isolation_js_1 = require("./isolation.js");
Object.defineProperty(exports, "IsolationEnforcer", { enumerable: true, get: function () { return isolation_js_1.IsolationEnforcer; } });
//# sourceMappingURL=index.js.map