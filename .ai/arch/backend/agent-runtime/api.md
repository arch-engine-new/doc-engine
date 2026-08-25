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
| Summary | HTTP adapter for ControlPlane: JSON REST endpoints (POST /graphs, GET /graphs/:id, POST /runs, GET /runs, GET /runs/:id, POST /runs/:id/wait, POST /runs/:id/cancel, POST /runs/:id/resume, GET /runs/:id/trace, DELETE /runs/:id, GET /health) with optional basePath and scheme flag; available as native node http server or fetch handler for serverless. |
| When to use | Need remote/HTTP access to the agent control API from dashboards or external callers; or need a serverless fetch handler. |
| How to use | createHttpServer(controlPlane, {port, hostname?, scheme?, basePath?, logger?}) -> HttpServer (listen/close/address); createFetchHandler(controlPlane, {basePath?}) -> (Request) => Promise<Response>. |
| Exports | createHttpServer, createFetchHandler |
| Related | backend/agent-runtime/api/ControlPlane |
| Tags | 暂无 |
| Source | register |
| Path | packages/agent-runtime/src/api/http.ts |
| Updated | 2026-08-25T11:07:55.535Z |
