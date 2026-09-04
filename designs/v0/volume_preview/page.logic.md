# page.logic — 组卷预览

## 元信息
- pageId: volume_preview
- feature: core-engine
- title: 组卷预览
- route: /jobs/:id/volume
- pageType: tree

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| preview | 进入 | VolumePreview 按 groupKeys |
| submitVolume | 工作台按钮 | 仅中台；不对 agent-runtime 开放 |
| openStepChat | 进入 | 讨论分组；对话不能 submit |

## 主流程
1. 读规范包 groupKeys[] / orderKey。
2. 生成预览树。
3. 原型禁用提交，避免提交成功幻觉。

## 状态
previewed

## 依赖
- 实体：VolumePreview
- 验收：A7
