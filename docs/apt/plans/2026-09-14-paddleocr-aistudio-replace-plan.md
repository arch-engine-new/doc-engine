# 全部真实 OCR 替换为 PaddleOCR AI Studio Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-14-paddleocr-aistudio-replace-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component（跳过 v0 freeze 与 UI 设计 Task）
> **specRisk:** high（改动 >8 文件；红队 3 轮，material 7 已 [a] 结案，unresolved=0）

**Goal:** 删除百度智能云 OCR，全部真实识别走 PaddleOCR AI Studio 异步任务（`PaddleOCR-VL-1.6`）；CI 仍用 `FakeOcr`；有真实文字层的 PDF 用 Unicode 抽字，无文本层扫描件才打 Paddle。

**Architecture:** 保持 `OcrPort.recognize` 签名。`PaddleOcr` 在端口内提交任务、轮询、按 `line.result.layoutParsingResults[].markdown.text` 拼文并 `flattenOcrMarkdown`。`DemoHttpSession` live 装配改 `PaddleOcr.fromEnv`；health 只 GET 鉴权、禁止 POST。PDF 抽字从 latin1 括号正则改为独立 `pdf-text` 模块 + Unicode 解码依赖。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

- 范围内：替换 live OCR 适配器、扫描 PDF 改走 port、Unicode 文字层闸门、env/health/手册、L2 mock 单测。
- 非目标：新页面、新表、新 HTTP 路径、90MB 全书拆页、持久化 Paddle `jobId`、发明 DELETE/cancel、CI 强制真网、token 入库。
- 用户已提供可用 Access Token：只写入 `apps/web/.env`（gitignore），禁止出现在 commit / 日志 / Error。
- 官方 jobs API 无 cancel；超时后远端可能仍跑——错误文案必须分开 10010 vs 已有 jobId 超时。

### 1.2 设计寻址（无 UI 则写 N/A）

N/A。`projectType=component` 且 spec 明确不改冻结 9 页。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| OcrPort / OcrRecognizeInput / OcrRecognizeResult | contract | `packages/core-engine/src/ocr/port.ts` | `recognize({bytes,mime,fileName})→{text,vendor,raw?}`；本片不改签名 |
| JobPipeline.openUploadJob / recognizeUploadText / MAX_UPLOAD_BYTES | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | 今日 PDF 走 `extractPdfTextLayer` 括号正则；须改为 Unicode 闸门，失败才 `ocr.recognize` |
| BlobStore | contract | `packages/core-engine/src/blob/port.ts` | 上传落盘不变 |
| FakeOcr | arch | `query_arch` `frontend/core-engine/utils#fakeocr` → `packages/core-engine/src/ocr/fake.ts` | 内存/CI 注入；不读 Paddle env |
| parseOcrFields | arch | `query_arch` `frontend/core-engine/utils#parseocrfields` → `packages/core-engine/src/extract/ocr-fields.ts` | 仍认 `编号：` 标签行；Paddle 输出先 flatten |
| DemoHttpSession | arch | `query_arch` `frontend/core-engine/utils#demohttpsession` → `packages/core-engine/src/http/session.ts` | `baiduFromEnv` + `probeBaiduOcr` 须替换 |
| BaiduOcr / readBaiduOcrEnv | arch | `search_arch` → `packages/core-engine/src/ocr/baidu.ts`、`env.ts` | **删除**，由 Paddle 实现替换 |
| extractOcrByTemplate | arch | `packages/core-engine/src/extract/ocr-fields.ts` | 不改 |

