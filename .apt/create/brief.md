---
productGoal: 工程资料核心引擎：教用分离。系统提供模板标注、规则运行时、待审与组卷预览；不预置任何行业规则。正式写库只认中台回执。
mode: refine
sourceDoc: docs/智能工程资料管理平台-核心引擎-两周实现计划.md
confirmed: yes
changePages:
  - standard_lib
---

# Create Brief（sourceDoc 冻结，禁止改写范围；本文件只增不减）

## 产品目的

交付一套 **可教的工程资料空引擎**：用户自配规范包/模板/规则；系统跑通「识别 → 规则执行 → 待审 → 组卷预览」，用 `trace_id` 对账。验收只验引擎，不验专业管得对不对。

**本期增量（2026-08-26，用户看完页面后追加，须在本 goal 程序内一起做，不得降为 D10 加分）：** 标准库必须是 **生产级 RAG + 图检索**。标准数量大、条款关系复杂；简单向量相似度不够。要能指出 **合不合规、不合哪一条（含版本与引用链）**。RAG/图只负责 **定位并引用条款**；日期/必填/成对等 P0 仍由 DSL 规则引擎判定。Finding 上的条款号必须来自库内 `clause_id`，禁止 LLM 手写。

**本期增量（2026-08-26，用户指出缺对话不可行）：** 每个识别结果、流水线每一步都可能要 **自然语言对话**（与配置/操作/审核人员交互，不是客服闲聊）。不加第 10 页：9 页工作台右侧共用 **本步对话** 面板。线程键 = `trace_id` + `step`。走 agent-runtime HITL。对话不能写库、不能取消 blocking、不能 submit；口语规则只生成 DSL 草稿。人确认「下一步」中台才推进；正式落库仍要 Receipt。

**本期 refine（2026-09-17，仅 `standard_lib`）：** 选完规范 PDF 并登记成功后，可点 **「处理全部页」**（操作名 `tickAll`）。前端串行循环已有 `tick`（`POST /api/standards/ingest-runs/:id/tick`），直到没有 `pending` 页。单次 tick 仍 ≤1 页。某一页 `ocr_error` / `index_error` 时继续处理其余 pending，已成功页不回滚。不新增全书一次 OCR 接口，不改条款/表切片，不加页。

**本期 refine（2026-09-19，仅 `standard_lib`，队列 F-1）：** 检索已经能命中（出处列可见），但用户 **看不到条文内容**。命中行可打开 **详情**：展示 `heading`（条款标题，如「1.1 事假须提前申请」）与 `body`（条款正文）。出处列（file_name / 页 / unit_id / clause_id / 路径）保留。本步对话引用命中时须带标题+正文，不得只回 `clause_id`。检索算法、DSL 硬规则、table/annex 的 `clause_id=null` 规则不变。不加页。

## 目标用户

- 配置人员：建项目/规范包、框选模板、写 DSL、上传标准库（条款入库、关系确认）
- 操作人员：上传资料、看检查结果（含不合哪条）、看组卷预览、查审计
- 审核人员：改软措辞、确认 Proposal（出 Receipt）

## 必做页面（9，禁止临时加页）

| pageId | 路由 | 说明 |
|--------|------|------|
| project_home | /projects | 项目与规范包 |
| template_annotate | /templates/:id/annotate | 画布框选 |
| rule_editor | /packs/:id/rules | 规则草稿/发布 |
| standard_lib | /packs/:id/standards | 标准入库 + 语义检索 + 图查询（本期加深，不加第 10 页） |
| job_upload | /jobs | 上传与 Job 状态机 |
| pending_review | /pending | 待审工作台 |
| check_findings | /jobs/:id/findings | 检查结果（标准符合度须挂 clause_id） |
| volume_preview | /jobs/:id/volume | 组卷预览（不提交） |
| audit_trace | /audit/:traceId | 审计时间线 |

Walking Skeleton（SLICE-1 先接通）：`job_upload` + `check_findings`（含本步对话壳）。生产级标准 RAG 在 **同一期程序的 SLICE-6** 交付。步骤对话壳从 SLICE-1 就有，各片接到对应 `step`。

