# Playbook（intake 程序模式）

队列：.apt/batch/queue.md。就绪：F-3～F-8。缺省 defer 验收（未带 --accept），无 ACCEPT-BATCH 哨兵。

## F-3 接线 the live prequery 为 ZhipuPrequery for 配置人员

- [x] PB-1 feature — liveRetrievePorts.prequery = ZhipuPrequery；缺配置显式失败；片内复现测试先红后绿
- [x] PB-2 verify — .apt/verify/latest.md 对照本片 Overall PASS

## F-4 替换 the live 独立 rerank 为 HTTP 服务 for 配置人员

- [x] PB-1 auto_brainstorm — spec 落盘；风险分级
- [x] PB-2 plan_from_spec — plan 落盘含测试案例
- [ ] PB-3 implement_plan — live rerank 走独立 HTTP；测试可 IndependentReranker
- [ ] PB-4 verify — Overall PASS
- [ ] PB-5 finish_feature — 契约登记 / audit / refresh

## F-5 禁止 the live JobPipeline 静默 FakeOcr for 审查员

- [ ] PB-1 feature — openLiveFromEnv 无 Paddle 失败；片内复现测试先红后绿
- [ ] PB-2 verify — Overall PASS

## F-6 接线 the live 对象存储 为 MinIO for 运维

- [ ] PB-1 auto_brainstorm — spec 落盘；风险分级
- [ ] PB-2 plan_from_spec — plan 落盘含测试案例
- [ ] PB-3 implement_plan — live minioFromEnv；health 失败 BLOCKED
- [ ] PB-4 verify — Overall PASS
- [ ] PB-5 finish_feature — 契约登记 / audit / refresh

## F-7 补上 the 标准库 tickAll 处理全部页 for 配置人员

- [ ] PB-1 feature — PdfTickPanel「处理全部页」串行 tick；片内复现测试先红后绿
- [ ] PB-2 verify — Overall PASS
- [ ] PB-3 accept — `$apt-accept --page=standard_lib` Overall PASS（accept-inline）

## F-8 打通 the 规范 PDF 文字层与扫描页双路径 for 配置人员

- [ ] PB-1 auto_brainstorm — spec 落盘（混排按页分流）；风险分级
- [ ] PB-2 plan_from_spec — plan 含文字层 / 扫描 / 混排夹具案例
- [ ] PB-3 implement_plan — 文字层 Unicode、无文字层栅格+OCR；live 禁止 FakeOcr
- [ ] PB-4 verify — Overall PASS
- [ ] PB-5 finish_feature — 契约登记 / audit / refresh
- [ ] PB-6 accept — `$apt-accept --page=standard_lib` Overall PASS（accept-inline）
