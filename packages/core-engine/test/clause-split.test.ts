/**
 * SLICE-6 clause split: headings, not a fixed 512-token window.
 */

import { describe, it, expect } from "vitest";
import { splitClauses } from "../src/index.js";

const FIXTURE = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

describe("splitClauses", () => {
  it("splits leave-request fixture into three headed clauses", () => {
    const parts = splitClauses(FIXTURE);
    expect(parts.map((p) => p.clauseNo)).toEqual(["1.1", "1.2", "2.1"]);
    expect(parts[0]?.heading).toContain("1.1");
    expect(parts[1]?.body).toContain("医疗机构");
  });

  it("does not chunk by 512-token windows: two headed clauses of very different lengths stay 2", () => {
    const longBody = "补交材料说明。".repeat(200);
    expect(longBody.length).toBeGreaterThan(512);
    const text = `第1条 短条款。
短。
第2条 长条款。
${longBody}
`;
    const parts = splitClauses(text);
    expect(parts).toHaveLength(2);
    expect(parts[0]?.clauseNo).toBe("第1条");
    expect(parts[1]?.clauseNo).toBe("第2条");
    expect(parts[1]?.body.length).toBeGreaterThan(512);
    const tokenWindowChunks = Math.ceil((parts[0]!.body.length + parts[1]!.body.length) / 512);
    expect(tokenWindowChunks).toBeGreaterThan(2);
    expect(parts.length).not.toBe(tokenWindowChunks);
  });

  it("preserves parent heading on dotted children when parent exists", () => {
    const text = `1.0 请假制度
总则说明。
1.0.1 事假须提前申请。
书面申请。
`;
    const parts = splitClauses(text);
    expect(parts).toHaveLength(2);
    expect(parts[1]?.parentClauseNo).toBe("1.0");
    expect(parts[1]?.heading).toContain("1.0 请假制度");
    expect(parts[1]?.heading).toContain("1.0.1");
  });
});
