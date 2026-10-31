/**
 * 정액형 표 펼침 — 기능/동적표 §3.7 (통합치료비). 급부(정액표 있는 것) → [급부 머리글(둘 이상일 때)] → 가입금액(오름차순) → 캡션 → 표.
 * 표 = 정액표의 글자 열 + 지급금액 열(그 급부 하나의 감액 구간), 셀 = 정액 × 감액비율(원 단위 반올림 없음 · 지급률은 곱하지 않는다), 첫 글자 열 세로 병합.
 */
import { describe, expect, it } from "vitest";

import { plainConst } from "../clause/bind";
import type { Inline } from "../clause/nodes";
import { reductionBoundary, reductionPeriodEnumSeed } from "../coverage/traits";
import type { FixedGrid } from "../types";
import { expandFixedDynTable, type FixedBlock } from "./expandFixed";
import { dynTableFixtureF, dynTableFixtureFR } from "./fixture";
import type { DynBenefit, DynTable, NewDynTable } from "./types";

const def = (n: NewDynTable, code = "T0003"): DynTable => ({ id: `id-${code}`, code, ...n });
const F = def(dynTableFixtureF());
const FR = def(dynTableFixtureFR(), "T0004");
const deps = { formatConst: plainConst, refId: "ref1" };
const 감액기간 = reductionPeriodEnumSeed();
const 일년 = reductionBoundary(감액기간, "V03");

const grid = (rows: [string[], Record<string, number>][], columns = ["분류", "치료항목", "지급횟수"]): FixedGrid => ({ columns, rows: rows.map(([cells, amounts]) => ({ cells, amounts })) });

/** 통합치료비 꼴 — 급부 「상해」(감액 없음) · 「상해 이외」(1년 50%), 가입금액 3,000만 · 5,000만. */
const 상해: DynBenefit = {
  subCoverageKey: "01", subCoverageName: "통합치료비", key: "1", name: "상해로 인한 경우", payRate: 100,
  fixedGrid: grid([[["상해", "입원", "1일당"], { "30000000": 50_000, "50000000": 80_000 }]]),
};
const 상해이외: DynBenefit = {
  subCoverageKey: "01", subCoverageName: "통합치료비", key: "2", name: "상해 이외의 사유로 인한 경우", payRate: 50,
  reduction: { periods: [{ end: 일년, rate: 50 }], afterRate: 100 },
  fixedGrid: grid([
    [["질병", "입원", "1일당"], { "30000000": 50_000, "50000000": 80_000 }],
    [["질병", "통원", "1회당"], { "30000000": 25_000, "50000000": 40_000 }],
    [["기타", "약제", "1회당"], { "30000000": 2_500, "50000000": 5_000 }],
  ]),
};
const 비갱신 = { 갱신형: { kind: "const" as const, value: false } };

/** 글 — 상수로 연결된 인라인 조건은 리터럴 `true` 가지(없으면 else 가지)를 고른다. 표 슬롯은 펼침이 글로 바꿨어야 하므로 남으면 드러낸다. */
const text = (list: readonly Inline[]): string =>
  list
    .map((n) => {
      if (n.kind === "text") return n.text;
      if (n.kind === "inlineCond") {
        const hit = n.branches.find((br) => br.when === undefined || br.when === "true");
        return hit ? text(hit.children) : "";
      }
      return `{${n.kind}}`;
    })
    .join("");
function lines(blocks: readonly FixedBlock[]): string[] {
  return blocks.flatMap((b) => {
    if (b.kind === "benefitHeader") return [`# ${text(b.inlines)}`];
    if (b.kind === "caption") return [`> ${text(b.inlines)}`];
    return [`[${b.header.map(text).join(" │ ")}]`, ...b.rows.map((r) => `[${r.cells.map(text).join(" │ ")}]${r.spans ? ` spans=${r.spans.join(",")}` : ""}`)];
  });
}

