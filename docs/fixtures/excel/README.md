# Excel 演示夹具（混凝土检验批）

> **非产品预置包**：仅供 brainstorm / 联调演示。符合 `.apt/goal.md`「空引擎」定位——用户应自备正式模板。

## 文件

| 文件 | 说明 |
|------|------|
| `concrete-inspection-batch-gb50204-template.xlsx` | 空白模板，`{{fieldKey}}` 占位，供「点选单元格绑字段」方案 A |
| `concrete-inspection-batch-demo-filled.xlsx` | 已填合规演示数据（虚构项目名、人员） |
| `concrete-inspection-batch-cell-mapping.json` | 单元格 ↔ `fieldKey` 映射 + 签字角色 + 合规规则示例 |

## 版式依据（公开资料）

- GB 50204-2015《混凝土结构工程施工质量验收规范》附录 A
- 与地方表 GD-C5-71165「混凝土施工检验批质量验收记录」同类字段对齐

**未**从爱给网/品茗等商业模板站直接下载或复制 xls，避免版权风险；版式按国标公开条文与填写范例**自行合成**。

## 重新生成

```bash
python scripts/generate-concrete-inspection-batch-xlsx.py
```

依赖：`pip install openpyxl`
