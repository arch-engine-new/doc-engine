---
title: 操作员法规语料入库与样例资料行为测试
status: approved
date: 2026-09-14
risk: low
feature: core-engine
---

# 操作员法规语料入库与样例资料行为测试

## Goal

把仓库里**操作员自带**的 `rules/` 法规 PDF 切成条款写入标准库知识库，并用 `examples/` 下真实工程资料 PDF 跑通「上传 → 抽字 → Job → 检索挂条」的**引擎行为测试**。证明的是空引擎能消化操作员语料，而不是产品预置公路规范包，也不是「桩基评定打分专业正确」。

## 范围

- 复用现有 `StandardLibrary.ingest` / `splitClauses` / `searchStandard` / `attachHit` / `JobPipeline.openUploadJob`。
- `rules/`：法规全书经 OCR/抽字后按条款标题切分入库（`clause_id` = `${version_id}:${clauseNo}`）。
- `examples/`：6 份桩基检验/交工 PDF 作为 Job 上传夹具（走已有 PDF 文字层抽取）。
- CI 默认证据：内存端口（`MemoryVectorStore` / `MemoryGraphStore` / `HashEmbeddings` / `FakePrequery`）上的可判定行为测试。
- 全书法册 OCR 为 **opt-in 脚本**，不进默认 CI。

## 非目标

- 不把公路/水利/房建规范包写入产品 seed / 默认文案（style.md 与 `rejectIndustrySpecPackName` 已禁 pack 名含「公路|水利|房建」）。
- 不新增第 10 页；不改冻结 9 页信息架构。
- 不验收「JTG F80/1 评得对不对」、不写行业 DSL 规则包。
- 不把 90MB 扫描件法规 PDF 塞进 `openUploadJob`（4MB 上限 + 无文字层会抛「扫描件 PDF 无法本地抽字」）。
- 不新增对外 HTTP 契约；标准入库仍走现有 `POST /api/standards/ingest` 的 `text` 字段。
- 默认 CI 不打真实 Qdrant / Neo4j / 百度 OCR。

## 现状与约束（查证）

| 事实 | 证据 |
|------|------|
| 入库契约吃 **text** 不吃 PDF 字节 | `query_contract(StandardLibrary)`：`IngestStandardInput.text`；`POST /api/standards/ingest` 同样 `requireStr(..., "text")` |
| 切分按行首 `第N条` / `N.N`，非 512 token 窗 | `packages/core-engine/src/retrieve/split.ts`；`clause-split.test.ts` |
| 现有 RAG 单测是请假夹具，禁止公路字样 | `standard-rag.test.ts` 文件头 |
| 样例 PDF 有文字层；法规 PDF 259 页几乎无文字层 | pypdf 探测：法规首页 3 页 `chars≈2`；样例首页约 1.8k–2.1k 字符 |
| 法规 PDF ≈90MB；上传闸门 4MB | `MAX_UPLOAD_BYTES`；`Get-ChildItem` Length |
| 扫描 PDF 上传会失败而非静默垃圾文本 | `extractPdfTextLayer` 返回 null → throw |
| 标准库页逻辑已要求「用户自己的标准 PDF」 | `query_design(page=standard_lib)` |
| 上传页走 Job 状态机 | `query_design(page=job_upload)` |
| 全局 style 禁止预置公路规范包 | `query_design(scope=global)` style.md |

## 设计

### Architecture

语料分两 Troops，不混用一条管道：

1. **法规 Troop（知识库）**：`rules/*.pdf` →（OCR 或人工摘录）→ `text` → `ingestStandard` → `t_standard_doc` / `t_standard_version` / `t_clause` + 向量/图端口。
2. **资料 Troop（Job）**：`examples/*.pdf` → `openUploadJob`（`application/pdf` + 文字层）→ Document / Extraction / 规则 Finding；标准符合度 Finding **仅**在 retrieve 命中时挂 `clause_id`。

测试装配：`JobPipeline.openStandardLibrary({ memory ports })`，`createSpecPack({ name: "operator-corpus-v1" })`（名称不得含公路/水利/房建），再 ingest 摘录、再 upload 样例。

### Components

