/**
 * 정액형 견본 — 정액형 정의의 상세가 늘 그리는 통합치료비 꼴 견본 (기능/동적표 §4.2 · §3.7).
 */
import { describe, expect, it } from "vitest";

import { DYN_TABLE_FIXED_SAMPLE, renderDynTableFixedSample } from "./fixedSample";
import { dynTableFixtureF, dynTableFixtureFR } from "./fixture";
import { cellText } from "./sampleView";

describe("renderDynTableFixedSample", () => {
  it("정의 F — 급부 머리글 둘 · 가입금액마다 캡션 + 표, 칸마다 영역(급부 머리글 · 캡션 · 글자 열 머리 · 글자 칸 · 열 머리글 · 셀)", () => {
    const v = renderDynTableFixedSample(dynTableFixtureF(), { 갱신형: false });
    expect(v.issues).toEqual([]);
    expect(v.blocks.map((b) => b.kind)).toEqual(["benefitHeader", "caption", "table", "caption", "table", "benefitHeader", "caption", "table", "caption", "table"]);
    const first = v.blocks[0];
    if (first.kind !== "benefitHeader") throw new Error();
    expect(cellText(first.cell)).toBe("1. 상해로 인한 경우");
    expect(first.cell.parts.some((p) => p.value && p.text === "1")).toBe(true);
    const caption = v.blocks[1];
    if (caption.kind !== "caption") throw new Error();
    expect(cellText(caption.cell)).toBe("<보험가입금액 3,000만원>");
    const table = v.blocks[2];
    if (table.kind !== "table") throw new Error();
    expect(table.header.map((c) => [c.region, cellText(c)])).toEqual([
      ["textHeader", "분류"],
      ["textHeader", "치료항목"],
      ["textHeader", "지급횟수"],
      ["single", "지급금액"],
    ]);
    expect(table.rows[0].cells.map((c) => [c.region, cellText(c)])).toEqual([
      ["textCell", "상해"],
      ["textCell", "입원"],
      ["textCell", "1일당"],
      ["cell", "5만원"],
    ]);
    const split = v.blocks[7];
    if (split.kind !== "table") throw new Error();
    expect(split.header.map((c) => c.region)).toEqual(["textHeader", "textHeader", "textHeader", "first", "last"]);
    expect(split.rows[1].spans).toEqual([0, 1, 1, 1, 1]);
    expect(v.regions).toEqual(["first", "last", "single", "cell", "benefitHeader", "caption", "textHeader", "textCell"]);
  });

  it("정의 FR(단일형) — 감액이 있어도 지급금액 열 하나 · 가운데 · 첫 · 마지막 영역은 없다", () => {
    const v = renderDynTableFixedSample(dynTableFixtureFR(), {});
    expect(v.issues).toEqual([]);
    expect(v.regions).toEqual(["single", "cell", "benefitHeader", "caption", "textHeader", "textCell"]);
  });

  it("견본 재료 — 급부 둘 · 가입금액 둘 · 설명 한 줄", () => {
    expect(DYN_TABLE_FIXED_SAMPLE.benefits).toHaveLength(2);
    expect(DYN_TABLE_FIXED_SAMPLE.insuredAmounts).toEqual([30_000_000, 50_000_000]);
    expect(DYN_TABLE_FIXED_SAMPLE.description).not.toBe("");
  });
});
