import { describe, expect, it } from "vitest";

import type { DocumentNode } from "../../src/domain/document/nodes";

import { applyPaymentTables, PAYMENT_TABLE, readReductionTable, REDUCTION_PRESENT, RENEWAL_PAYMENT_TABLE, RENEWABLE_COVERAGE } from "./payment";

/**
 * 담보약관의 손으로 쓴 지급금액 표 → 「감액 있음」 조건 + 표 구분자 (ADR-0099 결정 4 · 기능/구분자 §3.7).
 * 변환기가 원문 표에서 감액 구간 · 지급률 · 단서문구를 읽어 담보 시드 값으로 돌려주고, 표 자리는 표 구분자로 바꾼다 —
 * 생성되는 표가 원문 표와 같은 값을 내야 한다(모양은 허용 차이 — 행 = 급부명 · 머리글 한 줄).
 */

type Json = Record<string, unknown> & { id?: string; kind?: string; children?: Json[]; branches?: Json[] };

const cell = (id: string, text: string) => [{ id, kind: "text", text }];
const row = (id: string, texts: string[], header = false) => ({ ...(header ? { header: true } : {}), cells: texts.map((t, i) => cell(`${id}c${i}`, t)) });
const table = (id: string, rows: string[][], headerRows = 1) => ({ id, kind: "table", columns: rows[0].map(() => ({})), rows: rows.map((r, i) => row(`${id}-r${i}`, r, i < headerRows)) });
const para = (id: string, text: string) => ({ id, kind: "paragraph", children: [{ id: `${id}-x1`, kind: "text", text }] });

/** 메리츠 질병사망 — 감액 90일 10% · 갱신 표. */
const DEATH = [
  ["구분", "지급금액", "지급금액"],
  ["구분", "최초계약일부터 90일경과시점 전일 이전", "최초계약일부터 90일경과시점 이후"],
  ["질병으로 사망시", "보험가입금액의 10%", "보험가입금액의 100%"],
];
const DEATH_RENEWAL = [
  ["구분", "지급금액"],
  ["질병으로 사망시", "보험가입금액의 100%"],
];

function doc(children: Json[]): DocumentNode {
  return { id: "d", kind: "document", title: "질병사망 특별약관", children: [{ id: "a1", kind: "article", title: [{ id: "a1.t", kind: "text", text: "보험금의 지급사유" }], children }] } as unknown as DocumentNode;
}

const kinds = (tree: DocumentNode) => ((tree.children[0] as unknown as Json).children ?? []).map((c) => c.kind);
const cond = (tree: DocumentNode, i: number) => ((tree.children[0] as unknown as Json).children ?? [])[i];

