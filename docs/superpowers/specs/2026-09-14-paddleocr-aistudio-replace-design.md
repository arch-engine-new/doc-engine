---
title: 全部真实 OCR 替换为 PaddleOCR AI Studio 在线任务
date: 2026-09-14
status: draft
risk: high
phase: spec_pending_approval
topic: paddleocr-aistudio-replace
mode: apt-auto-brainstorm
feature: core-engine
redteam:
  rounds: 3
  material: 7
  resolved: 7
  user: 0
  unresolved: 0
---

# Design Spec: 全部真实 OCR 替换为 PaddleOCR AI Studio

## Goal

把本仓**所有真实 OCR 调用**从百度智能云 `aip.baidubce.com`（`BaiduOcr` / `BAIDU_OCR_*`）换成用户给定的 **PaddleOCR 官方在线任务 API**（`https://paddleocr.aistudio-app.com/api/v2/ocr/jobs`，模型 `PaddleOCR-VL-1.6`）。CI / 内存模式继续 `FakeOcr`，禁止静默假文本。操作员真上传的 JPEG/PNG **以及无文字层的扫描 PDF** 都走这条线；下游 `parseOcrFields` / DSL / 标准检索不变。

成功标准：源码与 `.env.example` 不再出现 `BAIDU_OCR_*` / `BaiduOcr`；live 配 `PADDLEOCR_ACCESS_TOKEN` 时 health `ocr=ok`；**有真实文字层的 PDF**（含仓库 `examples/*.pdf`）走 Unicode 抽字 `vendor=pdf-text`；**无文本层扫描件**走 Paddle 任务；缺 token 的真上传 503；单测不打真实网。

## 澄清（全自动自答）

`.apt/goal.md` 存在，按全自动 brainstorming。用户原话：所有 OCR 都用 AI Studio 这条在线接口；并给出可运行示例（`JOB_URL`、token、`MODEL=PaddleOCR-VL-1.6`、multipart 本地文件 / JSON `fileUrl`、轮询 `jobId`、从 `resultUrl.jsonUrl` 的 jsonl 抽 `markdown.text`）。用户本轮指令是 **`/apt-auto-brainstorm` 并据此写出实现计划**。

1. **厂商？** 只用 PaddleOCR AI Studio。删除智能云 `general_basic`/`accurate_basic`。不留双厂商开关。
2. **凭证？** 单一 Access Token，环境变量 `PADDLEOCR_ACCESS_TOKEN`，写入 `apps/web/.env`（已 gitignore），**禁止**写入 spec / plan / git / 日志 / Error。请求头与示例一致：`Authorization: bearer <token>`。
3. **模型？** 默认 `PaddleOCR-VL-1.6`；可用 `PADDLEOCR_MODEL` 覆盖。optionalPayload 与示例一致：`useDocOrientationClassify/useDocUnwarping/useChartRecognition` 均为 false。
4. **没配 token？** 夹具 `POST /api/jobs/fixture` 不变。live 真上传缺 MinIO 或缺 token → **503**，禁止 FakeOcr。health：无 token = `ocr=skip`。
5. **PDF？** 用 **Unicode 解码器**判定文字层，废弃 latin1 括号正则当生产闸门。解码后的文本若「汉字 ≥ 8 或（字母类字符 ≥ 40 且汉字 ≥ 1）」→ 本地 `vendor=pdf-text`（`examples/*.pdf` 用 pypdf 可抽出数百汉字，必须走这条，禁止把乱码当正文）。解码为空或达不到阈值 → `OcrPort`（真扫描件）。禁止用「`BT` 子串或拉丁词 ≥ 8」——二进制括号汤会误中。Job 仍 4MB；官方本地上传 50MB 由适配器二次闸。
6. **90MB 法规全书？** 本片**不**把超限 PDF 塞进 Job，也不新做拆页服务。标准库仍吃 `ingest(text)`。全书 OCR 是后续片。
7. **UI？** 不改 9 页信息架构，不加第 10 页。
8. **CI？** 默认不打 `paddleocr.aistudio-app.com`。适配器用注入 `fetch` 的契约测试覆盖任务生命周期。

## 范围

