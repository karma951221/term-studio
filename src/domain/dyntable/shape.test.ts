/**
 * 표 모양 — 기능/동적표 §3.2 「표 모양은 머리글 구조가 정한다」(2026-10-21, 열 기준 폐지).
 */
import { describe, expect, it } from "vitest";

import type { Inline } from "../clause/nodes";
import { dynTableFixtureA, dynTableFixtureR } from "./fixture";
import { isBlankTemplate, TABLE_SHAPE_LINE, tableShape, tableShapeIssues } from "./shape";
import type { DynTableHeaders } from "./types";

const text = (id: string, t: string): Inline => ({ id, kind: "text", text: t });

function headers(over: Partial<DynTableHeaders>): DynTableHeaders {
  return { first: [], middle: [], last: [], single: [text("s", "지급금액")], ...over };
}

describe("isBlankTemplate", () => {
  it("노드가 없거나 공백 글뿐이면 빈 템플릿", () => {
    expect(isBlankTemplate([])).toBe(true);
    expect(isBlankTemplate([text("a", "  ")])).toBe(true);
    expect(isBlankTemplate([text("a", "지급금액")])).toBe(false);
    expect(isBlankTemplate([{ id: "x", kind: "slot", ref: "builtin.table.boundary" }])).toBe(false);
  });
});

describe("tableShape", () => {
  it("첫 · 가운데 · 마지막이 모두 비면 단일형 (R)", () => {
    expect(tableShape(dynTableFixtureR().headers)).toBe("single");
  });

  it("첫 · 가운데 · 마지막을 채우면 감액 구간형 (A)", () => {
    expect(tableShape(dynTableFixtureA().headers)).toBe("split");
  });

  it("일부만 채운 편집 중 정의는 감액 구간형으로 펼친다 — 빈 머리글은 빈 칸으로 보인다(저장 검사가 막는다)", () => {
    expect(tableShape(headers({ first: [text("f", "첫")] }))).toBe("split");
    expect(tableShape(headers({ middle: [text("m", "가운데")] }))).toBe("split");
  });
});

describe("tableShapeIssues", () => {
  it("A · R 은 문제 없음", () => {
    expect(tableShapeIssues(dynTableFixtureA().headers)).toEqual([]);
    expect(tableShapeIssues(dynTableFixtureR().headers)).toEqual([]);
  });

  it("첫 · 가운데 · 마지막 중 일부만 채우면 빈 쪽마다 structure", () => {
    const issues = tableShapeIssues(headers({ first: [text("f", "첫")], last: [text("l", "끝")] }));
    expect(issues).toEqual([expect.objectContaining({ kind: "structure", at: expect.objectContaining({ refPath: "headers.middle" }) })]);
    const onlyMiddle = tableShapeIssues(headers({ middle: [text("m", "가운데")] }));
    expect(onlyMiddle.map((i) => i.at.refPath)).toEqual(["headers.first", "headers.last"]);
  });

  it("단일 열 머리글은 두 모양 모두 필요 — 비면 structure", () => {
    const issues = tableShapeIssues({ ...dynTableFixtureA().headers, single: [] });
    expect(issues).toEqual([expect.objectContaining({ kind: "structure", at: expect.objectContaining({ refPath: "headers.single" }) })]);
    expect(tableShapeIssues(headers({ single: [text("s", " ")] })).map((i) => i.at.refPath)).toEqual(["headers.single"]);
  });
});

describe("TABLE_SHAPE_LINE — 구조 섹션 머리의 모양 한 줄", () => {
  it("모양마다 한 줄", () => {
    expect(TABLE_SHAPE_LINE[tableShape(dynTableFixtureA().headers)]).toBe("표 모양: 감액 구간형 — 감액 경계로 열을 나눈다");
    expect(TABLE_SHAPE_LINE[tableShape(dynTableFixtureR().headers)]).toBe("표 모양: 단일형 — 늘 열 하나");
  });
});