## 核心流程（演示主路径）

创建项目 → 空规范包 → 空白表框选 3 字段 → 发布 R1 必填 / R2 日期顺序 → 上传 2 份 PDF → 质检+OCR+抽取 → 合规放过 / 颠倒拦住 → 软措辞待审 → 组卷预览 → 同一 trace_id 对账。

**步骤对话主路径（本期必做）：** 每步结果出来后打开本步对话（质检/抽取/检查/待审/预览/标注/规则草稿/检索均可）→ 用自然语言问「这是什么」「合哪条」「下一步做什么」→ HITL 回复 → 用户确认推进 → 状态机才走下一步。审计页只读对话摘要。

**标准库主路径（本期必做）：** 上传标准 PDF → 按条款切分写入关系库 → 向量入库 → 抽取引用/替代/适用关系写入图库 → 预查询改写 → 简单问走向量+rerank，跨条/引用/替代走图查询 → 命中 `clause_id` → 规则/阈值在引用上执行 → Finding 展示「不合哪条」+ 原文 span。

**标准库 PDF 入库路径（2026-09-17 refine）：** 选择 PDF → `uploadDoc` 得 202 + `ingest_run_id`（各页 `pending`）→ 可继续点「处理一页」(`tick`)，或点「处理全部页」(`tickAll`) 循环 `tick` 至无 pending → 页状态 `ok` / `ocr_error` / `index_error` 用 `.tag` 展示 → 仍按条款/表/附件切分入库（不是按页整页当检索块）。

**标准库命中阅读路径（2026-09-19 refine）：** 检索问句或条款号 → 表格列出出处 → **点击命中行打开详情** → 看到该条 heading + body → 本步对话可就该正文提问并引用。table/annex 详情展示 caption/单元格文本，clause_id 列仍为 —。

## 非目标

公路/水利/房建规范包**内容**（用户自传标准，引擎不预置条文）、测表公式、资料云实挂、组卷提交进认知 Tool、Temporal、CAD、弱网 App、模型微调、口语规则直上生产、Agent 直连业务库、推倒 agent-runtime、引入 LangGraph。

仍不做：用 Prompt 替代 DSL 硬规则；用聊天模型发明条款号；把 APT `.ai/arch/vectors.db` 当作业务标准库。

本轮 refine 另明确不做：一个请求里 OCR/索引完全书；把切片改成纯 512 token；放宽任务上传 4MB；预置公路/水利/房建规范包；改其它 8 页。

2026-09-19 另明确不做：改检索召回算法；用 Prompt 编造正文；把全文塞进每一行表格（详情里看正文）；把 table/annex 的 unit_id 写入 clause_id 列。

## 成功标准（A1–A10 + 本期 A11–A16）

A1 空规范包；A2 三框抽取；A3 缺反例不能 publish；A4 日期颠倒 blocking；A5 合规无 R2 finding；A6 待审可改且确认有 receipt；A7 自定义 groupKeys 预览；A8 认知节点调不到 submit；A9 trace_id 贯通；A10 /verify PASS + connect done。

A11 标准按条款切分入库；标准符合度 Finding **只挂** 检索/图命中的 `clause_id` + `standard_version`，LLM 手写条款号无效。  
A12 预查询改写 + 向量混合召回 + 独立 rerank；同一条款多种问法命中同一 `clause_id`。  
A13 跨条、引用、替代、同时适用走图查询，返回 `CITES` / `SUPERSEDES` / `APPLIES_TO` 路径，不得只靠向量凑。  
A14 项目绑定生效版本；废止/被替代版本不得作为现行依据。  
A15 任一 Job 步骤及配置页可打开绑定 `trace_id`+`step` 的本步对话；抽取/检查结果必须能就该结果提问。  
A16 对话只产生 Proposal / HITL resume；不能覆盖 blocking、不能 submit、口语不能直接 publish；确认下一步后中台才改 Job.status。

A17（2026-09-17，仅 standard_lib）：登记成功后点「处理全部页」，循环已有 tick 直至无 pending；请求次数 ≥ 页数，且单次 tick ≤1 页。某一页失败时已成功页仍在库，失败页用标签标出，不整本回滚。短文本夹具入库、单页 tick、按条款号检索仍可用。

