---
description: 批量摄入 — 把需求/bug 列表（含截图）收敛成队列三件套（queue.md + programMode state 骨架 + 待批清单）；收敛即入队，队列驱动连续执行——无运行锁 ∧ 有就绪新任务 ∧ 预授权在位 → 自动派发后台编排 agent 执行 /apt-goal --continue，执行体存活则 inbox 排队片间自取（主会话零占用——支持二级派发的平台；无通道平台可经用户同意由主会话接管编排。运行锁 + inbox 防并发重放；--fg 仅显式键入的调试入口）
---
<!-- apt-template-version: 10.9.0 -->
# $apt-intake — 批量摄入（收敛即入队 → 队列驱动连续执行）

你是批量需求摄入代理。把零散到达的需求 / bug 列表（含截图）收敛成**可执行的批量队列**；**收敛产出即入队，队列驱动连续执行**——三件套产出后按「触发规则（队列驱动连续执行）」节判定：无运行锁 ∧ 有就绪新任务 ∧ 预授权在位 → **自动派发单个后台编排 agent** 执行 `/apt-goal --continue` 切片循环（执行体**自动启动**，**不需要用户敲任何命令**）；执行体存活 → 新任务 inbox 排队片间自取。不分昼夜，**主会话零占用**（`--fg` 仅用户显式键入的调试入口，见 §6.1）。零新执行引擎：复用 `/apt-goal` programMode 切片循环（`templates/_apt-goal-loop.md`「程序模式」节：`cursor` 为 0-based 切片索引，按 `slices[cursor]` 进入该片全链）；循环每轮磁盘驱动（state + goalSha + 游标），后台中断与会话中断是同一故障类、同一恢复出口（手动 `--continue`）。

设计依据：`docs/superpowers/specs/2026-09-03-apt-batch-intake-design.md`（基础设计）+ `docs/superpowers/specs/2026-09-03-apt-intake-background-dispatch-design.md`（后台派发 / 运行锁 / inbox）。

## 输入

```
$apt-intake <列表文本 | 文件路径> [截图路径...] [--start] [--fg] --accept
```

- **列表**：markdown / 纯文本粘贴，或文件路径（需求 / bug 混排即可）
- **截图**：可选，本地图片路径；**会话内视觉解读**提取观察（现象 / 期望态 / 报错文本）写入该队列项收敛记录，**原件复制**归档到 `.apt/batch/screenshots/<队列ID>/`（队列可追溯；不做自动化 UI 比对）
- **--start**：可选**手动触发入口**（不再是必经入口）——语义 = 手动确保执行体在跑：空闲 → 派发；存活 → 报告状态；未预授权 → 列清单挂起（见「触发规则（队列驱动连续执行）」节与 §5）
- **--fg**：仅用户**显式键入**时生效的前台调试链入（**非默认、非自动路径**）——派发前警告「前台链入将**占用主会话**，期间输入将排队」，经确认才执行；平台不支持后台子 agent → 提示换支持后台的平台，**不回退前台**（见 §6.1；「后台派发设计稿上线注记」中「首批建议 `--fg`」为历史注记，已被后台必选语义取代）
- **--accept**：可选**单一无值旗标**（无等号）——**批末自动验收**（ACCEPT-BATCH 哨兵切片，片内单一调用 `$apt-accept --batch --provenance=sentinel`，见 §4.2）；**缺省 defer**——批末跳过验收、台账登记欠账（全行 `pending-acceptance`、queue 对应项标「待验收」），loopDone 终态报告欠账提示，`$apt-accept --batch` 补跑或挂验收看门（§6.7）。行为变更声明：现行「台账非空即自动验收」改为 **opt-in**
- **检查 / 审计类请求**（如「检查一下 X」）：合法输入——前置查证执行审计，交付物 = **审计结论**（对话内呈现），仅**发现的问题**收敛入队（§2）；零发现 → 停车线记「无队列项（审计结论已呈现）」（§4.5）

## 1. Preflight

调 `query_project_status`（无参）探活 MCP；FAIL 即停（规则同 `templates/_mcp-preflight.md`）。本会话**近 10 分钟内**已有 `query_project_status` PASS 探活结论 → 可复用，不重复探活。

## 1.5 运行锁与 inbox 路由（收敛前置，产出落点判定）

收敛开始前判一次 `.apt/batch/running.lock` 与 state 终态：

- **锁在 ∧ state 非终态**（存在非终态步 / 未 loopDone）→ 批处理运行中：本批收敛产物**全部改写 inbox**——`.apt/batch/inbox/pending-batch.md`（含全部队列项收敛记录与截图归档路径；**不写** queue.md 主位 / goal.md / state）；inbox 条目携带 `确认` 字段（见 §4.1），`半收敛` 项不参与片间自取。§4.2 幂等重入分支此时**禁止触发**（重写三件 = 正在跑的循环脚下抽地板：state 重置 pending + cursor 0 → 循环下一轮读盘后整批从头重放）。
- **锁在 ∧ state 全步终态 / loopDone 语义** → 陈旧锁：提示用户确认后清除，按正常路径续跑。
- **锁不在 ∧ `.apt/batch/inbox/pending-batch.md` 存在** → 把 inbox 待并项**并入本次收敛输入**（重新过 §2 收敛三动作与去重 / 依赖，ID 重编），随后正常产出（无运行循环，幂等重入安全）。
- **锁不在 ∧ state 存在且判「从未执行」**（顶层 `steps` 空 ∧ `cursor: 0` ∧ slices 全 `pending`）→ **未启动队列增量并入**：旧未终态项并入本次收敛输入（重新过 §2 收敛动作与跨轮查重；**旧项保留原队列 ID、新项接续编号**），随后增量重写三件 + goal.md（幂等重入的安全升级形态）。
- **锁不在 ∧ state 已有任一终态（批已跑过）∧ 新批收敛 → 第二批落点：归档 = 移动（四细则）**：
  1. **归档 = 移动**（非复制，消解双重归档）：旧批 loopDone → `.apt/batch/` 三件套（§4.1–§4.3）+ accept 台账（§4.4）+ `screenshots/` 整目录 → `.apt/batch/archive/<date>-<slug>/`；移动时点 = **新批收敛完成后、重写三件前**（禁止在收敛开始前移动——收敛中断时活树引用悬空）；目录级 mv 幂等：archive 已存在 → 跳过归档直接重写。
  2. **goal.md 归档统一由 §4.2 goal-archive 分支执行**（本规则不重复归档——消解双重归档；移动后 §4.2 自然走覆盖写分支）。
  3. **新批 ID 接续旧批最大号**（不重起，沿用本条增量并入先例「旧项保留原 ID、新项接续编号」；mergedFrom 不断裂——消解回收项与新批的 ID 碰撞：slices 唯一性 / 截图目录 / 台账来源三面）。
  4. **泊车待批项 / accept 台账随批归档**，归档时未终态项**带回收敛输入**（人批后随新批执行，不随归档流失）。

  「并提示用户」保留：归档动作在停车线摘要呈现（§4.5）；旧批未完成 → 以 `--continue` 续跑为主；用户明确弃批 → 未终态项带回收敛输入。

