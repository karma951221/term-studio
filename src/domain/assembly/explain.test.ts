/**
 * 설명 모드 — 조 하나의 결정 노드 기록 · 원본 · 판정 기록 잇기 (ADR-0092 결정 2 · 3 · 4 · 기능/조립산출 §3.7).
 *
 * 표본은 축약 픽스처(알파Plus)에 조를 덧붙여 만든다:
 *   특약(일반상해사망 담보약관)의 「설명 표본」 조 — IF(갱신여부) / ELIF(감액기간 = 24) / ELSE + 탄 가지 안 인라인 조건(부가유형)
 *   함수조항 — 인자(구분자 · 상수) · 옵션 오버라이드 · 값별 분기 · 중첩 호출
 *   반복 — 납입면제종마다(종마다 다른 가지) · 원소 0개(비었을 때 칸)
 *   대치 형태 기본계약 조 · 특약 생략 조 · 조건으로 사라진 조 · 절 형태 위임 · 공통
 */
import { describe, expect, it } from "vitest";

import type { Clause } from "../clause/types";
import type { ArticleNode, BlockNode, DocumentNode, InlineNode } from "../document/nodes";
import { titleNodes } from "../document/title";
import { entered, type Id } from "../types";
import { assemble } from "./booklet";
import { explainArticle, type ArticleExplanation } from "./explain";
import { findForm } from "../master";
import { alphaPlusFixture, deathCoverage, nodeQualFixture } from "./fixture";
import type { AssemblyInput, ClauseDecision, ConditionDecision, DecisionRecord, DynTableDecision, RepeatDecision, SwitchDecision } from "./types";

const text = (id: string, value: string): InlineNode => ({ id, kind: "text", text: value });
const para = (id: string, children: InlineNode[]): BlockNode => ({ id, kind: "paragraph", children }) as BlockNode;
const article = (id: string, title: string, children: BlockNode[], extra: Partial<ArticleNode> = {}): ArticleNode => ({ id, kind: "article", title: titleNodes(title, id), children, ...extra });

/** 특약 담보약관(cov-death)에 조를 덧붙인 입력. */
function withSpecial(extra: DocumentNode["children"], patch: (input: AssemblyInput) => AssemblyInput = (x) => x): AssemblyInput {
  const input = alphaPlusFixture();
  const doc = input.specialDocuments.get("cov-death")!;
  const specialDocuments = new Map(input.specialDocuments);
  specialDocuments.set("cov-death", { ...doc, children: [...doc.children, ...extra] });
  return patch({ ...input, specialDocuments });
}

const explain = (input: AssemblyInput, target: Parameters<typeof explainArticle>[2]): ArticleExplanation => explainArticle(input, input, target);
const outcomes = (d: DecisionRecord | undefined) => (d as ConditionDecision).branches.map((b) => b.outcome);

/** IF / ELIF / ELSE — 탄 가지 안에 인라인 조건. */
const ifElifElse = article("s-art-x", "설명 표본", [
  {
    id: "x-cond",
    kind: "condBlock",
    branches: [
      { id: "x-if", when: "D0001 = true", children: [para("x-p1", [text("x-t1", "갱신")])] },
      {
        id: "x-elif",
        when: "D0006 = 24",
        children: [
          para("x-p2", [
            text("x-t2", "감액 24개월 "),
            { id: "x-inl", kind: "inlineCond", branches: [{ id: "x-inl-if", when: "attr.A0002 = '2'", children: [text("x-t3", "추가")] }, { id: "x-inl-else", children: [text("x-t4", "기본")] }] },
          ]),
        ],
      },
      { id: "x-else", children: [para("x-p3", [text("x-t5", "그 밖")])] },
    ],
  } as BlockNode,
]);

