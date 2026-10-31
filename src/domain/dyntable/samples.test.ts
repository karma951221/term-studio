/**
 * 시스템 견본 — 동적표 상세가 늘 그려 두는 견본 다섯 · 견본이 인자를 채우는 규칙 (기능/동적표 §4.2 「견본」).
 */
import { describe, expect, it } from "vitest";

import type { EnumDef } from "../catalog";
import { dynTableFixtureA, dynTableFixtureAPrime, dynTableFixtureR } from "./fixture";
import { cellText, renderDynTableSample } from "./sampleView";
import { DYN_TABLE_SAMPLES, dynTableSample, sampleArgValues, sampleDescription } from "./samples";

const A = dynTableFixtureA();
const view = (id: string) => {
  const s = dynTableSample(id);
  return renderDynTableSample(A, s.benefits, sampleArgValues(A.params, s));
};

describe("DYN_TABLE_SAMPLES — 견본 다섯", () => {
  it("순서 · 이름 · 한 줄 설명", () => {
    expect(DYN_TABLE_SAMPLES.map((s) => s.id)).toEqual(["reduction3", "reduction1", "noReduction", "multiBenefit", "renewal"]);
    for (const s of DYN_TABLE_SAMPLES) {
      expect(s.label).not.toBe("");
      expect(s.description).not.toBe("");
    }
  });

  it("① 감액 3구간 — 첫 · 가운데 · 마지막 열, 셀 25 · 50 · 100", () => {
    const out = view("reduction3");
    expect(out.issues).toEqual([]);
    expect(out.header.map(cellText)).toEqual(["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후 계약일부터 2년경과시점 전일 이전", "계약일부터 2년경과시점 이후"]);
    expect(out.rows.map((r) => r.map(cellText))).toEqual([["사망보험금", "보험가입금액의 25%", "보험가입금액의 50%", "보험가입금액의 100%"]]);
  });

  it("② 감액 1구간 — 첫 · 마지막 열만", () => {
    expect(view("reduction1").header.map((c) => c.region)).toEqual(["corner", "first", "last"]);
  });

  it("③ 감액 없음 — 단일 열", () => {
    const out = view("noReduction");
    expect(out.header.map(cellText)).toEqual(["구 분", "지급금액"]);
    expect(out.rows.map((r) => r.map(cellText))).toEqual([["골절진단비", "보험가입금액의 100%"]]);
  });

  it("④ 급부 여럿 — 경계 합집합(180일 · 1년)으로 열 셋, 급부마다 한 행 · 세부보장이 둘이라 「해당보장의」", () => {
    const out = view("multiBenefit");
    expect(out.issues).toEqual([]);
    expect(out.header.map((c) => c.region)).toEqual(["corner", "first", "middle", "last"]);
    expect(cellText(out.header[1])).toBe("계약일부터 180일경과시점 전일 이전");
    expect(out.rows.map((r) => r.map(cellText))).toEqual([
      ["뇌졸중진단비", "해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 100%"],
      ["급성심근경색진단비", "해당보장의 보험가입금액의 6%", "해당보장의 보험가입금액의 12%", "해당보장의 보험가입금액의 20%"],
    ]);
  });

  it("⑤ 갱신형 담보 — 기준일 최초계약일 (이름이 (갱신) 지급금액 표로 읽히지 않게)", () => {
    const s = dynTableSample("renewal");
    expect(s.label).toBe("갱신형 담보 — 기준일 최초계약일");
    expect(s.description).toContain("(갱신) 표가 아니라");
    const out = view("renewal");
    expect(out.header.map((c) => c.region)).toEqual(["corner", "first", "middle", "last"]);
    expect(cellText(out.header[1])).toBe("최초계약일부터 1년경과시점 전일 이전");
  });

  it("단일형 정의(첫 · 가운데 · 마지막 비움)는 어느 견본이든 단일 열", () => {
    const R = dynTableFixtureR();
    for (const s of DYN_TABLE_SAMPLES) expect(renderDynTableSample(R, s.benefits, sampleArgValues(R.params, s)).header.map((c) => c.region)).toEqual(["corner", "single"]);
  });
});

