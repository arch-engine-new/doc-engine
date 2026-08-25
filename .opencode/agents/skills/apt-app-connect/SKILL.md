---
name: apt-app-connect
description: App 原生开发全流程：复制原型→迁移清单+Connect Ledger→connect-gate 强契约→先 feature 补后端→再对接清 mock（消费像素级规格+bindings）→验收闭环。目标仓不存在时由 Task S 创建原生工程（禁复制源工程）；仅页面逻辑的页豁免像素规格（specWaived）。缺接口不中断、不做完不结束；完成靠机制非提示词。
---

# $apt-app-connect <源工程路径> <目标工程路径> --platform=<one>

你是 **APT App 原生开发编排代理**。把 PM 的原型工程对接为**单平台**原生目标仓，走完整标准闭环。

> 本命令是 Web `$apt-frontend-connect` 的 App 分支：必填 `--platform`，强制消费**像素级规格载体**（`page.spec.*`）与 `native-bindings/<platform>.json`。  
> 只保证编排消费测量级载体；禁止任何「保证…还原到原生」类过满承诺。

**强要求 ≠ 提示词：** 对接完成判定靠 `.apt/connect/` 账本 + `connect-gate.cjs` exit 0，**不是提示词**自觉。详见共享闸门 `templates/_connect-strong-contracts.md`（下文亦内联强制点）。App 额外强制 `.apt/connect/platform.json`。

## 命令参数

```
$apt-app-connect <源工程路径> <目标工程路径> --platform=swiftui|compose|react-native|flutter
```

| 参数 | 必填 | 规则 |
|------|------|------|
| 源工程路径 | 是 | PM 原型工程（含 `designs/v0/` 或可 discover） |
| 目标工程路径 | 是 | 该平台的原生仓（一仓一平台） |
| `--platform` | **是** | 恰好一个；必须是 `swiftui` \| `compose` \| `react-native` \| `flutter`；且 ∈ `.apt/project.json` 的 `targetPlatforms` |

两个路径参数都必须显式指定。不猜测、不默认。

多平台示例（同一份 `page.spec.*`，三次独立 connect）：
```
$apt-app-connect D:\proto\app D:\app-ios --platform=swiftui
$apt-app-connect D:\proto\app D:\app-android --platform=compose
$apt-app-connect D:\proto\app D:\app-flutter --platform=flutter
```

## 核心顺序（必须遵守）

1. 发现缺后端接口 → **写清楚「缺少后端接口」**（`migration-<platform>.md` + `required-apis` status=`missing`），不跳过、不假装已有。  
2. 对接实现时 → **先按 `/feature` 模式补齐缺失后端**，再 mock→API / 原生接线。  
3. **不要中断、不要不做完**：禁止只完成复制/清单就宣称结束；会话过长则按 plan 续跑，直到后端缺口清掉且该平台对接完成，且 **gate `stage=done` exit 0**。

```
复制/扫描 → migration-<platform>.md + Ledger + platform.json → gate ledger → plan → gate plan
  → Phase 4a 补后端 → gate backend → Phase 4b 清 mock + 原生对接 → gate wire
  → verify → gate done → finish
```

（目标仓不存在时：禁止复制源工程，plan 首排 Task S 平台脚手架、Phase 4 先跑 Task S 再 Task A/B；五道 gate 顺序不变。）

## Connect 强契约（机制）

见 `templates/_connect-strong-contracts.md`。摘要：

| Phase | 必须跑 | 未过则 |
|-------|--------|--------|
| 2 后 | `--stage=ledger` | 禁止 Phase 3 |
| 3 后 | `--stage=plan` | 禁止 implement |
| 4a 后 | `--stage=backend` | 禁止 4b |
| 4b 后 | `--stage=wire` | 禁止宣称对接完成 |
| 完成前 | `--stage=done` | 禁止 Overall 完成叙事 |

```bash
node templates/connect-runner/connect-gate.cjs --stage=<ledger|plan|backend|wire|done> --dir=.apt/connect
```

Agent **必须**在目标工程写入：`pages.json`、`required-apis.json`、`required-dropdowns.json`、`mocks.json`、`progress.json`、**`platform.json`（App 必填）**；Phase 3 写 `plan-tasks.json`；延期写 `deferred.json`。示例 schema：`templates/connect-runner/*.example`（含 `platform.json.example`）。