## 2. 收敛循环（逐项问至确认）

对列表每一项澄清**至确认**即止——**提问节奏不限**：可单问、可一次多问、可多轮追问、也可零提问（信息已齐备时以查证结论或 AI 自答直接收敛，见下）；**收敛判据 = `确认: 已确认`（三要素齐备 ∧ 用户确认），不是问答次数**。提问前**必须先查**（前置查证，grounded questioning，见下）：

| 类型 | 澄清要素（先查证补齐，查不到才提问） |
|------|-----------|
| bug | 复现步骤 / 期望 vs 实际 / 影响面 / 所属页 |
| 需求 | 目的 / 边界（做什么、不做什么）/ 验收（可判定标准）|

**提问前置查证（grounded questioning）**：向用户提问前**必查三腿**——① **本地知识资产**：`query_contract` / `search_arch` / `query_arch`（逻辑 / 契约）；② **队列关系**：既有队列项 / `mergedFrom` / 同页依赖；③ **真源与代码**：`designs/v0/<page>/page.logic.md`（页面项产品真源）、页面 / 组件源码、截图观察。**查得到的以查证结论代问**（「资产库显示……我按此收敛，有误纠正」），**只问查不到且阻碍收敛的**。

**前端项提问决策树**（资产库不一定覆盖前端）：`page.logic.md` 预期行为 → 设计知识（若有）→ 页面源码实际实现 → 交叉比对成假设 → **封闭式 / 选项式提问附证据**（文件:行 / 截图引用）。**禁止开放式问用户前端实现细节**（用户不熟前端）——查不到时只问**业务现象与期望**（用户熟的域），前端实现定位留给实现阶段子 agent 自查。

**免提问自答收敛**：查证证据链足以完整推出三要素（复现 / 根因 / 期望——如复现步骤可由代码路径直接演绎）→ **零提问**直接收敛入队，记 `确认方式: AI 自答（证据: 文件:行/截图）`。边界：① 需求目的 / 边界含**主观取舍**的不适用（仍须用户确认）；② high 风险项仍走待批人审（既有机制兜底）；③ 终态摘要**单列 AI 自答项**（含证据链），用户可当场**推翻**——推翻 → 重收敛或移出队列；④ 自答**不改变分流**，「用户选择直跑」要件不变（自答标注与轻链既有「全自动自答，未经用户确认」先例同风格）。

每项过收敛三动作：

- **查重合并与略过（含跨轮，口径 = 队列未完成）**：本次输入内同根因合并为一项（记 `mergedFrom` 原编号）；跨轮对照**队列中未完成项**——现有 `.apt/batch/queue.md` 未终态项 + `.apt/batch/inbox/pending-batch.md` 待并项：同问题 / 同根因 → **略过不新增**——记 `mergedFrom: <既有队列ID>` 留痕（旧 ID 保留），向用户呈现「**略过：与 X 重复**」；**已完成（终态）项不参与查重——同问题复发 = 新项**，正常接续编号入队；合并项的截图归档路径随项保留；同页多项标注关联
  - **例外（收敛者 = 修复者的会话——接管形态 / 前台单件链）**：同时满足四要件时**不适用「复发 = 新项」**——(a) 对照面 = **同一会话内**已完成修复；(b)「同问题」机械判据 = 复现步骤指向**同一文件同一故障模式**；(c) 略过记录含**已修 commit 引用**（可核查）；(d) **用户坚称复发 → 推翻略过、正常入队**。四要件缺一 → 维持「复发 = 新项」；跨会话（后台常态）对照面为空 → 维持复发 = 新项（已知边界入「待实测台账」节观察）
- **依赖排序**：同页多项「先 logic 后实现」（armed 项目涉既有 `designs/v0` 页面 → 依赖 refine 完成项）；依赖只写排序约束，不改 P 级
- **优先级**：**P1** 阻断 / P2 重要 / P3 顺手
- **测试策略**（仅所属页非空项）：`accept-inline`（片内验收）｜`accept-batch`（批末统一，**默认**）——交互逐项定，P1 阻断项建议 inline；所属页为空 → 无此字段（**片内测试案例强制**，无 accept）
- **验收标准摘要（台账必填，§4.4）**：每个就绪项收敛（§2）时随三件套写入台账——bug 类来源 = 轻链 §0.2 落痕验收标准（1–3 条，分号分隔）；需求类来源 = 收敛记录「验收」可判定标准；**复现步骤引用**（bug 类必填 = 片内复现测试路径，先红后绿沉淀）——摘要不得只存在于 plan 头部（台账为验收真源，批末 `$apt-accept --batch` 以此枚举 RP）

**Ontology 感知**：收敛中 AI **可自主调用** `query_ontology` / `query_contract` 辅助判断（定位所属页、判断是否已知问题等），时机自判，不强制。

截图项：视觉观察写入收敛记录后请用户确认一次（满足**免提问自答收敛**条件时可零提问，按其边界执行）；观察存疑 → 挂待批清单（§4.3）；平台未提供本地路径时，原件归档记「未归档（会话内解读已留痕）」。

## 3. 分流（决定片内链路）

