import {
  ToolRegistry,
} from "agent-runtime";
import type { JobPipeline } from "../pipeline/job-pipeline.js";
import {
  createSearchClauseToolHandler,
  type RetrieveHit,
  type SearchStandardInput,
} from "../retrieve/library.js";
import { buildJobContext } from "./context.js";

const objectSchema = { type: "object" as const };
const retrieveHitsSchema = {
  type: "array" as const,
  items: { type: "object" as const },
};

/**
 * Missing pack / unbound version / no ingest must not fail HITL chat.
 * Empty RetrieveHit[] is a valid no-hit result (never invent clause_id).
 */
function wrapSearchClauseHandler(
  handler: (input: SearchStandardInput) => Promise<RetrieveHit[]>,
): (input: SearchStandardInput) => Promise<RetrieveHit[]> {
  return async (input: SearchStandardInput): Promise<RetrieveHit[]> => {
    try {
      return await handler(input);
    } catch {
      return [];
    }
  };
}

function registerGetJobContextTool(registry: ToolRegistry, pipeline: JobPipeline): void {
  registry.register(
    "get_job_context",
    {
      input: {
        type: "object",
        properties: {
          traceId: { type: "string" },
          step: { type: "string" },
        },
        required: ["traceId", "step"],
      },
      output: objectSchema,
    },
    async (input: { traceId: string; step: string }) =>
      buildJobContext(pipeline, input.traceId, input.step),
    "Read-only job/findings/extraction snapshot for the current trace.",
  );
}

/**
 * WHY: Table-Skill teaching is not RAG. Registering search_clause here would let
 * a graph arm retrieve clauses during teach and look like the processing path.
 * ToolRegistry already rejects submit_* names.
 */
export function registerSkillTeachTools(registry: ToolRegistry, pipeline: JobPipeline): void {
  registerGetJobContextTool(registry, pipeline);
}

/**
 * WHY: Leftover HITL still cites clauses; Skill teach uses registerSkillTeachTools
 * so the two paths cannot share a search_clause arm by accident.
 */
export function registerStepChatTools(registry: ToolRegistry, pipeline: JobPipeline): void {
  registerGetJobContextTool(registry, pipeline);

  registry.register(
    "check_wording",
    {
      input: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          wording: { type: "string" },
          agentRunId: { type: "string" },
        },
        required: ["jobId", "wording"],
      },
      output: objectSchema,
    },
    async (input: { jobId: string; wording: string; agentRunId?: string }) => {
      const proposal = await pipeline.checkWording({
        jobId: input.jobId,
        wording: input.wording,
        agentRunId: input.agentRunId,
      });
      return {
        proposal_id: proposal.proposal_id,
        status: proposal.status,
        wording: proposal.wording,
      };
    },
    "Cognition port: insert pending Proposal only; never writes Receipt.",
  );

  // Why read-only: step-chat may cite retrieved clause_id; attachStandardFitFinding
  // writes Finding and submit_* mutates volume — both belong to review, not chat.
  registry.register(
    "search_clause",
    {
      input: {
        type: "object",
        properties: {
          packId: { type: "string" },
          query: { type: "string" },
          jobId: { type: "string" },
        },
        required: ["packId", "query"],
      },
      output: retrieveHitsSchema,
    },
    wrapSearchClauseHandler(createSearchClauseToolHandler(pipeline.library)),
    "Read-only StandardLibrary.searchStandard; never attach Finding / never submit.",
  );
}

export function createStepChatRegistry(pipeline: JobPipeline): ToolRegistry {
  const registry = new ToolRegistry();
  registerStepChatTools(registry, pipeline);
  return registry;
}

/**
 * WHY: Tests and Skill teach graphs must start without search_clause; leftover
 * HITL keeps createStepChatRegistry so standard_lib retrieval stays intact.
 */
export function createSkillTeachRegistry(pipeline: JobPipeline): ToolRegistry {
  const registry = new ToolRegistry();
  registerSkillTeachTools(registry, pipeline);
  return registry;
}