### 禁止（偷懒）

- 无 ledger / 无 `platform.json` / 不跑 `connect-gate` 就进下一 Phase  
- 只更新 Markdown 迁移清单、不写 `required-apis` 等 JSON  
- gate exit ≠ 0 仍宣称「对接完成 / 命令结束」  
- 把缺接口页静默跳过（须 `deferred.json` 显式延期）  
- 跳过原生门禁（`--platform` / `page.spec.*` / native-bindings / `migration-<platform>.md`）

## 工作流

### Phase 0 — Preflight + 原生门禁 + 平台参数 + 目标仓判定 + 复制原型

1. 调 `query_project_status`，确认 MCP 可用。FAIL 则停。
2. 读 `.apt/project.json` 的 `targetPlatforms`：
   - 至少含一项原生：`swiftui` | `compose` | `react-native` | `flutter` → 继续
   - 空 / 仅 web / 无上述任一值 → **FAIL**，停止，并告知：

     > 当前项目无原生 targetPlatforms。请使用 Web 命令 `$apt-frontend-connect`；或先在 `.apt/project.json` 配置原生平台后再跑 `$apt-app-connect`。

3. 解析 `--platform`：
   - **缺失** → **FAIL**：`$apt-app-connect 需要 --platform=swiftui|compose|react-native|flutter`
   - **非法**（非上述四值之一） → **FAIL**：`--platform 非法：必须是 swiftui|compose|react-native|flutter`
   - **∉ targetPlatforms** → **FAIL**：`--platform=<x> 不在项目 targetPlatforms 中：[...]`
4. 从命令参数获取源路径和目标路径（须显式；不猜测）。
5. **目标仓判定**（决定「复制」还是「脚手架」）：
   - 目标工程路径**存在且为对应平台工程**（flutter 有 `pubspec.yaml`；compose 有 `settings.gradle*`；react-native 有 `package.json` 且依赖 react-native；swiftui 有 `*.xcodeproj`）→ 走步骤 6「全量复制 / 增量合并」参考流程（现行流程保留）
   - **目标不存在或非该平台工程 → 禁止复制源工程**（源是 HTML 原型仓，不是原生仓）；改走 Phase 3 的 **Task S 平台脚手架**（`flutter create` / Compose 模板 / RN 模板 / SwiftUI 工程模板）
   - 走 Task S 前**工具链 preflight（必查）**：flutter→`flutter -v`；compose→`java -version` + Gradle；react-native→`node -v` + `npm -v`；swiftui→`xcodebuild -version`（macOS）。缺失 → **FAIL** 并指明装什么（Flutter SDK / JDK + Gradle / Node.js + npm / Xcode）
6. **全量复制**（首次）或 **增量合并**（后续迭代）——仅当步骤 5 判定目标仓为对应平台工程：
   - 首次：整个源工程复制到目标路径。原件不动。
   - 后续：调 `discover_v0_pages` 确定增量范围（新页复制/更新页报告/未变页跳过）
7. 在目标路径执行 `agent-init`（如尚未初始化）。

### Phase 1 — 扫描对接缺口

1. 执行 `start-init --full`（全量扫描目标工程）。
2. 调 `query_connect_status`（无参）获取对接全景：
   - 每页 status / mockFiles / fieldNeeds / backendCoverage / apiLinks  
   - 页级 `status` 枚举：`not-connected` | `partial` | `connected`（契约 `ConnectStatus`）
3. 记录缺口（仅记账，不因此结束命令）。

### Phase 2 — 读 logic + 像素级规格载体 + bindings → 产出迁移清单 + Ledger + platform.json

对每个页面：

1. 读 `designs/v0/<pageId>/page.logic.md`（需求真源）。
2. **可选 applied schema（软引用）**：若存在 `.apt/schema/progress.md` 且 `applied=yes`（或等价），迁移清单 / 缺表缺字段对齐时**优先参考** progress 指向的 `docs/schema/*`；缺失 progress 或未 applied → **继续**，**不 FAIL**。
3. 读 **像素级规格载体**（按页分支）：
   - **原型页**（`designs/v0/<pageId>/index.html` 存在）：照旧强制——
     - `designs/v0/<pageId>/page.spec.json`（测量坐标 / 语义 component id）
     - `designs/v0/<pageId>/page.spec.png`（视觉参考）
     - 任一缺失 → **FAIL**，列出缺文件页；提示先跑 `$apt-app-create` / `$apt-app-ingest` 或 `extract-page-spec.cjs`
   - **零原型页**（仅 page.logic.md、无 index.html）：**豁免像素规格**；`platform.json` 该页记 `"specWaived": true` + 非空 `"waiveReason"`（例：`"mode=logic-only 无原型可提取"`）——**不带 reason 会被 connect-gate ledger 阶段 FAIL（SPEC_WAIVER_MISSING_REASON）**