1. 用 `PaddleOcr` 实现现有 `OcrPort.recognize({ bytes, mime, fileName }) → { text, vendor, raw? }`。`vendor` 固定 `"paddleocr-vl"`。轮询藏在 `recognize` 内，不改 HTTP 上传契约、不新建账本表、不把 jobId 暴露给前端。
2. 删除 `BaiduOcr`、`readBaiduOcrEnv`、`BAIDU_OCR_*`、`DEFAULT_BAIDU_OCR_API`。`packages/core-engine/src/index.ts` 与 `DemoHttpSession.resolveUploadDeps` / health probe 全部改接 Paddle。
3. `recognizeUploadText`：PDF 未过可用文字层闸门 → `ocr.recognize`；过闸门 → 本地抽字；JPEG/PNG → `ocr.recognize`。失败仍 `ocr_error`。**客户端禁止自动重试**。官方 jobs API（SDK `get_status` only）**无 cancel**；超时不得假装远端已停。
4. `apps/web/.env.example`：`PADDLEOCR_ACCESS_TOKEN=`（可空）；可选 `PADDLEOCR_MODEL`、`PADDLEOCR_JOB_URL`、`PADDLEOCR_POLL_TIMEOUT_MS`。删除百度两键。
5. `docs/使用手册.md` 同步 env / health / 扫描 PDF 行为。
6. 单测：FakeOcr 路径保持绿；Paddle 适配器 mock HTTP；扫描 PDF 夹具证明会调用 `OcrPort`。

## 非目标

- 资料云实挂、组卷提交、新 Vue 路由、公路/水利/房建预置包。
- 把 `OcrPort` 改成带进度回调的异步端口，或把 Paddle `jobId` 写入 `t_job`。
- 本地 RapidOCR / onnxruntime / 智能云 OCR 并存。
- 对 `rules/` 约 90MB 扫描件做拆页上传或 URL 托管。
- 改 `parseOcrFields` / DSL / `StandardLibrary.ingest` 签名。
- CI 强制外网打 Paddle；把 token 写进仓库。
- Agent 持 OCR 客户端。
- 新对外 HTTP 路径（上传仍 `POST /api/jobs/upload`）。

## 验收标准

| ID | 通过标准 |
|----|----------|
| P1 | `packages/core-engine/src` 与 `apps/web/.env.example` 无 `BAIDU_OCR`、`BaiduOcr`、`aip.baidubce.com`（手册历史段落可改写，不得再指导配置百度 AK/SK）。 |
| P2 | live 缺 `PADDLEOCR_ACCESS_TOKEN` 或缺 MinIO 的真上传返回 503，不写假 OCR。内存模式夹具与 `FakeOcr` 单测仍绿。 |
| P3 | 配 token 时 health：用**不创建 OCR 任务**的鉴权探测，成功 `ocr=ok`，401/403 `ocr=fail`，未配置 `ocr=skip`。探测不得 POST `/ocr/jobs`。 |
| P4 | JPEG/PNG live 路径：`PaddleOcr.recognize` POST multipart（`file` + `model` + `optionalPayload` JSON 字符串）→ 轮询 GET `{JOB_URL}/{jobId}` → `state=done` 后 GET `jsonUrl`。jsonl **每行**解析为 `JSON.parse(line).result.layoutParsingResults[].markdown.text`（必须走 `result` 包裹，禁止按顶层 `layoutParsingResults` mock 假绿）。拼接后经 `flattenOcrMarkdown`（去掉 `#` 标题标记、`*`/`_` 强调、表格 `|`）再写入 `ocr_text`。 |
| P5 | PDF **Unicode 解码失败或达不到可用阈值** → `OcrPort`；解码达标 → `vendor=pdf-text`，文本须含可读汉字/字母，禁止现行括号乱码。L2：对 `examples/` 至少 1 份真实 PDF，新解码器抽出汉字 ≥ 8 且 `vendor==="pdf-text"`（不调用 OCR）；另备无文本层的最小扫描夹具（无 ToUnicode/无 Tj 汉字）断言调用 `recognize`。禁止把 `latin1` 括号函数或「`includes("BT")`」当闸门。 |
| P6 | 三类失败文案必须分开，且客户端都不自动重试：**(a) 提交未被接受**（HTTP≠200，或 `code=10010`/`12002`/429）：无「远端仍在执行」，无 jobId 不捏造，中文「队列繁忙或限流，请稍后手动重试」。其它非 0 `code` 用厂商 `msg`。**(b) 已有 jobId 后超时 / `state=failed`**：含 `jobId` + 「远端可能仍在执行，请勿立即重复提交」。**(c) jsonl 空文本**：见 P7。不调用未文档化 DELETE。L2 必须覆盖「HTTP 200 + `code=10010`」。 |
| P7 | 适配器单测用注入 fetch 覆盖：pending→running→done、failed、非 200、缺 `result` 包裹、jsonl 无 markdown 文本（抛错不编造）、`flattenOcrMarkdown` 后 `parseOcrFields` 仍能抽出 `编号`/`日期A`/`日期B`（夹具为 VL 风格 markdown 包裹标签行）。默认 `npm test -w core-engine` 不访问 aistudio。 |
| P8 | 对话仍不能改 Job.status / 写 Receipt / publish。DSL R2 倒置日期仍 blocking。 |
| P9 | Token 不出现在 git diff、日志、抛错文案。 |