describe("sampleDescription — 견본 설명은 정의 모양별", () => {
  const R = dynTableFixtureR();
  const d = (id: string, def = A) => sampleDescription(dynTableSample(id), def);

  it("감액 구간형(A)이면 견본의 감액 구간형 설명 그대로", () => {
    expect(d("reduction3")).toBe("급부 하나, 감액 경계 둘 → 첫 · 가운데 · 마지막 열이 모두 쓰인다.");
    expect(d("renewal")).toContain("머리글 기준일이 「계약일」에서 「최초계약일」로 바뀐다");
  });

  it("단일형(R) — 감액 견본은 열 하나, 감액 구간은 표에 나오지 않는다", () => {
    expect(d("reduction3", R)).toBe("이 정의는 감액이 있어도 열 하나 — 감액 구간(1년 25% · 2년 50%)은 표에 나오지 않고 비율은 지급률(100%).");
    expect(d("reduction1", R)).toBe("이 정의는 감액이 있어도 열 하나 — 감액 구간(1년 50%)은 표에 나오지 않고 비율은 지급률(100%).");
    expect(d("noReduction", R)).toBe("감액이 없다 — 이 정의는 늘 열 하나라 감액 견본과 모양이 같다(급부 하나 · 열 하나).");
    expect(d("multiBenefit", R)).toBe("급부마다 한 행, 열은 하나 — 경계가 달라도 열을 나누지 않고 비율은 급부별 지급률(100% · 20%). 세부보장이 둘이라 셀 앞에 「해당보장의」.");
  });

  it("갱신형 담보 — 인자 갱신형이 없는 정의면 감액 3구간과 같은 표(모양과 무관)", () => {
    expect(d("renewal", R)).toBe("이 정의는 갱신형 인자를 읽지 않는다 — 감액 3구간과 같은 표.");
    expect(d("renewal", { ...A, params: [] })).toBe("이 정의는 갱신형 인자를 읽지 않는다 — 감액 3구간과 같은 표.");
  });

  it("갱신형 담보 — 단일형이라도 인자 갱신형이 있으면 그 인자가 켜진다", () => {
    expect(d("renewal", { ...R, params: A.params })).toBe("인자 갱신형이 켜진다 — 이 정의는 열 하나라 감액 구간은 나오지 않고, 갱신형을 읽는 자리만 감액 3구간과 달라진다.");
  });

  it("단일형 설명이 말하는 비율 · 행이 실제 견본 표와 맞다", () => {
    const rows = (id: string) => {
      const s = dynTableSample(id);
      return renderDynTableSample(R, s.benefits, sampleArgValues(R.params, s)).rows.map((r) => r.map(cellText));
    };
    expect(rows("reduction3")).toEqual([["사망보험금", "보험가입금액의 100%"]]);
    expect(rows("renewal")).toEqual(rows("reduction3"));
    expect(rows("multiBenefit")).toEqual([
      ["뇌졸중진단비", "해당보장의 보험가입금액의 100%"],
      ["급성심근경색진단비", "해당보장의 보험가입금액의 20%"],
    ]);
  });

  it("단일형 설명엔 첫 · 가운데 · 마지막 열 이야기가 없다", () => {
    for (const s of DYN_TABLE_SAMPLES) expect(sampleDescription(s, R)).not.toMatch(/첫 · 가운데|가운데 열|마지막 열/);
  });
});

describe("sampleArgValues — 견본이 인자를 채우는 규칙", () => {
  const plain = dynTableSample("reduction3");
  const renewal = dynTableSample("renewal");

  it("견본이 이름으로 정한 값이 먼저 — 갱신형", () => {
    expect(sampleArgValues(A.params, plain)).toEqual({ 갱신형: false });
    expect(sampleArgValues(A.params, renewal)).toEqual({ 갱신형: true });
  });

  it("견본이 정하지 않은 인자 — 상수 기본 연결 → 없으면 타입별 견본 값(참거짓 아니오 · 열거형 첫 값 · 그 밖 〔이름〕)", () => {
    const enums = new Map<string, EnumDef>([["E1", { code: "E1", label: "급여", values: [{ code: "V1", label: "첫값", order: 1 }, { code: "V2", label: "둘째", order: 2 }] } as EnumDef]]);
    const params = [
      { name: "켬", type: { kind: "boolean" as const }, default: { kind: "const" as const, value: true } },
      { name: "끔", type: { kind: "boolean" as const }, default: { kind: "discriminator" as const, code: "D1" } },
      { name: "종류", type: { kind: "enum" as const, enumCode: "E1" } },
      { name: "횟수", type: { kind: "number" as const } },
    ];
    expect(sampleArgValues(params, plain, enums)).toEqual({ 켬: true, 끔: false, 종류: "V1", 횟수: "〔횟수〕" });
    expect(sampleArgValues(dynTableFixtureAPrime().params, plain)).toEqual({ 갱신형: false, 단서: "〔단서〕" });
  });
});
