/**
 * Live retrieve ports: Qdrant + Neo4j.
 * Production retrieve must not silently use MemoryVectorStore when live env is set.
 */

import { DashScopeEmbeddings } from "./embeddings.js";
import { Neo4jGraphStore } from "./neo4j.js";
import { FakePrequery } from "./prequery.js";
import type { RetrievePorts } from "./ports.js";
import { QdrantVectorStore } from "./qdrant.js";
import { IndependentReranker } from "./rerank.js";

/**
 * Live retrieve must share one v3 embedder with rerank.
 * Missing DASHSCOPE_API_KEY fails here (not in resolveEngineMode) so memory CI
 * still works; never fall back to HashEmbeddings.
 */
export function liveRetrievePorts(): RetrievePorts {
  const embed = new DashScopeEmbeddings();
  return {
    vector: new QdrantVectorStore(),
    graph: new Neo4jGraphStore(),
    prequery: new FakePrequery(),
    rerank: new IndependentReranker({ embed }),
    embed,
  };
}