| 判定 | 分流 | 片内 steps 预画 |
|------|------|-----------------|
| bug 小修（预计 ≤2 子任务、无需新 spec） | **轻链**：`/feature` §0.2 需求收敛落痕——一句话目标 + **1–3 条可判定验收标准**，并入 plan 头部 Goal / 验收标准两字段（格式见 `templates/feature.md` §0.2；全自动 / 非交互模式 AI 自答须标注「全自动自答，未经用户确认」（`templates/feature.md` §0.2 先例）；缺任一字段不得进入实现编排） | `feature → 片内写复现测试（先红后绿） → verify` |
| 需求（其余） | **全链**：brainstorm → spec（**高风险 spec 白天批** → 挂待批清单）→ plan → implement → verify → finish | `auto_brainstorm → plan_from_spec → implement_plan → verify → finish_feature`（有运行时验收面加 `accept`）；plan 含测试案例规划——页面项 `test-cases.md`（对齐 B1.5 格式）｜非页面项单测/集成案例清单 |
| 需求·已收敛确认（`确认: 已确认` ∧ 三要素齐备 ∧ 交互模式经用户逐项确认 ∧ **用户选择直跑**（未选择升格 mini-spec 则归「需求（其余）」全链）；全自动模式不启用本分流，回退全链） | **确认即批直跑**：白天产出 **mini-spec**——收敛记录升格为 spec 正文（存 `docs/superpowers/specs/`，需求锁定表来源 = `追问确认`），跑 auto-brainstorm §6.5 同款风险分级：low → `auto_approved`；high → 挂待批清单**白天批** | `plan_from_spec → implement_plan → verify → finish_feature`（有运行时验收面加 `accept`）；plan 含测试案例规划——页面项 `test-cases.md`（对齐 B1.5 格式）｜非页面项单测/集成案例清单 |

**「直跑」消歧**：第三分流「确认即批直跑」的「直跑」= **切片直链**（首步 `plan_from_spec`，跳过 brainstorm）交**后台执行体**执行——**不是主会话立即执行**（主会话停车纪律见「停车线（命令终态）」节与硬规则）。

**bug 类验收映射（轻链与本分流同规）**：**测试步强制**——复现步骤机械映射为测试案例（**先红后绿**），done-when = 测试存在 ∧ 红→绿证据；验收标准仍必含「**按收敛记录复现步骤执行达期望态**」——复现步骤显式映射为验收探针，不得只写泛化断言。

`action` 只取 `_apt-goal-loop.md` nextAction 映射表枚举，禁止发明新子流程。

## 4. 产出三件 + goal.md

### 4.0 小批出口（机械判定）

收敛完成后（§2）、产出三件套前机械判定：**本批全部为轻链（§3 分流）∧ 预计合计 ≤1 片** → **固定呈现推荐**——「批量机器对本批不成比例，推荐退出 intake 走 `/feature` 单件链（收敛记录可作 §0.2 落痕带入）」；用户选择批量才产出三件套，不选 / 忽略 → 按批量继续（默认路径不变）。

### 4.1 `.apt/batch/queue.md`（队列资产，ID 规则：bug=B-N / 需求=F-N）

```markdown
# APT 批量队列（$apt-intake 生成）
> 生成：<ISO8601>｜共 N 项（P1 x / P2 y / P3 z）｜截图归档 .apt/batch/screenshots/
> 启动命令：<可选覆盖>｜关闭命令：<可选覆盖>（用户显式给定则 ACCEPT-BATCH 哨兵优先采用；不强制、不自检强拒——缺省由哨兵自动启动本地开发，见 §4.2）

## <ID>（如 B-1）
- 类型：bug｜需求
- 优先级：P1｜P2｜P3
- 标题：<一句话>
- 收敛记录：bug=复现/期望vs实际/影响面/所属页；需求=目的/边界/验收；截图项=视觉观察
- 截图：.apt/batch/screenshots/<ID>/<file>（无则记「无」）
- 分流：轻链（§0.2 落痕）｜全链
- 测试策略：accept-inline（片内验收）｜accept-batch（批末统一，默认）——仅所属页非空项，收敛（§2）时交互逐项定，P1 阻断项建议 inline；所属页为空项标注「片内测试案例强制（无 accept）」
- 验收：待验收｜已清（入账项标「待验收」；带 `--accept` 批末哨兵自动验收 overall PASS 即清，缺省 defer 为欠账、`$apt-accept --batch` 补跑 PASS 清——清法以 ledger 为单一计数源，见 §4.4）
- 确认：已确认｜半收敛｜AI 自答（证据: 文件:行）（已确认 = 目的 / 边界 / 可判定验收三要素齐备 ∧ 经用户确认；半收敛项**泊车**不生成切片，待后续续收敛；AI 自答项 = §2「免提问自答收敛」入队——**照常生成切片 ∧ 计入就绪**，停车线单列（附证据链），用户可当场**推翻**——推翻 → 重收敛或移出队列）
- 泊车：无｜待批泊车（待批清单非空的项标「待批泊车」，**不生成切片**、不阻塞就绪项触发；人批通过 → 转 inbox 片间自取或随下一轮触发执行——「触发规则（队列驱动连续执行）」节）
- 依赖：无｜<依赖的队列 ID 及理由>（如「依赖 F-1：同页 logic 先冻结」）
- mergedFrom：<被合并的原编号，可选>
```

### 4.2 `.apt/goal/playbook-state.json` 初始骨架（schema 对齐 `templates/goal-runner/playbook-state.json.example`）

- **写 goal.md 前置检查（防覆盖常规 goal，三态）**：`.apt/goal.md` 已存在时按旧 goal 状态分流——
  - **旧 goal 已完成**（frontmatter `status: completed`，或 state loopDone 语义）→ **自动归档后直接继续，零提问**：旧 goal.md 归档到 `.apt/goal-archive/<date>-<slug>.md`（slug 取旧 goal 主题词），随后覆盖写新 goal（已完成 goal 无状态损失，closure report 在 docs/ 另存）；**裁定：第二批及以后的 goal.md 归档统一由本分支执行**（§1.5 的 batch 归档不含 goal.md——消解双重归档）
  - **旧 goal 未完成** → **停止询问**——请用户归档旧 goal.md 或确认覆盖（常规 `/apt-goal` 目标会被本命令静默改写）
  - **`playbook-state.json` 含 `programMode`** → 幂等重入（重写三件 + goal.md + goalSha，现行为不变；**运行锁在 ∧ state 非终态时禁止**，收敛产物走 §1.5 inbox）
