# Api

_No api discovered._

## ControlPlane

| Field | Value |
|-------|-------|
| Summary | In-process agent control API: compile/start/trace/list runs, resume/cancel HITL, tool registry access — the facade over RunManager+Store+EventLog. |
| When to use | Embedding agent-runtime in an app: one object to start runs, get RunView traces, resolve HITL, and list persisted runs. |
| How to use | createControlPlane({runManager?, store?, tools?}) then compileGraph/startRun/getRun/listRuns/resumeHitl/cancelRun methods returning serializable DTOs (RunView etc). |
| Exports | ControlPlane, createControlPlane, CompileResult, RunView, StartRunControlOptions, ResumeHitlOptions, ResumeHitlResult, ListRunsFromStoreOptions |
| Related | 暂无 |
| Tags | agent-runtime, api, control-plane, run |
| Source | register |
| Path | packages/agent-runtime/src/api/control.ts |
| Updated | 2026-08-25T10:42:59.867Z |

## HttpControlServer

| Field | Value |
|-------|-------|
| Summary | HTTP adapter for ControlPlane: JSON REST endpoints (compile/start/get/list/resume/cancel/trace) with an optional basePath, available as fetch handler or node http server. |
| When to use | Need remote/HTTP access to the agent control API, e.g. for dashboards or external callers. |
| How to use | createFetchHandler(controlPlane, {basePath?}) returns a Request→Response handler for any fetch runtime; createHttpServer(...) wraps node http with listen/close. |
| Exports | HttpServer, HttpServerOptions, createHttpServer, createFetchHandler |
| Related | 暂无 |
| Tags | agent-runtime, http, api, fetch, node |
| Source | register |
| Path | packages/agent-runtime/src/api/http.ts |
| Updated | 2026-08-25T10:43:02.328Z |
