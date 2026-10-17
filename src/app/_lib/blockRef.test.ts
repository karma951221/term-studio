import { describe, expect, it } from "vitest";

import { blockRefChipText, blockRefValue, parseBlockRefValue } from "./blockRef";

const choices = [{ productCoverageId: "pc1", label: "1. 상해사망", articles: [{ id: "a1", label: "제1조(보험금의 지급사유)" }] }];

describe("블록 지정 참조 화면 표기 (ADR-0082 결정 12)", () => {
  it("칩 글 — 블록 전체 · 블록 조 · 대상 없음 · 재료 없음", () => {
    expect(blockRefChipText(choices, { productCoverageId: "pc1" })).toBe("제2절 보장조항 1. 상해사망");
    expect(blockRefChipText(choices, { productCoverageId: "pc1", articleId: "a1" })).toBe("제2절 보장조항 1. 상해사망 제1조(보험금의 지급사유)");
    expect(blockRefChipText(choices, { productCoverageId: "pc1", articleId: "a9" })).toBe("제2절 보장조항 1. 상해사망 (대상 조 없음)");
    expect(blockRefChipText(choices, { productCoverageId: "pc9" })).toBe("블록 지정 참조(대상 블록 없음)");
    expect(blockRefChipText(undefined, { productCoverageId: "pc1" })).toBe("〔블록 지정 참조〕");
  });
  it("고르기 값 왕복", () => {
    expect(parseBlockRefValue(blockRefValue("pc1"))).toEqual({ productCoverageId: "pc1" });
    expect(parseBlockRefValue(blockRefValue("pc1", "a1"))).toEqual({ productCoverageId: "pc1", articleId: "a1" });
    expect(parseBlockRefValue("")).toBeUndefined();
  });
});