- **先写 `.apt/goal.md` 再算 goalSha**（顺序不可倒）：goal.md = frontmatter（`pmUi:` 按 apt-goal Step 0.5 同款智能检测写入）+ 正文「批量处理 N 项需求/bug，队列见 .apt/batch/queue.md」。**frontmatter 禁写 `sourceDoc:`**——gate 对 sourceDoc 绑定有 CONSTRAINTS_MISSING / HARNESS_MISSING **两道**校验；页数对账挂 `state.constraints.pages`（refine 流才写，intake 不写不触发）；队列绑定走正文一行 + state `source` 字段审计留痕（gate 不校验）。
- **goalSha 计算式**（与 `templates/goal-runner/playbook-gate.cjs` 的 `sha256File` 逐字同源）：

  ```
  goalSha = sha256( readFileSync('.apt/goal.md','utf8') ).digest('hex')
  ```

  即 goal.md **文本内容（utf8）的 SHA-256 小写 hex**（出处：playbook-gate.cjs L50-52 `sha256File`；`templates/goal-runner/README.md`「goalSha = .apt/goal.md 内容 sha256…示例为 goal 文本（utf8）的 sha256，可自行复算验证」）。复算命令：

  ```bash
  node -e "const c=require('node:crypto'),f=require('node:fs');console.log(c.createHash('sha256').update(f.readFileSync('.apt/goal.md','utf8')).digest('hex'))"
  ```

- 骨架字段：`goalSha`（上式）/ `source`（`{path: ".apt/batch/queue.md", sha: queue.md 同式 sha256}`）/ `createdAt` / **`programMode: true`** / `slices[]`（**每队列项一片，`id` = 队列 ID**；`description` 用 FDD 语法一句话（动作 + the 领域对象 + for 角色）；`status: "pending"`；片内 `steps[]` 按 §3 分流预画 `{id: "PB-1..N", action, done-when, status: "pending"}`）/ **`cursor: 0`** / 顶层 `steps: []`（切片循环随片推进回填——gate 完成判据要求全步终态 ∧ 顶层 verify PASS，由执行循环负责，intake **禁止预填** verifyResult/finishedAt 等终态字段；回填 id 命名 `<sliceId>:PB-n`（片内预画 `PB-1..N` 为局部编号，规则见 `_apt-goal-loop.md` §3））
- **ACCEPT-BATCH 哨兵切片**：派发前（自动派发与 `--start` 同规）**带 `--accept` ∧** accept 台账 `.apt/batch/accept-ledger.md`（§4.4）非空 → 在 `slices[]` 末尾追加固定尾切片（`id: "ACCEPT-BATCH"`，id 固定、**恒居末位**——片间检查点新切片一律插于其之前，见 `_apt-goal-loop.md` §3）；缺 `--accept`（缺省 defer）或台账为空则不加。它是普通切片（终点步 = accept，gate 既有「accept Overall PASS」判据天然覆盖，零执行器改动），片内 steps 预画：
  1. **环境自动准备**：先跑环境探针——被测应用已在跑则直接用；未运行则**自动启动本地开发服务**（探测项目 dev 命令，如 package.json `scripts.dev`；queue 头 `启动命令`/`关闭命令` 为可选覆盖字段，用户显式给定则优先），等待探针就绪——探测失败 / 启动超时 / 探针不通 → **BLOCKED** 安全停
  2. **批量验收（单一调用）**：`$apt-accept --batch --provenance=sentinel`（provenance=sentinel 豁免 running.lock 检查——哨兵在 loop 内运行时锁必在，仅跳锁检查、不绕 points/gate/报告机制；「`--batch` / `--provenance`」为 accept 侧旗标，仅在哨兵调用串出现，不登记进本命令输入表）
  3. **汇总**：以 ACCEPTANCE-REPORT Overall 为终点步判据
  4. **收尾**：只关闭本切片自启的进程（用户预先在跑的应用不动）
- **幂等重入（仅无运行锁时允许）**：重跑 intake = 重写 goal.md + queue + state（goalSha 随新 goal.md 重算）；运行锁在 ∧ state 非终态 → 禁止重写，收敛产物走 §1.5 inbox 暂存；产出后**禁止再改 goal.md**（改了 → `--continue` goalSha 校验不匹配 → 停问，见 apt-goal.md §1 参数表）
- **不写 `.apt/status.json`**（MCP 服务端自管，goal loop 负责）

### 4.3 `.apt/batch/pending-approvals.md`（待批清单——白天人审停点）

逐条列出执行期会卡人审的项：**高风险 spec 待批** / `_pages.md` approved ≠ yes / **refine 确认**（armed 项目涉既有页）/ **截图观察存疑** / **mini-spec 判 high 待白天批**（第三分流产出）。每条含：队列 ID + 待批类型 + 白天清障动作（批 spec / 标 approved / 跑 `$apt-create --refine` / 确认观察）。无待批项也写文件，正文记「（空）」。

### 4.4 `.apt/batch/accept-ledger.md`（accept 台账——验收真源：单元/标准/状态的单一载体）

全部已确认就绪项的验收清单（辅助产物，不计入「三件套」；**验收真源**——批末 `$apt-accept --batch` 以台账为主源枚举验收单元），行格式：

**`<队列ID> → <切片id> → <验收标准摘要（分号分隔）> → <复现步骤引用> → <状态>`**

- **成员规则**：**全部已确认就绪项**入账（页面项与非页面项都入——页面项同时保留既有 `--page=<id>` 单页手工验收路径，批末轮统一走 `--batch`）；泊车 / 半收敛项不入账（无切片即无验收单元）
- **验收标准摘要（必填）**：bug 类 = 轻链 §0.2 落痕验收标准（1–3 条，分号分隔）；需求类 = 收敛记录「验收」可判定标准——收敛（§2）时随三件套写入台账，不得只存在于 plan 头部（RP 枚举源必须在台账）
- **复现步骤引用**：bug 类必填 = 片内复现测试路径（先红后绿沉淀，batch 轮优先重放登记）；需求类记「无」
- **状态机**：`pending-acceptance | cleared | pending-user-confirm`——入账时全行 `pending-acceptance`；**AI 自答单元**（queue.md `确认` 字段 = `AI 自答`）**入账时行内即标注「AI 自答」**（供 accept 侧消费：验收 PASS 后转 `pending-user-confirm` 不清账，用户显式确认才 `cleared`，报告单列；其余已确认单元 PASS 直接 `cleared`）
- **欠账三载体统一清法（ledger 为单一计数源与状态源）**：queue「待验收」标记与终态「欠账 N」均从 ledger 状态行推导——补跑 `$apt-accept --batch` overall PASS → 非 AI 自答行（`pending-acceptance`）转 `cleared`；AI 自答行转 `pending-user-confirm`（见上）→ queue 对应项「待验收」标记清除 → 欠账 N 归零；`pending-user-confirm` 不清（等人显式确认）；BLOCKED 单元保持 `pending-acceptance`（下轮补跑重验）
- **单写者**：intake 产出三件套时依 queue 生成（自动派发 / `--start` 同规；全部已确认就绪项汇总入账；无就绪项则台账为空——哨兵切片不加，见 §4.2）；片间检查点追加项同步维护

