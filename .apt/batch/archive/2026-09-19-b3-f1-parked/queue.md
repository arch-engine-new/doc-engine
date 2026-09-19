# APT 批量队列（$apt-intake 生成）
> 生成：2026-09-17T19:49:00+08:00｜共 2 项（P1 0 / P2 2 / P3 0）｜截图归档 .apt/batch/screenshots/
> 旧批归档：.apt/batch/archive/2026-09-17-b1-b2-stepchat/ ；goal 归档 .apt/goal-archive/2026-09-17-batch-b1-b2.md
> ID 接续：B-3 / 回收 F-1

## B-3
- 类型：bug
- 优先级：P2
- 标题：标准库右侧本步对话进页即不可见，须检索出命中才挂载
- 收敛记录：
  - 所属页：standard_lib
  - 复现：打开标准库（可不检索）。实际：右侧 StepChat 不渲染。
  - 期望：配置页进页即可打开本步对话（A15）；无命中也可问用法；检索 0 条时面板仍在，可回复未命中。
  - 实际：`chatReady` 初值 false；仅 `search()` 在 `hits.length > 0` 时置 true；`v-if="chatReady"` 卸载整个侧栏。B-1 为解开 `/api/jobs[0]` 绑定把「有 Job 就显示」改成了「有命中才显示」。
  - 影响面：用户以为对话被删；零命中（内存 RAG 重启丢失）时连入口都没有。
  - 边界：不恢复绑第一条 Job；trace 仍用 `pack:${packId}`。
- 截图：无（现象 = 侧栏缺失）
- 分流：轻链（§0.2 落痕）
- 测试策略：accept-inline（片内验收）
- 验收：待验收
- 确认：AI 自答（证据: apps/web/src/views/standard_lib/index.vue:47,163,275；designs/v0/standard_lib/page.logic.md openStepChat；.apt/create/brief.md A15；B-1 已终态，复发=新项）
- 泊车：无
- 依赖：无
- Goal（§0.2）：标准库进页即显示右侧本步对话，不必先检索出命中
- 验收标准（§0.2）：
  1. 打开 `/packs/:id/standards` 未点检索时，本步对话侧栏可见
  2. 检索 0 条命中后侧栏仍在，不得因 hits.length===0 卸载
  3. 仍不绑 `/api/jobs[0]`；线程仍为 pack 级 trace

## F-1
- 类型：需求
- 优先级：P2
- 标题：检索命中可通过详情查看条款标题与正文
- 收敛记录：从旧批回收。目的/边界/验收不变。
- 截图：.apt/batch/screenshots/F-1/standard_lib-hits.png
- 分流：全链
- 测试策略：accept-batch（批末统一，默认）
- 验收：待验收
- 确认：AI 自答（证据同旧批）
- 泊车：待批泊车（armed 页需 `$apt-create --refine`；`designs/v0/_pages.md` 中 standard_lib approved=no）
- 依赖：无