4. 读 `.ai/design/native-bindings/<platform>.json`（语义组件 → 平台 declaration）：
   - 文件缺失 → **FAIL**，调 `report_design_gap`，停止并提示补绑定后再继续
5. 读 page.logic.md 的「选项数据源」节——**全部下拉必须走接口或字典，无一例外**。
6. 调 `query_connect_status(page)` 确认该页 mock/gap/API 缺口。
7. 调 `query_design`（scope: global）获取语义组件定义。
8. 对 page.logic.md 的 API 意向名调 `query_contract` / `search_arch` 寻址后端接口。
9. 产出**平台迁移清单**（`designs/v0/<pageId>/migration-<platform>.md`）：

```markdown
# 迁移清单 — <pageId> — <platform>

## 像素级规格载体
| 文件 | 状态 |
|------|------|
| page.spec.json | ✅ |
| page.spec.png | ✅ |

（零原型页此节不标 ✅，改记 `specWaived` + `waiveReason`）

## 原生组件映射（native-bindings/<platform>.json）
| 语义组件 | 平台 declaration | 来源 |
|---------|------------------|------|
| PrimaryButton | Button{...} | native-bindings/<platform>.json |
| DataTable | … | native-bindings/<platform>.json |

## Spec 布局要点（来自 page.spec.json）
| 节点 / component | 坐标 / 尺寸要点 | 备注 |
|------------------|----------------|------|
| … | x,y,w,h | 实现阶段对照填写 |

## API 接入表
| API 意向名 | 后端接口 | 状态 |
|-----------|---------|------|
| listUsers | GET /system/user/list | ✅ 已有 |
| createUser | POST /system/user/create | ✅ 已有 |
| exportUsers | 无 | ❌ 缺少后端接口 |

## Mock 清理表
| Mock 文件/变量 | 替换为 |
|---------------|--------|
| services/mock-data/users.ts | GET /system/user/list |
| mockData.ts → roles[] | GET /system/dict/data/list?dictType=role |

## 下拉数据源（全部走接口或字典，无一例外）
| 下拉字段 | 数据来源 | 接口 |
|---------|---------|------|
| 角色 | 字典 | GET /system/dict/data/list?dictType=role |
| 社区 | 业务接口 | GET /property/community/list |
| 楼栋（级联） | 业务接口 | GET /property/house/tree?communityId=xxx |

## 缺失项
- 缺少后端接口：exportUsers → 需按 feature 补 ExportController（写入 plan 后端 Task，排在接线前）
- 缺表：无
- 缺微服务：无
- 缺 bindings：无（若缺 → 已 FAIL + report_design_gap）
```

9. **同步写入 Connect Ledger**（目标工程 `.apt/connect/`，**机制强制**，与上表对齐）：
   - `pages.json`：全页；每页须含 `apis`，并记 `mode`（原型页 `prototype-ref` / 零原型页 `logic-only`，与 Web 命令同枚举）
   - `required-apis.json`：每条 API `status` = `missing` | `ready` | `wired`
   - `required-dropdowns.json`：下拉 → 接口/字典（可空数组，文件必须存在）
   - `mocks.json`：待清理 mock 清单
   - `progress.json`：`phase` 至少推进到 ledger 阶段
   - **`platform.json`（App 必填）**：记录本次 `--platform`、`bindingsPath` / `bindingsPresent`、每页 `page.spec.json` / `page.spec.png` / `migration-<platform>.md` 路径摘要 + `specWaived` / `waiveReason`（零原型页 `specWaived: true` + 非空 `waiveReason`；原型页 `specWaived: false`）（对照 `templates/connect-runner/platform.json.example`）。缺文件 → **FAIL**，禁止进 Phase 3