## 触发规则（队列驱动连续执行）

三件套产出完毕（§4.1–§4.3）后、停车呈现（§4.5）前，主会话执行**触发判定**：查 `.apt/batch/running.lock`（§6.3）与队列就绪态。**就绪（机械定义）**：就绪项 = `确认: 已确认` ∧ 未挂待批——即已在 state `slices[]` 生成切片的队列项，与泊车互为补集（待批 / 半收敛项泊车不生成切片，见 §4.1「泊车」字段）。判定按**四态分流**（结果即 §4.5 摘要的「执行体状态」）：

- **无锁 ∧ 有就绪新任务 ∧ 预授权在位 → 自动派发（执行体自动启动）**：主会话**自动派发单个后台编排 agent** 执行 `/apt-goal --continue`——**不需要用户敲任何命令**。派发形态见 §6.1（后台必选）；prompt 契约见 §6.2，**零改动**——prompt 必须自包含（不依赖本会话上下文，不依赖子 agent 内调 Skill 工具），执行体内部**照常派发实现子 agent**（串行，禁止 inline 编码）。派发前写锁（§5「运行锁前置」/ §6.3）。派发失败 → §4.5 摘要报告失败原因，`--start` 为手动重试入口。
- **有锁（执行体存活）→ inbox 排队**：新任务全部改写 `.apt/batch/inbox/pending-batch.md`（§1.5 既有路由，不变），由存活执行体**片间自取**（`_apt-goal-loop.md` §3，机制不变）。
- **未预授权 → 挂起**：不派发；§4.5 摘要显示「待预授权」并呈现**预授权清单**（按工具类别：**子 agent 派发 / 读写 / 执行**）；用户配置后下一任务到达自动重试。
- **无锁 ∧ 无就绪新任务 → 不派发（摘要呈「未触发」）**：本批全为泊车项（待批 N 项不生成切片）等场景下无就绪项，不派发执行体；**人批通过后随下一收敛触发 / `--start` 启动**。

**泊车规则**：待批清单非空的项**不阻塞触发与执行**——该类项在 `.apt/batch/queue.md` 标「待批泊车」，**不生成切片**（state `slices[]` 只含就绪项）；**人批通过 → 该项转入 inbox**：执行体存活时片间自取，空闲时随下一轮触发一并派发。半收敛项同规泊车（§4.1 `确认` 字段）。

**`--start` 降级**：`--start` **不再是必经入口**，语义 = **手动确保执行体在跑**——空闲 → 派发；存活 → 报告状态；未预授权 → 列清单挂起（自检四条件见 §5）。用途：自动派发失败后的手动重试与调试。

## 4.5 停车线（命令终态）

三件套产出完毕（§4.1–§4.3）并完成**触发判定**（「触发规则（队列驱动连续执行）」节）→ 主会话呈现**固定终态摘要**并停车，**本命令就此终止**。摘要固定要素：

- **本次入队数**（P1/P2/P3 分布；**检查类批可为 0 项**——零发现时记「无队列项（审计结论已呈现）」）与**重复略过数**（逐条「略过：与 X 重复」，§2）
- **队列未完成总数**（含既有未终态项与 inbox 待并项）
- **待批泊车清单**：`.apt/batch/pending-approvals.md` 逐条（§4.3）
- **AI 自答收敛项单列**：逐项附证据链（文件:行 / 截图），**用户可当场推翻**——推翻 → 重收敛或移出队列
- **执行体状态**（四态之一）：**已自动启动**｜**inbox 排队**（执行体存活，新任务片间自取）｜**待预授权**（预授权清单未配置，挂起待配置）｜**未触发**（无就绪项——待批 N 项泊车，人批后随下一收敛/`--start` 启动）

摘要呈现完毕，主会话**就此打住**：可继续投喂下一批（重入 §2）、可只读查进度，**不开启任何实现链**（见硬规则）。

**「立即修」合法分流**：用户确需「现在就修」→ 明示引导**退出 intake 主会话**，直接走 `/feature` 单件链（与本队列解耦）——intake 不承担即时修复。

## 5. `--start` 自检（四条件，手动触发入口）

`--start` 语义 = **手动确保执行体在跑**（空闲 → 派发 / 存活 → 报告状态 / 未预授权 → 列清单挂起，见「触发规则（队列驱动连续执行）」节），不再是必经入口。自检四条件**机械判据**，任一硬条件 FAIL → 拒绝启动，**逐行列清障动作**：

| # | 条件 | 判据 | 拒绝时清障动作 |
|---|------|------|----------------|
| 1 | 待批项**已泊车**（硬） | `.apt/batch/pending-approvals.md` 非空项已逐项在 queue.md 标「待批泊车」∧ state `slices[]` 不含待批项——**泊车不阻塞就绪项执行**，`--start` / 自动派发照常放行就绪项 | §4.5 摘要逐条列出待批清单与清障：批 spec → 跑对应审批；approved ≠ yes → PM 核对后标 yes；refine → 跑 `$apt-create --refine`（H1–H3 人审闸）；截图存疑 → 用户确认收敛记录——**人批通过经 inbox 转入执行**（待批项不拒启动，但永不绕过人审直接成片）；**待批项残留 slices / 未泊车（数据不一致）→ 补泊车标记 ∧ 从 state `slices[]` 移除其切片（幂等重建 state 泊车字段），修复后重跑** |
| 2 | MCP 探活（硬） | `query_project_status`（无参）返回可解析 JSON（业务 blockers ≠ MCP 不可用） | 输出 FAIL 报告 + 修复 checklist（`templates/_mcp-preflight.md`），修复后重跑 `--start` |
| 3 | token 粗估（展示，非硬拒） | 展示「N 项 × 每片约 5–10M 子 Agent tokens = 总量区间」+ 预估时长；带 `--accept` ∧ accept 台账非空 → 预算粗估**把验收单元数计入**（ACCEPT-BATCH 哨兵切片批量验收开销，§4.2）。**不要求预记启动命令**——被测应用未运行由哨兵切片自动启动本地开发 | 超预算 → 给分批建议（P1 优先片先跑：重跑 intake 只留 P1 批），用户选继续 / 分批 |
| 4 | 工具**预授权**核对（硬） | 派发前核对**工具预授权清单**已配置——按工具类别：**子 agent 派发 / 读写 / 执行** | 未预授权 → **挂起拒启动**，逐项列出缺失类别（配置后重跑 `--start`，或等待下一任务到达自动重试）；**无前台回退选项**（§6.1；用户明示同意的接管编排除外——见 `templates/_apt-goal-loop.md`「主会话接管编排」节） |

