import { describe, expect, it } from "vitest";

import type { DocumentNode } from "../document/nodes";
import { nodeBuilders, sequentialIds } from "../document/builders";
import { titleNodes } from "../document/title";
import { reductionPeriodEnumSeed } from "../coverage/traits";
import { findForm } from "../master";
import type { Id } from "../types";
import { assembleSpecial } from "./booklet";
import { buildContexts } from "./context";
import { alphaMaster, alphaPlusFixture, coverageEntry, type CoverageSpec } from "./fixture";
import { explainArticle } from "./explain";
import { resolveDocument } from "./resolve";
import type { AssemblyInput, DynTableDecision, RenderedArticle, RenderedStatic } from "./types";

/*
 * 표 구분자 조립 — 기능/구분자 §3.7 (ADR-0099), QA/인수기준 「동적표(감액 지급금액 표) 인수 케이스」.
 * 문면의 표 구분자 자리(`tableRef`)가 그 상품담보의 폼 값(감액 · 지급률 · 체증 · 단서문구 · 정액표 · 가입금액)으로 표를 낸다.
 * 마스터 = 알파 픽스처 + 실제 정본의 특성 폼(`reduction` · `insured_amount` · `fixed_table` · `escalation` · `proviso`).
 */

const TABLE_CODE = "DT000001";
const RENEWAL_CODE = "DT000002";

const master = [...alphaMaster, findForm("reduction")!, findForm("insured_amount")!, findForm("fixed_table")!, findForm("escalation")!, findForm("proviso")!];
const FIXED_CODE = "DT000003";

/** 감액 구간의 `end` 는 「감액기간」 값 코드 (V03 = 1년). `fixedGrid` 는 급부 정액표(마스터 소유 — 조립 입력엔 이미 섞여 온다). */
type Benefit = { id: Id; name: string; payRate?: number; escalation?: { label: string; ratio: number }[]; reduction?: { periods: { end: string; rate: number }[]; afterRate?: number }; fixedGrid?: { columns: string[]; rows: { cells: string[]; amounts: Record<string, number> }[] } };
type Sub = { id: Id; name: string; benefits: Benefit[] };

function spec(subs: Sub[], renewal = false, insuredAmounts?: number[], proviso?: string): CoverageSpec {
  const values: CoverageSpec["values"] = {
    "pc-dyn": { ...(insuredAmounts ? { "insured_amount.amounts": insuredAmounts.map((amount) => ({ amount })) } : {}), ...(proviso ? { "proviso.text": proviso } : {}) } as CoverageSpec["values"][string],
  };
  for (const s of subs) {
    for (const b of s.benefits) {
      const v: Record<string, unknown> = {};
      if (b.payRate !== undefined) v["pay.rate"] = b.payRate;
      if (b.reduction) {
        v["reduction.periods"] = b.reduction.periods;
        if (b.reduction.afterRate !== undefined) v["reduction.after_rate"] = b.reduction.afterRate;
      }
      if (b.fixedGrid) v["fixed_table.grid"] = b.fixedGrid;
      if (b.escalation) v["escalation.steps"] = b.escalation;
      values[b.id] = v as CoverageSpec["values"][string];
    }
  }
  return {
    id: "pc-dyn",
    name: "감액테스트",
    coverageId: "cov-dyn",
    coverageName: "감액테스트",
    // 갱신형 = 담보속성 갱신유형(A0001) 갱신형('2') — 표 구분자의 기준일 낱말이 읽는다 (dyntable/system.ts RENEWABLE_CONDITION)
    attributes: renewal ? [{ kindCode: "A0001", valueCode: "2" }] : [],
    subCoverages: subs.map((s, i) => ({ id: s.id, key: String(i + 1).padStart(2, "0"), masterNodeId: `m-${s.id}`, name: s.name, benefits: s.benefits.map((b, j) => ({ id: b.id, key: String(j + 1), masterNodeId: `m-${b.id}`, name: b.name })) })),
    values,
  };
}