10. **下拉数据源全部走接口或字典**（无一例外）：
    - 字典类（角色/状态/性别/类型）→ `GET /system/dict/data/list?dictType=xxx`
    - 业务数据（社区/楼栋/房屋/部门/员工）→ 对应业务接口
    - 级联（社区→楼栋→房屋）→ 按联动关系串接口
    - **禁止保留任何硬编码的下拉选项数组**

11. **缺失项处理**（记账，不退出）：
    - **缺少后端接口**（Controller/Service）→ 迁移清单标「❌ 缺少后端接口」+ `required-apis`=`missing` + 汇总表；**必须**进入 plan 的 **feature 式后端 Task**（按业务域拆分）
    - 缺表（DDL/Entity/Mapper）→ 同上，进 plan 后端 Task
    - 缺字段（已有表加字段）→ 同上
    - **缺微服务**（与「缺普通业务接口」不同）→ 提示架构师 `/apt-arch-review`；确认拆分策略后，仍把可落地的接口/BFF 缺口写入 plan；无法本会话落地的写入 `deferred.json`（`reason=needs_arch_review`），**不得**因普通缺接口而结束本命令
    - **缺 native-bindings** → 已在步骤 4 **FAIL** + `report_design_gap`

展示迁移清单汇总（平台=`<platform>` + N 页 + M 个缺少后端接口 + K 个缺表）。  
若仅需用户扫一眼清单：可短暂停顿确认；**确认后必须继续 Phase 3–4，禁止当作对接已完成。**

#### Phase 2 出口闸门（强制）

```bash
node templates/connect-runner/connect-gate.cjs --stage=ledger --dir=.apt/connect
```

exit ≠ 0 → **禁止**进入 Phase 3。App 还须确认 `.apt/connect/platform.json` 已存在且与本次 `--platform` / spec / bindings 摘要一致。

### Phase 3 — 规划

调 `/plan-from-spec`，传入 `migration-<platform>.md` + ledger 作为实现依据。

plan 的 Task **必须**按此顺序：

1. **Task S — 平台脚手架**（仅 Phase 0 判定目标仓不存在时，首个 Task，`kind: "scaffold"`）  
   - 用平台官方模板创建原生工程（模板生成，不走 LLM）：flutter→`flutter create`；compose→Compose 模板；react-native→RN 模板；swiftui→SwiftUI 工程模板  
2. **Task A — 按域 feature 补后端**（仅针对「❌ 缺少后端接口 / 缺表 / 缺字段」）  
   - 每一业务域一个（或一组）Task，模式对齐 `/feature`：补 Controller/Service/Entity/Mapper 等  
   - 多域 **按域拆开串行**，保证索引表完整，避免一上下文塞爆后半截放弃  
3. **Task B — 该平台原生对接**（依赖对应 Task A 完成）  
   - 删 mock + 连 API + 对照 **像素级规格载体** 布局 + 用 native-bindings 组件模板 + 下拉走接口  
   - 每页以 page.logic.md 为 SSOT；布局/像素参考 `page.spec.json`；组件模板来自 bindings  
   - 零原型页（`specWaived`）：以 page.logic.md 结构 + native-bindings declaration + tokens 间距规则落布局，不承诺像素还原  

禁止：只有原生 UI Task、或把「缺少后端接口」的页直接跳过。

同时写出 `.apt/connect/plan-tasks.json`（从 plan 摘录 Task id / kind=`backend|wire|scaffold` / pageIds / apiIds / domain；**Task S 记 `kind: "scaffold"`，其余 kind 不变**），供机检。

#### Phase 3 出口闸门（强制）

```bash
node templates/connect-runner/connect-gate.cjs --stage=plan --dir=.apt/connect
```

exit ≠ 0 → **禁止**调 `/implement-plan`。

### Phase 4 — 实现（两段，都要做完）

调 `/implement-plan`，子 Agent **严格串行**：

#### Phase 4a — 先补后端（feature 模式）

- 只跑 Task A：按域补齐缺失 API / 表 / 字段  
- 每完成一域：回写 `migration-<platform>.md` API 表状态（❌ → ✅ 或注明已实现路径）；同步把对应 `required-apis` 从 `missing` → `ready`  
- **未完成全部 Task A 前，禁止开始清 mock**

