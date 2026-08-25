/**
 * Public package version pin so embedders can gate on runtime capabilities
 * without relying on package.json resolution at call sites.
 */
export const AGENT_RUNTIME_VERSION = "0.1.0";

/**
 * compileGraph validates authoring-time graphs before any run is scheduled,
 * so control APIs fail fast on dangling edges / missing terminals.
 */
export { compileGraph, GraphCompileError } from "./graph/compiler.js";

/**
 * Graph authoring types are part of the public SDK surface so hosts can
 * construct definitions without depending on internal paths.
 */
export type {
  CompiledGraph,
  GraphDefinition,
  GraphEdge,
  GraphNode,
  NodeType,
  RetryPolicy,
} from "./graph/types.js";

export { NODE_TYPES } from "./graph/types.js";
