export interface DictItem {
  value: string;
  label: string;
}

export const DEMO_DICTS: Record<string, DictItem[]> = {
  job_status: [
    { value: "uploaded", label: "已上传" },
    { value: "inspecting", label: "质检中" },
    { value: "extracting", label: "抽取中" },
    { value: "checking", label: "规则检查" },
    { value: "pending", label: "待审" },
    { value: "previewed", label: "组卷预览" },
    { value: "failed", label: "失败" },
  ],
  rule_status: [
    { value: "draft", label: "草稿" },
    { value: "published", label: "已发布" },
  ],
  proposal_status: [
    { value: "pending", label: "待确认" },
    { value: "confirmed", label: "已确认" },
  ],
  retrieve_path: [
    { value: "vector", label: "向量" },
    { value: "graph", label: "图谱" },
    { value: "exact", label: "精确" },
  ],
  standard_edge_kind: [
    { value: "CITES", label: "CITES" },
    { value: "SUPERSEDES", label: "SUPERSEDES" },
    { value: "APPLIES_TO", label: "APPLIES_TO" },
    { value: "REQUIRES", label: "REQUIRES" },
    { value: "SUPPORTS", label: "SUPPORTS" },
    { value: "PARENT_OF", label: "PARENT_OF" },
    { value: "BELONGS_TO", label: "BELONGS_TO" },
  ],
};
