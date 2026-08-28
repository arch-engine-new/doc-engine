const REQUIRED_KEYS = ["DATABASE_URL", "QDRANT_URL", "NEO4J_URI", "NEO4J_PASSWORD"] as const;

export type MemoryEngineMode = { mode: "memory" };

export type LiveEngineMode = {
  mode: "live";
  databaseUrl: string;
  qdrantUrl: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
};

export type EngineMode = MemoryEngineMode | LiveEngineMode;

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function missingRequired(
  databaseUrl: string | undefined,
  qdrantUrl: string | undefined,
  neo4jUri: string | undefined,
  neo4jPassword: string | undefined,
): string[] {
  const missing: string[] = [];
  if (!databaseUrl) missing.push("DATABASE_URL");
  if (!qdrantUrl) missing.push("QDRANT_URL");
  if (!neo4jUri) missing.push("NEO4J_URI");
  if (!neo4jPassword) missing.push("NEO4J_PASSWORD");
  return missing;
}

/**
 * Choose memory vs live stores from env. Partial env must fail-fast so operators
 * do not think they are on live Postgres/Qdrant/Neo4j when only some keys are set.
 */
export function resolveEngineMode(env: NodeJS.ProcessEnv = process.env): EngineMode {
  const databaseUrl = readTrimmed(env, "DATABASE_URL");
  const qdrantUrl = readTrimmed(env, "QDRANT_URL");
  const neo4jUri = readTrimmed(env, "NEO4J_URI");
  const neo4jPassword = readTrimmed(env, "NEO4J_PASSWORD");
  const missing = missingRequired(databaseUrl, qdrantUrl, neo4jUri, neo4jPassword);

  if (missing.length === REQUIRED_KEYS.length) {
    return { mode: "memory" };
  }
  if (!databaseUrl || !qdrantUrl || !neo4jUri || !neo4jPassword) {
    throw new Error(`Incomplete live engine configuration: missing ${missing.join(", ")}`);
  }

  return {
    mode: "live",
    databaseUrl,
    qdrantUrl,
    neo4jUri,
    neo4jUser: readTrimmed(env, "NEO4J_USER") ?? "neo4j",
    neo4jPassword,
  };
}
