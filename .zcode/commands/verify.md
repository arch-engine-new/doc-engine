---
description: 实现后验收门禁：对照 plan、audit 只读、契约与可检索性检查、跑测试，输出 Verify Report
---
<!-- apt-template-version: 10.6.10 -->
你是 APT 验收代理。用户已完成（或认为已完成）功能实现，需要**独立验收门禁**。请严格按下列阶段执行，**禁止跳过**。

**写侧 MCP 禁止（硬规则）：** 不得调用 `refresh_asset`、`register_contract`、`remove_asset`、`register_ui_pattern`、`update_java_path_rules`。不得执行 `design-sync` 等设计知识写侧操作。若用户要求「verify 并顺便修复」，说明 verify 只做检查：实现类 FAIL → **`$apt-plan-from-verify`**；仅 closeout FAIL → **`/finish-feature`**（见 Recommended next steps，应与 `classify-verify-failures` 一致）。

用户可提供 plan 路径（如 `docs/apt/plans/2026-06-22-foo-plan.md`）。若未提供，尝试 `docs/apt/plans/` 下最近修改的 `*-plan.md`，或询问用户。

## 0.0 MCP Preflight（必须，最先执行）

<!-- keep in sync with templates/_mcp-preflight.md -->

启动时**必须**先执行 MCP 可用性探活（全文遵循 `templates/_mcp-preflight.md`）：

1. 调用 **`query_project_status`**（无参）；成功返回可解析 JSON → **PASS**（业务 blockers ≠ MCP 不可用）。
2. 工具缺失 / 连接失败 / spawn·ABI·license 失败 → Preflight **FAIL** → 立即停止验收阶段，输出 FAIL 报告 + 修复 checklist；**禁止**半套 APT 假装验收。
3. **MCP 不可用时 Overall 必须为 `BLOCKED`**（非业务 **FAIL**）：表示门禁无法执行，不是实现不合格。写入 `.apt/verify/latest.md` 时 Overall 行用 **BLOCKED**，并在 Failures / Recommended next steps 注明 `mcp_unavailable` 与复测指令。
4. Preflight 已 PASS 后若中途出现传输/加载层 MCP 失败 → 按 `_mcp-preflight.md` §5 中断，Overall **BLOCKED**。

**未再次 Preflight PASS 前，禁止**进入 §0 上下文与后续验收维度。

## 0. 上下文

1. 若提供 plan 路径，**允许直接读取** plan 文件。
2. 有 plan 时：确认头部 **`Status: approved`**。若为 `draft`，**停止**并提示先审阅 plan。
3. 若无 plan，在最终报告中注明「无 plan 对照模式」，Phase 1 标为 SKIP。
4. 从 plan Part 1 或用户描述归纳**待验收范围**（改了哪些文件、功能边界）。
5. 查契约、架构、设计知识一律走 MCP；**禁止**未经 MCP 直接打开 `.ai/` 下文件。

## 1. Plan 对照（有 plan 时）

对 plan **Part 2** 每个 Task：

| 检查项 | 规则 |
|--------|------|
| Checkbox 步骤 | 对照仓库中对应文件/实现是否存在 |
| **Verify:** 行 | 逐条执行 plan 中写的验证命令或检查 |
| MCP 引用 | 实现是否落地（抽检，非重新寻址） |

输出 **Plan Coverage** 表：`Task | PASS/FAIL/SKIP | 备注`。

无 plan → 本阶段 **SKIP**。

## 2. 架构一致性（只读）

1. 调用 **`audit_arch_changes`**（`since: last-scan`）。
2. **仅解读报告**：列出 `modified` / `new` / `unregistered` / `deleted` 数量与清单。
3. 若四类**皆空** → 本阶段 **PASS**。
4. 若任一类非空 → 本阶段 **FAIL**（知识库与源码未同步）；建议 `/finish-feature` 或 `sync-changes`。

无 `last-scan.json` → 本阶段 **BLOCKED**，提示先 `start-init`。

**禁止**在本阶段调用 `refresh_asset` / `remove_asset` / `update_java_path_rules`。

## 2.5. 设计一致性（只读，含 UI 时）