#### Phase 4a 出口闸门（强制）

曾标「缺少后端接口」的项应可 `search_arch` / `query_contract` 命中；然后：

```bash
node templates/connect-runner/connect-gate.cjs --stage=backend --dir=.apt/connect
```

exit ≠ 0 → **禁止**进入 Phase 4b。

#### Phase 4b — 再对接原生 UI

- 跑 Task B：删 mock → 连 API → 对照 spec 布局 → 套 bindings declaration → 实现操作/状态/校验 → 下拉走接口  
- 回写 `mocks.json`（cleared/done）与 `required-apis`→`wired`；更新 `progress.json`  
- 调 `query_connect_status`，将快照写入 `.apt/connect/connect-status.json`  
- 若某页仍依赖未补齐的 API → BLOCKED，回到 4a，不得跳过该页假装完成

#### Phase 4b 出口闸门（强制）

```bash
node templates/connect-runner/connect-gate.cjs \
  --stage=wire \
  --dir=.apt/connect \
  --connect-status=.apt/connect/connect-status.json
```

exit ≠ 0 → **禁止**宣称对接完成 / 进入「命令结束」叙事。建议同时调 `check_code_quality`；`highCount>0` 视为未过。

#### 续跑（不要中断、不要不做完）

- 会话过长 / 子 Agent 额度用尽：写入 `.apt/orchestration` 续跑点（下一 Task id）+ 更新 `progress.json`  
- 提示用户对**同一目标 + 同一 `--platform`** 继续 `/implement-plan` 或再次 `$apt-app-connect`（增量），从续跑点接着做  
- **禁止**在仅完成 Phase 0–2 或只完成部分域时输出「对接完成 / 命令结束」；出口须列出尚未过的 `connect-gate` stage

### Phase 5 — 验收

调 `/verify`，既有门禁验收（**无**像素 diff；若存在 `.apt/connect/progress.json`，后续 verify 将含 connect 维）。

FAIL → `/finish-feature` → 重新 `/verify`。

验收前自检：迁移清单中曾标「缺少后端接口」的项应已可 `search_arch` / `query_contract` 命中，且对应 Mock 清理表已处理；否则不得宣称完成。

### Phase 6 — 闭环 + done 闸门

调 `/finish-feature`，同步架构资产。

宣称本命令完成前 **必须**：

```bash
node templates/connect-runner/connect-gate.cjs \
  --stage=done \
  --dir=.apt/connect \
  --connect-status=.apt/connect/connect-status.json
```

exit ≠ 0 → **禁止** Overall 完成叙事。

**N5 对接分级（done 时如实标注）**：done 过闸后必须在 `progress.json` 顶层如实标 `connectLevel`（`prototype|mock|real-backend|production`，缺省视为 `prototype`；gate 会在 done 输出透出该档位）。未到 `production` 时，完成输出须注明剩余升级路径**一句**（例：`connectLevel=mock：后端仍为 mock，需换接真实后端后重跑 done 闸门`）。

**出口**：→ `/current-status`（看进度，确认交付）。

## 约束

- **不自己做实现**——实现归 `/implement-plan` 的子 Agent  
- **原件不动**——所有修改在目标工程上  
- **单平台一次**——一次命令只处理一个 `--platform` / 一个目标仓  
- **迁移清单文件名**——`migration-<platform>.md`（勿写 `migration.md`，避免多平台覆盖）  
- **文案**——只用「像素级规格载体」；禁止「保证…还原到原生」  
- **下拉全部走接口或字典**——无一例外  
- **缺接口 = 记账并先 feature 补齐**——不是退出条件，也不是跳过对接的理由  
- **先后端、后接线**——顺序不可颠倒；`stage=backend` 未过禁止 4b  
- **不做完不结束**——禁止静默半截收工；完成靠 `connect-gate` 机制  
- **缺微服务需架构确认**——与普通缺 Controller 区分；普通缺口走 feature 补齐  
- **缺 bindings 停下**——`report_design_gap`，不猜平台组件  
- **App 账本**——`.apt/connect/platform.json` 必填（platform + bindings/spec/migration 摘要）  
- **迁移清单是 plan 的输入**——不是最终实现；机检以 `.apt/connect/` 为准
- **applied schema 软引用**——有则优先参考 `docs/schema/*`；无则不 FAIL