describe("정액형 표 펼침 — 통합치료비 (기능/동적표 §3.7)", () => {
  it("급부 → 가입금액 → 캡션 + 표. 급부 머리글은 정액표 급부가 둘 이상일 때, 지급금액 열은 그 급부의 감액으로만 나눈다, 셀 = 정액 × 감액비율", () => {
    const t = expandFixedDynTable(F, { benefits: [상해, 상해이외], insuredAmounts: [50_000_000, 30_000_000] }, 비갱신, deps);
    expect(t.issues).toEqual([]);
    expect(lines(t.blocks)).toEqual([
      "# 1. 상해로 인한 경우",
      "> <보험가입금액 3,000만원>",
      "[분류 │ 치료항목 │ 지급횟수 │ 지급금액]",
      "[상해 │ 입원 │ 1일당 │ 5만원]",
      "> <보험가입금액 5,000만원>",
      "[분류 │ 치료항목 │ 지급횟수 │ 지급금액]",
      "[상해 │ 입원 │ 1일당 │ 8만원]",
      "# 2. 상해 이외의 사유로 인한 경우",
      "> <보험가입금액 3,000만원>",
      "[분류 │ 치료항목 │ 지급횟수 │ 계약일부터 1년경과시점 전일 이전 │ 계약일부터 1년경과시점 이후]",
      "[질병 │ 입원 │ 1일당 │ 2만 5천원 │ 5만원] spans=2,1,1,1,1",
      "[질병 │ 통원 │ 1회당 │ 12,500원 │ 2만 5천원] spans=0,1,1,1,1",
      "[기타 │ 약제 │ 1회당 │ 1,250원 │ 2,500원]",
      "> <보험가입금액 5,000만원>",
      "[분류 │ 치료항목 │ 지급횟수 │ 계약일부터 1년경과시점 전일 이전 │ 계약일부터 1년경과시점 이후]",
      "[질병 │ 입원 │ 1일당 │ 4만원 │ 8만원] spans=2,1,1,1,1",
      "[질병 │ 통원 │ 1회당 │ 2만원 │ 4만원] spans=0,1,1,1,1",
      "[기타 │ 약제 │ 1회당 │ 2,500원 │ 5천원]",
    ]);
    // 지급률(50%)은 곱하지 않는다 — 정액이 이미 지급금액이다
    expect(t.blocks.filter((b) => b.kind === "table")).toHaveLength(4);
  });

  it("정액표 급부가 하나면 급부 머리글이 없다 · 정액표 없는 급부는 표에 나오지 않는다", () => {
    const 일반: DynBenefit = { subCoverageKey: "02", subCoverageName: "일반", key: "1", name: "일반급부", payRate: 100 };
    const t = expandFixedDynTable(F, { benefits: [일반, 상해], insuredAmounts: [30_000_000] }, 비갱신, deps);
    expect(t.issues).toEqual([]);
    expect(lines(t.blocks)).toEqual(["> <보험가입금액 3,000만원>", "[분류 │ 치료항목 │ 지급횟수 │ 지급금액]", "[상해 │ 입원 │ 1일당 │ 5만원]"]);
  });

  it("(갱신) 정액 표 — 단일형이라 감액이 있어도 지급금액 열 하나 · 정액 그대로", () => {
    const t = expandFixedDynTable(FR, { benefits: [상해이외], insuredAmounts: [30_000_000] }, undefined, deps);
    expect(t.issues).toEqual([]);
    expect(lines(t.blocks)[1]).toBe("[분류 │ 치료항목 │ 지급횟수 │ 지급금액]");
    expect(lines(t.blocks)[2]).toBe("[질병 │ 입원 │ 1일당 │ 5만원] spans=2,1,1,1");
  });

  it("운영 가입금액이 정액표에 없으면 오류(그 급부 행 좌표 · 금액을 말한다) — 그 표는 셀을 비운다", () => {
    const t = expandFixedDynTable(F, { benefits: [상해], insuredAmounts: [30_000_000, 70_000_000] }, 비갱신, deps, { document: "special", ownerId: "pc1" });
    expect(t.issues).toEqual([expect.objectContaining({ kind: "notEntered", at: expect.objectContaining({ document: "special", refPath: "동적표 T0003 › 행 상해로 인한 경우" }) })]);
    expect(t.issues[0].message).toContain("7,000만원");
    expect(lines(t.blocks).at(-1)).toBe("[상해 │ 입원 │ 1일당 │ ]");
  });

  it("정액표 급부가 하나도 없으면 structure · 운영 가입금액이 없으면 notEntered(담보 가입금액) — 표는 없다", () => {
    const 일반: DynBenefit = { subCoverageKey: "02", subCoverageName: "일반", key: "1", name: "일반급부" };
    const none = expandFixedDynTable(F, { benefits: [일반], insuredAmounts: [30_000_000] }, 비갱신, deps);
    expect(none.blocks).toEqual([]);
    expect(none.issues).toEqual([expect.objectContaining({ kind: "structure" })]);
    const noAmount = expandFixedDynTable(F, { benefits: [상해], insuredAmounts: [] }, 비갱신, deps);
    expect(noAmount.blocks).toEqual([]);
    expect(noAmount.issues).toEqual([expect.objectContaining({ kind: "notEntered" })]);
    expect(noAmount.issues[0].message).toContain("가입금액");
  });

  it("인자 연결이 없으면 argUnbound — 구조는 그대로 낸다", () => {
    const t = expandFixedDynTable(F, { benefits: [상해이외], insuredAmounts: [30_000_000] }, undefined, deps);
    expect(t.issues).toEqual([expect.objectContaining({ kind: "argUnbound" })]);
    expect(t.blocks.length).toBeGreaterThan(0);
  });

  it("노드 id — 참조 id / 템플릿 노드 id @ 블록 · 행 · 열, 표 슬롯은 같은 id 의 글 노드", () => {
    const t = expandFixedDynTable(F, { benefits: [상해], insuredAmounts: [30_000_000] }, 비갱신, deps);
    const caption = t.blocks[0];
    if (caption.kind !== "caption") throw new Error();
    expect(caption.inlines.map((n) => n.id)).toEqual(["ref1/caption-t1@k0", "ref1/caption-amount@k0", "ref1/caption-t2@k0"]);
    const table = t.blocks[1];
    if (table.kind !== "table") throw new Error();
    expect(table.rows[0].cells[3][0]).toEqual({ id: "ref1/cell-amount@k1r1c4", kind: "text", text: "5만원" });
    const slots = t.blocks.flatMap((b) => (b.kind === "table" ? [...b.header, ...b.rows.flatMap((r) => r.cells)] : [b.inlines])).flat().filter((n) => n.kind === "slot");
    expect(slots).toEqual([]);
  });
});
