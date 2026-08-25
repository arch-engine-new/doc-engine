/**
 * Database migration runner for agent-runtime SQLite schema.
 * Reads the generated SQL migration file and executes it idempotently.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the generated SQL migration file.
 */
const MIGRATION_FILE = join(__dirname, "../../../../docs/schema/generated/agent-runtime-migration.sql");

/**
 * Run the database migration.
 * Creates all tables and indexes defined in the migration SQL file.
 * Idempotent - safe to run multiple times.
 *
 * @param dbPath - Path to the SQLite database file (or ":memory:" for in-memory)
 * @returns Promise that resolves when migration completes
 */
export async function runMigration(dbPath: string): Promise<void> {
  const sql = readFileSync(MIGRATION_FILE, "utf-8");

  const db = new Database(dbPath);
  try {
    // Enable foreign keys
    db.pragma("foreign_keys = ON");

    // Execute the migration SQL
    // better-sqlite3's exec() runs multiple statements
    db.exec(sql);
  } finally {
    db.close();
  }
}

/**
 * Run migration on an existing database connection.
 * Useful when you already have a Database instance open.
 *
 * @param db - Existing better-sqlite3 Database instance
 */
export function runMigrationOnDb(db: Database.Database): void {
  const sql = readFileSync(MIGRATION_FILE, "utf-8");
  db.pragma("foreign_keys = ON");
  db.exec(sql);
}

/**
 * Check if migration has been applied (tables exist).
 *
 * @param dbPath - Path to the SQLite database file
 * @returns true if all expected tables exist
 */
export async function isMigrated(dbPath: string): Promise<boolean> {
  const db = new Database(dbPath);
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?, ?, ?, ?, ?, ?)",
      )
      .all(
        "t_agent_graph",
        "t_agent_run",
        "t_agent_node_execution",
        "t_agent_checkpoint",
        "t_agent_tool_call",
        "t_agent_run_event",
        "t_agent_hitl_interrupt",
      );

    return tables.length === 7;
  } finally {
    db.close();
  }
}