## 设计

### Architecture

保留 `OcrPort` 装配点：memory → `FakeOcr`；live → `PaddleOcr.fromEnv()`。`PaddleOcr` 把官方**异步任务**封装成现有同步 `recognize`：提交 → 每 5s 轮询 → 拉 jsonl → 拼 markdown。`JobPipeline.openUploadJob` 仍一次 HTTP 请求内等 OCR 结束（与今日百度同步调用同一形态）。超时默认 180s（`PADDLEOCR_POLL_TIMEOUT_MS`），避免无限挂死 Vite 代理。

官方约束（用户示例 + 公开文档）：本地文件 ≤50MB、URL 文件 ≤200MB、PDF 最多约 1000 页。本引擎 Job 已 4MB 闸门，适配器对 `bytes.length > 50 * 1024 * 1024` 直接抛中文错误。本片只用 **Local File Mode**（bytes 已在进程内）；不实现 `fileUrl` 模式，除非后续片要吃超 50MB 对象。

### Components

| 组件 | 职责 |
|------|------|
| `readPaddleOcrEnv` | 读 `PADDLEOCR_ACCESS_TOKEN`；空 → `null`。可选 model / jobUrl / pollTimeoutMs。token 永不进返回值以外的字符串拼接到日志。 |
| `PaddleOcr` | `OcrPort` live 实现；可注入 `fetch` 供单测。 |
| `hasUsablePdfTextLayer` / Unicode PDF 抽字 | **新依赖**（`unpdf` 或 `pdfjs-dist`，实现期定一种）解码页面文本。阈值：汉字 ≥ 8，或（`\p{L}` ≥ 40 且汉字 ≥ 1）。不合格 → OCR。禁止 latin1 括号正则与「拉丁词 ≥ 8」。 |
| `flattenOcrMarkdown` | 仅对 Paddle 返回文本：去 markdown 标记，保留「编号：」「日期A：」等标签行给 `parseOcrFields`。不改 `parseOcrFields` 正则契约。 |
| `FakeOcr` | 不变。 |
| `recognizeUploadText` | PDF 过闸门才本地抽字，否则 OCR。 |
| `probePaddleOcr` | health；见错误处理。 |
| `parseOcrFields` | 不改签名与标签语义。 |

### Data flow

```
JPEG/PNG bytes --PaddleOcr.recognize--> POST /api/v2/ocr/jobs (multipart)
PDF Unicode 解码达标 --pdf-text--> vendor=pdf-text（不打网）
PDF 解码失败/低于阈值 --PaddleOcr.recognize--> 同 JPEG 路径

POST 200 → data.jobId
loop GET /api/v2/ocr/jobs/{jobId}  (Authorization: bearer …)
  pending | running → sleep 5s（超时则抛，文案含 jobId，不 cancel）
  failed → throw errorMsg
  done → GET resultUrl.jsonUrl（按示例不带 token）
       → 逐行 JSON.parse(line).result.layoutParsingResults[].markdown.text
       → flattenOcrMarkdown
       → { text, vendor: "paddleocr-vl", raw: { jobId, extractedPages } }

JobPipeline → insertExtraction.ocr_text → parseOcrFields → DSL
```

`optionalPayload`（与用户示例一致）：

```json
{
  "useDocOrientationClassify": false,
  "useDocUnwarping": false,
  "useChartRecognition": false
}
```

multipart 字段：`model`、`optionalPayload`（`JSON.stringify`）、`file`。

### Error handling

