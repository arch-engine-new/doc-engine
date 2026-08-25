<!--
  由 /apt-goal Step 0.7 生成。action 只取 _apt-goal-loop.md nextAction 映射表。
  机读游标以 playbook-state.json 为准。
-->
# Playbook — 工业级 Graph 工作流 Agent 平台

> goalSha: e1b340af6b0344580073ab4a433dce0a2421402bbe51a2f8a39aecbe5c893873
> risk: **high**（8 步 ∧ 架构密集/基础设施 ∧ 非小改 → 需回复「跑」后执行）
> 链形: 重后端链（pmUi=false + 工作流框架/持久化/可观测）
> 终点: 无 page.logic 运行时验收面 → 末步 = /verify PASS；accept.required=false
> 白话: 先定规格 → 审架构 → 设计并落库表 → 排计划 → 写代码 → 验收 → 知识闭环

- [x] **PB-1 头脑风暴出 design spec**
      白话: 产品/架构同学把「图工作流工业级 Agent」写成可执行规格
      action: /auto-brainstorm
      done-when: docs/superpowers/specs/*-design.md 存在且 frontmatter status ∈ {approved, auto_approved}
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: pm
      branch: high risk 时停等人批（四问白话）；未收到「批准 spec」不前进

- [x] **PB-2 架构审查与补齐**
      白话: 架构师对照目标扫缺口（运行时/持久化/可观测/安全）并补齐选型
      action: /apt-arch-review
      done-when: arch_review 产出完成；架构缺口清单关闭或已登记决策
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: tl
      branch: 无

- [x] **PB-3 库表设计（图运行时状态）**
      白话: 设计 Agent Run / Node 执行 / Checkpoint / 工具调用等表结构
      action: $apt-schema-design
      done-when: check-schema-design 门禁 PASS；schema MD + 账本已落盘
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: tl
      branch: 无

- [x] **PB-4 表结构落库**
      白话: 评审通过后生成 DO + migration 并入 EntityGraph
      action: $apt-schema-apply
      done-when: schema apply 完成；EntityGraph 可检索到新实体；账本 applied
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: dev
      branch: 若表极少可 skip 并入 implement 首 Task（须非空 reason）

- [x] **PB-5 从 spec 生成实现方案**
      白话: 技术负责人把规格拆成可执行 tasks（Files/Verify 齐全）
      action: /plan-from-spec
      done-when: plan 文档存在且 tasks 全含 Files 与 Verify
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: tl
      branch: 无

- [ ] **PB-6 按 plan 串行实现**
      白话: 工程师子 Agent 按任务实现 Graph runtime（禁止主 Agent 直接堆代码）
      action: /implement-plan
      done-when: plan 内 tasks 全 done 且约定 build/test 通过
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: dev
      branch: 无

- [ ] **PB-7 知识门禁验收（终点）**
      白话: 测试员对照 plan/契约跑 /verify
      action: /verify
      done-when: .apt/verify/latest.md result=PASS
      on-failure: retry(2) → fix(/feature) → halt
      critical: true
      role: qa
      branch: FAIL → /apt-plan-from-verify → /implement-plan → /verify → /finish-feature

- [ ] **PB-8 闭环写侧补救**
      白话: 把实现变更同步回知识库/契约（不改业务代码）
      action: /finish-feature
      done-when: audit/refresh/契约同步完成；无未登记资产
      on-failure: retry(2) → fix(/feature) → skip(记 reason)
      critical: false
      role: tl
      branch: 无

## 裁剪说明
- 跳过 pm_spec / ui_gen / product_init / connect / accept：pmUi=false 且无页面运行时验收面
- 保留 arch_review + schema-design/apply：架构密集（框架/工作流）+ 持久化
- 无第三方集成关键词 → 无 PB-0 W0
- 已有 .ai/arch/last-scan.json → 无需 start_init
