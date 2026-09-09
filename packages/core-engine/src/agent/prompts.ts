import type { FindingRow } from "../types.js";

/** Steps where check_wording Tool may run (never writes Receipt). */
export const WORDING_STEPS = new Set([
  "checking",
  "pending",
  "pending_review",
  "check_findings",
]);

const WORDING_INTENT = /起草|生成提案|措辞|审核意见|check_wording|wording/i;

/** Steps where clause retrieval is in-scope even without a keyword. */
const CLAUSE_STEPS = new Set(["checking", "check_findings", "standard_lib"]);

const CLAUSE_INTENT = /条款|规范|标准|查条|search_clause/;

export function shouldDraftWording(step: string, userMessage: string): boolean {
  return WORDING_STEPS.has(step) && WORDING_INTENT.test(userMessage);
}

/**
 * Skip search_clause when the job has no spec pack — retrieval would throw and
 * break HITL chat. Only search on clause keywords or pages that already show clauses.
 */
export function shouldSearchClause(
  step: string,
  userMessage: string,
  packId: string | null | undefined,
): boolean {
  if (!packId) {
    return false;
  }
  return CLAUSE_INTENT.test(userMessage) || CLAUSE_STEPS.has(step);
}

/** Deterministic wording for auto check_wording when blocking findings exist. */
export function buildAutoWording(jobId: string, blocking: FindingRow[]): string {
  const summary = blocking
    .slice(0, 3)
    .map((f) => f.result)
    .join("；");
  return `针对 job ${jobId} 的 blocking finding，建议待审措辞：${summary}。请在待审页确认后生效。`;
}

export function stepSystemPrompt(step: string): string {
  const base =
    "你是工程资料核心引擎的本步对话助手（HITL）。用中文简要回答。" +
    "禁止：确认提案、写 Receipt、submit、发布规则、保存 FieldBox、取消 blocking finding、推进 Job 状态。" +
    "若用户要确认下一步，请提示使用页面上的独立按钮。" +
    "引用条款只能使用检索命中的 clause_id；若无命中须说明未命中，禁止编造条款号。";

  const perStep: Record<string, string> = {
    checking: "当前在规则检查步。可解释 finding 含义，不能取消 blocking。",
    pending_review: "当前在待审步。可讨论措辞；生成提案只能通过 check_wording，不能在对话里确认。",
    pending: "当前在待审步。可讨论措辞；生成提案只能通过 check_wording，不能在对话里确认。",
    check_findings: "当前在检查结论步。可就抽取与 finding 提问。",
    uploaded: "文件已上传。可问识别策略；同意后才进入质检。",
    inspecting: "质检步。可追问阈值与 MIME 校验。",
    extracting: "抽取步。可就 JSON 字段提问。",
    previewed: "组卷预览步。可讨论分组；submit 不对认知层开放。",
    volume_preview: "组卷预览步。可讨论分组；submit 不对认知层开放。",
    rule_editor: "规则编辑步。口语只生成 DSL 草稿，不能直接 publish。",
    standard_lib: "标准库步。可就命中条款提问；只引用检索命中的 clause_id，未命中须说明未命中，不替代硬规则。",
    project_home: "项目首页。可问如何建空规范包；不预置行业条文。",
  };

  return `${base}\n${perStep[step] ?? "就本页结果提问。"}`;
}
