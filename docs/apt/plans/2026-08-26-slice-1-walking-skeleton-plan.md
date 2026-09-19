# SLICE-1 Walking Skeleton Plan

> spec: `docs/superpowers/specs/2026-08-26-slice-1-walking-skeleton.md`  
> schema: `docs/schema/generated/core-engine-migration.sql`（PG 合同）；测试库 SQLite 同表名映射 JSONB→TEXT、IDENTITY→AUTOINCREMENT

## 包

新建 workspace `packages/core-engine`（vitest + typescript，对齐 agent-runtime）。根 `package.json` 的 `test` 改为同时跑两个 workspace。

## 任务

1. **SQLite 迁移映射**  
   仅 SLICE-1 表：`t_project`, `t_job`, `t_document`, `t_extraction`, `t_rule`, `t_rule_version`, `t_finding`, `t_audit_event`, `t_conversation_thread`, `t_conversation_message`。  
   行类型从 `docs/schema/generated/core-engine-rows.ts` 引用或 re-export，禁止另造字段名。

2. **规则解释器**  
   `evaluate(extraction.fields, rules) → Finding[]`  
   - R1 required(编号)  
   - R2 compare(日期A, ≤, 日期B) 按 ISO 日期字符串比较  
   - blocking 来自 rule_version.blocking

3. **Job 流水线**  
   `runFixtureJob({ kind: 'ok' | 'reversed' })`  
   - 写入 project/job/document/extraction/findings/audit_events  
   - 颠倒件：日期A > 日期B → R2 fail blocking  
   - 合规件：日期A ≤ 日期B → R2 pass，无 fail finding

4. **对话壳**  
   `appendChat({ traceId, step, role, body })` 确保 thread unique (trace_id, step)；不修改 job.status。

5. **HTTP（可选最小）**  
   若实现 HTTP：`POST /jobs/fixtures`、`GET /jobs/:id/findings`、`POST /jobs/:id/chat`。可用与 agent-runtime 类似的 Node http，不必引入框架。

6. **测试**  
   - A4 颠倒 → 存在 result=fail 且 blocking=1 的 R2 finding  
   - A5 合规 → 无 R2 fail  
   - A9 两 job 均可 `listAudit(trace_id)` 含 extraction + rule_version + finding  
   - A15 appendChat 后能读回消息且 job.status 不变  
   `npm test -w core-engine` 必须 PASS。

7. **闭环**  
   `audit_arch_changes` → `refresh_asset`/`register_asset` 新源码；新导出类型 `register_contract`。  
   禁止改 `packages/agent-runtime` 行为（可依赖）。禁止 Qdrant/Neo4j/Vue。

## 完成定义

测试覆盖 A4/A5/A9/A15；包可在 workspace 安装；不宣称 connect done。