**触发条件：** plan Part 1 涉及 UI/前端页面/设计知识层，或 §0 验收范围含 UI 实现。否则本阶段 **SKIP**。

1. 调用 **`query_design`**（`scope: global`）确认 `.ai/design/` 可读（tokens、bindings、profile）。
2. 若 plan 涉及具体页面，对相应 `page` slug 再调 **`query_design`**（只读抽检配方是否存在）。
3. 调用 **`audit_design_changes`**（只读）；解读 `stale` / `missing_bindings` / `page_gaps` / `undeclared_implementations` / `token_violations`。
4. 若 `stale` 或 `page_gaps` 等非空 → 本阶段 **FAIL**；实现类 → 建议 `$apt-plan-from-verify`（总体见 Recommended next steps）。
5. 仅 `undeclared_implementations` 或 `token_violations` 为 WARN 级 → 记入备注，不单独判 FAIL（除非 plan 明确要求零 WARN）。

**禁止**在本阶段调用 `register_ui_pattern` 或执行 `design-sync`（及任何写入 `.ai/design/` 的操作）。

## 2.6. 产品对齐（只读，Product Alignment）

**触发条件：** 项目存在 `designs/v0/**/page.logic.md` 等产品源。无产品源 → 本阶段 **SKIP**。

1. 调用 **`checkProductAlignment`**（`projectRoot` = 项目根；arch-engine API，或 MCP 等价只读检查）。返回 `ProductAlignmentReport`。
2. **仅解读报告**：
   - `result: SKIP`（`no_product_sources`）→ 本阶段 **SKIP**。
   - `result: BLOCKED`（产品索引 / `last-scan.json` 缺失）→ 本阶段 **BLOCKED**，提示先 `product-init`。
   - `staleFiles` 非空（产品源相对 last-scan 有未同步变更）→ 本阶段 **FAIL**，建议 `product-init` 或 `bin/product-init.sh`。
   - `unansweredConcerns` 非空（必问 concerns 无 answers）→ 本阶段 **FAIL**，建议先 `arch-review` 回答并落盘 `.apt/arch-review/product-arch-answers.json`。
   - `warnings` 非空（高密度能力但答案为「不要」）→ 记入备注 **WARN**，不单独判 FAIL。
   - 否则 → 本阶段 **PASS**。
3. 无产品源时 Overall 不因本维度 FAIL。

**禁止**在本阶段执行 `product-init` 或写入 `.ai/product/` / `.apt/arch-review/`。

## 2.7. Connect 门禁（只读，有 connect 账本或 connect 范围时）

**触发条件（满足任一即必须跑，禁止 SKIP）：**

- 存在 `.apt/connect/progress.json`，或
- plan / spec 标明 connect 范围（如 `frontend-connect` / `app-connect` / Connect Ledger / `connect-gate` / `.apt/connect/`）

否则本阶段 **SKIP**。

1. 优先调用 MCP **`check_connect_gate`**（`stage: "done"`；若存在 `.apt/connect/connect-status.json`，传 `connectStatusPath`）。返回 `ConnectGateReport`。
2. MCP 工具缺失时回退 CLI（等价只读）：
   ```bash
   node templates/connect-runner/connect-gate.cjs --stage=done --dir=.apt/connect
   ```
   （有 `connect-status.json` 时附加 `--connect-status=.apt/connect/connect-status.json`）
3. **仅解读结果：**
   - `passed: true` / exit `0` → 本阶段 **PASS**
   - `passed: false` / exit ≠ `0` → 本阶段 **FAIL**；将 `failures[]` / stderr 摘要写入 Failures
4. 本维度 **FAIL → Overall 必须 FAIL**（不得 PASS / 不得用 SKIP 掩盖）。

**禁止**在本阶段写入 `.apt/connect/` 或调用写侧 MCP。

## 3. 契约完整性（只读）

1. 根据 §0 验收范围，识别新增的**对外可调用** TS 类型/接口。
2. 对每个候选名称调用 **`query_contract`**。
3. 代码中存在但未登记 → 列入「未登记契约」，本阶段 **FAIL**。

**禁止**调用 `register_contract`。

## 4. 可检索性抽检

对 plan Part 1 关键依赖或 §3 涉及项，抽检 2–5 项：