function document(tableCode = TABLE_CODE): DocumentNode {
  const b = nodeBuilders(sequentialIds("n"));
  return {
    id: "dyn-doc",
    kind: "document",
    title: "감액테스트 특별약관",
    children: [{ id: "dyn-art", kind: "article", title: titleNodes("보험금의 지급", "dyn-art"), children: [{ ...b.tableRef(tableCode), id: "dyn-ref" }] }],
  };
}

function input(subs: Sub[], opts: { renewal?: boolean; doc?: DocumentNode; insuredAmounts?: number[]; proviso?: string } = {}): AssemblyInput {
  const base = alphaPlusFixture();
  return {
    ...base,
    master,
    coverages: [...base.coverages, coverageEntry(spec(subs, opts.renewal, opts.insuredAmounts, opts.proviso))],
    specialDocuments: new Map([...base.specialDocuments, ["cov-dyn", opts.doc ?? document()]]),
    enums: [...base.enums, reductionPeriodEnumSeed()],
  };
}

function tablesOf(doc: { children: unknown[] }): RenderedStatic[] {
  const art = doc.children.find((c) => (c as RenderedArticle).kind === "article" && (c as RenderedArticle).id === "dyn-art") as RenderedArticle | undefined;
  return (art?.children.filter((c) => c.kind === "table") ?? []) as RenderedStatic[];
}

function tableOf(doc: { children: unknown[] }): RenderedStatic | undefined {
  const art = doc.children.find((c) => (c as RenderedArticle).kind === "article" && (c as RenderedArticle).id === "dyn-art") as RenderedArticle | undefined;
  return art?.children.find((c) => c.kind === "table") as RenderedStatic | undefined;
}

const cellText = (cell: { kind: string; text?: string }[]) => cell.map((n) => (n.kind === "text" ? n.text : `<${n.kind}>`)).join("");

function rowsOf(inp: AssemblyInput): { rows: string[][]; issues: { kind: string; message: string }[]; complete: boolean } {
  const r = assembleSpecial(inp, inp, "pc-dyn");
  if (!r.ok) throw new Error(JSON.stringify(r.rejection));
  const t = tableOf(r.value.doc);
  if (t?.kind !== "table") throw new Error(`표 없음: ${JSON.stringify(r.value.issues)}`);
  return { rows: t.rows.map((row) => row.cells.map(cellText)), issues: r.value.issues, complete: r.value.complete };
}

const 후유장해 = (id: Id, reduction = true): Sub => ({ id, name: "질병후유장해", benefits: [{ id: `${id}-b`, name: "질병80%이상후유장해", payRate: 100, ...(reduction ? { reduction: { periods: [{ end: "V03", rate: 50 }] } } : {}) }] });

