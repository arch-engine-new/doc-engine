# Task 7 Report
## Status
DONE
## Commits
docs: step-chat can cite retrieved clauses only
## Tests
- `npm test -w core-engine -- agent-connect` — PASS (4 tests, 1 file)
- `npm test -w core-engine -- agent-native-graph` — PASS (2 tests, 1 file)
- grep `coze|dify|langgraph|temporal` on `packages/core-engine/package.json` and `packages/agent-runtime/package.json` — CLEAN (no matches)
## Changes
- `docs/使用手册.md` §1 StepChat 段：`checking` / `standard_lib` 可请助手查「条款」「规范」；助手只能引用检索命中的 `clause_id`；无命中必须说 **未命中**，禁止编造条款号；仍不能确认提案 / 发布规则 / 提交组卷。
- 同文件 §10 与控制面对照句：本步对话可走 `check_wording` 与只读 `search_clause`，不能确认/submit、不能推进 Job（避免仍写「只走 check_wording」与上文矛盾）。
- Did not add coze / dify / langgraph / temporal. Did not touch either `package.json`.
## Concerns
- None. Existing `task-7-report.md` belonged to an older excel-gap-fill plan; this file now documents the native-graph Task 7 docs/dep gate.