未 `report_missing`。`PaddleOcr` / `flattenOcrMarkdown` / Unicode PDF 解码为本片新建，落点见 1.4。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/ocr/env.ts` | 改 | `readPaddleOcrEnv`；删除百度键 |
| `packages/core-engine/src/ocr/paddleocr.ts` | 新 | `PaddleOcr` + 可注入 fetch |
| `packages/core-engine/src/ocr/baidu.ts` | 删 | |
| `packages/core-engine/src/ocr/pdf-text.ts` | 新 | Unicode 抽字 + `hasUsablePdfTextLayer` + `flattenOcrMarkdown` |
| `packages/core-engine/src/ocr/port.ts` | 改 | 注释：Baidu→Paddle |
| `packages/core-engine/src/ocr/fake.ts` | 改 | 注释去掉 BAIDU_* |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | 改 | `recognizeUploadText` 接 pdf-text 模块 |
| `packages/core-engine/src/http/session.ts` | 改 | 装配与 health |
| `packages/core-engine/src/index.ts` | 改 | 导出替换 |
| `packages/core-engine/package.json` | 改 | 增加 PDF Unicode 解码依赖（`unpdf` 或 `pdfjs-dist`，实现期定一种） |
| `packages/core-engine/test/paddleocr.test.ts` | 新 | 任务状态机 / 10010 / jsonl `result` |
| `packages/core-engine/test/pdf-text.test.ts` | 新 | examples 汉字；扫描夹具走 OCR |
| `packages/core-engine/test/upload-ocr.test.ts` | 改 | 扫描夹具调用 port |
| `apps/web/.env.example` | 改 | `PADDLEOCR_*`，删 `BAIDU_OCR_*` |
| `docs/使用手册.md` | 改 | health / 扫描 PDF |
| `docs/superpowers/specs/2026-09-14-operator-corpus-kb-test-design.md` | 改 | R3/R4 已在 brainstorm 修订；实现期勿回滚 |
| `apps/web/.env` | 改（不提交） | 写入 token |

### 1.5 风险与未决项

- **high：** 文件数 >8；同步 `recognize` 最长约 `PADDLEOCR_POLL_TIMEOUT_MS`（默认 180s）。
- Unicode 解码库若抽不出 `examples/` 汉字 → Task 4 失败，须换库，不得回退括号正则。
- 官方无 cancel：超时文案含 jobId，禁止立刻重传。
- Token 已由用户提供：实现 Agent 写入 `.env` 后 `git status` 确认未 staged。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1, 2, 6, 7 | 删百度、装配 Paddle |
| R2 | must | Task 1, 7 | token 只进 `.env` |
| R3 | must | Task 2 | 协议对齐用户示例 |
| R4 | must | Task 2, 6 | 缺 token 503；CI 不打网 |
| R5 | must | Task 4, 5 | Unicode 闸门 + examples 汉字 |
| R6 | must | Task 2 | 不重试；10010 vs 超时文案 |
| R7 | must | Task 6 | health 无 POST |
| R8 | must | 全 Task | 不改 9 页/不建表/不读 90MB |
| R9 | nice | Task 2（skipIf） | live 冒烟可选 |
| R10 | must | Task 3 | flatten + parseOcrFields |
| R11 | must | Task 2 | jsonl `result` 包裹 |
| R12 | must | Task 8 | 语料 spec 已改；禁止实现回滚 |

must 均有 Task 覆盖。

---

## Part 2 — 可执行任务清单

> 每步 2–5 分钟粒度。实现时由 `/implement-plan` 按 Task 派发。不要提交 `apps/web/.env`。

### Task 1: 环境变量与删除百度配置面

- [ ] 将 `env.ts` 改为 `readPaddleOcrEnv`：`PADDLEOCR_ACCESS_TOKEN` 空→`null`；可选 `PADDLEOCR_MODEL` 默认 `PaddleOCR-VL-1.6`、`PADDLEOCR_JOB_URL` 默认 `https://paddleocr.aistudio-app.com/api/v2/ocr/jobs`、`PADDLEOCR_POLL_TIMEOUT_MS` 默认 `180000`。删除 `BAIDU_OCR_*` / `parseBaiduOcrApi` / `DEFAULT_BAIDU_OCR_API`。
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#readbaiduocrenv`
  - **Files:** `packages/core-engine/src/ocr/env.ts`
- [ ] `.env.example` 替换为 Paddle 键（可空）；删除百度两键。
  - **Files:** `apps/web/.env.example`
  - **Verify:** `rg -n "BAIDU_OCR|BaiduOcr|aip.baidubce.com" packages/core-engine/src/ocr/env.ts apps/web/.env.example` 无匹配。**Rn:** R1、R2

### Task 2: PaddleOcr 适配器（注入 fetch）

- [ ] 新建 `PaddleOcr` 实现 `OcrPort`：`Authorization: bearer <token>`；本地 multipart `file`+`model`+`optionalPayload` JSON 字符串；轮询 5s；`vendor="paddleocr-vl"`；bytes>50MB 抛中文体积错；超时/失败不二次 POST `/ocr/jobs`。
  - **MCP:** `query_contract` name=`OcrPort`
  - **Files:** `packages/core-engine/src/ocr/paddleocr.ts`, `packages/core-engine/src/ocr/port.ts`
- [ ] 单测 mock fetch：pending→running→done 且 jsonl 为 `{"result":{"layoutParsingResults":[{"markdown":{"text":"..."}}]}}`；仅顶层 `layoutParsingResults` 必须失败；HTTP 200+`code=10010` 文案含「请稍后手动重试」且**不含**「远端仍在执行」；超时文案含 `jobId` 与「请勿立即重复提交」；`fromEnv` 无 token 为 null。
  - **Files:** `packages/core-engine/test/paddleocr.test.ts`
  - **Verify:** `npm test -w core-engine -- paddleocr` 全绿且无真实 aistudio 请求。**Rn:** R3、R4、R6、R11

### Task 3: flattenOcrMarkdown 接硬抽取

- [ ] 实现 `flattenOcrMarkdown`（去 `#`、`*`/`_`、表格 `|`）。Paddle `recognize` 成功路径在返回前调用。
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#parseocrfields`
  - **Files:** `packages/core-engine/src/ocr/pdf-text.ts`（或 `paddleocr.ts` 旁小模块，最终与 Task 4 同文件亦可）
