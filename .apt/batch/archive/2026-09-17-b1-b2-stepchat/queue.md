# APT 批量队列（$apt-intake 生成）
> 生成：2026-09-17T10:40:00+08:00｜共 2 项（P1 1 / P2 1 / P3 0）｜截图归档 .apt/batch/screenshots/
> 旧 goal 处理：用户确认覆盖（cover）未归档

## B-1
- 类型：bug
- 优先级：P1
- 标题：标准库本步对话回显假模型提示词，并绑到无关 Job 上下文
- 收敛记录：
  - 所属页：standard_lib
  - 复现：打开标准库 → 检索「公路建设」→ 右侧本步对话发送「公路建设条款数」（或任意问句）
  - 实际：助手回复以 `[fake-llm/fake]` 开头，整段回显 HITL 系统提示；上下文是 `fixture-reversed.json`、2 条 finding、`pack_slice1`，不是本次检索命中
  - 期望：未配置真实模型时用中文说明未配置、禁止回显系统提示；已配置时用人话解释本次命中条款；标准库对话不得绑任务列表第一条 Job
  - 影响面：标准库 HITL 主路径不可用（A15）
  - 根因（查证）：① `FakeLlmProvider.complete` 返回 ``[fake-llm:${model}] ${prompt}``（`packages/agent-runtime/src/llm/provider.ts`）；缺 `.apt/agent-runtime.llm.json` 即走假模型。② `apps/web/src/views/standard_lib/index.vue` `loadPack` 取 `/api/jobs` 第一条 `trace_id`。③ Vue 发 `step=retrieve`，`shouldSearchClause` / `stepSystemPrompt` 认的是 `standard_lib`。④ `buildJobContext` 只拼 Job/finding，不带本次 RetrieveHit。
  - 视觉观察：右侧 `step=retrieve`；助手 dump「禁止确认提案/写 Receipt/取消 blocking」+ job 9c3e3450… / fixture-reversed.json
- 截图：.apt/batch/screenshots/B-1/standard_lib-stepchat.png
- 分流：轻链（§0.2 落痕）
- 测试策略：accept-inline（片内验收）
- 验收：待验收
- 确认：AI 自答（证据: packages/agent-runtime/src/llm/provider.ts:21-25；apps/web/src/views/standard_lib/index.vue:70-71,275；packages/core-engine/src/agent/prompts.ts:14,46-68；packages/core-engine/src/agent/context.ts:18-70；截图 B-1）
- 泊车：无
- 依赖：无
- Goal（§0.2）：修好标准库本步对话，未配模型不回显系统提示，且上下文是本次检索而非无关 Job
- 验收标准（§0.2）：
  1. 未配置 `.apt/agent-runtime.llm.json` 时，助手回复不得以 `[fake-llm` 开头回显 HITL 系统提示，须中文说明未配置模型
  2. 标准库对话不得展示无关 Job 的 `fixture-reversed.json` / findings；问条款时只依据本次检索命中或明确未命中
  3. 按本项复现步骤执行达期望态（先红后绿测试覆盖上述两点）

## F-1
- 类型：需求
- 优先级：P2
- 标题：检索命中可通过详情查看条款标题与正文
- 收敛记录：
  - 所属页：standard_lib
  - 目的：向量/图谱命中不只看出处 ID，要点开看到入库的条款标题和正文
  - 边界：做 = 命中行可打开详情，展示账本已有 `heading` + `body`（表/附件展示 layout 正文）；检索算法、切分、OCR、硬规则 DSL 不动。不做 = 不在表里堆全文、不新做 OCR、不把详情当成条款号编辑器
  - 验收：点命中行（或「详情」）看到与入库一致的标题+正文；关闭后表仍在；table/annex 的 clause_id 列仍为 —
  - 视觉观察：命中表五列出处，「向量」只是路径标签；无详情入口。条款正文入库时已写入 heading/body，但 RetrieveHit / RetrieveHitsTable 不展示
- 截图：.apt/batch/screenshots/F-1/standard_lib-hits.png
- 分流：全链
- 测试策略：accept-batch（批末统一，默认）
- 验收：待验收
- 确认：AI 自答（证据: designs/v0/standard_lib/page.logic.md 检索命中列无详情；apps/web/src/views/standard_lib/RetrieveHitsTable.vue:29-54；packages/core-engine/src/retrieve/ports.ts:111-126 RetrieveHit 无 heading/body；截图 F-1）
- 泊车：待批泊车（armed 页需 `$apt-create --refine`；`designs/v0/_pages.md` 中 standard_lib approved=no）
- 依赖：无（人批 refine 完成后再生成切片）

## B-2
- 类型：bug
- 优先级：P1
- 标题：本步对话改读 arch.config.json 的 chat（glm-5.3-flash），不要再缺 llm.json 走假模型
- 收敛记录：片间 inbox 并入（确认: 已确认；用户明示使用 arch.config.json chat url/key/model=glm-5.3-flash）
- 分流：轻链（§0.2 落痕）
- 测试策略：accept-inline（片内验收）
- 验收：待验收
- 确认：已确认
- Goal（§0.2）：本步对话在仓库已有 arch.config.json chat 配置时使用 glm-5.3-flash，不再因缺少 agent-runtime.llm.json 走假模型
- 验收标准（§0.2）：
  1. 存在 `.ai/arch/arch.config.json` 的 `chat.model=glm-5.3-flash` 且 key 非空时，`createLlmProvider()` 不得落到 FakeLlmProvider
  2. 助手回复不得以 `[fake-llm` 开头
  3. loader 必须读到 arch.config.json chat 字段（单测可 mock HTTP）