describe("조건 분기 — 가지별 결과 · 조건 근거", () => {
  const input = withSpecial([ifElifElse]);
  const e = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-x" });
  const cond = e.sources[0].decisions[0] as ConditionDecision;

  it("결과에 찍힌 조 — 원본은 담보약관 조", () => {
    expect(e.status).toBe("shown");
    expect(e.sources).toEqual([expect.objectContaining({ kind: "coverage", productCoverageId: "pc-basic", coverageId: "cov-death", documentId: "s-doc-death", articleId: "s-art-x" })]);
  });

  it("IF 거짓 · ELIF 탐 · ELSE 평가 안 함", () => {
    expect(cond).toMatchObject({ kind: "condition", nodeId: "x-cond", inline: false });
    expect(outcomes(cond)).toEqual(["false", "taken", "skipped"]);
    expect(cond.branches[2].condition).toBeUndefined();
  });

  it("평가한 조건식마다 읽은 구분자 · 유효값 · 그 평가 중 필드 읽기", () => {
    expect(cond.branches[0].condition).toMatchObject({ expression: "D0001 = true", value: false, discriminators: [{ code: "D0001", slot: entered(false) }] });
    expect(cond.branches[0].condition!.reads).toEqual([expect.objectContaining({ owner: { kind: "productCoverage", id: "pc-basic" }, path: "coverage_basic.renewal", slot: entered(false) })]);
    expect(cond.branches[1].condition).toMatchObject({ value: true, discriminators: [{ code: "D0006", slot: entered(24) }] });
    // 앞 조건의 읽기는 다음 조건에 섞이지 않는다
    expect(cond.branches[1].condition!.reads.map((r) => r.path)).toEqual(["coverage_basic.reduction_months"]);
  });

  it("탄 가지 안의 인라인 조건 — 가지 기록 아래(재귀)", () => {
    const inner = cond.branches[1].decisions[0] as ConditionDecision;
    expect(inner).toMatchObject({ kind: "condition", nodeId: "x-inl", inline: true });
    expect(outcomes(inner)).toEqual(["false", "taken"]);
    expect(inner.branches[0].condition!.attributes).toEqual([{ code: "A0002", value: "1" }]);
    expect(cond.branches[0].decisions).toEqual([]);
  });

  it("같은 조라도 다른 상품담보 문맥이면 그 문맥의 판단 — 추가 탑재분은 인라인 IF 를 탄다", () => {
    const addon = explain(input, { document: "special", productCoverageId: "pc-addon", articleId: "s-art-x" });
    expect(outcomes((addon.sources[0].decisions[0] as ConditionDecision).branches[1].decisions[0])).toEqual(["taken", "skipped"]);
  });

  it("결정적이다 — 같은 입력이면 같은 기록", () => {
    expect(explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-x" })).toEqual(e);
  });

  it("설명 모드가 아닐 때의 책자는 설명 대상과 무관하다 — 기록을 싣지 않는다", () => {
    const booklet = assemble(input, input);
    expect(JSON.stringify(booklet)).not.toContain("x-cond");
  });
});

/** 갱신여부를 비운 일반상해사망 탑재분 — 조건 평가가 막힌다. */
function withoutRenewal(input: AssemblyInput): AssemblyInput {
  const c = deathCoverage("pc-basic", "일반상해사망", [{ kindCode: "A0002", valueCode: "1" }]);
  (c.values.get("pc-basic") as Map<string, unknown>).delete("coverage_basic.renewal");
  return { ...input, coverages: input.coverages.map((x) => (x.snapshot.id === "pc-basic" ? c : x)) };
}

describe("막힌 분기 — blocked · 평가 대기(Booklet.pending)", () => {
  const blocked = article("s-art-b", "막힘 표본", [
    {
      id: "b-cond",
      kind: "condBlock",
      branches: [
        // 막힌 가지 안의 막힌 분기는 평가하지 않는다 — 기록되지 않는다
        { id: "b-if", when: "D0001 = true", children: [{ id: "b-inner", kind: "condBlock", branches: [{ id: "b-inner-if", when: "D0001 = false", children: [para("b-p0", [text("b-t0", "안쪽")])] }] } as BlockNode] },
        { id: "b-elif", when: "D0006 = 24", children: [para("b-p1", [text("b-t1", "감액")])] },
        { id: "b-else", children: [para("b-p2", [text("b-t2", "그 밖")])] },
      ],
    } as BlockNode,
  ]);
  const input = withSpecial([blocked], withoutRenewal);

  it("조건 미입력 — 그 가지 blocked, 뒤 가지도 평가하지 않아 blocked · 조건 근거에 오류", () => {
    const e = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-b" });
    const cond = e.sources[0].decisions[0] as ConditionDecision;
    expect(outcomes(cond)).toEqual(["blocked", "blocked", "blocked"]);
    expect(cond.branches[0].condition).toMatchObject({ expression: "D0001 = true", issue: { kind: "notEntered" } });
    expect(cond.branches[0].condition!.value).toBeUndefined();
    expect(cond.branches[1].condition).toBeUndefined();
    expect(cond.branches[0].decisions).toEqual([]);
  });

});

describe("함수조항 호출 — 인자 · 옵션 · 값별 분기 · 중첩", () => {
  /** 인자 기간(구분자 연결) · 사유(상수 연결) — 기간 조건 + 사유 값별 분기. */
  const callee: Clause = {
    code: "C0900",
    label: "설명 함수조항",
    mode: "block",
    body: [
      {
        id: "f-cond",
        kind: "condBlock",
        branches: [
          { id: "f-if", when: "arg.기간 = 24", children: [{ id: "f-p1", kind: "paragraph", children: [{ id: "f-t1", kind: "text", text: "24개월" }] }] },
          { id: "f-else", children: [{ id: "f-p2", kind: "paragraph", children: [{ id: "f-t2", kind: "text", text: "그 밖" }] }] },
        ],
      },
      {
        id: "f-sw",
        kind: "switchBlock",
        on: "arg.사유",
        cases: [
          { id: "f-k1", values: ["V01"], children: [{ id: "f-p3", kind: "paragraph", children: [{ id: "f-t3", kind: "text", text: "일반" }] }] },
          {
            id: "f-k2",
            values: ["V02"],
            children: [
              {
                id: "f-p4",
                kind: "paragraph",
                // 중첩 호출 — 펼친 본문 안의 「문구」 함수조항 (함수조항 노드 타입 밖이라 저장 검사를 거치지 않은 트리로 조립 경로만 본다)
                children: [{ id: "f-t4", kind: "text", text: "간편 " }, { id: "f-nested", kind: "clauseInlineRef", clauseCode: "C0901", options: {} } as never],
              },
            ],
          },
        ],
      },
    ],
    options: [],
    params: [
      { name: "기간", type: { kind: "number" } },
      { name: "사유", type: { kind: "enum", enumCode: "E0001" } },
    ],
    required: { discriminators: [], attributes: [] },
  };
  const nested: Clause = {
    code: "C0901",
    label: "중첩 문구",
    mode: "inline",
    body: [{ id: "n-cond", kind: "inlineCond", branches: [{ id: "n-if", when: "D0002 = 'V02'", children: [{ id: "n-t1", kind: "text", text: "간편심사" }] }] }],
    options: [],
    required: { discriminators: [], attributes: [] },
  };
  const call = article("s-art-f", "호출 표본", [{ id: "s-call", kind: "clauseBlockRef", clauseCode: "C0900", options: {}, bindings: { 기간: { kind: "discriminator", code: "D0006" }, 사유: { kind: "const", value: "V02" } } } as BlockNode]);
  const input = withSpecial([call], (x) => ({ ...x, clauses: [...x.clauses, callee, nested] }));
  const e = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-f" });
  const rec = e.sources[0].decisions[0] as ClauseDecision;

  it("인자마다 연결과 값 — 구분자 연결은 사용처 문맥의 값", () => {
    expect(rec).toMatchObject({ kind: "clause", nodeId: "s-call", clauseCode: "C0900", overridden: [] });
    expect(rec.args).toEqual([
      { name: "기간", binding: { kind: "discriminator", code: "D0006" }, value: 24 },
      { name: "사유", binding: { kind: "const", value: "V02" }, value: "V02" },
    ]);
  });

  it("펼친 본문의 기록 — 인자를 바꿔 쓴 조건식 · 값별 분기의 판단 값과 칸", () => {
    const [cond, sw] = rec.decisions as [ConditionDecision, SwitchDecision];
    expect(cond).toMatchObject({ kind: "condition", nodeId: "s-call/f-cond" });
    expect(outcomes(cond)).toEqual(["taken", "skipped"]);
    expect(cond.branches[0].condition).toMatchObject({ expression: "D0006 = 24", value: true, discriminators: [{ code: "D0006", slot: entered(24) }] });
    expect(sw).toMatchObject({ kind: "switch", nodeId: "s-call/f-sw", inline: false, outcome: "taken", value: "V02", caseId: "s-call/f-k2" });
  });

  it("중첩 호출 — 칸 안의 호출 기록 아래에 그 본문의 기록", () => {
    const sw = rec.decisions[1] as SwitchDecision;
    const inner = sw.decisions[0] as ClauseDecision;
    expect(inner).toMatchObject({ kind: "clause", clauseCode: "C0901", args: [] });
    expect(outcomes(inner.decisions[0])).toEqual(["taken"]);
  });

  it("칸이 없는 값 — unassignedValue 표시(평가 대기는 아니다)", () => {
    const x = withSpecial([article("s-art-u", "미배정", [{ id: "u-call", kind: "clauseBlockRef", clauseCode: "C0900", options: {}, bindings: { 기간: { kind: "const", value: 1 }, 사유: { kind: "const", value: "V09" } } } as BlockNode])], (y) => ({ ...y, clauses: [...y.clauses, callee, nested] }));
    const u = explain(x, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-u" });
    expect((u.sources[0].decisions[0] as ClauseDecision).decisions[1]).toMatchObject({ kind: "switch", outcome: "unassigned", value: "V09" });
    expect(assemble(x, x).pending).toEqual([]);
  });

  it("상품 옵션 오버라이드 — 고른 옵션과 오버라이드 표시 (보통약관 자리)", () => {
    const base = alphaPlusFixture();
    const g = base.generalDocuments.get("g-doc")!;
    const def = g.children[0] as ArticleNode;
    const general: DocumentNode = { ...g, children: [{ ...def, children: [...def.children, { id: "g-lapse", kind: "clauseBlockRef", clauseCode: "C0001", options: { O01: "V01" } } as BlockNode] }, ...g.children.slice(1)] };
    const x: AssemblyInput = {
      ...base,
      generalDocuments: new Map([["g-doc", general]]),
      product: { ...base.product, overrides: [{ id: "ov1", scope: { kind: "product", id: "prod-alpha" }, nodeId: "g-lapse", clauseCode: "C0001", options: { O01: "V02" } }] },
    };
    const r = explain(x, { document: "general", articleId: "g-art-def" });
    expect(r.sources).toEqual([expect.objectContaining({ kind: "template", documentId: "g-doc", articleId: "g-art-def" })]);
    expect(r.sources[0].decisions).toEqual([expect.objectContaining({ kind: "clause", clauseCode: "C0001", options: { O01: "V02" }, overridden: ["O01"] })]);
  });
});

describe("반복 — 원소별 기록 · 원소 0개", () => {
  const loop = (id: string, filter?: string): BlockNode =>
    ({
      id,
      kind: "forBlock",
      source: { kind: "planOptions", form: "waiver", ...(filter ? { filter } : {}) },
      children: [{ id: `${id}-cond`, kind: "condBlock", branches: [{ id: `${id}-if`, when: "D0008 = true", children: [para(`${id}-p1`, [text(`${id}-t1`, "면제")])] }, { id: `${id}-else`, children: [para(`${id}-p2`, [text(`${id}-t2`, "미면제")])] }] }],
      fallback: [para(`${id}-fb`, [text(`${id}-fbt`, "해당 없음")])],
    }) as BlockNode;

  it("납입면제종마다 — 원소마다 다른 가지(1종 면제 · 2종 미면제), 노드 id 는 복제 접미사", () => {
    const input = withSpecial([article("s-art-r", "반복 표본", [loop("r")])]);
    const rec = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-r" }).sources[0].decisions[0] as RepeatDecision;
    expect(rec).toMatchObject({ kind: "repeat", nodeId: "r", form: "block", source: { kind: "planOptions", form: "waiver" } });
    expect(rec.elements.map((x) => [x.id, x.label])).toEqual([["opt-type-1", "1종"], ["opt-type-2", "2종"]]);
    expect(rec.elements.map((x) => (x.decisions[0] as ConditionDecision).nodeId)).toEqual(["r-cond@opt-type-1", "r-cond@opt-type-2"]);
    expect(rec.elements.map((x) => outcomes(x.decisions[0]))).toEqual([["taken", "skipped"], ["false", "taken"]]);
    expect((rec.elements[0].decisions[0] as ConditionDecision).loops).toEqual([{ loop: "r", element: "opt-type-1", kind: "planOption" }]);
  });

  it("원소 0개 — 원소 없음 + 비었을 때 칸", () => {
    const input = withSpecial([article("s-art-r0", "빈 반복", [loop("r0", "waiver.months > 100")])]);
    const rec = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-r0" }).sources[0].decisions[0] as RepeatDecision;
    expect(rec.elements).toEqual([]);
    expect(rec.fallback).toEqual([]);
  });
});

describe("트리 반복 · 인라인 반복 · 표 구분자", () => {
  it("세부보장마다(트리 반복) — 원소 = 스냅샷 노드(키 경로 · 이름), 원소마다 그 노드 문맥의 가지", () => {
    const base = nodeQualFixture();
    const doc: DocumentNode = {
      id: "nq-doc",
      kind: "document",
      title: "노드 표본",
      children: [
        article("nq-art", "세부보장마다", [
          {
            id: "nq-for",
            kind: "forBlock",
            source: { kind: "subCoverages" },
            children: [{ id: "nq-cond", kind: "condBlock", branches: [{ id: "nq-if", when: "D0007 = true", children: [para("nq-p1", [text("nq-t1", "감액")])] }, { id: "nq-else", children: [para("nq-p2", [text("nq-t2", "감액 없음")])] }] }],
          } as BlockNode,
        ]),
      ],
    };
    const input = { ...base, specialDocuments: new Map([...base.specialDocuments, ["cov-nodequal", doc]]) };
    const rec = explain(input, { document: "special", productCoverageId: "pc-nodequal", articleId: "nq-art" }).sources[0].decisions[0] as RepeatDecision;
    expect(rec.elements.map((x) => [x.kind, x.id, x.path, x.label])).toEqual([["coverageNode", "01", "01", "세부A"], ["coverageNode", "03", "03", "세부B"]]);
    expect(rec.elements.map((x) => outcomes(x.decisions[0]))).toEqual([["taken", "skipped"], ["false", "taken"]]);
    expect((rec.elements[0].decisions[0] as ConditionDecision).branches[0].condition!.discriminators).toEqual([{ code: "D0007", nodeId: "s-a", slot: entered(true) }]);
  });

  it("문장 안 반복 — 원소마다 기록", () => {
    const inlineFor = { id: "if-for", kind: "inlineFor", source: { kind: "planOptions", form: "waiver" }, connector: "및", children: [{ id: "if-cond", kind: "inlineCond", branches: [{ id: "if-if", when: "D0008 = true", children: [text("if-t1", "면제")] }, { id: "if-else", children: [text("if-t2", "미면제")] }] }] } as unknown as InlineNode;
    const input = withSpecial([article("s-art-if", "문장 반복", [para("if-p", [inlineFor])])]);
    const rec = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-if" }).sources[0].decisions[0] as RepeatDecision;
    expect(rec).toMatchObject({ kind: "repeat", form: "inline", nodeId: "if-for" });
    expect(rec.elements.map((x) => outcomes(x.decisions[0]))).toEqual([["taken", "skipped"], ["false", "taken"]]);
  });

  it("표 구분자 — 원천 급부 · 펼친 행 · 없는 코드면 그 오류", () => {
    const base = alphaPlusFixture();
    const docOf = (code: string): DocumentNode => ({ id: "dt-doc", kind: "document", title: "표 표본", children: [article("dt-art", "감액", [{ id: "dt-ref", kind: "tableRef", code } as BlockNode])] });
    const input: AssemblyInput = { ...base, master: [...base.master!, findForm("reduction")!], specialDocuments: new Map([...base.specialDocuments, ["cov-death", docOf("DT000001")]]) };
    const rec = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "dt-art" }).sources[0].decisions[0] as DynTableDecision;
    expect(rec).toMatchObject({ kind: "dynTable", nodeId: "dt-ref", tableCode: "DT000001" });
    expect(rec.benefits.map((b) => b.name)).toEqual(["사망보험금"]);
    expect(rec.rows.map((r) => r.name)).toEqual(["사망보험금"]);
    const missing = explain({ ...input, specialDocuments: new Map([...base.specialDocuments, ["cov-death", docOf("DT999999")]]) }, { document: "special", productCoverageId: "pc-basic", articleId: "dt-art" }).sources[0].decisions[0] as DynTableDecision;
    expect(missing.issue).toMatchObject({ kind: "brokenRef" });
  });
});