| 情况 | 行为 |
|------|------|
| 未配 token 的 live 上传 | `UploadServiceUnavailableError` 503，文案改为同时要求 MinIO 与 PaddleOCR token，不回退 Fake |
| POST HTTP≠200，或 HTTP 200 且业务 `code=10010`，或 HTTP 429/`code=12002` | 抛「队列繁忙或限流，请稍后手动重试」；无 jobId 不捏造；文案**不含**「远端仍在执行」；不重试 |
| POST HTTP 200 且 `code` 为其它非 0 | 抛厂商 `msg`（无 token）；不含「远端仍在执行」；不重试 |
| `state=failed` 或已有 jobId 后轮询超时 | 抛 `errorMsg` 或超时中文 + `jobId` + 「远端任务可能仍在执行，请勿立即重复提交同一文件」。不调用未文档化 DELETE |
| jsonl 缺 `result` 或无 markdown 文本 | 抛「PaddleOCR 未返回可抽取文本」；禁止用空串当成功 |
| 文件 >50MB（适配器） | 抛体积错误；Job 层 4MB 仍先挡 |
| health 无 token | `skip` |
| health 有 token | GET `{JOB_URL}/__health_probe`（或任意不存在的 jobId）。**禁止 POST 创建任务**。401/403 → `fail`；能证明请求已被接受（404 / 业务 JSON 且非未授权）→ `ok`；网络失败 → `fail` |
| 额度/限流 | 映射为失败中文，不重试（与旧百度 17/18 同一 fail-closed 纪律） |

### Testing

证据阶梯（镜 2/4）：

- **L1 形状（不足以为验收主体）**：grep 无 `BAIDU_OCR` / `BaiduOcr`。可作 P1 的一部分，不能单独代表 OCR 可用。
- **L2 行为（must）**：注入 fetch 的任务状态机（含 `result` 包裹与 HTTP 200+`code=10010`）；`examples/` 真实 PDF Unicode 抽字汉字 ≥ 8 且不调用 OCR；无文本层扫描夹具调用 port；缺 env `fromEnv()===null`；health 探测 mock 401 vs 404；VL markdown 夹具经 flatten 后 `parseOcrFields` 得到编号与两个日期。`upload-ocr.test.ts` 现有 FakeOcr / ocr_error 保持。
- **L3 真网（nice）**：`describe.skipIf(!process.env.PADDLEOCR_ACCESS_TOKEN)` 对最小 JPEG 跑一次。失败不挡默认 CI。

**为什么最贵的真机制（每条 CI 打 PaddleOCR-VL）不是默认：** 要真实 token、计费/额度、且 VL 模型慢；本片要替换的是适配器契约与扫描 PDF 路由，L2 mock 生命周期已能判定。L3 仅 opt-in。

## 方案比较

机制类：条文 / 静态闸门 / 行为证据 / 流程重组。候选跨 ≥2 类。

### Option 1 — 只改手册（条文类）

写「以后用 Paddle」。代码仍打 `aip.baidubce.com`。

- Trade-off：零风险，零效果。
- 隐藏成本：操作员按手册配 token 却走百度。
- 失败模式：用户明示「全部替换」未发生。
- **否决。**

### Option 2 — 环境开关双厂商（静态闸门类）

`OCR_VENDOR=baidu|paddle`。

- Trade-off：可回滚；违背「全部替换」。
- 隐藏成本：两套探针、两套错误码、永久双栈。
- 失败模式：默认仍百度，Paddle 从未被走到。
- **否决**（用户明示全替换）。

### Option 3 — `OcrPort` 适配器替换 + 扫描 PDF 改走 port（行为证据类，推荐）

删除百度实现；`PaddleOcr` 实现 `OcrPort`；无文字层 PDF 调用 `recognize`；health 做鉴权探测而非「有 env 即 ok」。

- Trade-off：HTTP 上传线程会阻塞在轮询上（与今日同步百度同类）；4MB 文件通常可接受。
- 隐藏成本：VL 模型比 `general_basic` 慢；jsonl schema 若厂商变更，L2 单测会红。
- 失败模式：health 误 POST 创建任务烧额度；缓解：P3 禁止 POST。轮询挂死；缓解：超时。把空 markdown 当成功；缓解：P6/P7。括号抽字把扫描件当 pdf-text；缓解：可用文字层闸门 + examples 实文件 L2。VL markdown 抽不出字段；缓解：flatten + 夹具。超时仍占远端队列；缓解：错误含 jobId 且禁止立刻重传，不发明 cancel。
- 依赖（查证）：`query_contract(OcrPort)` 签名已存在；`JobPipeline.recognizeUploadText` 今日对扫描 PDF throw；`DemoHttpSession.resolveUploadDeps` 装配 `baiduFromEnv`。

