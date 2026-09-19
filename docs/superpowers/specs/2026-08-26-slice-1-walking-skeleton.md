# SLICE-1 Walking Skeleton Spec

**Slice:** 跑通 the job pipeline for Operator  
**Pages:** `job_upload` + `check_findings`（本步对话壳）；不实现 Vue 页（无 design profile，本片不做 UI connect）  
**Contracts:** `JobRow`, `FindingRow`, `ConversationThreadRow` @ `docs/schema/generated/core-engine-rows.ts`  
**Reuse:** `packages/agent-runtime` HITL / EventLog；禁止推倒 runtime  
**Out:** Qdrant/Neo4j、DSL 全量、Receipt 落库、组卷提交、Vue SPA

## 目标

操作员上传 2 份文本层夹具 → 抽取 JSON（编号/日期A/日期B）→ 执行 R1 `required(编号)` + R2 `compare(日期A, ≤, 日期B)` → 产出 Finding + AuditEvent（同一 `trace_id`）→ 每步可写 ConversationThread（HITL，不改 Job.status、不写 Receipt）。

## 验收（本片）

| ID | 通过标准 |
|----|----------|
| A4 | 日期颠倒夹具出现 blocking finding（R2 fail） |
| A5 | 合规夹具无 R2 fail finding |
| A9 | 任一 Job 可用 `trace_id` 串起 Extraction + RuleVersion + Finding |
| A15 | `trace_id`+`step=checking` 可追加对话消息；消息不推进状态机 |

## 行为

1. `createProject` → `createJob(upload fixture)` 写入 `t_job.trace_id`，status 经 inspecting→extracting→checking。
2. 抽取：夹具为 JSON 或文本层 PDF；字段 key 固定 `编号`/`日期A`/`日期B`。无模板时仍可从夹具 JSON 灌入（本片不画布）。
3. 规则解释器最小集：`required(field)`、`compare(a, ≤, b)`；默认 blocking=1。
4. R2 fail 时 Job 不得标自动通过（停在 checking 或 pending 均可，但 findings 必须 blocking）。
5. `POST /jobs/:id/chat` 写入 `t_conversation_thread` + `t_conversation_message`；`confirmNext` 本片可做 no-op 或仅记消息，**禁止**因对话取消 blocking。
6. 本片 **不** 调 LLM；HITL 只落对话表。agent-runtime 作为后续片接入点，本片可只依赖类型/可选 HitlGateway token 字段空着。

## 非目标

OCR 厂商、OSS、PG 实库必连（测试用 SQLite 映射同表名）、标准 RAG、publish 闸门、Proposal/Receipt。
