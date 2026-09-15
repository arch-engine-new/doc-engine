/**
 * Vector payload gate. Callers must supply provenance; stores must not invent it.
 */

const CHUNK_KINDS = new Set(["clause", "table", "annex"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function assertClauseIdForKind(payload: Record<string, unknown>): void {
  const clauseId = payload.clause_id;
  const hasClauseId = typeof clauseId === "string" && clauseId.length > 0;
  // Tables/annexes may omit clause_id or send JSON null; a non-empty string is R21.
  if (payload.chunk_kind === "table" || payload.chunk_kind === "annex") {
    if (hasClauseId) {
      throw new Error("table/annex vector payload must not carry clause_id");
    }
    return;
  }
  if (clauseId === undefined || clauseId === null) return;
  if (typeof clauseId !== "string" || clauseId !== payload.unit_id) {
    throw new Error("clause vector payload clause_id must equal unit_id");
  }
}

/**
 * Reject payloads that Qdrant used to "repair" with `clause_id: payload?.clause_id ?? point.id`.
 * That backfill turned a table/annex layout id into a fake clause number on search hits.
 */
export function assertVectorPayload(
  payload: unknown,
): asserts payload is Record<string, unknown> {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("vector payload must be an object");
  }
  const body = payload as Record<string, unknown>;
  if (!isNonEmptyString(body.file_name)) {
    throw new Error("vector payload missing file_name");
  }
  if (!isNonEmptyString(body.unit_id)) {
    throw new Error("vector payload missing unit_id");
  }
  if (typeof body.chunk_kind !== "string" || !CHUNK_KINDS.has(body.chunk_kind)) {
    throw new Error("vector payload invalid chunk_kind");
  }
  if (
    !isPositiveInt(body.page_start) ||
    !isPositiveInt(body.page_end) ||
    body.page_end < body.page_start
  ) {
    throw new Error("vector payload invalid page range");
  }
  assertClauseIdForKind(body);
}

/**
 * Persist unit_id and drop table/annex clause_id so stores cannot resurrect a fake clause number.
 */
export function storedVectorPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const stored: Record<string, unknown> = { ...payload, unit_id: payload.unit_id };
  if (payload.chunk_kind === "table" || payload.chunk_kind === "annex") {
    delete stored.clause_id;
  }
  return stored;
}

/**
 * Search hits must surface layout identity. Missing unit_id is a gate failure, not a UUID fallback.
 */
export function requirePayloadUnitId(payload: Record<string, unknown> | undefined): string {
  const unitId = payload?.unit_id;
  if (typeof unitId === "string" && unitId.length > 0) return unitId;
  throw new Error("vector payload missing unit_id");
}