- [ ] 夹具：`# 表\n**编号：** SH-002\n日期A：2026-08-20\n日期B：2026-08-01` flatten 后 `parseOcrFields` 得到三字段。
  - **Files:** `packages/core-engine/test/paddleocr.test.ts`
  - **Verify:** 上述用例在 `npm test -w core-engine -- paddleocr` 中通过。**Rn:** R10

### Task 4: Unicode PDF 文字层（禁止括号乱码）

- [ ] 增加解码依赖（`unpdf` 或 `pdfjs-dist`，选一种能抽出 `examples/` 汉字者）。导出 `extractPdfUnicodeText` / `hasUsablePdfTextLayer`（汉字≥8 或（`\p{L}`≥40 且汉字≥1））。删除生产路径对旧 `extractPdfTextLayer` 的调用。
  - **Files:** `packages/core-engine/package.json`, `packages/core-engine/src/ocr/pdf-text.ts`
- [ ] 对 `examples/` 至少 1 份真实 PDF 断言汉字≥8；合成无文本层夹具断言闸门 false。
  - **Files:** `packages/core-engine/test/pdf-text.test.ts`
  - **Verify:** `npm test -w core-engine -- pdf-text`；失败则换库，**禁止**回退 latin1 括号正则。**Rn:** R5

### Task 5: 接入 JobPipeline

- [ ] `recognizeUploadText`：PDF 过闸门 → `{text, vendor:"pdf-text"}`；否则 `ocr.recognize`。JPEG/PNG 仍 OCR。失败仍 `ocr_error`。
  - **MCP:** `query_contract` name=`JobPipeline`
  - **Files:** `packages/core-engine/src/pipeline/job-pipeline.ts`, `packages/core-engine/test/upload-ocr.test.ts`
- [ ] 无文本层 PDF + spy `OcrPort`：`recognize` 被调用；`examples/` 真实 PDF + FakeOcr：不调用 `recognize`（文字层命中）。
  - **Verify:** `npm test -w core-engine -- upload-ocr`。**Rn:** R5、R8

### Task 6: DemoHttpSession 装配与 health

- [ ] `resolveUploadDeps` live 使用 `PaddleOcr.fromEnv`；缺 MinIO 或缺 token → `UploadServiceUnavailableError`（文案提 PaddleOCR token，不提百度）。memory 仍 `FakeOcr`。
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#demohttpsession`
  - **Files:** `packages/core-engine/src/http/session.ts`
- [ ] `probePaddleOcr`：无 token=`skip`；GET `{JOB_URL}/__health_probe`（或随机不存在 jobId）；**函数体内不得出现 `method: "POST"`**；401/403=`fail`；404=`ok`。
  - **Verify:** `rg -n "BaiduOcr|baiduFromEnv|probeBaidu|aip.baidubce.com" packages/core-engine/src` 无匹配；`npm test -w core-engine -- http-adapter` 内存 health `ocr=skip` 仍绿。**Rn:** R1、R4、R7

### Task 7: 导出、手册、本地 env（不提交密钥）

- [ ] `index.ts` 导出 `PaddleOcr` / `readPaddleOcrEnv` / `paddleOcrFromEnv`；删除百度导出。
  - **Files:** `packages/core-engine/src/index.ts`, `packages/core-engine/src/ocr/fake.ts`, `docs/使用手册.md`
- [ ] 将用户已提供的 token 写入 `apps/web/.env` 的 `PADDLEOCR_ACCESS_TOKEN`（及默认 model/url 注释）。**不要 git add 该文件。**
  - **Files:** `apps/web/.env`（gitignore）
  - **Verify:** `git diff --cached -- apps/web/.env` 为空；`rg -n "BAIDU_OCR|BaiduOcr|aip.baidubce.com" packages/core-engine/src apps/web/.env.example docs/使用手册.md` 无匹配。**Rn:** R1、R2、P9

### Task 8: 语料 spec 口径锁定

- [ ] 确认 `docs/superpowers/specs/2026-09-14-operator-corpus-kb-test-design.md` R3=`vendor=pdf-text` 且抽出汉字≥8；R4=`rules/` 超 4MB `UploadValidationError`。实现不得把 examples 改回「必须 OCR」或「括号 length≥3 即成功」。
  - **Files:** `docs/superpowers/specs/2026-09-14-operator-corpus-kb-test-design.md`
  - **Verify:** 读 R3/R4 与本 plan 1.6 R12 一致。**Rn:** R12

### Task 9: 包级回归

- [ ] `npm test -w core-engine` 全绿；`npm run typecheck -w core-engine`（或仓库等价命令）通过。
  - **Files:** （本 Task 不新增生产文件）
  - **Verify:** 上述命令 exit 0。**Rn:** R4、R8
