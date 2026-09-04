# Style — apt-skyline-clean（天际清朗）

选定风格：浅底、钴蓝主按钮、工作台分区清晰。禁止大面积紫光/霓虹。

## Tokens

- 背景 `--apt-bg` `#f3f6fa`；抬升面 `--apt-bg-elevated` `#ffffff`
- 主色 `--apt-primary` `#1f5eff`；悬停 `#1648d6`
- 辅色成功/警告/危险：`#1f9d6a` / `#c98500` / `#d64545`
- 展示字体 Sora；正文 Source Sans 3 + 思源黑体
- 圆角 6px / 12px；阴影轻、白昼清晰

## 语义组件

| id | 用途 |
|----|------|
| PrimaryButton | 主操作（保存、确认、发布） |
| GhostButton | 次要/线框操作 |
| DataTable | 项目、Job、Proposal、Finding 列表 |
| StatusTag | Job/规则/提案状态 |
| WorkbenchCard | 工作台分区卡片 |
| StepChatPanel | 9 页共用本步对话（trace_id+step） |
| FieldBoxCanvas | 模板框选画布 |
| VolumeTree | 组卷预览树（无提交成功幻觉） |
| AuditTimeline | 审计事件时间线 |

## 约束

- 文案与默认数据不得预置公路/水利/房建规范包。
- 提交类按钮不对认知层开放；组卷页提交默认禁用。
- 颜色一律用 `--apt-*`，禁止页面硬编码新 hex。
