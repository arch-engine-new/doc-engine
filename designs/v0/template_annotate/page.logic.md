# page.logic — 模板标注

## 元信息
- pageId: template_annotate
- feature: core-engine
- title: 模板标注
- route: /templates/:id/annotate
- pageType: canvas

## 校验
- 继承基字段（`inherited=true`）只读，不可增删改坐标。
- 画布仅可编辑模板扩展框与覆盖框（`PUT /api/templates/:id/boxes` 仅写模板自有 FieldBox）。
- 保存扩展框时 `field_key` 不得与类型基字段语义冲突（同 key 以模板框坐标与 value_type 为准）。
- 有 `page_image_uri` 时作 canvas 底图；无 URI 时沿用棋盘格占位。

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| loadTemplate | 进入 | Template（含 doc_type_id、page_image_uri） |
| loadDocTypePath | 进入 | DocType 路径面包屑（沿 parent 链） |
| loadEffectiveBoxes | 进入 | EffectiveFieldBox[]（含 inherited 标记） |
| loadPageImage | page_image_uri 存在 | 页图作 canvas 背景 |
| drawBox | 画布框选（仅扩展区） | FieldBox draft |
| saveBoxes | 保存 | FieldBox[]（模板扩展/覆盖框） |
| openStepChat | 框选后 | 可问该框字段含义；保存仍要点按钮 |

## 主流程
1. 顶栏展示 DocType 路径；左侧只读「继承基字段」列表（来自 effective-boxes，`inherited=true`）。
2. 画布加载 `page_image_uri` 底图（有则显示，无则棋盘格）；继承框以灰色只读 overlay 展示（有坐标时）。
3. 用户仅框选模板扩展/覆盖字段，记录 page,x,y,w,h,fieldKey,valueType。
4. 抽取阶段 `resolveEffectiveBoxes` 合并「祖先 FieldDef ∪ 模板 FieldBox」；框失败字段为 null，不中断 Job。

## 状态
loading / editing / saved / error

## 依赖
- 实体：Template, DocType, FieldDef, FieldBox
- API：`GET /api/templates/:id/effective-boxes`；`GET/PUT /api/templates/:id/boxes`
- 验收：A2（含 AC-2 合并 key、AC-4 底图）
- 非目标：表格线检测、跨页续表、坐标继承
