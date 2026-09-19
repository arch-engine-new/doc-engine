/**
 * Live retrieve ports: Qdrant + Neo4j.
 * Production retrieve must not silently use MemoryVectorStore when live env is set.
 */

import {
  createLlmProvider,
  FakeLlmProvider,
  UnconfiguredLlmProvider,
} from "agent-runtime";
import { DashScopeEmbeddings } from "./embeddings.js";
import { HttpReranker } from "./http-rerank.js";
import { Neo4jGraphStore } from "./neo4j.js";
import { ZhipuPrequery } from "./prequery.js";
import type { RetrievePorts } from "./ports.js";
import { QdrantVectorStore } from "./qdrant.js";

/**
 * Live embed stays DashScope v3; live rerank is a dedicated HTTP ranker.
 * Sharing the v3 embedder with IndependentReranker would fake an independent model.
 * Missing DASHSCOPE_API_KEY fails here (not in resolveEngineMode) so memory CI
 * still works; never fall back to HashEmbeddings.
 * Live prequery is glm: Unconfigured/Fake LLM must throw instead of FakePrequery.
 */
export function liveRetrievePorts(): RetrievePorts {
  const embed = new DashScopeEmbeddings();
  const llm = requireConfiguredLlm();
  return {
    vector: new QdrantVectorStore(),
    graph: new Neo4jGraphStore(),
    prequery: new ZhipuPrequery(llm),
    rerank: new HttpReranker(),
    embed,
  };
}

/**
 * Unconfigured complete() looks like a successful rewrite; live must fail closed.
 */
function requireConfiguredLlm(): ReturnType<typeof createLlmProvider> {
  const llm = createLlmProvider();
  if (llm instanceof UnconfiguredLlmProvider || llm instanceof FakeLlmProvider) {
    throw new Error(
      "Live retrieve prequery requires a configured LLM (llm.json); UnconfiguredLlmProvider is not a silent FakePrequery fallback.",
    );
  }
  return llm;
}