describe("조 단위 — 원본 · 대치 · 생략 · 결과에 없음", () => {
  it("기본계약 대치 — 템플릿 조 자리 ← 기본계약 담보약관 조, 덧칠은 담보약관 조", () => {
    const input = alphaPlusFixture();
    const doc = input.specialDocuments.get("cov-base-death")!;
    const pay = doc.children[0] as ArticleNode;
    const withCond: DocumentNode = { ...doc, children: [{ ...pay, children: [...pay.children, para("b-par-x", [{ id: "b-inl", kind: "inlineCond", branches: [{ id: "b-inl-if", when: "D0001 = false", children: [text("b-x", "비갱신")] }] }])] }, ...doc.children.slice(1)] };
    const x = { ...input, specialDocuments: new Map([...input.specialDocuments, ["cov-base-death", withCond]]) };
    const e = explain(x, { document: "general", articleId: "g-art-pay" });
    expect(e.status).toBe("shown");
    expect(e.sources).toEqual([
      expect.objectContaining({ kind: "coverage", productCoverageId: "pc-base", productCoverageName: "상해사망(기본계약)", documentId: "b-doc-death", articleId: "b-art-pay", fills: { templateArticleId: "g-art-pay", via: "replace" } }),
    ]);
    expect(outcomes(e.sources[0].decisions[0])).toEqual(["taken"]);
  });

  it("상품 조 사본 — 원본은 사본", () => {
    const input = alphaPlusFixture();
    const def = input.generalDocuments.get("g-doc")!.children[0] as ArticleNode;
    const x = { ...input, product: { ...input.product, articleCopies: new Map([["g-art-def", { ...def, children: [para("copy-p", [text("copy-t", "사본 글")])] }]]) } };
    expect(explain(x, { document: "general", articleId: "g-art-def" }).sources).toEqual([expect.objectContaining({ kind: "copy", documentId: "g-doc", articleId: "g-art-def" })]);
  });

  it("특약 생략된 조 — 결과에 없어도 설명 대상이 되고 생략 판정 기록을 잇는다", () => {
    const input = alphaPlusFixture();
    const record = assemble(input, input).omitted.find((o) => o.productCoverageId === "pc-basic" && o.disposition === "omitted")!;
    expect(record).toBeDefined();
    const e = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: record.articleId });
    expect(e.status).toBe("omitted");
    expect(e.omission).toEqual(record);
    expect(e.sources[0]).toMatchObject({ kind: "coverage", articleId: record.articleId });
  });

  it("조건으로 사라진 조 — 결과에 없음 + 조 자리를 정한 조건(조 바깥)", () => {
    const gone = { id: "y-cond", kind: "condBlock", branches: [{ id: "y-if", when: "D0001 = true", children: [article("s-art-y", "사라지는 조", [para("y-p", [text("y-t", "갱신")])])] }] } as unknown as DocumentNode["children"][number];
    const input = withSpecial([gone]);
    const e = explain(input, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-y" });
    expect(e.status).toBe("absent");
    expect(e.sources[0].decisions).toEqual([]);
    expect(e.sources[0].enclosing).toEqual([expect.objectContaining({ kind: "condition", nodeId: "y-cond" })]);
    expect(outcomes(e.sources[0].enclosing![0])).toEqual(["false"]);
  });

  it("조립이 만든 조(최소 준용규정) — 원본 없음 · 시스템 표시", () => {
    const input = alphaPlusFixture();
    const doc = assemble(input, input).specials.flatMap((g) => g.docs).find((d) => d.ownerId === "pc-basic")!;
    const generated = doc.children.find((a) => a.kind === "article" && a.id.endsWith("::application-article"))!;
    expect(generated).toBeDefined();
    expect(explain(input, { document: "special", productCoverageId: "pc-basic", articleId: generated.id })).toMatchObject({ status: "shown", sources: [], system: true });
  });

  it("없는 상품담보 · 없는 조 — 결과에 없음, 원본 없음", () => {
    const input = alphaPlusFixture();
    expect(explain(input, { document: "special", productCoverageId: "pc-none", articleId: "s-art-pay" })).toMatchObject({ status: "absent", sources: [] });
    expect(explain(input, { document: "general", articleId: "g-none" })).toMatchObject({ status: "absent", sources: [] });
  });
});

