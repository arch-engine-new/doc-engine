---
status: approved
slice: F-5
chain: feature-light
---

# F-5 live JobPipeline 禁止静默 FakeOcr

**Status:** approved（`/apt-goal` 全自动自答，未经用户确认）

**Goal:** live JobPipeline 禁止静默 FakeOcr（全自动自答，未经用户确认）

**验收标准:**

1. 按收敛记录复现：`openLiveFromEnv` 无 Paddle 时失败，源码不再 `PaddleOcr.fromEnv() ?? new FakeOcr()`
2. live 扫描页不得产出假 OCR 文本（live 装配不得得到 `vendor: "fake"`）
3. 测试仍可显式注入 FakeOcr

## Part 1

**范围:** 只改 live 装配。`PaddleOcr` / `FakeOcr` / `OcrPort` 已存在。HTTP `session.ts` 的 `resolveUploadDeps` 已对 live 缺 token 抛 `UploadServiceUnavailableError`，本片对齐 `JobPipeline.openLiveFromEnv` 的 live 分支，禁止把 pipeline 层 ingest OCR 静默落到 FakeOcr。

**不做:** MinIO（F-6）、tickAll（F-7）、PDF 双路径（F-8）。不改 `session.ts` 上传 503 逻辑。不把真实 Paddle 网络调用写进单测。

**寻址（MCP）:**

| 依赖 | 来源 | 路径 |
|------|------|------|
| JobPipeline | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` — live 行 `PaddleOcr.fromEnv() ?? new FakeOcr()` |
| PaddleOcr | contract + `query_arch` `#paddleocr` | `packages/core-engine/src/ocr/paddleocr.ts` — `fromEnv` token 空 → null |
| FakeOcr | `search_arch` + `query_arch` `#fakeocr`（contract 未登记） | `packages/core-engine/src/ocr/fake.ts` — `vendor: "fake"`；仅测试注入 |
| OcrPort | contract | `packages/core-engine/src/ocr/port.ts` |
| readPaddleOcrEnv | `search_arch` | `packages/core-engine/src/ocr/env.ts` — `PADDLEOCR_ACCESS_TOKEN` |

**拟改:** 抽出 `requireLiveOcr(env?)`：`PaddleOcr.fromEnv()` 非 null 则返回该实例，否则 throw（信息须说明 live 需要 Paddle token，**禁止**把 token 值写入 Error）。`openLiveFromEnv` live 分支改为 `new JobPipeline(store, liveRetrievePorts(), requireLiveOcr())`。memory 分支保持 `PaddleOcr.fromEnv() ?? undefined`（构造器默认 FakeOcr 仅服务测试 / memory）。构造器 `ocr ?? new FakeOcr()` **保留**（AC3）。禁止 live 分支任何 `?? new FakeOcr()`。

**风险:** `live-rag-ingest.test.ts` 在 live env 下调用 `openLiveFromEnv()`；本片不改该文件。CI 无 DATABASE_URL 时 skip。本地 live 无 `PADDLEOCR_ACCESS_TOKEN` 时该 skipIf 套件会从静默 Fake 变为显式失败——符合本 bug。单测用 `requireLiveOcr` 避免连 Postgres。

## Part 2

### Task 1: 红灯测试（禁止改装配）

- [ ] 只读 MCP：`query_contract` name=`JobPipeline`；`query_contract` name=`PaddleOcr`；`query_contract` name=`OcrPort`；`query_arch` path=`frontend/core-engine/util#fakeocr`
- [ ] 新增 `packages/core-engine/test/live-no-fake-ocr.test.ts`（当前应失败）：
  1. `readFileSync` 装配源码：`openLiveFromEnv` 函数体不得出现 `PaddleOcr.fromEnv() ?? new FakeOcr()`
  2. `requireLiveOcr({})` / 无 `PADDLEOCR_ACCESS_TOKEN` 时 throw，message 匹配 `/Paddle|OCR|token/i`，**不得**包含真实密钥
  3. `requireLiveOcr({ PADDLEOCR_ACCESS_TOKEN: "test-token" })` 为 `PaddleOcr`，`not.toBeInstanceOf(FakeOcr)`
  4. `new JobPipeline` / `openStandardLibrary(..., new FakeOcr("scan-fixture"))` 显式注入后，`ocr.recognize(...)` 的 `vendor === "fake"`（通过 openUploadJob 或直接 FakeOcr；不要打 live 网）
- [ ] **禁止**改 `job-pipeline.ts` 实现（本 Task 只加测试）
- [ ] git commit 一条（允许红灯）；写 report

**MCP:** query_contract / query_arch（只读）

**Files:**

- `packages/core-engine/test/live-no-fake-ocr.test.ts`

**Verify:**

```
npx vitest run test/live-no-fake-ocr.test.ts
```

cwd: `packages/core-engine` — **期望 FAIL**（红灯证据写入 report）

**Contracts:** 无（纯测试）

### Task 2: 绿灯实现 requireLiveOcr + live 装配

- [ ] 只读 MCP：同 Task 1；`query_contract` name=`JobPipeline`
- [ ] 实现 `requireLiveOcr` 并导出；live `openLiveFromEnv` 使用它；删除 `PaddleOcr.fromEnv() ?? new FakeOcr()`
- [ ] 构造器测试默认 FakeOcr 保留；memory 分支不 throw
- [ ] 微闭环：`register_contract` name=`requireLiveOcr`（及必要时 FakeOcr）；`refresh_asset` `job-pipeline.ts`
- [ ] git commit 一条；Verify 期望 PASS

**MCP:** query_contract / query_arch（只读）；register_contract / refresh_asset（微闭环）

**Files:**

- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/live-no-fake-ocr.test.ts`（仅当 Task 1 需微调断言）
- `packages/core-engine/test/live-env.test.ts`（仅当 memory 分支回归需要）

**Verify:**

```
npx vitest run test/live-no-fake-ocr.test.ts test/live-env.test.ts
```

cwd: `packages/core-engine`

**Contracts:** requireLiveOcr；FakeOcr（若仍 missing）
