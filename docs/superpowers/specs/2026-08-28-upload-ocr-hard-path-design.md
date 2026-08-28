---
title: 上传 + 百度 OCR + 硬抽取/硬检索
date: 2026-08-28
status: approved
risk: high
phase: approved
topic: upload-ocr-hard-path
mode: apt-auto-brainstorm
goalSha: 6900c96c0679cba37337f51c3356d096355eb577939de41b76d1d115a7818c37
approvedAt: 2026-08-28T15:48:00.000Z
approvedBy: user
---

# Design Spec: 上传、OCR、硬抽取与硬 RAG（厂商 Embedding / 思考稍后）

## Goal

让操作人员能在「任务」页**真正选一份资料**进入流水线：**MinIO 对象存储**（Docker，数据在 `D:\docker_run\minio_data`，开发验证少量文件）→ 百度在线 OCR（免费额度）→ 按模板字段做**确定性抽取** → 已发布 DSL 校验 → 用包内生效标准做**硬检索**（现有 Qdrant/Neo4j + HashEmbeddings）。  
「思考」本片仍是本步 HITL 对话，**不用模型判合不合格**。Embedding / 预查询 / 对话补全的厂商 API Key **本片只留接口位，不切换默认实现**。

成功标准：选一张表单图片（或夹具回归），检查页能看到 OCR 文本和按框投影的字段，规则 Finding 仍走 DSL；标准符合度 Finding 的 `clause_id` 仍必须来自库。

## 澄清（全自动自答）

`.apt/goal.md` 存在，本轮按全自动 brainstorming：AI 自问自答。用户原话：先补齐硬能力；OCR 用百度在线（每日免费额度）；思考 / RAG / embedding **部分**最后再用厂商 key。

1. **本片做什么？** 上传 + 百度 OCR + 硬抽取 + 接到现有 Job 状态机与 DSL/标准库。不接资料云、不开放组卷提交。
2. **OCR 厂商？** 百度智能云通用文字识别（默认 `general_basic`，额度更宽；可用 `BAIDU_OCR_API=accurate_basic` 切换高精度）。环境变量 `BAIDU_OCR_API_KEY` + `BAIDU_OCR_SECRET_KEY`。密钥不入库、不进 git。
3. **没配百度 key？** 夹具路径不变（`POST /api/jobs/fixture`）。真上传在缺 key 时 **失败并写审计**，禁止静默编造 OCR 文本。测试用 `FakeOcr`，不打网。
4. **思考要不要接智谱？** 本片不接。仓内已有 `ZhipuLlmProvider`，对话仍只 `appendChat`（HITL，不改 status、不写 Receipt）。模型当法官会覆盖 blocking 硬规则，与 A16 冲突。
5. **Embedding 换厂商？** 本片不换默认。继续 `HashEmbeddings`。端口 `Embeddings` 保持同步；异步厂商向量作为**后续片**（需改端口为 `embed(): Promise<number[]>`，属破坏性契约，本片不做）。
6. **PDF？** 本片主路径：**JPEG/PNG**。PDF 有文本层可本地抽字（不耗百度额度）；扫描件 PDF 本片返回明确错误（请先导出首页为图片），不引入 Windows 上脆弱的 PDF 栅格化。
7. **改几页 UI？** 只改 `job_upload`：加文件选择 + 上传按钮。不新增第 10 页。组件用已有 `PrimaryButton` / `DataTable` / `StatusTag` / `StepChatPanel`。
8. **Vite `.env`？** 本片必须让 `apps/web/.env` 里无 `VITE_` 前缀的键进入 **Node `process.env`**（`loadEnv(..., "")` 只注入服务端，不暴露给 `import.meta.env` 客户端）。否则百度 key、MinIO、三库 key 都可能读不到。
9. **文件放哪？** 用户批准时改为 **MinIO**，不写 `apps/web/.uploads`。容器名 `minio`，API `9000`，控制台 `9001`，账号 `minioadmin` / `minioadmin`，bucket `docengine`（引擎幂等创建）。**不是**资料云挂载。

## 范围

1. `OcrPort`：`recognize({ bytes, mime, fileName }) → { text, vendor, raw? }`。实现：`BaiduOcr`、`FakeOcr`。
2. `BlobStore`：`put` / `get` / `ensureBucket`。实现：`MinioBlobStore`（S3 API）、`MemoryBlobStore`（单测）。`Document.file_uri` 形如 `s3://docengine/jobs/{job_id}/{file_name}`。不建新账本表。
3. `POST /api/jobs/upload`（multipart）：`pack_id`、`template_id` 可选、文件。创建 Job `uploaded` → 质检（体积/MIME）→ OCR → 抽取 → 跑已发布规则 → 若包有生效标准则用抽取文本/字段拼 query 调 `searchStandard` / `attachStandardFitFinding`（无命中则不编造 `clause_id`）。
4. 硬抽取：OCR 全文用规则解析 `编号` / 日期类字段（正则 + 中文键名别名），再 `extractByTemplate` 投影到模板框；缺键为 `null`，不中断 Job。
5. 任务页：`<input type="file">` + 上传；夹具按钮保留。
6. `GET /api/health` 增加 `ocr` 与 `minio`（`ok | skip | fail`；无对应 env = skip）。
7. `.env.example` 增加百度两键与 `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET`；手册补 MinIO 控制台与上传步骤。
8. 单测：FakeOcr + 样例图/样例字符串；无 key 时不访问百度。可选 skipIf 的 live OCR 测。