**运行锁前置**：四条件通过 → 先写 `.apt/batch/running.lock`（§6.3）再派发后台编排 agent（§6.1；`--fg` 显式调试链入同规先写锁）。

## 6. 派发与执行（后台必选，主会话零占用）

### 6.1 派发形态

- **后台派发（默认且唯一自动路径）**：ZCode（Agent 工具 `run_in_background`）、Claude Code（后台 subagent）等支持后台子 agent 的平台 → 主 agent 派**单个后台编排 agent** 执行 goal 循环（§6.2 prompt 契约零改动）；主会话保持可交互——问答 / 只读查进度（读 state 游标与 playbook 勾选）/ 收敛下一批（走 §1.5 inbox）。派发后按 §6.6 询问用户是否加看门（仅 ZCode）。
- **`--fg` 显式前台（仅调试用，非自动路径）**：仅当用户**显式键入 `--fg`** 才前台链入——同会话调起 `/apt-goal --continue`（平台无斜杠时用 Skill 名 `apt-goal` 传参 `--continue`）；**派发前必须警告「前台链入将占用主会话，期间输入将排队」**，经用户确认才执行。
- **平台不支持后台子 agent → 提示后提供接管选项**：提示「当前平台不支持后台子 agent」后提供接管选项——用户明示同意 → **主会话接管编排**（按 `templates/_apt-goal-loop.md`「主会话接管编排（平台豁免形态）」节执行——机制真源，本节不复制正文：实现子 Agent 由主会话 Agent 工具派发、串行、主会话不 inline）；不同意 → 挂起换平台（原行为，预授权清单照常呈现）。**自动前台链入路径废止**——主会话零占用是硬约束（接管编排为平台强制豁免形态，见引用节）。
- **`--continue` 契约**（apt-goal.md §1，后台派发与 `--fg` 调试共用）：从已存在的 `.apt/goal.md` 恢复（不覆盖）、读 state、goalSha 校验通过从游标续跑。

### 6.2 后台派发 prompt 要点（必须自包含）

后台 agent 是全新上下文：派发 prompt 不得依赖本会话状态，**不得依赖子 agent 内再调 Skill 工具**。要点：

1. **身份**：APT goal 循环执行体（夜间批量，programMode 切片循环）。
2. **Preflight**：先 `query_project_status` 探活；FAIL → 输出 FAIL 报告终态退出，禁止半套 APT 开跑。执行体上下文**无 MCP 工具时**走**批准的降级通道**：stdio JSON-RPC 直连探活——已装服务器 `~/.apt/mcp-server/dist/index.js` 或项目内构建 `mcp-server/dist/index.js`（env `APT_PROJECT_ROOT`=项目根；win 路径 `%USERPROFILE%\.apt\mcp-server\dist\index.js`），initialize → tools/call `query_project_status`，超时 ≥60s——探活语义不变。
3. **读指令与状态**：读已部署 apt-goal skill（`.zcode/skills/apt-goal/SKILL.md` 或对应平台路径）及其引用的 `templates/_apt-goal-loop.md`（项目内无该片段时以 SKILL.md 内联条文为准）；读 `.apt/goal.md` + `.apt/goal/playbook-state.json`，做 goalSha 校验。
4. **执行**：按 `/apt-goal --continue` 语义逐轮执行（七要素 / 程序模式切片循环 / 失败自治阶梯 / 四护栏 / 顶层 steps 回填，全以所读条文为准；实现阶段照旧派发子 Agent 串行，禁止 inline 编码）直至终态。
5. **终态**：loopDone（playbook-gate exit 0 + DELIVERY-SUMMARY 落盘）｜护栏 halt｜人工停点（高风险 `await_spec_approval` / `awaiting_human_refine`）——后台**无交互通道**，人工停点一律**落 state 标记后结束回合**，禁止空转等待；「四问白话」等呈现型内容写进终态报告。**loopDone 欠账提示**：`.apt/batch/accept-ledger.md` 仍有 `pending-acceptance` 行（缺省 defer 批，或带 `--accept` 而 batch 轮未全清）→ 终态报告增欠账提示行「**验收欠账 N 项**（N = ledger `pending-acceptance` 行数，ledger 为单一计数源），`$apt-accept --batch` 补跑或挂验收看门」，并询问用户是否挂**验收看门**（§6.7）。
6. **锁与终态收尾**：loopDone → `playbook-gate` exit 0 → 清 `.apt/batch/running.lock` → **push 当前分支至其 upstream**（`git push`；无 upstream 或 push 失败 → WARN 呈终态报告，不阻断；push 在清锁之后）；halt / 人工停点**保留锁**（批次未完，见 §6.3）。
7. **最终消息** = 终态报告（DELIVERY-SUMMARY 或 halt / 停点报告），主 agent 收到完成通知后转达用户。

**平台实证注记（2026-09-06 实测）**：部分平台后台编排子 Agent 自身**无派发子 Agent 的工具**——此时执行体落结构化标记 `state.halt = { reason: "no-dispatch-channel", at }` 后结束回合（同 §6.2 第 5 点），主会话接管编排；接管机制真源见 `templates/_apt-goal-loop.md`「主会话接管编排（平台豁免形态）」节（触发 / 豁免声明 / 看门互斥 / 双轨裁定 / 契约四要素 / push 细则），本节不复制其正文。

### 6.3 运行锁 `.apt/batch/running.lock`

- **写**：启动前（自动派发 / `--start` / `--fg` 前台对称都写）：JSON `{startedAt, goalSha, dispatcher: "apt-intake"}`。
- **清**：仅 loopDone（gate exit 0 后）或用户**明确弃批 / 归档**；halt 与人工停点不清（批次未完）。
- **陈旧与冲突判定**：锁在 ∧ state 全步终态 ∧ loopDone 语义 → 陈旧锁，提示用户确认后清除；锁在 ∧ state 非终态 → 新收敛触发（自动派发判定或 `--start`）**停报告**（上一批停在何处、`/apt-goal --continue` 续跑或明确弃批），禁止在非终态 state 上直接重写启动。

### 6.4 运行期并发契约

