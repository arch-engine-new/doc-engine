/**
 * Re-export generated core-engine row contracts.
 * Field names are owned by docs/schema/generated/core-engine-rows.ts — do not invent.
 */
export type {
  AuditColumns,
  AuditEventRow,
  ClauseRow,
  ConversationMessageRow,
  ConversationThreadRow,
  CompletenessRuleRow,
  DocTypeRow,
  DocumentArtifactRow,
  DocumentRow,
  ExcelCellMappingRow,
  ExtractionRow,
  FieldBoxRow,
  FieldDefRow,
  FieldFillRuleRow,
  FindingRow,
  IngestPageRow,
  IngestRunRow,
  JobRow,
  JsonValue,
  LayoutEdgeRow,
  LayoutUnitRow,
  ProjectRow,
  ProposalRow,
  ReceiptRow,
  RuleFixtureRow,
  RuleRow,
  RuleVersionRow,
  SignatureTaskRow,
  SkillDraftRow,
  SkillLedgerRow,
  SkillRecordRow,
  SpecPackRow,
  StandardDocRow,
  StandardEdgeRow,
  StandardVersionRow,
  TemplateRow,
  VolumePreviewRow,
} from "../../../docs/schema/generated/core-engine-rows.js";

/** leftover fixture jobs stay legacy; empty-engine table Skill uploads write skill. */
export type JobTrack = "legacy" | "skill";