describe("readReductionTable — 원문 감액 지급금액 표 읽기", () => {
  it("감액 구간 하나 — 열 머리글의 경계(90일 → 「감액기간」 V01) · 셀 비율(10% / 100%) · 지급률 100", () => {
    expect(readReductionTable(table("t", DEATH, 2) as never)).toEqual({ rows: 1, trait: { periods: [{ end: "V01", rate: 10 }], afterRate: 100, payRate: 100 } });
  });

  it("감액 구간 둘 — 첫 · 가운데 · 마지막 열(90일 10% · 1년 50%), 행 여럿은 비율이 모두 같아야 한다", () => {
    const rows = [
      ["구분", "지급금액", "지급금액", "지급금액"],
      ["구분", "최초계약일부터 90일경과시점 전일 이전", "최초계약일부터 90일경과시점 이후 최초계약일부터 1년경과시점 전일 이전", "최초계약일부터 1년경과시점 이후"],
      ["1종수술", "질병1종 수술비보장 보험가입금액의 10%", "질병1종 수술비보장 보험가입금액의 50%", "질병1종 수술비보장 보험가입금액의 100%"],
      ["2종수술", "질병2종 수술비보장 보험가입금액의 10%", "질병2종 수술비보장 보험가입금액의 50%", "질병2종 수술비보장 보험가입금액의 100%"],
    ];
    expect(readReductionTable(table("t", rows, 2) as never)).toEqual({ rows: 2, trait: { periods: [{ end: "V01", rate: 10 }, { end: "V03", rate: 50 }], afterRate: 100, payRate: 100 } });
  });

  it("머리글 꼬리는 단서문구 · 셀 꼬리 「(보험금 지급기간 동안 적용)」도 단서문구에 함께 (기능/동적표 §3.3 — 열 머리글 꼬리로 찍는 허용 차이)", () => {
    const rows = [
      ["구분", "지급금액", ""],
      ["", "계약일부터 1년경과시점 전일 이전「2대질환」으로 진단확정 시", "계약일부터 1년경과시점 이후「2대질환」으로 진단확정 시"],
      ["보험금 지급기간 동안「2대질환 주요치료」를 받은 경우(연간1회한, 10년간)", "보험가입금액의 50%(보험금 지급기간 동안 적용)", "보험가입금액의 100%(보험금 지급기간 동안 적용)"],
    ];
    expect(readReductionTable(table("t", rows) as never)?.trait).toEqual({ periods: [{ end: "V03", rate: 50 }], afterRate: 100, payRate: 100, proviso: "「2대질환」으로 진단확정 시(보험금 지급기간 동안 적용)" });
  });

  it("띄어쓰기는 보지 않는다 — 「1년 경과시점」 · 「경과시점이후」", () => {
    const rows = [
      ["구 분", "지급금액", ""],
      ["", "계약일부터 1년 경과시점 전일 이전", "계약일부터 1년 경과시점이후"],
      ["항암중입자방사선치료시(단, 최초 1회에 한하여 지급)", "보험가입금액의 50%", "보험가입금액의 100%"],
    ];
    expect(readReductionTable(table("t", rows) as never)?.trait.periods).toEqual([{ end: "V03", rate: 50 }]);
  });

  it.each([
    ["「감액기간」에 없는 경계(5년)", [["구분", "지급금액", ""], ["", "계약일부터5년경과시점 전일 이전", "계약일부터5년경과시점 이후"], ["간병", "보험가입금액의 50%", "보험가입금액의 100%"]]],
    ["지급금액 표가 아니다(연간 총 지급액 한도)", [["구 분", "연간 총 지급액 한도", ""], ["", "계약일부터 1년 경과시점 전일 이전", "계약일부터 1년 경과시점 이후"], ["통합치료", "보험가입금액의 50%", "보험가입금액의 100%"]]],
    ["행마다 비율이 다르다(체증 연차 행)", [["구분", "지급금액", ""], ["", "계약일부터1년경과시점 전일 이전", "계약일부터1년경과시점 이후"], ["1차 연도", "보험가입금액의 50%", "보험가입금액의 100%"], ["2차 연도", "보험가입금액의 60%", "보험가입금액의 120%"]]],
    ["감액 열이 없다", DEATH_RENEWAL],
  ])("읽지 않는다 — %s", (_why, rows) => {
    expect(readReductionTable(table("t", rows) as never)).toBeUndefined();
  });
});

