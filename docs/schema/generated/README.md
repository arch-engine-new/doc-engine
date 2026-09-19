# Apply WARN

- stack: sql-fallback (empty repo, no jpa/mybatis/typeorm convention dir)
- agent-runtime SQL: docs/schema/generated/agent-runtime-migration.sql
- core-engine SQL: docs/schema/generated/core-engine-migration.sql (PostgreSQL)
- Companion TS: docs/schema/generated/agent-runtime-rows.ts, docs/schema/generated/core-engine-rows.ts
- Move into a business package during SLICE-1 implement if needed
- EntityGraph: await start_init/sync after package lands; do not hand-edit entities.json