### Option 4 — 流水线持久化 Paddle jobId（流程重组类）

`t_job` 增列、前端轮询进度、Worker 拉结果。

- Trade-off：适合 259 页全书；相对 4MB 上传过重。
- 隐藏成本：新列/迁移，接近新数据模型。
- 失败模式：本片范围膨胀，9 页被加进度条。
- **本片否决。** 全书 OCR 若要做，另开 spec。

### 推荐项锁定

推荐 **Option 3**。

**为什么最贵的真机制（Option 4 持久化异步任务 + 全书拆页）不是默认：** 用户本轮要的是「项目里的 OCR 全部换成这条在线 API」，不是新建异步中台。现有 `openUploadJob` 已是同步 HTTP；4MB 闸门使 Option 4 的进度 UI 没有对应流量。最贵档服务的是 90MB 法规 Troops，已标非目标。

**最强反方：**「把异步 VL 任务塞进同步 `recognize` 是形状合格、行为会炸：health 自报 token 存在、扫描 PDF 4MB 上限让『全部 OCR』名不副实、空 markdown 仍能让 Job checking。」

**回应：** P3 禁止用「有 env」当 ok，必须鉴权探测且禁止 POST；P5 只承诺 Job 闸门内的扫描件，90MB 明确非目标而非假装已覆盖；P6/P7 空文本失败。攻击指出的是必须写进验收的失败模式，未推翻 Option 3；Option 4 才能吃全书，但那是另一需求。攻击后推荐仍成立。

## Ontology detection

| 调用 | 结果 | 复用决策 |
|------|------|----------|
| `query_project_status` | phase=pm_spec；先前 activeSpec 为操作员语料测试 | 本片替换 OCR 厂商，不继承「扫描件必须 upload 失败」为产品行为（那是语料测试 Troops 隔离，见风险） |
| `query_ontology()` | 有 `OcrPort`、`OcrRecognizeInput/Result`、`JobPipeline`、`BlobStore` | 复用端口与流水线 |
| `query_ontology(OCR)` | `BaiduOcr`、`readBaiduOcrEnv`、`FakeOcr`、`parseOcrFields` | **删除**百度三件套；**复用** FakeOcr + parseOcrFields |
| `query_contract(OcrPort)` | `recognize(bytes,mime,fileName)→{text,vendor,raw?}` | 复用，不改签名 |
| S3 缺口 | 扫描 PDF 从未进入 `OcrPort`；百度只收 JPEG/PNG base64 | 用 pipeline 改路由填洞，不 `report_missing` 新契约 |
| 设计页 | 本片无 UI 改动 | 不 `query_design` 页面配方；不 `report_design_gap` |

## 追问记录

模式：全自动（`.apt/goal.md` 存在）。红队册：`C:\Users\weilt\.apt\templates\_redteam-patterns.md`。

### 轮次：2 轮后收敛（第 2 轮无新实质发现）

### 步骤 3 澄清（自问自答，含册外）

1. **目的（镜 5）**：换厂商还是加并行 OCR？→ **全部真实 OCR 只留 Paddle**。来源：用户明示。
2. **成功证据（镜 2/4）**：认 grep 无百度，还是认任务生命周期？→ **行为**：mock 状态机 + 扫描 PDF 走 port + health 鉴权探测。grep 只作 P1 辅助。
3. **不可砍项（镜 3）**：砍掉「删除百度 + 扫描 PDF 进 OcrPort」则未满足「全部 OCR」。
4. **自证（镜 1）**：health 能否「有 token 即 ok」？→ 不能；禁止 POST 创建任务的探测。
5. **册外**：示例 token 能否写进 spec？→ **不能**。只写 env 名。
6. **册外**：90MB 法规是否本片必须 OCR？→ 否，超 Job 4MB 与官方 50MB 本地上限；用户本轮指令是替换 OCR，不是法规 Troops。

需求初稿 v1：目的=替换全部真实 OCR 为 AI Studio 任务 API；角色=操作员真上传 + 开发者 CI；边界=OcrPort 内替换 + 扫描 PDF 改路由；非目标=全书拆页/新表/新页面；成功=P1–P9。

