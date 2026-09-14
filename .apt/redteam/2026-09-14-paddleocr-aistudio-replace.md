# Spec 红队 round 1 — paddleocr-aistudio-replace

> findings 原文，派发方不得增删。

## A. 实质发现清单

- [形状≠行为] 攻击：P5/R5 把「无文字层扫描 PDF → `OcrPort`」写成 must，但生产闸门仍是 `extractPdfTextLayer` 的括号抽字；该闸门对仓库全部 `examples/*.pdf`（均无 `/BT`）返回数万～数十万二进制垃圾而非 `null`，扫描件会走 `vendor=pdf-text`、永不打 Paddle。R5 用「无 `/BT` 夹具 spy `recognize`」会假绿。
  依据：`packages/core-engine/src/pipeline/job-pipeline.ts` 966–997 行（括号正则 + `text.length >= 3` 才算有字；否则才 OCR）；spec 澄清 §5 / P5 / R5 把「无 `/BT`」当成无文字层。对 `examples/` 下 6 份 PDF 用**同一函数**实测：全部 `hasBT=false`、`extractNull=false`、`extractLen` 约 78k–752k，可打印样本为乱码而非条款汉字。
  严重度：high（设计翻转：必须改文字层判定，或承认操作员扫描件本片仍不走 Paddle）

- [形状≠行为] 攻击：P4 把 VL `markdown.text` 拼进 `ocr_text` 即视为成功；下游 `parseOcrFields` 只认 `编号：` / `日期A：` 标签行。无一条验收证明官方 VL 版面 markdown（标题/表格）仍能抽出字段；Job 会 `checking` 且字段全 `null`。
  依据：官方异步示例逐页写的是 `layoutParsingResults[].markdown.text`；`packages/core-engine/src/extract/ocr-fields.ts` 33–37、70–80 行；`packages/core-engine/src/ocr/fake.ts` 7–8 行；P8 只锁 FakeOcr 倒置日期；已批准抽取口径「未读到则为 null，Job 不崩」。
  严重度：medium

- [册外] 攻击：P4/数据流把 jsonl 写成顶层 `layoutParsingResults[].markdown.text`；官方示例每行是 `json.loads(line)["result"]["layoutParsingResults"]`。L2 按 P4 mock 会绿，真网按官方形状会抽空再被 P6 打成 `ocr_error`。
  依据：spec P4 与数据流；官方示例 `result = json.loads(line)["result"]` 再取 `layoutParsingResults`。
  严重度：medium

- [YAGNI 反向] 攻击：R6 为零重试是为了不烧额度，但 180s 墙钟超时（含 `pending` 排队）不取消远端 job；官方对队列满/限流写的是「请稍后重试」。超时后操作员再传 = 第二单，第一单仍在跑。
  依据：spec 超时/R6；`JobPipeline.openUploadJob` 在一次 HTTP 内等 OCR；官方错误码 10010「请稍后重试」、12002 HTTP 429；spec 未规定超时后 cancel。
  严重度：medium

- [用户意图错位] 攻击：已批准语料 spec R4（扫描件不得当资料 Job 成功，含「无文字层夹具」）仍是 must；本片 P5 让 ≤4MB 无文字层走 OCR。冲突只写在风险，拟改动文件不含语料测试/语料 spec。默认单测装配 `FakeOcr` 时，无文字层夹具会变成 `checking` Job。
  依据：`docs/superpowers/specs/2026-09-14-operator-corpus-kb-test-design.md` R4；本 spec 拟改动文件无语料 spec；`DemoHttpSession` 内存模式注入 `FakeOcr`。
  严重度：medium
