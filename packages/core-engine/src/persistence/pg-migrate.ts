/**
 * Live ledger schema comes from the generated Postgres contract so we do not
 * invent a second table set beside docs/schema/generated/core-engine-migration.sql.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_FILE = join(
  __dirname,
  "../../../../docs/schema/generated/core-engine-migration.sql",
);

function isExecutableSql(chunk: string): boolean {
  const withoutComments = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"))
    .join("\n")
    .trim();
  return withoutComments.length > 0;
}

function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(isExecutableSql)
    .map((chunk) => `${chunk};`);
}

/** Apply generated IF NOT EXISTS DDL instead of a hand-written live schema. */
export async function runPgMigration(databaseUrl: string): Promise<void> {
  const sql = readFileSync(MIGRATION_FILE, "utf-8");
  const statements = splitStatements(sql);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
}
