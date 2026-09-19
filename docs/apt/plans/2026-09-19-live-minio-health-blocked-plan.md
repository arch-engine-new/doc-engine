---
status: approved
slice: F-6
chain: full
---

# F-6 live MinIO health 不得 skip

**Status:** approved（`/apt-goal` 全自动自答，未经用户确认）

**Spec:** `docs/superpowers/specs/2026-09-19-live-minio-health-blocked-design.md`

**Goal:** live 对象存储接 MinIO，health 探针不再默认 skip（全自动自答，未经用户确认）

**验收标准:**

1. live 上传 `minioFromEnv()` 可用（缺则 throw，不 MemoryBlobStore）
2. live health 对 MinIO 失败即 HTTP 503 BLOCKED，不得 `minio: "skip"`
3. 测试 MemoryBlobStore / memory health skip 不变

## Part 1

**范围:** 改 live `probeMinio` 与 `/api/health` 503 映射；手册 live 段。不改 MemoryBlobStore。不改 OCR skip。不新写 docker-compose。

**寻址（MCP）:**

| 依赖 | 来源 | 路径 |
|------|------|------|
| MinioBlobStore / fromEnv | `query_arch` `#minioblobstore` | `packages/core-engine/src/blob/minio.ts` |
| MemoryBlobStore | `search_arch` | `packages/core-engine/src/blob/memory.ts` |
| BlobStore | 源码（contract 未单独登记） | `packages/core-engine/src/blob/port.ts` |
| DemoHttpSession / probeMinio | arch + 源码 | `packages/core-engine/src/http/session.ts` — `if (!store) return "skip"` |
| handleDemoRequest | 源码 | `packages/core-engine/src/http/handle-request.ts` — health 恒 200 |
| UploadServiceUnavailableError | 源码 | `session.ts` live 缺 MinIO 已 503 上传 |

**拟改:** 导出 `probeMinioHealth`（live 永不 skip）。`health()` live 用它。`handleDemoRequest` live+minio fail → 503。手册删除「未配 MINIO 为 skip 不是坏了」。

## Part 2

### Task 1: 红灯测试

- [ ] 只读 MCP：`query_arch` `#minioblobstore`；`query_arch` `#memoryblobstore`
- [ ] 新增 `packages/core-engine/test/live-minio-health.test.ts`（期望 FAIL）：
  1. `probeMinioHealth({})` / 无 `MINIO_ENDPOINT` → `"fail"` 不是 `"skip"`
  2. 有 endpoint+keys 但 `ensureBucket` 失败（假 endpoint 或不依赖真网的 stub）→ `"fail"`
  3. memory `GET /api/health` 仍 200 `minio: "skip"`（已有 http-adapter，可引用）
  4. 构造 `mode:"live"` 的 session（注入 dummy liveConfig + 内存 pipeline），health minio fail 时 `handleDemoRequest` **503**
  5. 源码 `probeMinio` live 路径不得 `return "skip"`
- [ ] 禁止改实现。git commit 红灯。

**Files:** `packages/core-engine/test/live-minio-health.test.ts`

**Verify:** `npx vitest run test/live-minio-health.test.ts`（cwd packages/core-engine）期望 FAIL

### Task 2: 绿灯实现探针 + 503

- [ ] 实现 `probeMinioHealth`；live `health()` 使用；删除 live `return "skip"`
- [ ] `handleDemoRequest` live+minio fail → 503
- [ ] 凭证/错误信息不得含密钥
- [ ] 微闭环 register `probeMinioHealth`（若导出）；refresh session.ts / minio.ts
- [ ] Verify 期望 PASS

**Files:**

- `packages/core-engine/src/blob/minio.ts`（若探针放此）
- `packages/core-engine/src/http/session.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/test/live-minio-health.test.ts`
- `packages/core-engine/test/http-adapter.test.ts`（仅当 memory 回归需要）

**Verify:** `npx vitest run test/live-minio-health.test.ts test/http-adapter.test.ts`

### Task 3: 手册 live MinIO 默认

- [ ] `docs/使用手册.md` live health：MinIO 为默认；失败/未配是 BLOCKED（503 / `fail`），不是 skip 绿
- [ ] memory 段仍说明 skip
- [ ] 不提交真实 `.env` 密钥

**Files:** `docs/使用手册.md`；必要时 `apps/web/.env.example` 注释

**Verify:** 手册含「BLOCKED」或「503」且不再写 live 未配 MinIO「不是坏了」
