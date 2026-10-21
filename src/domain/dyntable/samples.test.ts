/**
 * 시스템 견본 — 동적표 상세가 늘 그려 두는 견본 다섯 · 견본이 인자를 채우는 규칙 (기능/동적표 §4.2 「견본」).
 */
import { describe, expect, it } from "vitest";

import type { EnumDef } from "../catalog";
import { dynTableFixtureA, dynTableFixtureAPrime, dynTableFixtureR } from "./fixture";
import { cellText, renderDynTableSample } from "./sampleView";
import { DYN_TABLE_SAMPLES, dynTableSample, sampleArgValues } from "./samples";

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

  it("④ 급부 여럿 — 경계 합집합(6개월 · 1년)으로 열 셋, 급부마다 한 행 · 세부보장이 둘이라 「해당보장의」", () => {
    const out = view("multiBenefit");
    expect(out.issues).toEqual([]);
    expect(out.header.map((c) => c.region)).toEqual(["corner", "first", "middle", "last"]);
    expect(cellText(out.header[1])).toBe("계약일부터 6개월경과시점 전일 이전");
    expect(out.rows.map((r) => r.map(cellText))).toEqual([
      ["뇌졸중진단비", "해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 100%"],
      ["급성심근경색진단비", "해당보장의 보험가입금액의 6%", "해당보장의 보험가입금액의 12%", "해당보장의 보험가입금액의 20%"],
    ]);
  });

  it("⑤ 갱신형 켬 — 감액 3구간, 기준일이 「최초계약일」", () => {
    const out = view("renewal");
    expect(out.header.map((c) => c.region)).toEqual(["corner", "first", "middle", "last"]);
    expect(cellText(out.header[1])).toBe("최초계약일부터 1년경과시점 전일 이전");
  });

  it("열 기준 「없음」 정의는 어느 견본이든 단일 열", () => {
    const R = dynTableFixtureR();
    for (const s of DYN_TABLE_SAMPLES) expect(renderDynTableSample(R, s.benefits, sampleArgValues(R.params, s)).header.map((c) => c.region)).toEqual(["corner", "single"]);
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
