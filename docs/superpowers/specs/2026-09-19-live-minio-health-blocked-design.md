---
title: F-6 live 对象存储接 MinIO，health 失败不得 skip
date: 2026-09-19
status: approved
risk: low
phase: approved
approvedAt: 2026-09-19T14:30:00.000Z
approvedBy: apt-auto-brainstorm
topic: live-minio-health-blocked
mode: apt-auto-brainstorm
feature: core-engine
pages:
  - job_upload
---

# Design Spec: live MinIO 为默认对象存储，health 失败即 BLOCKED（F-6）

## Goal

运维在 live 模式上传原件必须走 `minioFromEnv()`（MinIO S3 兼容），与测试 `MemoryBlobStore` 分离。`GET /api/health` 在 live 下对 MinIO **不得** `skip` 当绿：缺 `MINIO_ENDPOINT` / 凭证不齐 / `ensureBucket` 失败一律 `minio: "fail"`，HTTP **503 BLOCKED**。memory 模式仍 `minio: "skip"` 且 200。

验收锚点：队列 F-6；`session.ts` `resolveUploadDeps` 已对 live 缺 MinIO 抛 `UploadServiceUnavailableError`；`probeMinio` 仍 `if (!store) return "skip"` 是本片要改的缺口。手册「未配 MINIO 为 skip 不是坏了」与本片冲突，须改写。

## 范围

1. live `probeMinio`：**永不**返回 `skip`。`fromEnv()` null、凭证不齐 throw、`ensureBucket` 失败 → `"fail"`。成功 → `"ok"`。
2. `GET /api/health`：`mode === "live"` 且 `minio === "fail"` → HTTP **503**（BLOCKED），body 仍为 `DemoHealth` JSON。其它探针失败本片不改状态码（postgres/qdrant 仍 200 + fail）。
3. live 上传继续 `minioFromEnv()`；缺 MinIO 仍 503 `UploadServiceUnavailableError`。不改 `MemoryBlobStore` 实现与既有 memory 上传测试。
4. 手册 live 段：MinIO 为 live 默认依赖；未配或探针失败是 BLOCKED，不是 skip 绿。
5. 不新增 git 内 docker-compose（容器仍宿主机 `minio`，与既有手册一致）。`.env.example` 已有 `MINIO_*`，仅当注释仍暗示 skip 可选时改注释。

## 非目标

- 不把 MinIO 并入 `resolveEngineMode` 必填四键（ledger 可 live、上传才强制 MinIO）。
- 不改 `MemoryBlobStore`；不把测试上传改走 MinIO。
- 不改 PaddleOCR health skip 语义（F-5 管 OCR 装配；本片只 MinIO）。
- 不接资料云 / pending-mount。
- 不在单测打真实 MinIO 网（用假 endpoint / stub `ensureBucket`）。

## 验收标准

1. live 无 `MINIO_ENDPOINT`：`probeMinio` / health `minio === "fail"`，不是 `"skip"`；`GET /api/health` 503。
2. live `ensureBucket` 失败：`minio: "fail"`，health 503。
3. memory `GET /api/health` 仍 200 且 `minio: "skip"`；`MemoryBlobStore` 单测仍绿。
4. live 上传路径仍 `minioFromEnv()`；缺店仍 throw，不静默 MemoryBlobStore。

## 设计

**架构：** 复用 `fromEnv` / `MinioBlobStore` / `BlobStore`。抽出可单测的 `probeMinioHealth(env?)`（或等价导出名）：live health 调用它。`handleDemoRequest` 对 live+minio fail 映射 503。

**数据流：** live health → `fromEnv` → `ensureBucket` → ok/fail。memory health 不调用探针。

**错误处理：** 凭证不齐 / 网络 / HeadBucket 失败一律 fail，Error **不得**写入 accessKey/secretKey。

**测试：** 新 `live-minio-health.test.ts` + 改写手册断言源码；`http-adapter` memory 用例保持 skip。

## 方案比较

| 方案 | 机制类 | 隐藏成本 | 失败模式 | 依赖前提 |
|------|--------|----------|----------|----------|
| A 推荐：live 探针永不 skip + health 503 | 静态闸门 + 行为证据 | 运维未起 MinIO 时 live health 从 200/skip 变 503 | 假 endpoint 单测即可，不需真桶 | `fromEnv` / `DemoHealthProbe` 已存在 |
| B 新增 `"blocked"` 枚举 | 条文 | 前端/手册/类型全改 | 调用方漏适配仍当绿 | 新对外枚举，本片避免 |
| C MinIO 并入 resolveEngineMode | 流程重组 | 无 MinIO 时整个 live ledger 打不开 | RAG smoke 被误伤 | 与「ledger 可 live、上传才要 blob」冲突 |

**最强反方：** 503 会让只关心 PG/Qdrant 的探针变红。**回应：** 队列明确 MinIO 为 live 默认、skip 不当绿；ledger 仍可 `openLiveFromEnv`。A 仍成立。

**为何不选最贵（C）：** C 把对象存储绑进三库门，超出上传边界。

## 追问记录

轮次：2（第 2 轮无新实质发现 → 收敛）

### 轮 1

- S1：运维开 live 任务页上传；health 仪表当绿。空数据=未起 MinIO。
- S2：skip 当绿会让假上传进 MemoryBlobStore（`resolveUploadDeps` 已 503，但 health 仍骗运维）。
- S3：查证 `query_arch #minioblobstore`、`fromEnv` null、`probeMinio` skip、`resolveUploadDeps` 已 throw。缺口只在探针/手册。
- S4：可判定：源码无 live skip；health 503；memory skip 仍在。

### 轮 2

- S1：memory 演示必须继续 skip，避免 CI 变 503。
- S2：不把 OCR skip 一并改掉（越界 F-5）。
- S3：无 compose 文件在仓；手册即 compose 文档。
- S4：不打真实 9000 端口。

需求修订：v1「接 MinIO」→ v2 明确「上传已接，改 health skip + 手册」。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | live 上传走 minioFromEnv | 用户明示（队列） | live resolveUploadDeps blob 为 MinioBlobStore；缺则 throw | must |
| R2 | live health MinIO 失败 BLOCKED 不 skip | 用户明示（队列） | live 无 endpoint 或 ensureBucket 失败 → minio fail + HTTP 503 | must |
| R3 | 测试 MemoryBlobStore 不变 | 用户明示（队列） | memory health minio skip；既有 memory 上传测试绿 | must |

## Ontology detection

- `query_ontology(topic=MinIO blob store health)`：MinioBlobStore / MemoryBlobStore / fromEnv。
- 复用：fromEnv、MinioBlobStore、UploadServiceUnavailableError、DemoHealthProbe。
- 不复用：把 MinIO 塞进 resolveEngineMode。
