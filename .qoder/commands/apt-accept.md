---
---
<!-- apt-template-version: 10.9.0 -->
# $apt-accept — 运行时按产品真源验收

依据 ingest 的 **`page.logic.md`** 做运行时验收：

1. 枚举**全量必验点（RP）** → `required-points.json`  
2. 写 `accept-cases.md`（一点一案）→ 验一条勾一条  
3. 跑 **`accept-gate`**（机制门禁，不是提示词）  
4. 写 **`ACCEPTANCE-REPORT`**（含全量 RP 覆盖表）  
5. FAIL 默认走 **`/feature`**（low 可自动批准）；`--no-fix` 可只要报告  

与 `/verify` 正交。不硬依赖外部 QA Skill。

## 使用

```
$apt-accept --base-url=https://staging.example.com --user=qa --password=***
```

选项：`--mode=auto|page|logic` · `--regression` · `--incremental` · `--smoke` · `--batch-size=5` · `--no-fix` · `--captcha=` / `--interactive-captcha`

## 硬规则

- 无 `required-points.json` / gate 未过 → 页不得 done，Overall 不得 PASS  
- 每一个 RP（加载/操作/校验/状态/下拉/上传/…）都必须独立案例并勾选  
- 终稿报告缺全量覆盖表 → Overall 不得 PASS  
- 禁止 accept 内 inline 改产品代码；修复走 `/feature`
