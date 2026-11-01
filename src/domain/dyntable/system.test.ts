/**
 * 표 구분자 — 시스템 정의 · 일반 · 갱신 한 쌍 (기능/구분자 §3.7, ADR-0099).
 */
import { describe, expect, it } from "vitest";

import { plainConst } from "../clause/bind";
import type { Inline } from "../clause/nodes";
import { reductionBoundary, reductionPeriodEnumSeed } from "../coverage/traits";
import { checkDynTable } from "./check";
import { expandDynTable } from "./expand";
import { findTableDiscriminator, isTableDiscriminatorCode, TABLE_DISCRIMINATORS, tableDiscriminatorBindings, tableShape, templateText, type DynBenefit } from "./index";

const 감액기간 = reductionPeriodEnumSeed();
const 일년 = reductionBoundary(감액기간, "V03");

/** 글 · 조건(참거짓 리터럴만)을 글로. */
function text(inlines: readonly Inline[]): string {
  return inlines
    .map((n) => {
      if (n.kind === "text") return n.text;
      if (n.kind === "inlineCond") {
        const hit = n.branches.find((b) => b.when === undefined || b.when === "true");
        return hit ? text(hit.children) : "";
      }
      if (n.kind === "slot") return `{${n.ref}}`;
      return "";
    })
    .join("");
}

const benefit: DynBenefit = { subCoverageKey: "S", subCoverageName: "S", key: "G", name: "주요치료비", payRate: 100, reduction: { periods: [{ end: 일년, rate: 50 }], afterRate: 100 } };

describe("표 구분자 목록 — 정의 둘 × 일반 · 갱신 = 넷", () => {
  it("코드 · 이름 · 짝 · 종류 — 감액 지급금액 표(DT000001 · DT000002) · 통합치료비 표(DT000003 · DT000004)", () => {
    expect(TABLE_DISCRIMINATORS.map((t) => [t.code, t.label, t.variant, t.pair, t.kind])).toEqual([
      ["DT000001", "보험금 지급금액표", "general", "DT000002", "reduction"],
      ["DT000002", "갱신 보험금 지급금액표", "renewal", "DT000001", "reduction"],
      ["DT000003", "통합치료비 지급금액표", "general", "DT000004", "fixed"],
      ["DT000004", "갱신 통합치료비 지급금액표", "renewal", "DT000003", "fixed"],
    ]);
    expect(TABLE_DISCRIMINATORS.every((t) => t.level === "coverage")).toBe(true);
  });

  it("찾기 — 표 구분자 코드만", () => {
    expect(findTableDiscriminator("DT000003")?.label).toBe("통합치료비 지급금액표");
    expect(findTableDiscriminator("D0001")).toBeUndefined();
    expect(isTableDiscriminatorCode("DT000002")).toBe(true);
    expect(isTableDiscriminatorCode("D0005")).toBe(false);
  });

  it("일반표는 감액 구간형, 갱신표는 단일형(열 하나) — 시스템 정의는 정의 저장 검사를 통과한다", () => {
    for (const t of TABLE_DISCRIMINATORS) {
      expect(tableShape(t.table.headers)).toBe(t.variant === "general" ? "split" : "single");
      expect(checkDynTable(t.table)).toEqual([]);
    }
  });

  it("읽는 폼 — 감액 표는 감액 · 지급률 · 체증 · 단서문구, 통합치료비 표는 감액 · 정액표 · 가입금액", () => {
    expect(findTableDiscriminator("DT000001")?.reads).toEqual(["reduction.periods", "pay.rate", "escalation.steps", "proviso.text"]);
    expect(findTableDiscriminator("DT000003")?.reads).toEqual(["reduction.periods", "fixed_table.grid", "insured_amount.amounts"]);
  });
});

describe("문구 템플릿 읽기 표기 — 상세 화면 (§4.5)", () => {
  it("기준일 조건은 〔(최초)계약일〕, 단서문구 꼬리는 〔 {단서문구}〕, 「해당보장의」 조건은 〔해당보장의 〕, 표 슬롯은 {경계}", () => {
    const t = findTableDiscriminator("DT000001")!.table;
    expect(templateText(t.headers.first)).toBe("〔(최초)계약일〕부터 {경계}경과시점 전일 이전〔 {단서문구}〕");
    expect(templateText(t.cell)).toBe("〔해당보장의 〕보험가입금액의 {비율}%");
    expect(templateText(findTableDiscriminator("DT000003")!.table.fixed!.caption)).toBe("<보험가입금액 {가입금액}>");
  });
});

describe("시스템 연결 — 기준일 낱말 · 단서문구 꼬리 (§3.7 · 3-d)", () => {
  const deps = { formatConst: plainConst, refId: "r" };
  const expand = (code: string, renewable: boolean, proviso?: string) => {
    const t = findTableDiscriminator(code)!;
    return expandDynTable(t.table, { benefits: [benefit], renewable }, tableDiscriminatorBindings({ renewable, ...(proviso ? { proviso } : {}) }), deps);
  };

  it("감액 열 머리글 = 〔(최초)계약일〕부터 {경계}경과시점 전일 이전 / 이후 — 단서문구가 없으면 꼬리 없이", () => {
    const t = expand("DT000001", false);
    expect(t.issues).toEqual([]);
    expect(t.header.map(text)).toEqual(["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후"]);
  });

  it("갱신형이면 최초계약일 · 단서문구가 있으면 감액 열 머리글 끝에 한 칸 띄우고 꼬리", () => {
    const t = expand("DT000001", true, "「2대질환」으로 진단확정시");
    expect(t.header.map(text)).toEqual(["구 분", "최초계약일부터 1년경과시점 전일 이전 「2대질환」으로 진단확정시", "최초계약일부터 1년경과시점 이후 「2대질환」으로 진단확정시"]);
  });

  it("갱신표는 열 하나 「지급금액」 — 꼬리가 없다", () => {
    expect(expand("DT000002", true, "꼬리").header.map(text)).toEqual(["구 분", "지급금액"]);
  });
});
