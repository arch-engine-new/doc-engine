/**
 * IndependentReranker must not call chat complete.
 * CI HashEmbeddings stays 48-dim even when callers await embed().
 */

import { describe, it, expect, vi } from "vitest";
import { HashEmbeddings, IndependentReranker } from "../src/index.js";

describe("IndependentReranker", () => {
  it("HashEmbeddings embed length is 48 when awaited", async () => {
    const vector = await new HashEmbeddings().embed("x");
    expect(vector).toHaveLength(48);
  });

  it("does not call LlmProvider.complete", async () => {
    const complete = vi.fn(async () => {
      throw new Error("LlmProvider.complete must not be called");
    });
    const spy = { complete };
    const embed = new HashEmbeddings();
    const reranker = new IndependentReranker({ llm: spy, embed });
    const preferred = "事假须提前申请。须在休假前书面申请。";
    const other = "病假须提供医疗机构证明。";
    const ids = await reranker.rerank("事假须提前申请", [
      { clause_id: "v:1.2", text: other, vector: await embed.embed(other) },
      { clause_id: "v:1.1", text: preferred, vector: await embed.embed(preferred) },
    ]);
    expect(complete).not.toHaveBeenCalled();
    expect(ids[0]).toBe("v:1.1");
  });

  it("reranks when embed returns a Promise", async () => {
    const embed = {
      embed: async (text: string): Promise<number[]> => {
        await Promise.resolve();
        if (text === "alpha") return [1, 0];
        if (text === "yyyy") return [1, 0];
        return [0, 1];
      },
    };
    const reranker = new IndependentReranker({ embed });
    const ids = await reranker.rerank("alpha", [
      { clause_id: "wrong", text: "zzzz" },
      { clause_id: "right", text: "yyyy" },
    ]);
    expect(ids[0]).toBe("right");
  });
});