- **Corpus manifest**（新建测试夹具，非产品 seed）：`packages/core-engine/test/fixtures/corpus/manifest.json`，列出 6 个 example 文件名、建议 `doc_type` 标签（检验批复 / 评定表 / 中间交工）、是否期望文字层抽字成功。
- **Standard excerpt**：`jtg-f80-pile-excerpt.txt`——操作员从法规中摘出的**短条款文本**（钻孔灌注桩相关 `N.N` 标题 + 短 body），供默认 CI ingest。全书 OCR 产物放 `test/fixtures/corpus/.cache/` 并 gitignore。
- **行为测试** `operator-corpus.test.ts`：ingest / exact search / 禁发明条款 / 上传 6 份 PDF。
- **Opt-in 脚本** `scripts/ocr-operator-standard.mjs`（可选）：对 `rules/` 扫描件调现有 `OcrPort` 或外部 OCR，写出 cache；缺凭证则 skip。

不新增 `StandardLibrary` 方法，除非摘录切分证明 `splitClauses` 对真实标题全 0 条——那时才允许**最小**扩展 heading 正则，并补 `clause-split.test.ts`。默认假设 JTG 点号条款能被现有 `HEADING_RE` 切到。

### Data flow

```
rules/*.pdf  --OCR/摘录--> excerpt.txt --ingestStandard--> clauses[]
                                                      |
examples/*.pdf --extractPdfTextLayer--> openUploadJob --> job + extraction
                                                      |
                         searchStandard(query from 桩号/分项名) --> RetrieveHit
                                                      |
                         attachHit only if clause in t_clause
```

检索 query 来自样例文件名/抽字中的稳定片段（如「钻孔灌注桩」「钢筋加工」），经 `FakePrequery` 映射到摘录中的真实 `clauseNo`。禁止测试里手写不在 `t_clause` 的 `clause_id`。

### Error handling

| 情况 | 行为 |
|------|------|
| 法规扫描件直接 `openUploadJob` | 保持现状：抽字失败抛错；测试**断言此路径失败**，证明 Troops 未混用 |
| 摘录切出 0 条 | 测试失败（ingest 行为证据），再评估是否扩 `splitClauses` |
| 样例 PDF 无文字层 | manifest 标记；该文件 skip 或改 JPEG 首页夹具；不得静默当成功 |
| 样例 >4MB | 当前 6 份均 <4MB；若超限，测试断言 `UploadValidationError` 且不插 Job |
| 发明条款号 | `attachHit` / 检索未命中不得写入 `clause_id`（沿用 A11） |
| live OCR 无凭证 | opt-in 脚本 skip，默认 CI 仍绿 |

### Testing

证据阶梯（镜 2/4）：

- **L1 形状（不足以为验收主体）**：`rules/`、`examples/` 文件存在。可作前置，不可单独 PASS。
- **L2 行为（默认 must）**：Vitest 跑 ingest+search+upload，断言世界变化见验收标准。
- **L3 真 OCR（nice / opt-in）**：有 OCR 凭证时对法规首页或指定页跑识别，切出 ≥1 条 headed clause。失败不挡 L2。

## 方案比较

机制类：条文 / 静态闸门 / 行为证据 / 流程重组。候选跨 ≥2 类。

### Option 1 — 条文备忘录（条文类）

在 README 写「法规应切片进知识库，examples 用来测」。

- Trade-off：零代码；无运行证据。
- 隐藏成本：下次有人以为已经测过。
- 失败模式：绿灯与仓库状态无关。
- 依赖：无。
- **不推荐。**

### Option 2 — 文件存在闸门（静态闸门类）

CI grep/`test -f` 检查 PDF 在。

- Trade-off：便宜；只证明形状。
- 隐藏成本：90MB 二进制拖垮 clone，仍 0 条 `t_clause`。
- 失败模式：空 PDF 也过。
- 依赖：git 跟踪 PDF。
- **不推荐作验收主体。** 可作 L1 前置。

### Option 3 — 双 Troop 行为夹具（行为证据类，推荐）

默认 CI：摘录 ingest + 6 份 example 上传 + 检索只挂真实 `clause_id`。全书 OCR 脚本 opt-in。

- Trade-off：要维护短摘录与 FakePrequery 映射；不覆盖 259 页扫描质量。
- 隐藏成本：摘录与原书漂移；需定期对照。
- 失败模式：摘录选错章 → 检索「看起来像」但未覆盖用户关心的分项。缓解：摘录必须含与 6 份文件名对应的「钻孔灌注桩」条款号。
- 依赖：`StandardLibrary.ingest`、`splitClauses`、`openUploadJob` PDF 文字层（均已查证存在）。