## 非目标

- 资料云实挂、组卷提交、`submitted=true`、Agent 调 `submit_*`。
- 用 LLM 判合规、用对话确认 Proposal / 发布规则。
- 智谱 Embedding、智谱预查询、把 `Embeddings.embed` 改成 async。
- 把 `check_wording` 换成真实 LLM（仍用夹具措辞）。
- 扫描件 PDF 栅格化、多页 OCR、百度表格/位置 OCR 按像素框精确裁剪（FieldBox 坐标本片不送百度；裁剪作为后续增强）。
- 新 Vue 路由、公路/水利/房建预置包。
- CI 强制外网打百度。
- Agent 持 OCR 客户端、三库客户端或 MinIO 客户端。

## 验收标准

| ID | 通过标准 |
|----|----------|
| U1 | 任务页可选 JPEG/PNG 上传；成功后列表出现新 Job，`Document.file_name` 为原文件名；MinIO bucket `docengine` 中有对应 object（控制台 http://127.0.0.1:9001）。 |
| U2 | 配置了百度两键时，Job 的 `extraction.ocr_text` 为接口返回全文（非夹具 JSON）；缺 key 的真上传返回 503/4xx 且不写假 OCR。 |
| U3 | 模板有框时 `fields_json` 含对应 `field_key`；OCR 未读到则为 `null`，Job 不崩。 |
| U4 | 已发布 R1/R2 仍对抽取字段执行；日期颠倒类 blocking 不得因 OCR 软化而自动通过。 |
| U5 | 包已钉生效标准且检索有命中时，标准符合度 Finding 带库内 `clause_id`；无命中则不加编造条款号。 |
| U6 | 对话不能改 Job.status / 不能写 Receipt / 不能 publish。 |
| U7 | `POST /api/jobs/fixture` 与无百度 key 的 `npm test -w core-engine` 全绿。 |
| U8 | 组卷提交仍禁用；mock adapter 无 receipt 仍不算写入。 |
| U9 | 健康检查：无百度 key 时 `ocr=skip`；有 key 且 token 可取时 `ocr=ok`。 |
| U10 | 无 MinIO env 时夹具测试全绿；有 env 时 health `minio=ok`；缺 MinIO 的真上传失败且不写假文件。 |

## 方案比较（核心决策：OCR 与抽取怎么接流水线）

### 方案 A — 只加百度 OCR，仍用夹具字段跑规则

- 优点：改动小。
- 缺点：检查页字段与上传文件无关，用户仍觉得「没在收集资料」。
- **不推荐。**

### 方案 B — MinIO 落对象 + 百度全文 OCR + 正则/别名硬解析 + 现有 `extractByTemplate` + 现有 DSL/标准库（推荐）

- 优点：硬能力闭环；测试可 FakeOcr；不破坏 A16（模型不当法官）；复用 `JobPipeline` / `StandardLibrary` / `RuleInterpreter`。
- 缺点：全文 OCR 对「框在画布上的像素」不准；复杂版式字段可能为 null。
- **推荐。** 理由：用户要先补硬能力并用百度免费额度；框选精度留给后续位置 OCR/裁剪。

### 方案 C — 本片同时接智谱 Embedding + 智谱「思考」判标准

- 优点：更像终局 RAG。
- 缺点：额度/密钥/破坏性 `Embeddings` 异步改造；思考覆盖硬规则，超出「先硬能力」。
- **不推荐本片。**

## 设计

### Architecture

```
浏览器 job_upload
  → POST /api/jobs/upload (multipart)
  → Vite 中间件（process.env 含百度 key 与三库 key）
  → JobPipeline.openUploadJob
       → BlobStore.put（MinIO）+ t_document.file_uri
       → BlobStore.get → OcrPort.recognize（Baidu 或 Fake）
       → parseOcrFields(text) → extractByTemplate(boxes)
       → t_extraction
       → evaluate(DSL)
       → 可选 attachStandardFitFinding(query=ocr/fields)
  → 检查页 / 待审 / 审计（现页）
```

认知层 `agent-runtime` **不**调用百度、不持 MinIO 客户端。HITL 仍走 `/api/chat`。MinIO 只存演示原件，**不等于**资料云目录挂载。

### Components

| 组件 | 职责 |
|------|------|
| `BlobStore` / `MinioBlobStore` / `MemoryBlobStore` | 原件 put/get；S3 兼容；单测内存 |
| `OcrPort` / `BaiduOcr` / `FakeOcr` | 识字；百度走 OAuth token 缓存 + `general_basic` |
| `parseOcrFields` | 从全文解析编号/日期等到 `Record<string, string>` |
| `extractByTemplate` | **复用**：投影到 FieldBox keys |
| `JobPipeline.openUploadJob` | 新装配；`runFixtureJob` 保留 |
| `handleDemoRequest` | multipart 解析；`/api/jobs/upload` |
| `job_upload/index.vue` | file input + 上传 |
| Vite `loadEnv` | 无前缀键写入 `process.env` |

