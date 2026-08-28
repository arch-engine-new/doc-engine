/**
 * Live retrieve ports: Qdrant + Neo4j.
 * Production retrieve must not silently use MemoryVectorStore when live env is set.
 */

import { HashEmbeddings } from "./embeddings.js";
import { Neo4jGraphStore } from "./neo4j.js";
import { FakePrequery } from "./prequery.js";
import type { RetrievePorts } from "./ports.js";
import { QdrantVectorStore } from "./qdrant.js";
import { IndependentReranker } from "./rerank.js";

/**
 * Same defaults as `defaultRetrievePorts` except vector + graph:
 * `QdrantVectorStore` reads `QDRANT_URL`, `Neo4jGraphStore` reads `NEO4J_URI`.
 * Throws if those env vars are missing instead of falling back to memory stores.
 */
export function liveRetrievePorts(): RetrievePorts {
  return {
    vector: new QdrantVectorStore(),
    graph: new Neo4jGraphStore(),
    prequery: new FakePrequery(),
    rerank: new IndependentReranker(),
    embed: new HashEmbeddings(),
  };
}
