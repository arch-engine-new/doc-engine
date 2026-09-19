---
title: F-8 规范 PDF 文字层与扫描页双路径
date: 2026-09-19
status: approved
risk: low
phase: approved
approvedAt: 2026-09-19T15:40:00.000Z
approvedBy: apt-auto-brainstorm
topic: pdf-text-and-scan-dual-path
mode: apt-auto-brainstorm
feature: core-engine
pages:
  - standard_lib
---

# Design Spec: 规范 PDF 文字层与扫描页双路径（F-8）

## Goal

配置人员同一 ingest-run 内按页分流：有可用 Unicode 文字层走文字、无则单页栅格 PNG + `recognizeLayout`。混排两路都入库。live 扫描禁止 FakeOcr。单次 tick ≤1 页。小夹具验收，禁止 259 页全书 OCR。

`StandardIngestWorker.resolvePageText` 已按页 `hasUsablePdfTextLayer`。本片补齐**混排夹具测试**、文字层 tick 不调 OCR、live 装配不把 FakeOcr 注入 ingest（F-5 `requireLiveOcr`）。不改切片规则。

## 范围

1. 纯文字层 PDF：tick 后条款可检索；该页 `recognizeLayout` 次数 0。
2. 无文字层页：栅格 PNG + OCR；失败 `ocr_error`，不得 vendor=fake 冒充成功。
3. 同一 PDF 一页有字一页无字：两页分别 ok；检索都能命中对应条文。
4. 单次 tick ≤1 页（既有）。
5. live `openLiveFromEnv` ingest 默认 OCR 为 Paddle（`requireLiveOcr`），测试可显式 FakeOcr/SpyOcr。

## 非目标

全书一次 OCR；整本 PDF 丢给 Paddle；改条款/表切片；`rules/` 259 页手工 OCR；改 tickAll（F-7）。

## 验收标准

队列 F-8 四条 + live 禁止 FakeOcr。

## 设计

复用 `extractPdfUnicodePages` / `hasUsablePdfTextLayer` / `renderPdfPagePng` / `OcrPort.recognizeLayout`。混排夹具：页 1 含 ≥8 汉字 ToUnicode/Tj；页 2 空白无文字层。测试 SpyOcr 计数。

## 方案

A 推荐：补测试 + 仅当 live HTTP ingest 仍落到 FakeOcr 时接线（查证：live pipeline 已 requireLiveOcr）。不新 API。
B 新 tick-text-or-ocr HTTP：过贵。
C 整本 OCR：禁止。

## 追问记录

2 轮收敛。S3：ingest-worker 已分流；缺口是混排测试与文字层 tick 用例。S4：SpyOcr.layoutCalls 可判定。

## 需求锁定表

| ID | 需求 | 来源 | 验收 | 优先级 |
|----|------|------|------|--------|
| R1 | 文字层页不 OCR | 用户明示 | SpyOcr layoutCalls=0 且可检索 | must |
| R2 | 扫描页栅格+OCR | 用户明示 | layoutCalls PNG；失败 ocr_error | must |
| R3 | 混排两路入库 | 用户明示 | 同 run 两页 ok，检索两路 | must |
| R4 | live 禁止 FakeOcr | 用户明示 | openLiveFromEnv 用 requireLiveOcr | must |

## Ontology detection

复用 ingest-worker / pdf-text / OcrPort / FakeOcr（仅测）。不复用 Job 4MB 闸门。
