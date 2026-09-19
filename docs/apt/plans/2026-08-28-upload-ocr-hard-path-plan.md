# 上传 / MinIO / 百度 OCR / 硬抽取 Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-28-upload-ocr-hard-path-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component（仍做 job_upload 文件控件；不新开页。设计寻址已做以免臆造 token。）

**Goal:** 任务页真上传原件进本机 MinIO，再用百度 OCR 与硬规则/硬检索跑完检查；夹具路径与 CI 不依赖外网。

**Architecture:** `BlobStore`（MinIO S3 / 单测内存）写入已有 `t_document.file_uri`；`OcrPort`（百度 `general_basic` / FakeOcr）产出全文；`parseOcrFields` + 复用 `extractByTemplate` 后走现有 `evaluate` 与 `StandardLibrary`。不新建账本表。Vite `loadEnv` 把无 `VITE_` 前缀的 `.env` 注入 Node。Agent 不持 MinIO/OCR 客户端。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**做：** MinIO 对象存储（`D:\docker_run\minio_data`，开发少量文件）、百度 OCR、硬抽取、接到现有 Job 状态机与 DSL/标准库、任务页文件选择、health 增加 `ocr`/`minio`、`apps/web/.env` 对 Node 生效。

**不做：** 资料云实挂、组卷提交、LLM 判合规、智谱 Embedding、扫描件 PDF 栅格化、新路由、CI 强制打百度。

**约束：** 真上传缺 MinIO 或缺百度 key 不得静默编造；夹具 `POST /api/jobs/fixture` 保持绿。MinIO ≠ `/adapter/pending-mount`。

### 1.2 设计寻址

| 项 | MCP 结果 | 约束摘要 |
|----|----------|----------|
| global | `query_design` scope=global | `--apt-*` token；禁止新 hex；提交类不对认知层开放 |
| page `job_upload` | `query_design` page=job_upload | 已有 upload 操作；gaps 空；不新开页 |
| PrimaryButton | `query_design` component=PrimaryButton | `button.btn` 主操作（上传） |
| GhostButton | `query_design` component=GhostButton | `button.btn.ghost` 夹具/重置 |
| DataTable | `query_design` component=DataTable | 原生 table + StatusTag |
| StatusTag | `query_design` component=StatusTag | `span.tag` ok\|warn\|bad |
| StepChatPanel | `query_design` component=StepChatPanel | HITL，不写账本 |

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| JobPipeline | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | `runFixtureJob` 保留；本片加 `openUploadJob` |
| extractByTemplate | contract | `packages/core-engine/src/extract/field-box.ts` | 缺键 → null，不抛错 |
| RuleInterpreter / evaluate | contract | `packages/core-engine/src/rules/interpreter.ts` | DSL 硬校验 |
| StandardLibrary | contract | `packages/core-engine/src/retrieve/library.ts` | search / attach 仅库内 `clause_id` |
| HashEmbeddings / liveRetrievePorts | contract + arch | `packages/core-engine/src/retrieve/live-ports.ts` | 本片不换 embedding |
| DemoHttpAdapter / handleDemoRequest | contract + arch | `packages/core-engine/src/http/handle-request.ts` | 扩 multipart + `/api/jobs/upload` |
| DemoHttpSession | arch | `frontend/core-engine/util#DemoHttpSession` → `packages/core-engine/src/http/session.ts` | health 加 ocr/minio |
| DocumentRow | contract | `docs/schema/generated/core-engine-rows.ts` | 已有 `file_uri` / `file_name` / `mime`，不建新表 |
| mockPendingMount | contract | `packages/core-engine/src/adapter/mock.ts` | 不升级为资料云 |
| ZhipuLlmProvider | contract | `packages/agent-runtime/src/llm/zhipu-provider.ts` | **本片不调用** |

