/**
 * 견본 표 — 견본 급부 · 인자 값으로 펼친 표를 칸마다 영역 + 글 조각(자리표시자 값 · 조건 글)으로 (기능/동적표 §4.2).
 * 인수 케이스 1 의 글자 그대로를 기대한다.
 */
import { describe, expect, it } from "vitest";

import { dynTableFixtureA, dynTableFixtureAPrime, dynTableFixtureR } from "./fixture";
import { cellText, renderDynTableSample } from "./sampleView";
import type { DynBenefit } from "./types";

function benefit(sub: string, name: string, rate: number | undefined, periods: [number, number][] = [], afterRate = 100): DynBenefit {
  return {
    subCoverageKey: sub,
    subCoverageName: sub,
    key: `${sub}/${name}`,
    name,
    ...(rate !== undefined ? { payRate: rate } : {}),
    ...(periods.length > 0 ? { reduction: { periods: periods.map(([end, r]) => ({ end, rate: r })), afterRate } } : {}),
  };
}

describe("renderDynTableSample — 글", () => {
  it("케이스 1 — 세부보장 1 · 급부 1 · 경계 1개, 비갱신: 첫 + 마지막 열, 「해당보장의」 없음", () => {
    const out = renderDynTableSample(dynTableFixtureA(), [benefit("질병80%이상후유장해", "질병80%이상후유장해", 100, [[12, 50]])], { 갱신형: false });
    expect(out.issues).toEqual([]);
    expect(out.header.map(cellText)).toEqual(["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후"]);
    expect(out.rows.map((r) => r.map(cellText))).toEqual([["질병80%이상후유장해", "보험가입금액의 50%", "보험가입금액의 100%"]]);
  });

  it("갱신형 = 예 면 기준일이 「최초계약일」, 세부보장 2개면 셀 앞에 「해당보장의」", () => {
    const red: [number, number][] = [[12, 50]];
    const out = renderDynTableSample(dynTableFixtureA(), [benefit("대장", "대장 진단비", 100, red), benefit("위", "위 진단비", 100, red)], { 갱신형: true });
    expect(out.issues).toEqual([]);
    expect(cellText(out.header[1])).toBe("최초계약일부터 1년경과시점 전일 이전");
    expect(out.rows.map((r) => cellText(r[1]))).toEqual(["해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 50%"]);
  });

  it("인자 값을 안 주면 그 조건은 거짓 · 슬롯은 〔이름〕 값 조각으로 드러난다", () => {
    const out = renderDynTableSample(dynTableFixtureAPrime(), [benefit("S", "급부", 100, [[12, 50]])], { 갱신형: false });
    expect(out.header[1].parts.at(-1)).toEqual({ text: "〔단서〕", value: true });
  });

  it("열 기준 「없음」(R) — 단일 열 「지급금액」, 비율 = 지급률 · 급부가 비면 머리글만", () => {
    const out = renderDynTableSample(dynTableFixtureR(), [benefit("S", "항암치료비", 20)], {});
    expect(out.header.map(cellText)).toEqual(["구 분", "지급금액"]);
    expect(out.rows.map((r) => r.map(cellText))).toEqual([["항암치료비", "보험가입금액의 20%"]]);
    expect(renderDynTableSample(dynTableFixtureR(), [], {}).rows).toEqual([]);
  });

  it("지급률 미입력 급부는 100% 로 읽는다 — 사유가 서지 않는다", () => {
    const out = renderDynTableSample(dynTableFixtureR(), [benefit("S", "급부", undefined)], {});
    expect(out.rows.map((r) => r.map(cellText))).toEqual([["급부", "보험가입금액의 100%"]]);
    expect(out.issues.some((m) => m.includes("지급률"))).toBe(false);
  });
});

describe("renderDynTableSample — 영역 · 조각", () => {
  it("칸마다 영역, 쓰인 영역 목록(화면 순서)", () => {
    const out = renderDynTableSample(dynTableFixtureA(), [benefit("S", "사망보험금", 100, [[12, 25], [24, 50]])], { 갱신형: false });
    expect(out.header.map((c) => c.region)).toEqual(["corner", "first", "middle", "last"]);
    expect(out.rows[0].map((c) => c.region)).toEqual(["row", "cell", "cell", "cell"]);
    expect(out.regions).toEqual(["row", "corner", "first", "middle", "last", "cell"]);
  });

  it("자리표시자에 들어간 값은 value, 조건이 고른 글은 cond — 같은 표시가 이웃하면 한 조각", () => {
    const out = renderDynTableSample(dynTableFixtureA(), [benefit("S", "사망보험금", 100, [[12, 25], [24, 50]])], { 갱신형: false });
    expect(out.header[1].parts).toEqual([{ text: "계약일", cond: true }, { text: "부터 " }, { text: "1년", value: true }, { text: "경과시점 전일 이전" }]);
    expect(out.header[2].parts.filter((p) => p.value).map((p) => p.text)).toEqual(["1년", "2년"]);
    expect(out.rows[0][1].parts).toEqual([{ text: "보험가입금액의 " }, { text: "25", value: true }, { text: "%" }]);
  });

  it("세부보장 둘이면 「해당보장의 」 가 조건 조각", () => {
    const out = renderDynTableSample(dynTableFixtureA(), [benefit("가", "가 진단비", 100), benefit("나", "나 진단비", 20)], { 갱신형: false });
    expect(out.rows[1][1].parts).toEqual([{ text: "해당보장의 ", cond: true }, { text: "보험가입금액의 " }, { text: "20", value: true }, { text: "%" }]);
  });
});
