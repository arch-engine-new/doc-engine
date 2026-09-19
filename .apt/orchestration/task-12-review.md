# Task 12 Review — Docker live 冒烟（非 CI 强制）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 12
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-12-brief.md` / `.apt/orchestration/task-12-review-brief.md`
Report: `.apt/orchestration/task-12-report.md`
Range: `08657a3533b6564a00514641ff466d4e73b9c7de..9f584e7987786bd48fa0cdc39addc923739c1410`
Commit: `9f584e7987786bd48fa0cdc39addc923739c1410` test(retrieve): skip live RAG ingest smoke without DATABASE_URL
Parent: `08657a3533b6564a00514641ff466d4e73b9c7de`（= BASE_SHA）
Status (implementer): `DONE`

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `query_contract` name=`liveRetrievePorts`；禁读 `.ai/` | **YES** | `.apt/tool-call-log.jsonl` `2026-09-15T09:50:14Z` `query_project_status` + `query_contract liveRetrievePorts` 均 ok；随后 `refresh_asset` 测试文件。当日无 `audit_arch_changes`。审查方只读复查合同：`packages/core-engine/src/retrieve/live-ports.ts`（缺 env 抛错，不回落 memory） |
| `describe.skipIf(!DATABASE_URL)`（可兼 QDRANT_URL/NEO4J_URI） | **YES** | `hasLiveEnv = Boolean(DATABASE_URL && QDRANT_URL && NEO4J_URI)`；`describe.skipIf(!hasLiveEnv)`，与 `live-triple-store.test.ts` 一致 |
| 无 Docker / 无 env → skip，CI 仍绿 | **YES** | 审查方本机三 env 均 UNSET；复跑 1 skipped / exit 0（见 Verify） |
| 有 live：JSON 请假夹具或 tick `rules/` 前 N 页 | **YES** | 走 JSON `LEAVE_TEXT`（事假/病假）+ `ingestStandard`；brief 允许夹具或 tick。全书 OCR / `LIVE_RAG_PAGES` 不是门禁 |
| 抽查任一 Qdrant point `payload.file_name` 非空 | **YES** | `scroll("clauses")` 32 点，任一 `file_name` 字符串非空即过。`beforeAll` 调 `liveRetrievePorts()` 再 `JobPipeline.openLiveFromEnv()` |
| **禁止**公路写入 `demo/reset` seed；未涨 Job 4MB | **YES** | diff 仅新测文件；`seed.ts` / `live-ports.ts` / `job-pipeline.ts` 无改。夹具正文无公路/JTG；「公路」只出现在注释「不写入 seed」。`MAX_UPLOAD_BYTES` 未动 |
| 白名单；commit 文案 | **YES** | 1 文件 `packages/core-engine/test/live-rag-ingest.test.ts`。message=`test(retrieve): skip live RAG ingest smoke without DATABASE_URL`。未改 `live-ports.ts`（brief：仅必须才改） |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Extra / Misunderstood（相对本 Task brief / plan Task 12 / review-brief）。plan 正文写 tick `rules/`，brief 显式允许 JSON 请假夹具；实现取夹具路径，符合编排账本。

## Quality

**公开 export 注释抽检：N/A（Approved：无新增公开 export）**

未改 `live-ports.ts`。测试文件头注释说明 skip 原因、JSON 夹具、全书 OCR 非门禁、不写公路 seed。`scrollNonEmptyFileName` / `hasLiveEnv` 非导出。

TS 有 return type；命名 camelCase。函数体 <80。

**白名单 / 密钥：** 本 commit 仅测试文件。未含 `.ai/`、`.env`、token。未 push。未改 seed。

## Verify

审查方复跑（本机无 `DATABASE_URL` / `QDRANT_URL` / `NEO4J_URI`）：

```
npx vitest run packages/core-engine/test/live-rag-ingest.test.ts
```

→ exit 0；Test Files **1 skipped** (1)；Tests **1 skipped** (1)；Duration ~3.5s（vitest 3.2.7）。

与 report 一致。无 Docker 时 skip 绿。有 live 的 Qdrant 抽查本机未跑（三 env 均缺，符合非 CI 强制）。

Rn: R1、R10。

## Issues

**blocking：** 无（0）

**nit：**

- live 抽查是 collection 内「任一」非空 `file_name`，未绑定本次 ingest 的 point；与 brief「抽查任一」一致，脏库下可能假绿。
- `liveRetrievePorts()` 返回值未使用；`openLiveFromEnv()` 内部已装配同一合同。构造期 fail-fast 仍有效。
- `refresh_asset` 把测试登记为 `frontend/core-engine/util/live-rag-ingest.test`；`.ai/` 未进本 commit（brief 禁止 `audit_arch_changes`）。
- 本机无 live env，未实际打到 Qdrant（report 已披露）。

## Assessment

**PASS**
