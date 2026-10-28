import { describe, expect, it } from "vitest";

import type { ReferenceTarget } from "@/domain/document";
import { CONNECTOR_PLACEHOLDER } from "@/domain/types";

import { connectorEnabled, pickedPreview, restrictShown, restrictSuffix, type RefFieldsState } from "./refFields";

const base: RefFieldsState = { count: 0, repeatedPicked: false, mode: "", hasValues: false, hasValueLoops: false, treeLevel: undefined };

describe("restrictShown — 값 · 키 한정 칸은 의미가 있을 때만 선다 (2026-10-29)", () => {
  it("평범한 항 하나 — 문서에 사유 반복이 있어도 숨긴다", () => {
    expect(restrictShown({ ...base, count: 1, hasValues: true })).toBe(false);
  });
  it("고른 대상이 반복 안(또는 함수조항 참조)이고 값 후보가 있으면 선다", () => {
    expect(restrictShown({ ...base, count: 1, hasValues: true, repeatedPicked: true })).toBe(true);
  });
  it("반복 안 대상이어도 값 후보가 없으면(담보 트리 반복뿐) 값 한정은 없다", () => {
    expect(restrictShown({ ...base, count: 1, repeatedPicked: true })).toBe(false);
  });
  it("참조 자리가 사유 반복 안이면 「현재 값」 후보가 있어 선다", () => {
    expect(restrictShown({ ...base, count: 1, hasValues: true, hasValueLoops: true })).toBe(true);
  });
  it("담보 트리 반복 안 대상이면 키 한정으로 선다", () => {
    expect(restrictShown({ ...base, count: 1, treeLevel: "benefit" })).toBe(true);
  });
  it("이미 한정을 건 참조는 대상과 상관없이 선다 — 풀 수 있어야 한다", () => {
    expect(restrictShown({ ...base, count: 1, mode: "values" })).toBe(true);
  });
  it("대상을 아직 안 골랐으면 숨긴다", () => {
    expect(restrictShown({ ...base, hasValues: true, hasValueLoops: true })).toBe(false);
  });
});

describe("connectorEnabled — 연결어는 여러 번호가 될 수 있을 때만 (결정 14)", () => {
  it("대상 하나 · 한정 없음이면 고를 수 없다", () => {
    expect(connectorEnabled({ ...base, count: 1 })).toBe(false);
  });
  it("대상 둘이면 고른다", () => {
    expect(connectorEnabled({ ...base, count: 2 })).toBe(true);
  });
  it("반복 안 대상 하나 · 한정을 건 대상 하나도 고른다", () => {
    expect(connectorEnabled({ ...base, count: 1, repeatedPicked: true })).toBe(true);
    expect(connectorEnabled({ ...base, count: 1, mode: "current:L1" })).toBe(true);
  });
});

const article = (n: number): ReferenceTarget => ({ kind: "article", article: { id: `a${n}`, n, title: "" } });
const paragraph = (a: number, n: number): ReferenceTarget => ({ kind: "paragraph", article: { id: `a${a}`, n: a, title: "" }, paragraph: { id: `a${a}p${n}`, n, code: `P0${n}00` } });

describe("pickedPreview — 고른 대상이 찍힐 문구", () => {
  it("없으면 undefined", () => {
    expect(pickedPreview([], undefined, false)).toBeUndefined();
  });
  it("하나면 그 대상 — 연결어 없이", () => {
    expect(pickedPreview([paragraph(10, 1)], "및", false)).toBe("제10조 제1항");
  });
  it("둘이면 고른 연결어로 잇는다", () => {
    expect(pickedPreview([paragraph(10, 1), paragraph(10, 3)], "또는", true)).toBe("제10조 제1항 또는 제3항");
  });
  it("연결어를 아직 안 골랐으면 자리표시", () => {
    expect(pickedPreview([article(3), article(5)], undefined, true)).toBe(`제3조 ${CONNECTOR_PLACEHOLDER} 제5조`);
  });
});

describe("restrictSuffix — 미리보기 끝의 한정 표기 (칩과 같은 말)", () => {
  it("없음이면 빈 글", () => {
    expect(restrictSuffix("", { values: [], keys: [] })).toBe("");
  });
  it("해당 값들 — 고른 값 이름", () => {
    expect(restrictSuffix("values", { values: ["뇌졸중", "급성심근경색증"], keys: [] })).toBe(" ⟨값 = 뇌졸중 · 급성심근경색증⟩");
  });
  it("해당 값들인데 아직 안 골랐으면 자리표시", () => {
    expect(restrictSuffix("values", { values: [], keys: [] })).toBe(" ⟨값 = ?⟩");
  });
  it("해당 키들", () => {
    expect(restrictSuffix("keys", { values: [], keys: ["세부보장 01 · 암"] })).toBe(" ⟨해당 키 — 세부보장 01 · 암⟩");
  });
  it("현재 — 반복 이름", () => {
    expect(restrictSuffix("current:L1", { values: [], keys: [], current: "납입면제사유마다" })).toBe(" ⟨현재 값 — 납입면제사유마다⟩");
  });
});