describe("조립 — 표 구분자 (기능/구분자 §3.7)", () => {
  it("(a) 인수 케이스 1 — 세부보장 1 · 급부 1 · 감액 1년(V03) 50% → 열 둘 · 셀 50% / 100%", () => {
    const r = rowsOf(input([후유장해("s1")]));
    expect(r.rows).toEqual([
      ["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후"],
      ["질병80%이상후유장해", "보험가입금액의 50%", "보험가입금액의 100%"],
    ]);
    expect(r.issues.filter((i) => i.message.includes("지급금액표"))).toEqual([]);
    expect(r.complete).toBe(true);
  });

  it("(b) 인수 케이스 4 — 세부보장 넷(급부 하나씩) → 셀에 「해당보장의 」, 머리글은 그대로", () => {
    const subs: Sub[] = ["s1", "s2", "s3", "s4"].map((id, i) => ({ id, name: `세부${i + 1}`, benefits: [{ id: `${id}-b`, name: `급부${i + 1}`, payRate: 100, reduction: { periods: [{ end: "V03", rate: 50 }] } }] }));
    const r = rowsOf(input(subs));
    expect(r.rows[0]).toEqual(["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후"]);
    expect(r.rows.slice(1)).toEqual([1, 2, 3, 4].map((i) => [`급부${i}`, "해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 100%"]));
  });

  it("(c) 기준일 낱말은 시스템 문구가 그 상품담보의 갱신형(담보속성 갱신유형 = 갱신형)을 읽어 고른다 → 「최초계약일부터…」", () => {
    const r = rowsOf(input([후유장해("s1")], { renewal: true }));
    expect(r.rows[0]).toEqual(["구 분", "최초계약일부터 1년경과시점 전일 이전", "최초계약일부터 1년경과시점 이후"]);
  });

  it("(c2) 단서문구(담보 특성 — 마스터 소유)가 있으면 감액 열 머리글 끝에 꼬리 · 갱신표는 열 하나라 꼬리가 없다", () => {
    const r = rowsOf(input([후유장해("s1")], { proviso: "「2대질환」으로 진단확정시" }));
    expect(r.rows[0]).toEqual(["구 분", "계약일부터 1년경과시점 전일 이전 「2대질환」으로 진단확정시", "계약일부터 1년경과시점 이후 「2대질환」으로 진단확정시"]);
    expect(rowsOf(input([후유장해("s1")], { proviso: "꼬리", doc: document(RENEWAL_CODE) })).rows).toEqual([
      ["구 분", "지급금액"],
      ["질병80%이상후유장해", "보험가입금액의 100%"],
    ]);
  });

  it("(c3) 체증 급부 — 구분마다 행 「급부명(구분)」 · 칩 (최초)계약일은 갱신형이면 최초계약일 · 셀 = 지급률 × 체증 비율 × 감액비율", () => {
    const subs: Sub[] = [
      {
        id: "s1",
        name: "주요치료비",
        benefits: [
          { id: "s1-a", name: "주요치료비", payRate: 100, reduction: { periods: [{ end: "V03", rate: 50 }] }, escalation: [{ label: "〔(최초)계약일〕부터 5년 이전", ratio: 1 }, { label: "이후", ratio: 1.2 }] },
          { id: "s1-b", name: "일반치료비", payRate: 100 },
        ],
      },
    ];
    const r = rowsOf(input(subs, { renewal: true }));
    expect(r.rows.slice(1)).toEqual([
      ["주요치료비(최초계약일부터 5년 이전)", "보험가입금액의 50%", "보험가입금액의 100%"],
      ["주요치료비(이후)", "보험가입금액의 60%", "보험가입금액의 120%"],
      ["일반치료비", "보험가입금액의 100%", "보험가입금액의 100%"],
    ]);
  });

  it("(d) 같은 급부명 · 비율 다름 → 따로 찍고 경고 dynTableMergeConflict, 완성본은 깨지지 않는다", () => {
    const subs: Sub[] = [
      { id: "s1", name: "1종수술", benefits: [{ id: "s1-b", name: "수술보험금", payRate: 100, reduction: { periods: [{ end: "V03", rate: 50 }] } }] },
      { id: "s2", name: "2종수술", benefits: [{ id: "s2-b", name: "수술보험금", payRate: 50, reduction: { periods: [{ end: "V03", rate: 50 }] } }] },
    ];
    const r = rowsOf(input(subs));
    expect(r.rows).toHaveLength(3);
    expect(r.rows.slice(1).map((row) => row[0])).toEqual(["수술보험금", "수술보험금"]);
    // 지급률 100 · 50 × 감액 50% → 50 · 25 — 열이 달라 묶지 않는다
    expect(r.rows[1].slice(1)).toEqual(["해당보장의 보험가입금액의 50%", "해당보장의 보험가입금액의 100%"]);
    expect(r.rows[2].slice(1)).toEqual(["해당보장의 보험가입금액의 25%", "해당보장의 보험가입금액의 50%"]);
    const warn = r.issues.find((i) => i.kind === "dynTableMergeConflict");
    expect(warn).toBeDefined();
    expect(r.complete).toBe(true);
  });

  it("(e) 보통약관(행 원천 없는 문맥)의 표 구분자는 구조 오류 마커", () => {
    const inp = input([후유장해("s1")]);
    const ctx = buildContexts(inp).general;
    const out = resolveDocument(document(), ctx, { clauses: new Map(), overrides: new Map(), coordinate: { document: "general" } });
    expect(out.issues.map((i) => [i.kind, i.message])).toEqual([["structure", "표 구분자는 담보약관(상품담보) 문맥에서만 쓸 수 있습니다"]]);
  });

  it("(f) 없는 표 구분자 코드 → brokenRef 마커", () => {
    const inp = input([후유장해("s1")], { doc: document("DT999999") });
    const r = assembleSpecial(inp, inp, "pc-dyn");
    if (!r.ok) throw new Error(JSON.stringify(r.rejection));
    expect(tableOf(r.value.doc)).toBeUndefined();
    const issue = r.value.issues.find((i) => i.kind === "brokenRef");
    expect(issue?.message).toBe("표 구분자 DT999999 이(가) 없습니다");
    expect(issue?.at.nodePath).toContain("dyn-ref");
    expect(r.value.complete).toBe(false);
  });

  it("(h) 급부명이 비면 행 머리는 세부보장명 — 식의 builtin.benefit.name 도 같다 (기능/담보 §3.1 · 기능/동적표 §3.2, 2026-10-31)", () => {
    const subs: Sub[] = [{ id: "s1", name: "질병후유장해", benefits: [{ id: "s1-b", name: "", payRate: 100, reduction: { periods: [{ end: "V03", rate: 50 }] } }] }];
    const r = rowsOf(input(subs));
    expect(r.rows[1]).toEqual(["질병후유장해", "보험가입금액의 50%", "보험가입금액의 100%"]);
    expect(r.complete).toBe(true);
  });

  it("(i) 정액형 표 — 급부 정액표(마스터 소유) · 상품담보 운영 가입금액으로 급부 머리글 · 캡션 · 표 블록 여럿을 낸다 (기능/동적표 §3.7)", () => {
    const subs: Sub[] = [
      {
        id: "s1",
        name: "통합치료비",
        benefits: [
          { id: "s1-a", name: "상해로 인한 경우", payRate: 100, fixedGrid: { columns: ["분류", "치료항목"], rows: [{ cells: ["상해", "입원"], amounts: { "30000000": 50_000, "50000000": 80_000 } }] } },
          { id: "s1-b", name: "상해 이외의 사유로 인한 경우", payRate: 100, reduction: { periods: [{ end: "V03", rate: 50 }] }, fixedGrid: { columns: ["분류", "치료항목"], rows: [{ cells: ["질병", "입원"], amounts: { "30000000": 50_000, "50000000": 80_000 } }, { cells: ["질병", "통원"], amounts: { "30000000": 25_000, "50000000": 40_000 } }] } },
        ],
      },
    ];
    const inp = input(subs, { doc: document(FIXED_CODE), insuredAmounts: [50_000_000, 30_000_000] });
    const r = assembleSpecial(inp, inp, "pc-dyn");
    if (!r.ok) throw new Error(JSON.stringify(r.rejection));
    const tables = tablesOf(r.value.doc).filter((t): t is Extract<RenderedStatic, { kind: "table" }> => t.kind === "table");
    expect(r.value.issues.filter((i) => i.message.includes("지급금액표"))).toEqual([]);
    expect(r.value.complete).toBe(true);
    expect(tables).toHaveLength(4);
    const text = (cell: { kind: string; text?: string }[] | undefined) => (cell ?? []).map((n) => (n.kind === "text" ? n.text : `<${n.kind}>`)).join("");
    expect(tables.map((t) => [text(t.heading), text(t.caption)])).toEqual([
      ["1. 상해로 인한 경우", "<보험가입금액 3,000만원>"],
      ["", "<보험가입금액 5,000만원>"],
      ["2. 상해 이외의 사유로 인한 경우", "<보험가입금액 3,000만원>"],
      ["", "<보험가입금액 5,000만원>"],
    ]);
    expect(tables[0].rows.map((row) => row.cells.map(cellText))).toEqual([
      ["분류", "치료항목", "지급금액"],
      ["상해", "입원", "5만원"],
    ]);
    expect(tables[2].rows.map((row) => row.cells.map(cellText))).toEqual([
      ["분류", "치료항목", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후"],
      ["질병", "입원", "2만 5천원", "5만원"],
      ["질병", "통원", "12,500원", "2만 5천원"],
    ]);
    expect(tables[2].rows[1].spans).toEqual([2, 1, 1, 1]);
    expect(tables[2].rows[0].header).toBe(true);
  });

  it("(k) 정액형 표의 결정 노드 기록 — 표 블록(급부 × 가입금액)마다 한 줄 · 그 블록 번호 · 금액 (출처 패널, 기능/동적표 §5)", () => {
    const subs: Sub[] = [
      {
        id: "s1",
        name: "통합치료비",
        benefits: [
          { id: "s1-a", name: "상해로 인한 경우", payRate: 100, fixedGrid: { columns: ["분류"], rows: [{ cells: ["상해"], amounts: { "30000000": 50_000, "50000000": 80_000 } }] } },
          { id: "s1-b", name: "상해 이외의 사유로 인한 경우", payRate: 100, fixedGrid: { columns: ["분류"], rows: [{ cells: ["질병"], amounts: { "30000000": 50_000, "50000000": 80_000 } }] } },
        ],
      },
    ];
    const inp = input(subs, { doc: document(FIXED_CODE), insuredAmounts: [50_000_000, 30_000_000] });
    const rec = explainArticle(inp, inp, { document: "special", productCoverageId: "pc-dyn", articleId: "dyn-art" }).sources[0].decisions[0] as DynTableDecision;
    expect(rec).toMatchObject({ kind: "dynTable", nodeId: "dyn-ref", tableCode: FIXED_CODE, fixed: true });
    expect(rec.issue).toBeUndefined();
    expect(rec.rows.map((r) => [r.name, r.amount, r.blocks, r.benefitKeys])).toEqual([
      ["상해로 인한 경우 · 3,000만원", 30_000_000, [0, 1, 2], ["1"]],
      ["상해로 인한 경우 · 5,000만원", 50_000_000, [3, 4], ["1"]],
      ["상해 이외의 사유로 인한 경우 · 3,000만원", 30_000_000, [5, 6, 7], ["2"]],
      ["상해 이외의 사유로 인한 경우 · 5,000만원", 50_000_000, [8, 9], ["2"]],
    ]);
  });

  it("(l) 정액형 표가 펼쳐지지 못하면 기록에 그 오류 · 표 0개", () => {
    const subs: Sub[] = [{ id: "s1", name: "통합치료비", benefits: [{ id: "s1-a", name: "상해", payRate: 100, fixedGrid: { columns: ["분류"], rows: [{ cells: ["상해"], amounts: { "30000000": 50_000 } }] } }] }];
    const inp = input(subs, { doc: document(FIXED_CODE) });
    const rec = explainArticle(inp, inp, { document: "special", productCoverageId: "pc-dyn", articleId: "dyn-art" }).sources[0].decisions[0] as DynTableDecision;
    expect(rec).toMatchObject({ fixed: true, rows: [], issue: { kind: "notEntered" } });
  });

  it("(j) 정액형 표 — 운영 가입금액이 없으면 표 대신 오류 마커(notEntered)", () => {
    const subs: Sub[] = [{ id: "s1", name: "통합치료비", benefits: [{ id: "s1-a", name: "상해", payRate: 100, fixedGrid: { columns: ["분류"], rows: [{ cells: ["상해"], amounts: { "30000000": 50_000 } }] } }] }];
    const inp = input(subs, { doc: document(FIXED_CODE) });
    const r = assembleSpecial(inp, inp, "pc-dyn");
    if (!r.ok) throw new Error(JSON.stringify(r.rejection));
    expect(tablesOf(r.value.doc)).toHaveLength(0);
    expect(r.value.issues.find((i) => i.kind === "notEntered")?.message).toContain("가입금액");
    expect(r.value.complete).toBe(false);
  });

  it("(g) 어느 급부도 감액 폼을 열지 않음 → 열 하나 「지급금액」 · 비율 = 지급률", () => {
    const r = rowsOf(input([후유장해("s1", false)]));
    expect(r.rows).toEqual([
      ["구 분", "지급금액"],
      ["질병80%이상후유장해", "보험가입금액의 100%"],
    ]);
  });
});
