#!/usr/bin/env python3
"""Generate GB50204-2015 style concrete inspection batch Excel fixtures (demo only)."""

from __future__ import annotations

import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.utils import get_column_letter

OUT_DIR = Path(__file__).resolve().parents[1] / "docs" / "fixtures" / "excel"

THIN = Side(style="thin")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)


def style_range(ws, cell_range: str, *, border: bool = True, align=LEFT, bold: bool = False):
    for row in ws[cell_range]:
        for cell in row:
            if border:
                cell.border = BORDER
            cell.alignment = align
            if bold:
                cell.font = Font(bold=True)


def set_row_heights(ws, start: int, end: int, height: float):
    for r in range(start, end + 1):
        ws.row_dimensions[r].height = height


def build_workbook(*, fill_demo: bool) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "检验批记录"

    widths = {
        "A": 6,
        "B": 14,
        "C": 16,
        "D": 10,
        "E": 14,
        "F": 10,
        "G": 14,
        "H": 12,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    ws.merge_cells("A1:H1")
    ws["A1"] = "混凝土施工检验批质量验收记录"
    ws["A1"].font = Font(size=16, bold=True)
    ws["A1"].alignment = CENTER

    ws.merge_cells("A2:H2")
    ws["A2"] = "（依据 GB 50204-2015《混凝土结构工程施工质量验收规范》附录 A / 地方表 GD-C5-71165 同类版式）"
    ws["A2"].font = Font(size=9, color="666666")
    ws["A2"].alignment = CENTER

    ws["A3"] = "编号"
    ws.merge_cells("B3:D3")
    ws["B3"] = "{{batch_no}}" if not fill_demo else "C30-B2-20250829-01"

    header_rows = [
        ("A4", "单位工程名称", "B4", "project_name"),
        ("D4", "分部（子分部）工程名称", "E4", "division_name"),
        ("A5", "分项工程名称", "B5", "sub_item_name"),
        ("D5", "检验批容量", "E5", "batch_capacity"),
        ("A6", "施工单位", "B6", "constructor_org"),
        ("D6", "项目负责人", "E6", "project_manager"),
        ("A7", "分包单位", "B7", "subcontractor"),
        ("D7", "分包单位项目负责人", "E7", "subcontractor_manager"),
    ]
    for label_cell, label, value_cell, key in header_rows:
        ws[label_cell] = label
        ws.merge_cells(f"{value_cell}:{get_column_letter(ord(value_cell[0]) - ord('A') + 2)}{value_cell[1:]}")
        ws[value_cell] = demo_value(key) if fill_demo else f"{{{{{key}}}}}"

    ws["A8"] = "施工依据"
    ws.merge_cells("B8:H8")
    ws["B8"] = demo_value("construction_basis") if fill_demo else "{{construction_basis}}"

    ws["A9"] = "验收依据"
    ws.merge_cells("B9:H9")
    ws["B9"] = demo_value("acceptance_basis") if fill_demo else "{{acceptance_basis}}"

    ws["A10"] = "检验批部位"
    ws.merge_cells("B10:H10")
    ws["B10"] = demo_value("batch_location") if fill_demo else "{{batch_location}}"

    ws.merge_cells("A11:H11")
    ws["A11"] = "主控项目"
    ws["A11"].font = Font(bold=True)
    ws["A11"].alignment = CENTER

    main_headers = ["序号", "验收项目", "设计要求及规范规定", "最小/实际抽样数量", "检查记录", "检查结果"]
    cols = ["A", "B", "C", "D", "E", "F"]
    ws.merge_cells("F12:H12")
    for col, text in zip(cols, main_headers):
        ws[f"{col}12"] = text
    ws["F12"] = main_headers[-1]
    ws.merge_cells("F12:H12")

    main_items = [
        (
            "1",
            "混凝土强度等级及试件的取样和留置",
            "第7.4.1条；强度等级必须符合设计要求",
            "3组 / 3组",
            "strength_sampling_record",
            "main_item_1_result",
            "pass",
        ),
        (
            "2",
            "混凝土抗渗及试件取样和留置",
            "第7.4.2条",
            "/",
            "impermeability_record",
            "main_item_2_result",
            "na",
        ),
        (
            "3",
            "原材料每盘称量的偏差",
            "第7.4.3条",
            "每工作班抽查不少于1次",
            "weighing_deviation_record",
            "main_item_3_result",
            "pass",
        ),
        (
            "4",
            "初凝时间控制",
            "第7.4.4条",
            "全 / 全",
            "initial_set_record",
            "main_item_4_result",
            "pass",
        ),
    ]
    row = 13
    for item in main_items:
        ws[f"A{row}"] = item[0]
        ws.merge_cells(f"B{row}:B{row}")
        ws[f"B{row}"] = item[1]
        ws.merge_cells(f"C{row}:C{row}")
        ws[f"C{row}"] = item[2]
        ws.merge_cells(f"D{row}:D{row}")
        ws[f"D{row}"] = item[3]
        ws.merge_cells(f"E{row}:G{row}")
        ws[f"E{row}"] = demo_value(item[4]) if fill_demo else f"{{{{{item[4]}}}}}"
        ws.merge_cells(f"H{row}:H{row}")
        ws[f"H{row}"] = demo_value(item[6]) if fill_demo else f"{{{{{item[5]}}}}}"
        row += 1

    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "一般项目"
    ws[f"A{row}"].font = Font(bold=True)
    ws[f"A{row}"].alignment = CENTER
    row += 1

    for col, text in zip(cols, main_headers):
        ws[f"{col}{row}"] = text
    ws.merge_cells(f"F{row}:H{row}")
    row += 1

    general_items = [
        ("1", "施工缝的位置和处理", "第7.4.5条", "全 / 全", "construction_joint_record", "general_item_1_result", "pass"),
        ("2", "后浇带的位置和浇筑", "第7.4.6条", "/", "post_pour_strip_record", "general_item_2_result", "na"),
        ("3", "养护措施", "第7.4.7条", "全 / 全", "curing_record", "general_item_3_result", "pass"),
    ]
    for item in general_items:
        ws[f"A{row}"] = item[0]
        ws.merge_cells(f"B{row}:B{row}")
        ws[f"B{row}"] = item[1]
        ws.merge_cells(f"C{row}:C{row}")
        ws[f"C{row}"] = item[2]
        ws.merge_cells(f"D{row}:D{row}")
        ws[f"D{row}"] = item[3]
        ws.merge_cells(f"E{row}:G{row}")
        ws[f"E{row}"] = demo_value(item[4]) if fill_demo else f"{{{{{item[4]}}}}}"
        ws.merge_cells(f"H{row}:H{row}")
        ws[f"H{row}"] = demo_value(item[6]) if fill_demo else f"{{{{{item[5]}}}}}"
        row += 1

    ws.merge_cells(f"A{row}:C{row}")
    ws[f"A{row}"] = "施工单位检查结果"
    ws.merge_cells(f"D{row}:H{row}")
    ws[f"D{row}"] = demo_value("constructor_check_result") if fill_demo else "{{constructor_check_result}}"
    row += 1

    sign_rows = [
        ("专业工长（签字）", "foreman_sign", "日期", "foreman_sign_date"),
        ("项目专业质量检查员（签字）", "quality_inspector_sign", "日期", "quality_inspector_sign_date"),
    ]
    for left_label, left_key, right_label, right_key in sign_rows:
        ws.merge_cells(f"A{row}:B{row}")
        ws[f"A{row}"] = left_label
        ws.merge_cells(f"C{row}:D{row}")
        ws[f"C{row}"] = demo_value(left_key) if fill_demo else f"{{{{{left_key}}}}}"
        ws.merge_cells(f"E{row}:F{row}")
        ws[f"E{row}"] = right_label
        ws.merge_cells(f"G{row}:H{row}")
        ws[f"G{row}"] = demo_value(right_key) if fill_demo else f"{{{{{right_key}}}}}"
        row += 1

    ws.merge_cells(f"A{row}:C{row}")
    ws[f"A{row}"] = "监理单位验收结论"
    ws.merge_cells(f"D{row}:H{row}")
    ws[f"D{row}"] = demo_value("supervisor_conclusion") if fill_demo else "{{supervisor_conclusion}}"
    row += 1

    ws.merge_cells(f"A{row}:B{row}")
    ws[f"A{row}"] = "专业监理工程师（签字）"
    ws.merge_cells(f"C{row}:D{row}")
    ws[f"C{row}"] = demo_value("supervisor_engineer_sign") if fill_demo else "{{supervisor_engineer_sign}}"
    ws.merge_cells(f"E{row}:F{row}")
    ws[f"E{row}"] = "日期"
    ws.merge_cells(f"G{row}:H{row}")
    ws[f"G{row}"] = demo_value("supervisor_sign_date") if fill_demo else "{{supervisor_sign_date}}"

    style_range(ws, f"A3:H{row}")
    set_row_heights(ws, 1, row, 22)
    ws.row_dimensions[1].height = 28

    meta = wb.create_sheet("_meta")
    meta["A1"] = "fixture"
    meta["B1"] = "concrete-inspection-batch-gb50204"
    meta["A2"] = "standard"
    meta["B2"] = "GB 50204-2015"
    meta["A3"] = "note"
    meta["B3"] = "Demo template synthesized from public standard layout; not copied from commercial template sites."

    return wb


def demo_value(key: str) -> str:
    data = {
        "project_name": "龙旗广场筑业大厦项目",
        "division_name": "主体结构",
        "sub_item_name": "混凝土",
        "batch_capacity": "85 m³",
        "constructor_org": "某某建设集团有限公司",
        "project_manager": "张三",
        "subcontractor": "/",
        "subcontractor_manager": "/",
        "construction_basis": "《混凝土结构工程施工规范》GB50666-2011；《项目混凝土专项施工方案》SQ-2023-015",
        "acceptance_basis": "《混凝土结构工程施工质量验收规范》GB50204-2015",
        "batch_location": "二层④-⑦轴/A-D轴顶板梁、板",
        "strength_sampling_record": "设计强度 C30。现场留置 150mm 标准养护试件 3 组（编号 C30-B2-01～03），已送检。",
        "impermeability_record": "本部位混凝土设计无抗渗要求。",
        "weighing_deviation_record": "开盘抽查，水泥、砂、石、水、外加剂称量偏差均符合 GB50666 第 7.4.3 条规定。",
        "initial_set_record": "浇筑 09:00 开始，14:30 完成，未超过初凝时间。",
        "construction_joint_record": "施工缝留置于次梁跨度中间 1/3 范围内，已凿毛、清理、润湿并铺设同配比砂浆。",
        "post_pour_strip_record": "本检验批范围内无后浇带。",
        "curing_record": "浇筑完毕 12h 内覆盖塑料薄膜，专人洒水保持湿润，养护期 14 天。",
        "pass": "合格",
        "na": "—",
        "constructor_check_result": "主控项目全部合格，一般项目符合规范规定。自检合格。",
        "foreman_sign": "李四",
        "foreman_sign_date": "2025-08-29",
        "quality_inspector_sign": "王五",
        "quality_inspector_sign_date": "2025-08-29",
        "supervisor_conclusion": "验收合格。",
        "supervisor_engineer_sign": "赵六",
        "supervisor_sign_date": "2025-08-29",
    }
    return data.get(key, "")


def cell_mapping() -> dict:
    return {
        "docTypeId": "concrete_inspection_batch",
        "title": "混凝土施工检验批质量验收记录",
        "standard": "GB 50204-2015",
        "sheet": "检验批记录",
        "placeholdersUseDoubleBraces": True,
        "fields": [
            {"fieldKey": "batch_no", "cell": "B3", "valueType": "string", "required": True},
            {"fieldKey": "project_name", "cell": "B4", "valueType": "string", "required": True},
            {"fieldKey": "division_name", "cell": "E4", "valueType": "string", "required": True},
            {"fieldKey": "sub_item_name", "cell": "B5", "valueType": "string", "required": True},
            {"fieldKey": "batch_capacity", "cell": "E5", "valueType": "string", "required": True},
            {"fieldKey": "constructor_org", "cell": "B6", "valueType": "string", "required": True},
            {"fieldKey": "project_manager", "cell": "E6", "valueType": "string", "required": True},
            {"fieldKey": "subcontractor", "cell": "B7", "valueType": "string", "required": False},
            {"fieldKey": "subcontractor_manager", "cell": "E7", "valueType": "string", "required": False},
            {"fieldKey": "construction_basis", "cell": "B8", "valueType": "text", "required": True},
            {"fieldKey": "acceptance_basis", "cell": "B9", "valueType": "text", "required": True},
            {"fieldKey": "batch_location", "cell": "B10", "valueType": "string", "required": True},
            {"fieldKey": "strength_sampling_record", "cell": "E13", "valueType": "text", "required": True},
            {"fieldKey": "impermeability_record", "cell": "E14", "valueType": "text", "required": False},
            {"fieldKey": "weighing_deviation_record", "cell": "E15", "valueType": "text", "required": True},
            {"fieldKey": "initial_set_record", "cell": "E16", "valueType": "text", "required": True},
            {"fieldKey": "construction_joint_record", "cell": "E20", "valueType": "text", "required": True},
            {"fieldKey": "post_pour_strip_record", "cell": "E21", "valueType": "text", "required": False},
            {"fieldKey": "curing_record", "cell": "E22", "valueType": "text", "required": True},
            {"fieldKey": "constructor_check_result", "cell": "D23", "valueType": "text", "required": True},
            {"fieldKey": "foreman_sign", "cell": "C24", "valueType": "signature", "role": "foreman"},
            {"fieldKey": "foreman_sign_date", "cell": "G24", "valueType": "date"},
            {"fieldKey": "quality_inspector_sign", "cell": "C25", "valueType": "signature", "role": "quality_inspector"},
            {"fieldKey": "quality_inspector_sign_date", "cell": "G25", "valueType": "date"},
            {"fieldKey": "supervisor_conclusion", "cell": "D26", "valueType": "text", "required": True},
            {"fieldKey": "supervisor_engineer_sign", "cell": "C27", "valueType": "signature", "role": "supervisor_engineer"},
            {"fieldKey": "supervisor_sign_date", "cell": "G27", "valueType": "date"},
        ],
        "complianceRules": {
            "strength_grade": {"pattern": "C\\d{2}", "example": "C30"},
            "strength_mpa_min": {"gte": 30, "note": "示例：C30 试块 28d 强度 ≥30MPa"},
            "sampling_groups_min": {"gte": 1, "per": "floor"},
        },
        "signatureRoles": [
            {"role": "foreman", "label": "专业工长"},
            {"role": "quality_inspector", "label": "项目专业质量检查员"},
            {"role": "supervisor_engineer", "label": "专业监理工程师"},
        ],
        "sources": [
            "GB 50204-2015 附录 A 质量验收记录（公开标准）",
            "公开填写范例（百度文库/品茗 GD-C5-71165 同类字段，仅作字段对齐参考）",
        ],
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    template_path = OUT_DIR / "concrete-inspection-batch-gb50204-template.xlsx"
    demo_path = OUT_DIR / "concrete-inspection-batch-demo-filled.xlsx"
    mapping_path = OUT_DIR / "concrete-inspection-batch-cell-mapping.json"

    build_workbook(fill_demo=False).save(template_path)
    build_workbook(fill_demo=True).save(demo_path)
    mapping_path.write_text(json.dumps(cell_mapping(), ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {template_path}")
    print(f"Wrote {demo_path}")
    print(f"Wrote {mapping_path}")


if __name__ == "__main__":
    main()