**新建（实现期落点，非假装已存在）：** `BlobStore` / `MinioBlobStore` / `MemoryBlobStore`；`OcrPort` / `BaiduOcr` / `FakeOcr`；`parseOcrFields`。`search_arch`「MinIO S3 blob」无业务对象存储资产。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/blob/*` | 新 | S3 兼容 put/get，幂等建 bucket `docengine` |
| `packages/core-engine/src/ocr/*` | 新 | 百度 token + general_basic；FakeOcr |
| `packages/core-engine/src/extract/ocr-fields.ts` | 新 | 编号/日期硬解析 |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | 改 | `openUploadJob` |
| `packages/core-engine/src/http/handle-request.ts` | 改 | multipart；`POST /api/jobs/upload` |
| `packages/core-engine/src/http/node.ts` | 改 | 读二进制 body |
| `packages/core-engine/src/http/session.ts` | 改 | health.ocr / health.minio |
| `apps/web/vite.config.ts` | 改 | `loadEnv(mode, cwd, "")` → `process.env` |
| `apps/web/src/views/job_upload/index.vue` | 改 | file + 上传按钮 |
| `apps/web/.env.example` | 改 | MinIO 四键 + 百度两键 |
| `packages/core-engine/test/upload-ocr.test.ts` | 新 | MemoryBlobStore + FakeOcr |
| `docs/使用手册.md` | 改 | MinIO 控制台 9001、上传步骤 |
| `packages/core-engine/package.json` | 改 | `@aws-sdk/client-s3`（或等价 S3 客户端） |
| `packages/core-engine/src/index.ts` | 改 | 导出新端口 |

Docker 容器已在宿主机启动，**不**进 git：`minio` 9000/9001，卷 `D:\docker_run\minio_data`。命令已记入 `D:\docker_run\start_container.txt`。

### 1.5 风险与未决项

- 百度日额度用尽 → Job `failed` + `ocr_error`，禁止重试打爆。
- Vite 未注入无前缀 env 时 MinIO/百度都会 skip/失败；本片必须修 `loadEnv`。
- MinIO 开发口令 `minioadmin` 仅本机验证，禁止提交真实 `.env`。
- FieldBox 像素裁剪本片不做，复杂表单字段可能为 null。
- 扫描件 PDF 本片拒绝，需先导出首页 JPEG/PNG。

---

## Part 2 — 可执行任务清单

> 实现时由 `/implement-plan` 按 Task 派发。PowerShell 不要用 `&&`。

### Task 1: Vite 注入无前缀 env + 示例键

- [ ] `apps/web/vite.config.ts` 用 `loadEnv(mode, process.cwd(), "")` 把键写入 `process.env`（不要用 `envPrefix: ""`，以免泄漏到客户端）
  - **MCP:** `query_arch` path=`frontend/core-engine/util#DemoHttpSession`
  - **Files:** `apps/web/vite.config.ts`, `apps/web/.env.example`
- [ ] `.env.example` 增加：`MINIO_ENDPOINT=http://127.0.0.1:9000`、`MINIO_ACCESS_KEY=minioadmin`、`MINIO_SECRET_KEY=minioadmin`、`MINIO_BUCKET=docengine`、`BAIDU_OCR_API_KEY=`、`BAIDU_OCR_SECRET_KEY=`（可空注释）
  - **Verify:** `.env.example` 含上述键名；`npx tsc -p apps/web --noEmit` 或现有 web 能启动配置解析

### Task 2: BlobStore 端口 + 内存实现

- [ ] 定义 `BlobStore`：`ensureBucket()`、`put({ key, bytes, mime })`、`get(key)`；`MemoryBlobStore` 供单测
  - **MCP:** `query_contract` name=`DocumentRow`
  - **Files:** `packages/core-engine/src/blob/port.ts`, `packages/core-engine/src/blob/memory.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`
  - **Contracts:** `BlobStore`

### Task 3: MinioBlobStore

- [ ] 用 S3 客户端对接 `MINIO_ENDPOINT`；path-style；幂等创建 bucket `docengine`；`file_uri` = `s3://{bucket}/{key}`，key=`jobs/{job_id}/{safeName}`
  - **MCP:** `query_contract` name=`DocumentRow`
  - **Files:** `packages/core-engine/src/blob/minio.ts`, `packages/core-engine/package.json`
- [ ] 无 `MINIO_ENDPOINT` 时不要构造 MinIO 客户端；缺连接串的真上传由装配层失败
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 4: OcrPort + FakeOcr

- [ ] `recognize({ bytes, mime, fileName }) → { text, vendor }`；`FakeOcr` 可注入固定文本
  - **MCP:** `query_contract` name=`extractByTemplate`
  - **Files:** `packages/core-engine/src/ocr/port.ts`, `packages/core-engine/src/ocr/fake.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`
  - **Contracts:** `OcrPort`

### Task 5: BaiduOcr

- [ ] OAuth token 缓存；默认 `general_basic`；`BAIDU_OCR_API` 可切 `accurate_basic`；错误码 17/18 映射可读中文
  - **MCP:** `query_arch` path=`frontend/core-engine/util#DemoHttpSession`
  - **Files:** `packages/core-engine/src/ocr/baidu.ts`, `packages/core-engine/src/ocr/env.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 6: parseOcrFields + extractByTemplate

- [ ] 从全文解析 `编号` / `日期A` / `日期B`（中文别名 + 简单日期正则），再交给 `extractByTemplate`
  - **MCP:** `query_contract` name=`extractByTemplate`
  - **Files:** `packages/core-engine/src/extract/ocr-fields.ts`, `packages/core-engine/src/extract/field-box.ts`
  - **Verify:** 单测：缺键为 null；颠倒日期字符串能被解析成两个 ISO 或可比较日期串

### Task 7: JobPipeline.openUploadJob

- [ ] MIME 白名单 jpeg/png（文本 PDF 可选抽字）；>4MB 或非法 MIME **400 且不插 Job**；put MinIO → OCR → 抽取 → `evaluate` → 可选 `attachStandardFitFinding`（无命中不编造 clause_id）；`runFixtureJob` 行为不变
  - **MCP:** `query_contract` name=`JobPipeline`；`query_contract` name=`StandardLibrary`；`query_contract` name=`RuleInterpreter`
  - **Files:** `packages/core-engine/src/pipeline/job-pipeline.ts`
  - **Verify:** `npm test -w core-engine -- upload-ocr`
  - **Contracts:** 实现后 `openUploadJob` 可挂在 JobPipeline 契约更新说明

### Task 8: HTTP multipart + health

- [ ] `POST /api/jobs/upload`；node/Vite 能读 multipart；`GET /api/health` 增加 `ocr`、`minio`
  - **MCP:** `query_contract` name=`DemoHttpAdapter`；`query_arch` path=`frontend/core-engine/util#handleDemoRequest`
  - **Files:** `packages/core-engine/src/http/handle-request.ts`, `packages/core-engine/src/http/node.ts`, `packages/core-engine/src/http/session.ts`
  - **Verify:** 无 MinIO/百度 env 时 health 对应 skip；`npm test -w core-engine`

### Task 9: 任务页上传控件

- [ ] `job_upload` 增加 file input + 主按钮「上传资料」；夹具按钮保留；颜色只用 `--apt-*` / 现有 `btn` `btn ghost`
  - **MCP:** `query_design` page=`job_upload`；`query_design` component=`PrimaryButton`
  - **Files:** `apps/web/src/views/job_upload/index.vue`, `apps/web/src/services/http.ts`
  - **Verify:** 页面能选文件并 POST `/api/jobs/upload`（multipart）

### Task 10: 手册与契约

- [ ] 手册写 MinIO 控制台 `http://127.0.0.1:9001`、bucket `docengine`、与资料云无关；`register_contract`：`BlobStore`、`OcrPort`；`refresh_asset` module=`core-engine`
  - **MCP:** `register_contract`；`refresh_asset` sourcePath=`packages/core-engine/src/http/session.ts`
  - **Files:** `docs/使用手册.md`, `packages/core-engine/src/index.ts`
  - **Verify:** 手册含 9001 / `s3://` 或 bucket 名 / 百度额度失败说明；`npx tsc -p packages/core-engine --noEmit`
