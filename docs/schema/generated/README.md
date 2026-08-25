# Apply WARN

- stack: sql-fallback (empty repo, no jpa/mybatis/typeorm convention dir)
- SQL written to docs/schema/generated/agent-runtime-migration.sql
- Companion TS row types: docs/schema/generated/agent-runtime-rows.ts
- Move into packages/agent-runtime during implement if needed
- EntityGraph: await start_init/sync after package lands; do not hand-edit entities.json
