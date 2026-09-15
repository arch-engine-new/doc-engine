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

function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => (line.trim().startsWith("--") ? "" : line))
    .join("\n");
}

function splitStatements(sql: string): string[] {
  return stripLineComments(sql)
    .split(";")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => `${chunk};`);
}

async function tableExists(client: pg.Client, table: string): Promise<boolean> {
  const result = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
  return result.rows[0]?.reg != null;
}

/** Add doc_type columns on legacy Postgres ledgers created before DocType slice. */
async function ensureDocTypeColumns(client: pg.Client): Promise<void> {
  if (await tableExists(client, "t_template")) {
    await client.query(
      `ALTER TABLE t_template ADD COLUMN IF NOT EXISTS doc_type_id VARCHAR(64) NOT NULL DEFAULT ''`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_t_template_doc_type_id ON t_template(doc_type_id)`,
    );
  }
  if (await tableExists(client, "t_job")) {
    await client.query(
      `ALTER TABLE t_job ADD COLUMN IF NOT EXISTS doc_type_id VARCHAR(64) NULL`,
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_t_job_doc_type_id ON t_job(doc_type_id)`);
  }
}

/** Add Excel gap-fill columns on legacy Postgres ledgers created before Task 1. */
async function ensureExcelGapFillColumns(client: pg.Client): Promise<void> {
  if (await tableExists(client, "t_template")) {
    await client.query(
      `ALTER TABLE t_template ADD COLUMN IF NOT EXISTS layout_kind VARCHAR(16) NOT NULL DEFAULT 'raster'`,
    );
    await client.query(
      `ALTER TABLE t_template ADD COLUMN IF NOT EXISTS excel_template_uri VARCHAR(512) NULL`,
    );
    await client.query(
      `ALTER TABLE t_template ADD COLUMN IF NOT EXISTS excel_sheet_name VARCHAR(128) NULL`,
    );
  }
}

/** Add layout provenance columns on legacy Postgres ledgers created before RAG ingest. */
async function ensureRagLayoutColumns(client: pg.Client): Promise<void> {
  if (!(await tableExists(client, "t_clause"))) {
    return;
  }
  await client.query(`ALTER TABLE t_clause ADD COLUMN IF NOT EXISTS file_name VARCHAR(512) NULL`);
  await client.query(`ALTER TABLE t_clause ADD COLUMN IF NOT EXISTS page_start INTEGER NULL`);
  await client.query(`ALTER TABLE t_clause ADD COLUMN IF NOT EXISTS page_end INTEGER NULL`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_t_clause_file_page ON t_clause(file_name, page_start)`,
  );
}

/** Apply generated IF NOT EXISTS DDL instead of a hand-written live schema. */
export async function runPgMigration(databaseUrl: string): Promise<void> {
  const sql = readFileSync(MIGRATION_FILE, "utf-8");
  const statements = splitStatements(sql);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // Legacy ledgers may lack doc_type_id before new tables/indexes are applied.
    await ensureDocTypeColumns(client);
    await ensureExcelGapFillColumns(client);
    await ensureRagLayoutColumns(client);
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
}
