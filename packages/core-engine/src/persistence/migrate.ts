/**
 * SQLite migration for walking-skeleton ledger tables (SLICE-1..6 including standard library).
 * Production contract remains docs/schema/generated/core-engine-migration.sql (PostgreSQL).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_FILE = join(__dirname, "sqlite-slice1.sql");

const LEDGER_TABLES = [
  "t_project",
  "t_spec_pack",
  "t_doc_type",
  "t_field_def",
  "t_template",
  "t_excel_cell_mapping",
  "t_field_fill_rule",
  "t_document_artifact",
  "t_signature_task",
  "t_completeness_rule",
  "t_field_box",
  "t_job",
  "t_document",
  "t_extraction",
  "t_rule",
  "t_rule_version",
  "t_rule_fixture",
  "t_finding",
  "t_proposal",
  "t_receipt",
  "t_volume_preview",
  "t_audit_event",
  "t_conversation_thread",
  "t_conversation_message",
  "t_standard_doc",
  "t_standard_version",
  "t_clause",
  "t_standard_edge",
  "t_layout_unit",
  "t_layout_edge",
  "t_ingest_run",
  "t_ingest_page",
] as const;

/** @deprecated Use LEDGER_TABLES; kept so SLICE-1 callers keep compiling. */
const SLICE1_TABLES = LEDGER_TABLES;

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

/** Add doc_type columns on legacy SQLite ledgers created before DocType slice. */
function ensureDocTypeColumns(db: Database.Database): void {
  if (tableHasColumn(db, "t_template", "template_id") && !tableHasColumn(db, "t_template", "doc_type_id")) {
    db.exec(`ALTER TABLE t_template ADD COLUMN doc_type_id VARCHAR(64) NOT NULL DEFAULT ''`);
  }
  if (tableHasColumn(db, "t_job", "job_id") && !tableHasColumn(db, "t_job", "doc_type_id")) {
    db.exec(`ALTER TABLE t_job ADD COLUMN doc_type_id VARCHAR(64) NULL`);
  }
}

/** Add Excel gap-fill columns on legacy SQLite ledgers created before Task 1. */
function ensureExcelGapFillColumns(db: Database.Database): void {
  if (tableHasColumn(db, "t_template", "template_id") && !tableHasColumn(db, "t_template", "layout_kind")) {
    db.exec(`ALTER TABLE t_template ADD COLUMN layout_kind VARCHAR(16) NOT NULL DEFAULT 'raster'`);
  }
  if (tableHasColumn(db, "t_template", "template_id") && !tableHasColumn(db, "t_template", "excel_template_uri")) {
    db.exec(`ALTER TABLE t_template ADD COLUMN excel_template_uri VARCHAR(512) NULL`);
  }
  if (tableHasColumn(db, "t_template", "template_id") && !tableHasColumn(db, "t_template", "excel_sheet_name")) {
    db.exec(`ALTER TABLE t_template ADD COLUMN excel_sheet_name VARCHAR(128) NULL`);
  }
}

/** Add layout provenance columns on legacy SQLite ledgers created before RAG ingest. */
function ensureRagLayoutColumns(db: Database.Database): void {
  if (!tableHasColumn(db, "t_clause", "clause_id")) {
    return;
  }
  if (!tableHasColumn(db, "t_clause", "file_name")) {
    db.exec(`ALTER TABLE t_clause ADD COLUMN file_name VARCHAR(512) NULL`);
  }
  if (!tableHasColumn(db, "t_clause", "page_start")) {
    db.exec(`ALTER TABLE t_clause ADD COLUMN page_start INTEGER NULL`);
  }
  if (!tableHasColumn(db, "t_clause", "page_end")) {
    db.exec(`ALTER TABLE t_clause ADD COLUMN page_end INTEGER NULL`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_t_clause_file_page ON t_clause(file_name, page_start)`);
}

export function runMigrationOnDb(db: Database.Database): void {
  const sql = readFileSync(MIGRATION_FILE, "utf-8");
  db.pragma("foreign_keys = ON");
  // ALTER t_clause before CREATE INDEX in sqlite-slice1.sql so old DBs do not fail.
  ensureRagLayoutColumns(db);
  db.exec(sql);
  ensureDocTypeColumns(db);
  ensureExcelGapFillColumns(db);
  ensureRagLayoutColumns(db);
}

export async function runMigration(dbPath: string): Promise<void> {
  const db = new Database(dbPath);
  try {
    runMigrationOnDb(db);
  } finally {
    db.close();
  }
}

export async function isMigrated(dbPath: string): Promise<boolean> {
  const db = new Database(dbPath);
  try {
    const placeholders = LEDGER_TABLES.map(() => "?").join(", ");
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`,
      )
      .all(...LEDGER_TABLES) as Array<{ name: string }>;
    return tables.length === LEDGER_TABLES.length;
  } finally {
    db.close();
  }
}

export { LEDGER_TABLES, SLICE1_TABLES };
