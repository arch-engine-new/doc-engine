# Frontend Connect Plan（S2：有原型、无 Vue 工程）

> 源：`designs/v0`（原件不动）  
> 目标：`apps/web`（Vue 3 + Vite + TS）  
> 风格：`apt-skyline-clean`（`.ai/design/profile.json` 已可 `query_design(global)`）  
> Ledger：`.apt/connect/`（`stage=ledger` PASS）

## 场景

S2。9 页均有 `index.html` + `page.logic.md`。`packages/core-engine` 库能力已齐，**缺 HTTP 适配层**，故全部 `required-apis.status=missing`。禁止把原型 HTML 拷进 `apps/web` 当最终页。

## 任务顺序

1. **Task S — 脚手架**（`kind: scaffold`）  
   `apps/web`：Vue 3 + Vite + vue-router + TS。路由对齐 9 页。`src/styles/tokens.css` 从 `designs/v0/styles/tokens.css` 同步（可复制 tokens，不是拷贝整页 HTML）。全局含 `[hidden]{display:none !important}`。`src/services/http.ts` + `src/mocks` 骨架。`npm install` 后 `npm run dev` 能起。view 路径：`src/views/<pageId>/index.vue`。

2. **Task A — HTTP 中台**（`kind: backend`，域 `core-engine-http`）  
   为 `JobPipeline` / `ReviewDesk` / `VolumeDesk` / `StandardLibrary` / mock adapter 补 **同一进程 HTTP**（如 `packages/core-engine` 的 `src/http` 或 `apps/web` 的 Vite 插件/dev server 代理到 Node 适配器）。路径对齐 `.apt/connect/required-apis.json`。完成后把对应 API `missing` → `ready`。提供 `POST /api/demo/reset` 重置到夹具演示态。  
   **禁止** agent-runtime 直连业务库；`submit_*` 仍禁。

3. **Task B — 按页实现并接线**（`kind: wire`）  
   垂直切片，优先 Walking Skeleton：`job_upload` → `check_findings` → `pending_review`，再 `project_home` / `template_annotate` / `rule_editor` / `volume_preview` / `standard_lib` / `audit_trace`。  
   page.logic 为 SSOT；对照 `designs/v0/<pageId>/index.html` 布局与 tokens。下拉走 `/api/dict/:dictType`。本步对话走 `POST /api/chat`，不能写 Receipt / 不能 submit / 不能取消 blocking。组卷页不得出现提交成功幻觉。

## 完成定义

`connect-gate` 依次 `plan` → `backend` → `wire` → `done`。`connectLevel` 本轮目标 **`mock` 或 `real-backend`**（进程内 core-engine，非资料云实挂）。**不宣称 production / 资料云实挂。**