describe("절 형태 — 제1절 위임 · 공통 · 블록 조", () => {
  const p = (id: string, value: string) => para(id, [text(`${id}-t`, value)]);
  const template: DocumentNode = {
    id: "t-doc",
    kind: "document",
    title: "독립특약 템플릿",
    children: [article("t-def", "용어의 정의", [p("t-def-p", "정의")]), article("t-pay", "보험금의 지급사유", [p("t-pay-p", "마스터 지급사유")]), article("t-lapse", "특별약관의 소멸", [p("t-lapse-p", "마스터 소멸")])],
  };
  const lapse = (id: string): BlockNode => ({ id, kind: "clauseBlockRef", clauseCode: "C0001", options: { O01: "V02" } }) as BlockNode;
  const docA: DocumentNode = {
    id: "a-doc",
    kind: "document",
    title: "A 문면",
    children: [
      article("a-pay", "보험금의 지급사유", [para("a-pay-p", [text("a-pay-t", "A 지급사유 "), { id: "a-inl", kind: "inlineCond", branches: [{ id: "a-inl-if", when: "D0001 = false", children: [text("a-inl-t", "비갱신")] }] }])], { linkedArticleId: "t-pay" }),
      article("a-lapse", "특별약관의 소멸", [lapse("a-lapse-c")], { linkedArticleId: "t-lapse" }),
    ],
  };
  const docB: DocumentNode = {
    id: "b-doc",
    kind: "document",
    title: "B 문면",
    children: [article("b-pay", "보험금의 지급사유", [p("b-pay-p", "B 지급사유")], { linkedArticleId: "t-pay" }), article("b-lapse", "특별약관의 소멸", [lapse("b-lapse-c")], { linkedArticleId: "t-lapse" })],
  };
  const base = alphaPlusFixture();
  const values = new Map(base.product.values);
  values.set("feature.contract_kind", entered("V02"));
  const input: AssemblyInput = {
    ...base,
    coverages: base.coverages.filter((c) => ["pc-base", "pc-basic"].includes(c.snapshot.id as Id)),
    generalDocuments: new Map([["t-doc", template]]),
    specialDocuments: new Map([["cov-base-death", docA], ["cov-death", docB]]),
    product: { ...base.product, name: "판정 표본", values, baseContractIds: [], generalDocumentId: "t-doc" },
  };

  it("위임 — 템플릿 조 자리 ← 블록마다 담보약관 조 + 제1절 판정 기록", () => {
    const e = explain(input, { document: "general", articleId: "t-pay" });
    expect(e.status).toBe("shown");
    expect(e.firstSection).toMatchObject({ articleId: "t-pay", result: "delegate", k: 2, n: 2 });
    expect(e.sources.map((s) => [s.kind, s.productCoverageId, s.articleId, s.fills?.via])).toEqual([
      ["coverage", "pc-base", "a-pay", "delegate"],
      ["coverage", "pc-basic", "b-pay", "delegate"],
    ]);
    expect(outcomes(e.sources[0].decisions[0])).toEqual(["taken"]);
  });

  it("공통 — 제1절로 오른 블록 조는 블록에서 생략(결과에 없음) · 판정 기록 · 블록 조 처리", () => {
    const g = explain(input, { document: "general", articleId: "t-lapse" });
    expect(g.firstSection).toMatchObject({ result: "common" });
    expect(g.sources.map((s) => s.fills?.via)).toEqual(["common", "common"]);
    const b = explain(input, { document: "special", productCoverageId: "pc-base", articleId: "a-lapse" });
    expect(b.status).toBe("omitted");
    expect(b.firstSection).toMatchObject({ articleId: "t-lapse", result: "common" });
    expect(b.sources[0]).toMatchObject({ kind: "coverage", articleId: "a-lapse", treatment: "omitted" });
  });

  it("마스터 — 연결 없는 템플릿 조는 템플릿 그대로", () => {
    expect(explain(input, { document: "general", articleId: "t-def" }).sources).toEqual([expect.objectContaining({ kind: "template", articleId: "t-def" })]);
  });
});