锁在期间，主 agent（含用户新指令）对 `.apt/goal.md` / `.apt/goal/playbook-state.json` / `.apt/goal/playbook.md` / `.apt/status.json` / `.apt/batch/queue.md` **只读**——循环每轮重读 state、子流程后刷新 status，并发写 = 游标 / 终态漂移（最坏整批重放）。进度播报只读 state 游标与 playbook 勾选；新一批收敛一律走 §1.5 inbox。**接管编排模式豁免**：主会话为编排者，state / goal 台账写为其编排职责（本节只读约束豁免，机制见 `templates/_apt-goal-loop.md`「主会话接管编排（平台豁免形态）」节）；新需求仍走 inbox。

### 6.5 中断与恢复

- **后台 agent 异常死亡 / 会话关闭**：锁与 state 留存（即进度快照）。恢复出口 = 手动 `/apt-goal --continue`——幂等由 goalSha 校验保证（state 游标 + 切片终态驱动续跑；state 损坏自动降级 classic 并提示重建）；续跑至 loopDone 时同样按 §6.3 清锁。
- **人工停点恢复**：用户完成对应动作（批 high spec / 跑 `$apt-create --refine` 等）后 `/apt-goal --continue` 续跑。

### 6.6 看门续跑（可选，仅 ZCode CronCreate）

后台派发后可加**看门**：执行体死亡 / 会话关闭后，由定时自动化按机械判据唤醒续跑，直到 loopDone。看门只做「唤醒 + 判定 + 续派」，**零新执行语义**——执行契约复用 §6.2，锁契约复用 §6.3，恢复语义复用 §6.5。

- **建立时机**：后台派发（自动或 `--start`）完成后询问用户是否加看门（默认不加）；同意 → 主 agent 调 CronCreate：`recurring: true` + `intervalUnit: "minute"` + `interval: 30`（用户指定间隔则改；title 含间隔措辞，如「APT 批量看门（每 30 分钟）」）。
- **每轮 firing 判定**（prompt 自包含；逐轮**独立判定**，不依赖前次 firing 记忆；禁止 firing 内再调 CronCreate）：
  1. 读 `.apt/batch/running.lock` + `.apt/goal/playbook-state.json`（state 损坏 / 不可解析 → 报告 + CronDelete 自删）。
  2. 锁不存在 → 批次已结束：CronList 定位本自动化 → CronDelete → 一行报告收尾。
  3. 锁在 ∧ state 全步终态（loopDone 语义）→ 陈旧锁：报告请用户按 §6.3 确认清锁，CronDelete 自删。
  4. 锁在 ∧ **人工停点**（state 任一步 status ∈ {`halted`, `awaiting_human_refine`} ∨ `.apt/status.json` phase ∈ {`spec_pending_approval`, `blocked`}；**排除 `state.halt.reason="no-dispatch-channel"`**——通道 halt ≠ 人工停点，主会话接管中）→ **只报告等人，不派发不删**（人处理后下一轮 firing 自动续跑；看门禁止替人批 spec / 代确认 refine）。
  5. 锁在 ∧ 非终态 ∧ 无人工停点 → 查会话存活执行体（后台任务）：存活 → 本轮不动；`state.halt` 在 ∧ 无后台执行体 → **不派发**（主会话接管中），本轮结束；无存活（含会话重启后认知丢失）→ 按 §6.2 七要点派发**新的后台编排 agent** 续跑（goalSha 校验兜底）。
  6. 判定不确定（执行体死活无法确认）→ 不派发——**漏跑优于双跑**。
- **平台限定**：无 CronCreate 原语的平台不提供看门（不建新调度器，维持零新执行引擎）；用户可随时 CronList → CronDelete 手动移除。

### 6.7 验收看门（可选，仅 ZCode CronCreate）

欠账批（缺省 defer，或 `--accept` 批 batch 轮未全清）loopDone 终态报告询问用户是否挂**验收看门**（默认不挂）；同意 → 主 agent 调 CronCreate（复用 §6.6 CronCreate 模式）：`recurring: true` + `intervalUnit: "minute"` + `interval: 30`（用户指定间隔则改；title「APT 验收看门（每 30 分钟）」）。看门只做「判定 + 补跑验收」，**零新执行语义**——执行契约 = `$apt-accept --batch --provenance=watchman`（provenance=watchman 受 accept 侧并发守卫约束：执行体存活锁在 → BLOCKED 拒跑，不写 ledger/queue）。

- **每轮 firing 判定**（prompt 自包含；逐轮**重读失败计数载体**——连续失败次数不赖 firing 会话记忆，载体见第 4 条；禁止 firing 内再调 CronCreate）：
  1. 读 `.apt/batch/running.lock` + `.apt/goal/playbook-state.json` + `.apt/batch/accept-ledger.md`（ledger 缺失 / 不可解析 → 报告 + CronDelete 自删）。
  2. 锁在 ∧ state 非终态（执行体存活）→ 本轮不动（不与执行体并发双写；漏跑优于双跑）。
  3. 锁在 ∧ state 全步终态 / loopDone 语义（陈旧锁）→ 报告请用户按 §6.3 确认清锁，CronDelete 自删（对齐 §6.6 既有分支）。
  4. 锁不在 ∧ ledger 存在 `pending-acceptance` 行 → 自动跑 `$apt-accept --batch --provenance=watchman` → overall **PASS**（清账完成：非 AI 自答行转 `cleared`、AI 自答行转 `pending-user-confirm`——§4.4 清法 → queue「待验收」清除 → 欠账 N 归零）→ CronList 定位本自动化 → CronDelete 自删 + 一行报告；BLOCKED / FAIL → 保留欠账下轮再试——**连续失败计数以 ledger 行内 `watchman-fails` 标注或最近一次 batch 报告残留为载体，逐轮重读该载体累计；至多连续 3 次失败后 CronDelete 自删并报告**（防空转）。
  5. 锁不在 ∧ ledger 无 `pending-acceptance` 行（无欠账）→ 验收已清：CronDelete → 一行报告收尾。
  6. 判定不确定（执行体死活 / ledger 状态无法确认）→ 本轮不跑——漏跑优于双跑。
- **不代用户确认**：`pending-user-confirm` 单元（AI 自答，§4.4）不属欠账，看门**禁止代用户确认**（等人显式确认后转 `cleared`）。
- **平台限定**：无 CronCreate 原语的平台不提供看门；用户可随时 CronList → CronDelete 手动移除。

## 待实测台账（条文已落、实战未验证）