A18（2026-09-19，仅 standard_lib）：检索有命中后，打开详情能看到该条 **heading + body**（或表/附件的可读文本）；出处列仍在。本步对话回答能引用命中正文，不得只报 clause_id 而声称看不到原文。

## 技术约束（已锁定）

- 认知层：本仓 `packages/agent-runtime`；**按步骤 HITL 对话** + `check_wording`；只写 Proposal / interrupt resume。检索 Tool 返回 `clause_id[]`，Agent 不持有向量/图账本，不持有正式账本
- 中台账本：Job/Rule/Extraction/Finding/Receipt + **Clause / Citation**；Agent 不得持有正式结果
- 两周队列：Redis/简单 Worker，不上 Temporal
- OCR/OSS：W0 未单独确认厂商 → SLICE-1 允许文本层 PDF + 本地存储；真实 OCR/OSS 后补
- **页面形态：Web SPA。** apt-create 只产 HTML 原型；最终实现 **Vue 3 + Vite + TypeScript**，经 `$apt-frontend-connect` 接线。不做 App / 小程序。原型 HTML 不是最终交付。
- **本期标准检索三库（必做，不得用单 SQLite 冒充）：**
  - 关系数据库：PostgreSQL（StandardDoc / StandardVersion / Clause / 项目绑定生效版）
  - 向量数据库：Qdrant（条款级 dense，键为 `clause_id`；可加稀疏/BM25 混合召回）
  - 图数据库：Neo4j（节点 Standard/Clause/Term；边 CITES、SUPERSEDES、APPLIES_TO、REQUIRES）
- **预查询模型：** 复用智谱 `glm-5.3` 做问句改写与标准号/条款号/专业抽取，不代替精排
- **Rerank 模型：** 独立精排（如 bge-reranker-v2-m3 或等价国产 rerank API），禁止用聊天补全当 rerank
- 切分：按条款层级（含父条标题、表、注），禁止纯 512 token 切

## 复用

已有 agent-runtime（图编排、智谱 LLM、HITL、Tool 幂等、checkpoint）。禁止平行造引擎。标准 RAG 在中台检索服务实现，runtime 只调检索 Tool。

## 澄清问答记录

- 2026-08-26：用户问页面用什么语言、是否直接 Web。结论：**Web SPA，Vue 3 + Vite + TS**；用户回复「同意」。
- 2026-08-26：用户看完 9 页原型后追加：标准检索要完整生产级 RAG + 图搜索。结论：写入 brief，SLICE-6 必做。
- 2026-08-26：用户问页面有无自然语言入口。当时仅标准库检索框 + 待审改措辞，**无多轮对话**。用户随后要求：每个识别结果、每做下一步都可能要对话，没有则不可行。结论：**9 页共用本步对话面板（不加页）**，写入 brief，本期与引擎一起做。
- 2026-09-17：用户问能否改进「只能一页页处理」。`/feature` 锁定目标后回复「批准」，再发 `/apt-create --refine`。结论：`changePages: [standard_lib]`；新增 `tickAll`（处理全部页）= 前端循环已有 `tick`；失败继续、不回滚 ok 页；不新增全书 OCR；productGoal 不变；本轮 `confirmed` 重置为 no，须「确认 brief」。
- 2026-09-17：用户原文「确认brief」→ brief `confirmed: yes`。随后「确认风格」→ 锁定 `apt-skyline-clean`。
- 2026-09-19：用户先 `$apt-intake` 确认「向量库有数据、检索能命中，但看不到内容」= 队列 F-1；再发 `/apt-create --refine`。`productGoal` 不变；`changePages: [standard_lib]`；本轮增量 = 命中详情展示 heading+body + 对话可引用正文。上一轮 tickAll 的 `confirmed: yes` **不得沿用**（H3），重置为 `no`，须本轮「确认 brief」。
- 2026-09-19：用户原文「确认brief」→ brief `confirmed: yes`。进入 Phase 0.5 风格选择。
- 2026-09-19：用户原文「确认风格」→ 锁定 `apt-skyline-clean` / 天际清朗。