### Data flow

1. 操作员选文件（上限 **4MB**，超限 400）→ 通过后建 Job `uploaded`。
2. 自动或「同意下一步」进入 `inspecting`（MIME/大小；失败 → `failed` + 审计）。
3. `extracting`：OCR → 解析 → 投影 → `ocr_text` + `fields_json`。
4. `checking`：DSL Finding；再尝试标准库检索（失败/无命中不阻断 DSL 结果）。
5. blocking 仍停在 checking，需 HITL `confirm-next` 才进 pending。

### Error handling

- 百度 17（日额度）/ 18（QPS）/ 网络：Job `failed`，审计 `ocr_error`，响应含可理解中文，不重试打爆额度。
- 不支持的 MIME（非 `image/jpeg` / `image/png` / 文本层 `application/pdf`）：**400，不插入 Job**。OCR/额度失败：Job 已存在则置 `failed` 并写 `ocr_error` 审计。
- Token 获取失败：与缺 key 一样，不静默 Fake。
- 检索无命中：不 insert 带假 `clause_id` 的 Finding。
- MinIO 不可达 / 缺 env：真上传 503，夹具路径不受影响。

### Testing

- `FakeOcr` 返回含「编号」「日期A>日期B」的字符串 → 抽取 + R2 blocking。
- 合规样例字符串 → 无日期颠倒失败。
- 不 mock 真实百度 URL，除非 `BAIDU_OCR_*` 都在且测试显式 `describe.skipIf`。
- 现有 fixture / live-triple-store 测试保持绿。
- `MemoryBlobStore` 覆盖 put/get；有 MinIO env 时可 skipIf 集成测 object 存在。

## Ontology detection

**query 记录**

- `query_ontology()` 全景：core-engine / web / agent-runtime；设计页含 `job_upload`。
- `query_ontology(topic=OCR upload extract embeddings)`：命中 `HashEmbeddings` / `FixtureEmbeddings`，**无**现成 OCR 资产。
- `query_design(scope=global)`、`query_design(page=job_upload)`：upload 操作已在 page.logic，UI 无 blocking gap。
- `query_contract`：`JobPipeline`、`extractByTemplate`、`Embeddings`、`StandardLibrary`、`ZhipuLlmProvider`。

**既有资产与复用决策**

| 资产 | 决策 | 理由 |
|------|------|------|
| `JobPipeline` / `runFixtureJob` | 复用 + 新增 `openUploadJob` | 夹具回归必须留 |
| `extractByTemplate` | 复用 | 缺键 null、不抛错 |
| `StandardLibrary.searchStandard` / `attachStandardFitFinding` | 复用 | 硬 RAG；禁止编造 clause_id |
| `HashEmbeddings` / `liveRetrievePorts` | 复用，本片不替换 | 用户要求 embedding 厂商 key 稍后 |
| `ZhipuLlmProvider` | **不复用本片** | 思考不当法官；对话仍 HITL |
| `DemoHttpAdapter` | 复用并扩展 multipart | 与 9 页同一中间件 |
| `mockPendingMount` | 复用、不升级 | MinIO ≠ 资料云适配器 |
| job_upload 设计配方 | 复用，补文件控件 | 不新开页 |
| MinIO / BlobStore | **新建** | ontology 无对象存储资产 |

## 拟改动文件（> 8，故 risk=high）

1. `packages/core-engine/src/blob/port.ts`
2. `packages/core-engine/src/blob/minio.ts`
3. `packages/core-engine/src/blob/memory.ts`
4. `packages/core-engine/src/ocr/port.ts`
5. `packages/core-engine/src/ocr/baidu.ts`
6. `packages/core-engine/src/ocr/fake.ts`
7. `packages/core-engine/src/extract/ocr-fields.ts`
8. `packages/core-engine/src/pipeline/job-pipeline.ts`
9. `packages/core-engine/src/http/handle-request.ts`
10. `packages/core-engine/src/http/node.ts`（或等价 multipart 读取）
11. `packages/core-engine/src/http/session.ts`（health.ocr / health.minio）
12. `apps/web/src/views/job_upload/index.vue`
13. `apps/web/vite.config.ts`（loadEnv 无前缀 → process.env）
14. `apps/web/.env.example`
15. `packages/core-engine/test/upload-ocr.test.ts`
16. `docs/使用手册.md`
17. `packages/core-engine/src/index.ts`（导出 OcrPort、BlobStore）

另可能：`packages/core-engine/src/ocr/env.ts`。

## 风险分级

**high**：拟改动 > 8 个文件；新增对外契约 `OcrPort` / `openUploadJob`。  
未含 mcp-server / arch-engine。  
用户已批准 spec，并要求上传走 MinIO（`D:\docker_run\minio_data`）。仍为 high，进入 `/plan-from-spec`（plan 保持 draft，待「确认」后再 `/implement-plan`）。