**为什么最贵的真机制（每轮 CI 百度 OCR 90MB + live Qdrant/Neo4j）不是默认：** 法规无文字层、超 4MB、OCR 要厂商凭证且慢/不稳；目标是引擎契约（切条、挂条、上传抽字），不是识别率。最贵档与证据强度不对齐，故 L3 仅 opt-in。请假夹具继续覆盖 A11–A14 合成路径，本 spec 补**操作员真实文件**路径。

### Option 4 — 独立评测台 / 新页面（流程重组类）

单独 corpus lab 页或新 HTTP 上传法规 PDF。

- Trade-off：能演示；违反冻结 9 页，且接近「新对外契约」。
- 失败模式：把测试做成产品功能，和「空引擎不预置行业」冲突。
- **否决。**

### 推荐项锁定

推荐 **Option 3**。

**最强反方：**「请假夹具已覆盖 A11–A14，再测公路文件是预置行业的伪需求；不 OCR 全书就没测到真实入库。」

**回应：** 用户明示增加的是操作员语料与测试文件，不是改产品默认包。Pack 名禁用行业词；seed 不改。全书 OCR 是 L3。L2 测的是同一套 `ingest(text)+splitClauses+openUploadJob(pdf-text)` 契约吃**真实文件形态**（扫描法规 vs 有字资料），这是请假纯字符串夹具测不到的。攻击未推翻推荐：假需求指控忽略用户明示；「必须全书 OCR」把最贵档偷换成 must，证据强度不支持。

## Ontology detection

| 调用 | 结果 | 复用决策 |
|------|------|----------|
| `query_ontology()` | 有 `StandardLibrary`、`ClauseRow`、`JobPipeline`、web `standard_lib`/`job_upload` | 复用，不新造检索栈 |
| `query_ontology(standard ingest clause RAG)` | ingest by heading、无行业预设 | 复用；本 spec 不改「无行业预设」产品口径 |
| `query_contract(StandardLibrary)` / `IngestStandardResult` | ingest 返回 `clauses[]` | 复用 |
| `query_design(global)` | 禁止预置公路规范包 | 遵守；测试 pack 名 `operator-corpus-v1` |
| `query_design(standard_lib)` | uploadDoc → ingestClauses；缺口 `no-implementation-ref` | 本 spec **不**补 UI 实现；只补引擎测试。UI 仍走现有页 |
| `query_design(job_upload)` | 上传 PDF → Job | 复用 `openUploadJob` 测 examples |

S3 缺口：法规扫描件 → text 的生产路径在 HTTP 层仍是「先有 text」。不 `report_missing` 新契约；用 OcrPort / 摘录填这个洞。不 `report_design_gap`（不改页面配方）。

## 追问记录

模式：全自动（`.apt/goal.md` 存在）。红队册：`C:\Users\weilt\.apt\templates\_redteam-patterns.md`（项目内无 `.apt/redteam-patterns.md`）。

### 轮次：2 轮后收敛（第 2 轮无新实质发现）

### 步骤 3 澄清（自问自答，含册外）

1. **目的（镜 5）**：用户要的是引擎能吃自带法规+样例，还是产品内置公路包？→ **操作员语料 + 测试**，不改「不预置专业业务」。来源：用户明示 + goal.md。
2. **成功证据（镜 2/4）**：认行为还是认文件在？→ **行为**：`t_clause` 有条、检索 hit 在库、examples 生成 Job 且抽到字。
3. **不可砍项（镜 3）**：砍掉「真实 PDF 走 upload/ingest 契约」则本需求不成立。
4. **册外**：90MB 扫描件怎么进 4MB Job 闸门？→ **不进**；法规走 ingest(text)，资料走 upload。

需求初稿 v1：目的=操作员法规切片入库 + examples 行为测试；角色=开发者/演示操作员；边界=复用现契约；非目标=行业对错与新页面；成功=L2 行为测试绿。

### 第 1 轮 S1–S4

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 场景 | 谁、何路径、空/失败？ | 开发者 CI + 本地演示。主路径：摘录 ingest → 6 PDF upload → search。空：切 0 条失败。扫描法规走 upload 应失败。 |
| S2 破坏 | 什么让需求没价值？一半保哪半？ | 只测文件存在=没价值。保 ingest+upload 行为；砍专业评分。YAGNI：不新页面。 |
| S3 可行 | 契约能否支撑？ | 能：ingest(text)、split、openUploadJob pdf-text。不能：法规 PDF 直接 upload。证据见上表。 |
| S4 验收 | 可否写成测试？ | 可以：clause 数、clauseNo 集合、hit.clause_id、6 jobs、扫描件 upload throw。 |