### 第 1 轮 S1–S4

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 场景 | 谁在何种文件上走 OCR？空配置/并发？ | 操作员 `job_upload`：图 + 扫描 PDF。内存 FakeOcr。并发=每次 recognize 独立 jobId。空 token=503。 |
| S2 破坏 | 什么让「全部替换」没价值？ | 双栈开关、health 自报、扫描 PDF 仍赶去导出 JPEG。一半时保：删百度 + 扫描件进 port。YAGNI：不持久化 jobId。 |
| S3 可行 | 契约能否支撑？ | 能：`OcrPort` 已是 Promise。不能：百度接口形态（同步 base64 vs 异步任务）必须新适配器。证据：`baidu.ts`、`recognizeUploadText` 963–1004 行。 |
| S4 验收 | 可否判定？ | mock fetch 状态机；grep 无百度；PDF 无文字层 spy `recognize`；health 不 POST。 |

**v1→v2：** 写死 Local File Mode、禁止 health POST、文字层 PDF 不算 OCR。

### 第 2 轮 S1–S4

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | GET jsonl 是否带 token？示例未带。 | 按示例不带；若 401 再失败，不默默重试带 token（避免把 token 打进查询串）。 |
| S2 | 与 2026-09-14 语料 spec R4「扫描件 upload 必须失败」冲突？ | 产品行为改为可 OCR；语料测试若仍断言失败需改夹具（超 4MB 的 `rules/` PDF 仍失败）。本片不实现 90MB。 |
| S3 | 4MB 扫描 PDF 官方是否接受？ | 远小于 50MB。适配器仍留 50MB 闸。 |
| S4 | L3 live 测是否 must？ | 否，nice。must 是 L2。 |

第 2 轮无新实质发现（冲突澄清写入风险，不改推荐方案）。**收敛。**

### 需求修订 delta

- v1：换 Paddle、删百度。
- v2：health 禁 POST；文字层 PDF 本地抽字；扫描 PDF 进 port；token 不入库。
- v3（红队 round1 回卷）：可用文字层闸门替换括号 `length>=3`；jsonl 锁 `result` 包裹；`flattenOcrMarkdown`；超时不发明 cancel、错误含 jobId；语料 spec R4 改「超限全书失败」而非「任何扫描件失败」。

### 第 3 轮 S1–S4（红队 material 回卷，需求已修订）

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 操作员真实扫描件是谁？ | 仓库 `examples/*.pdf`：无 BT、0 汉字、括号抽字却上万字节乱码。主路径必须 OCR。 |
| S2 | 只 grep `/BT` 够不够？ | 不够，红队已证无 BT 仍被旧函数判有字。必须 `hasUsablePdfTextLayer`。 |
| S3 | flatten 是否新契约？ | 否，纯字符串，`parseOcrFields` 签名不变。 |
| S4 | 语料 R4 怎么可判定？ | `rules/` 体积 >4MB → `UploadValidationError`；小扫描件 live 走 OCR / 内存 FakeOcr 允许成功 Job。 |

### 红队轮留痕

**Round 1 material 原文结案（[a] 设计 delta，禁止 prose 反驳）：**

| # | 原文攻击（摘要） | 结案 |
|---|------------------|------|
| M1 | 括号抽字让 examples 永不进 Paddle | [a] 初版公式失败（r2）。**r2 D1：** Unicode 解码器 + examples 必须抽出汉字走 pdf-text；无文本层夹具才 OCR；废弃拉丁词≥8 |
| M4 | 超时不取消远端仍烧额度 | [a] D4 无 cancel。**r2 D2：** 10010/429 与超时文案分离；L2 覆盖 HTTP 200+code=10010 |
| M2 | VL markdown 抽不出编号日期 | [a] D2：`flattenOcrMarkdown` + R10 夹具 |
| M3 | jsonl 顶层 vs `result` 包裹 | [a] D3：P4/R11 锁官方路径 |
| M5 | 语料 R4 冲突未入改动清单 | [a] D5：R12 + 修订语料 spec R3/R4（examples 真文字层 pdf-text；全书超限失败） |

### 残留问题