1. **`search_arch`** 或 **`query_contract`**。
2. 搜不到或 path 明显过期 → **FAIL**。

**禁止**调用 `refresh_asset`。

## 4.5 代码质量（v8.0，含代码改动时必须）

1. 调用 **`check_code_quality`**（`projectRoot` = 项目根）。返回 `QualityReport`。
2. `highCount > 0` → **FAIL**。`mediumCount >= 5` → **FAIL**。否则 **PASS**。
3. 无源码文件 → **SKIP**。
4. plan 范围不含代码改动 → **SKIP**。

## 5. 测试与构建

1. 有 plan：执行 Part 2 各 Task 的 **Verify:** 中的命令（去重）。
2. 无 plan：从 `package.json` / README 推断常规测试命令；无法推断则询问用户。
3. 命令失败 → **FAIL**，附 stderr 摘要。
4. 无可用测试命令 → **SKIP** 并注明（不单独判 FAIL）。

### 5.5 测试用例覆盖率检查（有 test-cases.md 时必须）

扫描 `designs/v0/*/test-cases.md`（来自 plan-from-spec B1.5）：

1. 读取每份 test-cases.md，提取全部用例 ID（T1, T2, ...）。
2. 对每个用例，检查是否有对应的自动化测试覆盖：
   - 搜索 `src/` 下的测试文件（`*.test.*` / `*.spec.*`）是否覆盖该用例的场景
   - 或检查 plan Part 2 的 Verify 行是否引用了该用例 ID
3. 输出覆盖率报告：

```
测试用例覆盖率：
  user-list: 5/5 用例覆盖 ✓
  order-detail: 2/3 用例覆盖 ✗（T3 列表空态未覆盖）
```

4. **关键用例（T1-T3，来自 page.logic.md §校验/§操作明细/§状态）未覆盖 → FAIL**。
5. 接口用例（T4+，来自 dev-handoff.md）未覆盖 → **WARN**（记入备注，不单独判 FAIL）。
6. 无 test-cases.md → **SKIP**（向后兼容，不影响现有项目）。

### 5.6 外部 Harness 维度（sourceDoc / activeSpec 引用可执行规格时必须）

**触发条件：** `.apt/goal.md` frontmatter **`sourceDoc`** 或 **activeSpec**（活跃规格路径）引用**可执行规格**——todobackend.com 套件、RealWorld 探针、OpenAPI 测试套件、仓库内 JS/HTTP 测试脚本的 URL 或路径。无引用 → 本阶段 **SKIP**（Summary 记 SKIP，`## Harness` 段写一句「无触发」即可）。

1. **必须拉取/定位并执行该套件**（不得只过知识门禁）。常用形态：
   - 浏览器 CORS 套件（如 todobackend.com）：按官方 contribute 指引将本服务注册为被测实现后在线跑测；
   - npm 包 / git 仓库套件：`git clone`（或 `npm install`）→ 按其 README 命令执行；
   - HTTP 探针：对规格端点跑 `curl` 探针循环，校验响应码与报文。
2. 执行环境问题（网络不可达、依赖装不上、沙箱禁网/禁浏览器）→ 本阶段 **BLOCKED**（不算 FAIL），Failures 注明环境原因并给**手动指引**（命令 + 前置条件）。
3. **结果**写入 `latest.md` 新增 **`## Harness`** 段（结构见 §6 模板）：每套件一行——套件名 / 执行命令 / 退出码 / 摘要一行。
4. **任一套件 FAIL → Overall 必须 FAIL**（不得只过知识门禁）；全部套件 PASS → 本阶段 **PASS**。

Summary 表新增一行：`| 外部 Harness | PASS/FAIL/SKIP/BLOCKED |`。

**禁止**在本阶段修改实现或删减套件用例来「凑绿」。

## 6. 输出 Verify Report

**硬规则（loopDone 依赖）：** 必须将本报告（含 Overall 行）另存为 `.apt/verify/latest.md`（SSOT，供 `query_project_status` 读取 `lastVerify.result`；spec §5.3 loopDone 必须含 verify PASS）。**同时必须**写机读 SSOT `.apt/verify/latest.json`（N3：机器语义不依赖 md 自然语言解析——`query_project_status` 优先读 JSON 的 `overall`，缺失/损坏/字段非法回退 md 解析）。两文件 Overall 必须一致：