**v1→v2：** 拆成法规/资料双 Troop；pack 名避开行业词；L3 OCR 降为 nice。

### 第 2 轮 S1–S4

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 6 份文件是否都要同一 DocType？ | 否。manifest 分标签即可；测试不强制新 DocType 表。 |
| S2 | 摘录会不会变成「私货规范包」？ | 放 `test/fixtures/corpus/`，不进 `seed.ts`。 |
| S3 | `splitClauses` 对 JTG 点号是否够用？ | 现有 `1.0`/`1.0.1` 单测已覆盖点号；摘录必须用点号标题。若 0 条再扩正则（残留风险 R）。 |
| S4 | 检索 query 如何可判定？ | FakePrequery 把样例关键词映到摘录 clauseNo；断言 hit 在 `ingested.clauses`。 |

第 2 轮无新实质发现（无需求/方案/风险新增，仅落实 fixture 放置）。**收敛。**

### 需求修订 delta

- v1：笼统「切片 + 用 examples 测」。
- v2：双 Troop、L2/L3 分档、禁止 pack 行业词、扫描件不得走 4MB upload。
- v2 后无 v3。

### 残留问题

无（非强制收敛）。残留风险见下节 R：若真实摘录标题不被 `HEADING_RE` 命中，实现期最小扩正则。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | 操作员法规以 text 经 `ingestStandard` 按条款切分入库 | 用户明示 | 摘录 ingest 后 `clauses.length ≥ 3`，每条 `clause_id` 形如 `${version_id}:${clauseNo}`，`qdrant_point_id === clause_id`，且不是按 512 token 切（沿用 split 不变量） | must |
| R2 | 检索挂条只允许库内 clause | 追问确认（A11 查证） | exact 查询摘录中某 `clauseNo` 得 1 hit；`getClause(hit.clause_id)` 存在；对「第999条」不 insert finding / 不发明 id | must |
| R3 | `examples/` 6 份 PDF 走 upload 文字层并生成 Job | 用户明示 | 每份 `openUploadJob({ mime: application/pdf, bytes })` 成功；`job.trace_id` 非空；`vendor` 为 `pdf-text` 或抽取文本长度 ≥ 3 | must |
| R4 | 法规扫描件不得被当成资料 Job 成功 | 追问确认 | 对 `rules/` PDF（或无文字层夹具）调用 `openUploadJob` 抛错；`listJobs` 不增加（或 status=failed 且无假 clause_id，以实现时现有 throw 为准） | must |
| R5 | 测试 pack 不使用行业预置命名、不改产品 seed | 追问确认 + style.md | `createSpecPack` 名称无「公路」「水利」「房建」；不修改 `pipeline/seed.ts` 默认包 | must |
| R6 | 默认 CI 不依赖 live OCR/三库 | AI 假设未确认→已降级 | opt-in 脚本无凭证时 skip；默认 `npm test -w core-engine` 不含网络 OCR | nice |
| R7 | 全书 OCR 后切条 | AI 假设未确认 | 有凭证时 cache 中 headed clause ≥ 1 | nice |

## 验收标准（汇总）

1. 新 Vitest 文件在 core-engine 测试套件中默认执行，覆盖 R1–R5。
2. 请假夹具 `standard-rag.test.ts` 仍绿（不替换合成路径）。
3. 不新增页面、不新增 HTTP 路径。
4. `/verify` 不因本变更引入 logic-sync 失败（不改 `designs/v0` 逻辑）。

## 风险

- 摘录与 90MB 原书漂移 → 摘录注明对应章/条号，manifest 写来源文件名。
- `HEADING_RE` 不识别真实标题 → 实现期扩正则 + split 单测（范围仍 ≤8 文件目标）。
- 大 PDF 进入 git → 已在仓库；本 spec 不要求 CI 读 90MB。

## 拟改动文件（≤8）

1. `packages/core-engine/test/operator-corpus.test.ts`
2. `packages/core-engine/test/fixtures/corpus/manifest.json`
3. `packages/core-engine/test/fixtures/corpus/jtg-f80-pile-excerpt.txt`
4. `packages/core-engine/test/fixtures/corpus/.gitignore`（忽略 `.cache/`）
5. 可选：`scripts/ocr-operator-standard.mjs`
6. 本 spec

不改 seed、不改 9 页 Vue。