无强制收敛残留。远端超时无法 cancel 为已写入 R6 的接受项（官方 API 无该能力）。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | 真实 OCR 只走 PaddleOCR AI Studio 任务 API，删除智能云百度 OCR | 用户明示 | P1：源码与 `.env.example` 无 `BAIDU_OCR`/`BaiduOcr`/`aip.baidubce.com`；live 装配 `PaddleOcr.fromEnv` | must |
| R2 | 凭证仅为 Access Token，不进 git/日志 | 用户明示 | P9 + `.gitignore` 已含 `apps/web/.env`；错误信息不含 token 子串 | must |
| R3 | 默认模型 `PaddleOCR-VL-1.6`，协议对齐用户示例（bearer、multipart、轮询、jsonl markdown） | 用户明示 | P4 + L2 单测断言 POST URL、header 前缀 `bearer `、form 含 model 与 file | must |
| R4 | 缺 token 不静默 Fake；CI 不打网 | 追问确认（沿用旧 fail-closed） | P2、P7 | must |
| R5 | PDF 用 Unicode 解码判定文字层：`examples/` 走 pdf-text（须抽出汉字）；无文本层扫描夹具走 OcrPort | 追问确认 + 红队 r1 D1 + r2 D1 | P5：examples 至少 1 份 `vendor==="pdf-text"` 且抽出汉字 ≥ 8；无文本层夹具 spy `recognize`；生产路径不得再调用旧括号 `extractPdfTextLayer` | must |
| R6 | 客户端不自动重试；提交失败与轮询超时文案分离；空文本不算成功；不假装已取消远端 | 追问确认 + 红队 r1 D4 + r2 D2 | P6：10010 夹具文案无「远端仍在执行」；超时夹具文案含 jobId 与「请勿立即重复提交」；无第二轮 POST jobs | must |
| R7 | health 鉴权探测且不创建任务 | 追问确认（镜 1） | P3：probe 实现无 `method: "POST"` | must |
| R8 | 不改 9 页、不新建表、不 OCR 90MB 全书 | 用户本轮范围 + goal 冻结页 | 无新路由；无 migration；不读 `rules/` 大 PDF 进 Job | must |
| R9 | 可选 live 真网冒烟 | AI 假设未确认 | skipIf 无 token | nice |
| R10 | VL markdown 经 flatten 后硬抽取标签仍可用 | 红队 round1 D2 | P7：夹具 markdown 含 `#`/`**编号：**`/`日期A：` 表格行，flatten 后 `parseOcrFields` 得到与 FakeOcr 同类三字段 | must |
| R11 | jsonl 按官方 `line.result.layoutParsingResults` 解析 | 红队 round1 D3 | P4：mock 仅顶层 layoutParsingResults 必须失败；带 `result` 包裹必须成功 | must |
| R12 | 同步修订语料 spec：全书超限失败；examples 用 Unicode 抽字成功且 vendor=pdf-text（文本含汉字），不得把括号乱码当成功 | 红队 r1 D5 + r2 D1 | 更新语料 spec R3/R4 | must |

## 风险

- **high（文件数）**：预计改动 >8 个文件（env、paddleocr 新文件、删除 baidu、port 注释、pipeline、session、index、example env、手册、≥2 测试文件）。
- jsonl schema 漂移 → L2 锁当前示例字段；厂商变更时测试红而不是静默空串。
- 同步轮询阻塞 HTTP → 180s 超时；不在本片引入队列。
- 官方 jobs API 无 cancel：超时后远端可能继续跑。R6 只保证客户端不重试 + 操作员文案，不保证厂商停表。
- 用户已提供可用 token：实现期只写入 `apps/web/.env`，审查 diff 时确认未暂存。

## 拟改动文件（>8，故 risk=high）

1. `packages/core-engine/src/ocr/env.ts`
2. `packages/core-engine/src/ocr/paddleocr.ts`（新）
3. `packages/core-engine/src/ocr/baidu.ts`（删）
4. `packages/core-engine/src/ocr/port.ts`
5. `packages/core-engine/src/ocr/fake.ts`
6. `packages/core-engine/src/pipeline/job-pipeline.ts`
7. `packages/core-engine/src/http/session.ts`
8. `packages/core-engine/src/index.ts`
9. `packages/core-engine/test/paddleocr.test.ts`（新）
10. `packages/core-engine/test/upload-ocr.test.ts`
11. `apps/web/.env.example`
12. `docs/使用手册.md`
13. `docs/superpowers/specs/2026-09-14-operator-corpus-kb-test-design.md`（修订 R4）
14. `packages/core-engine/package.json`（新增 PDF Unicode 解码依赖）
15. `packages/core-engine/src/ocr/pdf-text.ts`（解码 + 闸门，从 pipeline 拆出以便单测）

实现期另写 `apps/web/.env`（不提交）。