```json
{
  "overall": "PASS",
  "date": "2026-08-24",
  "harness": { "ran": false, "result": "SKIP" }
}
```

（`overall` 只许 `"PASS" | "FAIL" | "BLOCKED"`；`date` 与报告 **Date:** 行同值；`harness.ran` 对应 §5.6 是否触发执行（未触发写 `false`/`"SKIP"`），`harness.result` 任一套件 FAIL 时写 `"FAIL"` 并保证 `overall` 为 `"FAIL"`。）

**必须**按下列结构输出（可选另存 `docs/apt/verify/YYYY-MM-DD-<slug>-report.md`）：

```markdown
# Verify Report

**Plan:** <path 或 N/A>
**Overall:** PASS | FAIL | BLOCKED
**Date:** YYYY-MM-DD

## Summary
| 维度 | 结果 |
|------|------|
| Plan 对照 | PASS/FAIL/SKIP |
| 架构 audit | PASS/FAIL/BLOCKED |
| 设计 audit | PASS/FAIL/SKIP |
| 产品对齐 | PASS/FAIL/BLOCKED/SKIP |
| Connect 门禁 | PASS/FAIL/SKIP |
| 契约登记 | PASS/FAIL |
| 可检索性 | PASS/FAIL |
| 代码质量 | PASS/FAIL/SKIP |
| 测试/构建 | PASS/FAIL/SKIP |
| 外部 Harness | PASS/FAIL/SKIP/BLOCKED |

## Harness
（§5.6 有触发时填写；无触发写一句「SKIP：无外部 Harness 触发」）

| 套件 | 执行命令 | 退出码 | 结果 | 摘要 |
|------|----------|--------|------|------|
| <套件名> | <执行命令> | <退出码> | PASS/FAIL | <一行摘要> |

（网络/环境不可达 → 该套件结果记 **BLOCKED**，不计为失败，附手动指引）

## Plan Coverage
（有 plan 时填写）

## Failures
- [F1] ...

## Recommended next steps
（应与 `scripts/classify-verify-failures.cjs` / `classify-verify-failures` 一致；禁止「FAIL → 一律 `/finish-feature`」）

- Overall **PASS** → `/finish-feature`（闭环：audit / refresh / 契约）
- Overall **FAIL** 且含**实现类**维度 FAIL（Plan 对照、可检索性、代码质量、测试/构建、测试用例覆盖率、Connect 门禁、设计 audit、产品对齐、外部 Harness）→ `$apt-plan-from-verify`（默认读 `.apt/verify/latest.md`）→ 确认后 `/implement-plan` → 再 `/verify`
- Overall **FAIL** 且**仅** closeout 维度 FAIL（架构 audit、契约登记）→ `/finish-feature` 后重新 `/verify`
- Overall **BLOCKED** / infra（`mcp_unavailable` / 需 start-init / product-init）→ `start-init` / `product-init` / 修 MCP 后重新 `/verify`
- FAIL 但 Summary 无法分类 → 修正报告格式后重新 `/verify`（`re-verify`）
```

**Overall 规则：**

- MCP Preflight FAIL / 中途 MCP 传输层不可用 → **BLOCKED**（非业务 FAIL；见 §0.0）
- 任一必选维度 FAIL → **FAIL**
- 仅缺 arch `last-scan` / 需 `start-init` → **BLOCKED**
- 仅缺产品索引 / 需 `product-init` → **BLOCKED**（见 §2.6）
- Connect 门禁 FAIL → **FAIL**（见 §2.7；不得 Overall PASS）
- 外部 Harness 任一套件 FAIL → **FAIL**（见 §5.6；不得只过知识门禁）
- 全部 PASS → **PASS**

### 6.1 分流建议（可选收尾，只读）

报告写入 `.apt/verify/latest.md` 后，**可**跑分类脚本打印一行 `recommended=`（便于抄进 Recommended next steps）；**禁止**写 plan 或修实现：

```bash
node scripts/classify-verify-failures.cjs
```
