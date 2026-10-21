/**
 * 동적표 칸의 영역 — 펼친 표의 칸마다 「어느 템플릿 영역이 만들었나」 · 자리표시자 노드 (기능/동적표 §4.2 「칸 ↔ 필드」).
 */
import { describe, expect, it } from "vitest";

import { plainConst } from "../clause/bind";
import { expandDynTable } from "./expand";
import { dynTableFixtureA, dynTableFixtureAPrime, dynTableFixtureR } from "./fixture";
import { headerRegion, placeholderIds, regionsOf, templateNodeId } from "./regions";
import type { DynBenefit, DynTable } from "./types";

const deps = { formatConst: plainConst, refId: "ref1" };
const A: DynTable = { id: "a", code: "DT000001", ...dynTableFixtureA() };
const R: DynTable = { id: "r", code: "DT000002", ...dynTableFixtureR() };

function benefit(name: string, periods: [number, number][]): DynBenefit {
  return { subCoverageKey: name, subCoverageName: name, key: name, name, payRate: 100, ...(periods.length > 0 ? { reduction: { periods: periods.map(([end, rate]) => ({ end, rate })), afterRate: 100 } } : {}) };
}

describe("headerRegion — 열 머리글을 만든 템플릿", () => {
  it("열 하나 = 단일, 둘 = 첫 + 마지막, 셋 이상 = 첫 + 가운데 + 마지막", () => {
    expect(headerRegion(0, 1)).toBe("single");
    expect([0, 1].map((j) => headerRegion(j, 2))).toEqual(["first", "last"]);
    expect([0, 1, 2, 3].map((j) => headerRegion(j, 4))).toEqual(["first", "middle", "middle", "last"]);
  });
});

describe("regionsOf — 펼친 표의 칸마다 영역", () => {
  it("경계 둘(열 셋) — 머리글 행 = 구분 칸 · 첫 · 가운데 · 마지막, 본문 행 = 행 머리 + 셀", () => {
    const out = expandDynTable(A, { benefits: [benefit("사망보험금", [[12, 25], [24, 50]])] }, { 갱신형: { kind: "const", value: false } }, deps);
    expect(regionsOf(out)).toEqual({ header: ["corner", "first", "middle", "last"], rows: [["row", "cell", "cell", "cell"]] });
  });

  it("열 기준 「없음」 — 구분 칸 + 단일 열", () => {
    const out = expandDynTable(R, { benefits: [benefit("골절진단비", [])] }, undefined, deps);
    expect(regionsOf(out)).toEqual({ header: ["corner", "single"], rows: [["row", "cell"]] });
  });
});

describe("자리표시자 노드", () => {
  it("templateNodeId — 펼친 노드 id 에서 템플릿 노드 id 를 꺼낸다(참조 id 가 다르면 없음)", () => {
    expect(templateNodeId("ref1/first-boundary@rhc1", "ref1")).toBe("first-boundary");
    expect(templateNodeId("ref1/cell-t1@r2c3", "ref1")).toBe("cell-t1");
    expect(templateNodeId("other/cell-t1@r2c3", "ref1")).toBeUndefined();
  });

  it("placeholderIds — 템플릿의 슬롯 노드 id 전부(표 슬롯 · 인자 슬롯, 조건 안까지)", () => {
    const ids = placeholderIds(dynTableFixtureA());
    expect([...ids].sort()).toEqual(["cell-rate", "first-boundary", "last-boundary", "middle-boundary", "middle-prev"]);
    expect(placeholderIds(dynTableFixtureAPrime()).has("first-clause")).toBe(true);
  });
});