describe("applyPaymentTables — 표 자리를 「감액 있음」 조건 + 표 구분자로", () => {
  it("감액 표 → 「감액 있음」 조건 블록 안 보험금 지급금액표, 자동갱신 항 뒤 표 → 「감액 있음 그리고 갱신형」 안 갱신 보험금 지급금액표 · 항은 그대로", () => {
    const tree = doc([para("a1-p1", "회사는 … 지급합니다."), table("a1-t1", DEATH, 2), para("a1-p2", "제1항에도 불구하고 보통약관 제25조(계약의 자동갱신)에 따라 보장이 자동갱신되는 경우 … 지급합니다."), table("a1-t3", DEATH_RENEWAL)] as Json[]);
    expect(applyPaymentTables(tree, 1)).toEqual({ periods: [{ end: "V01", rate: 10 }], afterRate: 100, payRate: 100 });
    expect(kinds(tree)).toEqual(["paragraph", "condBlock", "paragraph", "condBlock"]);
    expect(cond(tree, 1)).toEqual({ id: "a1-t1-c", kind: "condBlock", branches: [{ id: "a1-t1-c-b", when: `${REDUCTION_PRESENT} = true`, children: [{ id: "a1-t1", kind: "tableRef", code: PAYMENT_TABLE }] }] });
    expect(cond(tree, 3)).toEqual({ id: "a1-t3-c", kind: "condBlock", branches: [{ id: "a1-t3-c-b", when: `${REDUCTION_PRESENT} = true and ${RENEWABLE_COVERAGE} = true`, children: [{ id: "a1-t3", kind: "tableRef", code: RENEWAL_PAYMENT_TABLE }] }] });
  });

  it("갱신형 짝 가지(조건 블록 안 조) — 두 가지의 표가 같은 값이면 둘 다 바꾼다(기준일 낱말만 다르다)", () => {
    const general = [["구분", "지급금액", ""], ["", "계약일부터1년경과시점 전일 이전", "계약일부터1년경과시점 이후"], ["뇌출혈 진단시", "보험가입금액의 50%", "보험가입금액의 100%"]];
    const renewal = general.map((r) => r.map((c) => c.replace(/계약일/g, "최초계약일")));
    const tree = {
      id: "d",
      kind: "document",
      title: "뇌출혈진단비보장 특별약관",
      children: [
        { id: "m1", kind: "condBlock", branches: [{ id: "m1-b", when: "갱신형", children: [{ id: "r-a1", kind: "article", title: [], children: [table("r-a1-t1", renewal), para("r-a1-p2", "「자동갱신 특별약관」에 따라 보장이 자동갱신되는 경우 …"), table("r-a1-t2", [["구분", "지급금액"], ["뇌출혈 진단시", "보험가입금액의 100%"]])] }] }] },
        { id: "m1n", kind: "condBlock", branches: [{ id: "m1n-b", when: "비갱신형", children: [{ id: "a1", kind: "article", title: [], children: [table("a1-t1", general)] }] }] },
      ],
    } as unknown as DocumentNode;
    expect(applyPaymentTables(tree, 1)?.periods).toEqual([{ end: "V03", rate: 50 }]);
    const refs = JSON.stringify(tree).match(/"kind":"tableRef","code":"DT00000\d"/g);
    expect(refs).toEqual([`"kind":"tableRef","code":"${PAYMENT_TABLE}"`, `"kind":"tableRef","code":"${RENEWAL_PAYMENT_TABLE}"`, `"kind":"tableRef","code":"${PAYMENT_TABLE}"`]);
  });

  it("행 수가 세부보장 수와 다르면 두지 않는다 — 표 하나에 급부 여럿을 세울 세부보장이 없다", () => {
    const rows = [["구분", "지급금액", ""], ["", "계약일부터1년경과시점 전일 이전", "계약일부터1년경과시점 이후"], ["관혈수술시", "보험가입금액의 50%", "보험가입금액의 100%"], ["비관혈수술시", "보험가입금액의 50%", "보험가입금액의 100%"]];
    const tree = doc([table("a1-t1", rows)] as Json[]);
    expect(applyPaymentTables(tree, 1)).toBeUndefined();
    expect(kinds(tree)).toEqual(["table"]);
    expect(applyPaymentTables(tree, 2)?.periods).toEqual([{ end: "V03", rate: 50 }]);
  });

  it("한 문서에 감액 표가 여럿(조가 다르거나 한 조에 둘)이면 두지 않는다 — 표마다 다른 급부를 가리킨다", () => {
    const one = [["구분", "지급금액", ""], ["", "계약일부터1년경과시점 전일 이전", "계약일부터1년경과시점 이후"], ["혈전용해치료(뇌졸중)시", "해당보장 보험가입금액의 50%", "해당보장 보험가입금액의 100%"]];
    const tree = doc([table("a1-t1", one), para("a1-p2", "그 밖의 항"), table("a1-t2", one)] as Json[]);
    expect(applyPaymentTables(tree, 1)).toBeUndefined();
    expect(kinds(tree)).toEqual(["table", "paragraph", "table"]);
  });

  it("조 제목이 같아도 조건 가지 밖에 나란히 선 조(제1조의1 · 제1조의2 — 뇌졸중 · 특정심장질환)는 다른 급부다 — 두지 않는다", () => {
    const one = [["구분", "지급금액", ""], ["", "계약일부터1년경과시점 전일 이전", "계약일부터1년경과시점 이후"], ["혈전용해치료시", "해당보장 보험가입금액의 50%", "해당보장 보험가입금액의 100%"]];
    const art = (id: string) => ({ id, kind: "article", title: [{ id: `${id}.t`, kind: "text", text: "보험금의 지급사유" }], children: [table(`${id}-t1`, one)] });
    const tree = { id: "d", kind: "document", title: "혈전용해치료비보장 특별약관", children: [art("a1_1"), art("a1_2")] } as unknown as DocumentNode;
    expect(applyPaymentTables(tree, 1)).toBeUndefined();
    expect(JSON.stringify(tree)).not.toContain("tableRef");
  });

  it("감액 표가 없으면 트리 그대로 · undefined", () => {
    const tree = doc([para("a1-p1", "회사는 …"), table("a1-t1", DEATH_RENEWAL)] as Json[]);
    expect(applyPaymentTables(tree, 1)).toBeUndefined();
    expect(kinds(tree)).toEqual(["paragraph", "table"]);
  });
});