> **状态显式标注：本节各项机制「条文已落、实战未验证」**——条文验收只保证形状，行为验证由**下一轮实战批量 + 本台账探针**承接。每项五字段：机制 / 触发条件（何时必须测）/ 验证探针（怎么测）/ 判过标准 / 责任者（= 下一轮实战批）。任一项实战通过后回填「已验证 <日期>」。

| # | 机制 | 触发条件（何时必须测） | 验证探针（怎么测） | 判过标准 | 责任者 |
|---|------|------------------------|--------------------|----------|--------|
| 1 | 接管全路径（执行体 halt 落 `state.halt={reason:"no-dispatch-channel"}` → 主会话接管 → loopDone） | 无二级派发通道平台首次实战批 | 走查：halt 落标记 → CronList 看门互斥检查（移除 / 同意保留）→ 用户同意 → 主会话按 `_apt-goal-loop.md` 接管节派发实现子 Agent → gate exit 0 | 全链无第二执行体、无 inline 编码、锁仅 loopDone 清、接管完成清除 `state.halt` | 下一轮实战批 |
| 2 | 归档 → 幂等重写全路径（§1.5 第二批四细则） | 旧批 loopDone 后投喂第二批 | 走查：`archive/<date>-<slug>/` 整目录移动 → §4.2 覆盖写新批 → 中断重跑 | archive 已存在 → 跳过归档直接重写；新批 ID 接续旧批最大号；goal.md 由 §4.2 归档不双重归档；泊车项带回收敛输入 | 下一轮实战批 |
| 3 | 查重例外新面（§2 四要件） | 收敛者 = 修复者会话内同 bug 复发 | 走查：四要件逐条对照 → 略过 / 推翻入队两分支 | (a)–(d) 全满足才例外；跨会话维持「复发 = 新项」 | 下一轮实战批 |
| 4 | push 终态收尾（含无 upstream 分支） | 任一批 loopDone 收尾 | 走查：gate exit 0 → 清锁 → `git push`；构造无 upstream / push 失败场景 | push 在清锁之后；无 upstream 或失败 → WARN 呈终态报告、不阻断、不悬挂锁 | 下一轮实战批 |
| 5 | ACCEPT-BATCH 哨兵切片（`--accept` opt-in + `--batch` 改写） | 带 `--accept` ∧ 台账非空的批跑到末位切片；另测缺省 defer 分支 | 走查：缺 `--accept` → 哨兵不生成（台账全行 `pending-acceptance` + queue「待验收」+ 终态欠账提示）；`--accept` 在 → 哨兵恒居末位 → 环境自动准备 → 单一 `$apt-accept --batch --provenance=sentinel` → ACCEPTANCE-REPORT Overall 判定 | 台账单元全验收；单元失败按来源切片归因重跑 ≤2 轮；只关自启进程 | 下一轮实战批 |
| 6 | 看门（§6.6，仅 ZCode CronCreate） | 用户同意加看门的夜间批 | 走查：杀执行体 → 下一轮 firing 判定 → 续派 | 至多一执行体存活；人工停点只报告不派发；`no-dispatch-channel` 不误报为人工停点；漏跑优于双跑 | 下一轮实战批 |
| 7 | 多批并发（inbox 片间自取 × 连续投喂） | 执行体存活期间连续投喂 ≥2 批 | 走查：inbox 排队 → 片间检查点并入 → 队尾不重排 / goalSha 不变 / 单写者 | 无游标漂移、无整批重放、新切片插于哨兵之前 | 下一轮实战批 |

## 硬规则

- **禁止掀 `.ai/arch/`：** **禁止**删除或清空 `.ai/arch/`。**禁止**不排除 `.ai/arch`（或 `last-scan.json`）的 `git clean` force / `-fd` / `-fdx` / `-x` / untracked。
- intake 是**提示词命令**，不亲自实现任何队列项；执行一律交给 `/apt-goal --continue` 切片循环的**后台编排执行体**（自动派发为唯一自动路径；`--fg` 仅用户显式键入的调试例外，见 §6.1）
- **主会话禁止开实现链**：收到实现意图信号（「修了吧」「先修这个」「顺手改掉」「开始做」等）→ 响应仅为：告知执行体状态（**已自动接手** / **inbox 排队**）或将其 **inbox 入队**——`/feature`、`plan_from_spec`、`implement_plan`、`verify`、`finish_feature`、fix 等**实现链步骤逐个点名禁跑**，主会话一个都不开（即时修复唯一合法出口 = 「立即修」分流，见停车线节）；**接管编排形态除外**——实现仍由主会话派发的子 Agent 串行执行，主会话自身不 inline 编码（机制见 `templates/_apt-goal-loop.md`「主会话接管编排（平台豁免形态）」节）
- **主会话职责白名单**：intake 生命周期内允许动作**仅限**——Preflight / 收敛问答 / 三件套产出 / 触发派发 / 进度只读报告 / inbox 入队 / 分流提示；**白名单外一律拒绝并给出正确入口**（如「立即修」→ 退出 intake 走 `/feature` 单件链）
- **待批项泊车不阻塞就绪项执行**：待批项在 queue.md 标「待批泊车」**不生成切片**（人审停点前置不变，禁止「先跑再说」直接成片）；就绪项照常触发自动派发 / inbox 排队；**人批通过经 inbox 转入执行**（见「触发规则（队列驱动连续执行）」节）
- state 骨架字段必须与 `playbook-state.json.example` 兼容（programMode / slices / cursor 语义一致），禁止臆造字段
- goal.md 定稿后禁改；队列变更走重跑 intake（幂等重写三件 + goal.md + goalSha）
- **运行锁在 ∧ state 非终态：禁止重写三件套 / goal.md**——新收敛一律 §1.5 inbox，新收敛触发（自动派发判定 / `--start`）停报告提示续跑，禁止抢写
- **后台派发 prompt 必须自包含**（不依赖本会话上下文，不依赖子 agent 内调 Skill 工具）
- **后台遇人工停点：落 state 标记结束回合，禁止空转等待；loopDone 才清锁**（弃批须用户明示）
- **看门至多一执行体存活；判定不确定不派发（漏跑优于双跑）；人工停点只报告不续跑**（仅 ZCode，见 §6.6）
- **验收看门只补跑验收（`--batch --provenance=watchman`）；连续 3 次失败自删；不代用户确认 `pending-user-confirm`**（仅 ZCode，见 §6.7）
- 截图原件必归档 `.apt/batch/screenshots/`；解读观察必须可追溯（写入收敛记录并经用户确认）
