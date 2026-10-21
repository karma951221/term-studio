/**
 * 출처 패널의 재료 — 설명 결과(`explainArticle`) + 모델링 원본 + 결과 값 · 이름표 (ADR-0092 결정 1 · 2 · 기능/조립산출 §3.7).
 * 표본은 축약 픽스처(알파Plus — 대치 형태, 기본계약 「상해사망(기본계약)」이 보통약관 제2조 · 제3조 자리를 채운다).
 */
import { describe, expect, it } from "vitest";

import { assemble } from "./booklet";
import { explainArticle, type ExplainTarget } from "./explain";
import { alphaPlusFixture } from "./fixture";
import { buildSourceView, liveSourceView, locateRendered, renderedValues } from "./sourceView";
import type { RenderedArticle } from "./types";

const input = alphaPlusFixture();
const booklet = assemble(input, input);
const view = (target: ExplainTarget) => buildSourceView(input, input, explainArticle(input, input, target), booklet);

describe("locateRendered — 결과 자리 · 결과 조", () => {
  it("보통약관 조 — 「보통약관 › 제N조(조 명)」", () => {
    const r = locateRendered(booklet, { document: "general", articleId: "g-art-def" });
    expect(r.place).toBe("보통약관 › 제1조(용어의 정의)");
    expect(r.article?.id).toBe("g-art-def");
  });

  it("특약 조 — 「특약 문서 제목 › 제N조(조 명)」", () => {
    const r = locateRendered(booklet, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" });
    expect(r.place).toMatch(/특별약관 › 제\d+조\(특별약관의 소멸\)$/);
    expect(r.article?.id).toBe("s-art-lapse");
  });

  it("결과에 없는 조 — 결과 조 없이 자리만(문서 제목)", () => {
    const r = locateRendered(booklet, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-nope" });
    expect(r.article).toBeUndefined();
  });
});

describe("renderedValues — 결과 조의 글 조각(노드 id → 글)", () => {
  it("항 · 호 · 목의 글을 노드 id 로 모은다 — 슬롯 자리의 값이 그 슬롯 id 로 남는다", () => {
    const article: RenderedArticle = {
      kind: "article",
      id: "a",
      number: 1,
      label: "제1조",
      title: "t",
      children: [
        {
          kind: "paragraph",
          id: "p",
          number: 1,
          label: "",
          children: [
            { kind: "text", id: "t1", text: "앞 " },
            { kind: "text", id: "slot1", text: "50%" },
          ],
          items: [{ kind: "item", id: "i", number: 1, label: "1.", children: [{ kind: "text", id: "slot2@01", text: "1년" }], subitems: [{ kind: "subitem", id: "s", number: 1, label: "가.", children: [{ kind: "text", id: "slot3", text: "가" }] }] }],
        },
      ],
    };
    expect(renderedValues(article)).toEqual({ t1: "앞 ", slot1: "50%", "slot2@01": "1년", slot3: "가" });
  });

  it("실제 책자 — 특약 「보험금의 지급사유」의 평균공시이율 슬롯 값", () => {
    const r = locateRendered(booklet, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-pay" });
    expect(renderedValues(r.article!)["s-slot-rate"]).toBeDefined();
  });
});

describe("buildSourceView — 원본 · 대치 한 줄 · 이름표", () => {
  it("특약 조 — 원본은 담보약관 조(모델 트리 그대로) · 문서 제목 · 조 서수", () => {
    const v = view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" });
    expect(v.sources).toHaveLength(1);
    expect(v.sources[0].article?.id).toBe("s-art-lapse");
    expect(v.sources[0].documentTitle).toBe("일반상해사망 특별약관");
    expect(v.sources[0].kindLabel).toBe("담보약관");
    expect(v.sources[0].fillLine).toBeUndefined();
    expect(v.place).toMatch(/제\d+조\(특별약관의 소멸\)$/);
  });

  it("함수조항 호출이 쓴 정의를 싣는다 — 이름 · 모델 트리(문면 모양)", () => {
    const v = view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" });
    expect(Object.keys(v.clauses)).toContain("C0001");
    expect(v.clauses.C0001.label).toBeTruthy();
    expect(v.clauses.C0001.tree.kind).toBe("document");
  });

  it("조건이 읽은 구분자 · 담보속성의 이름표 — 구분자 표시명, 담보속성 값 이름", () => {
    const v = view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-pay" });
    expect(v.attributes.A0001?.label).toBeTruthy();
    // 슬롯이 읽는 구분자도 이름표가 있다(값 자리의 이름)
    expect(v.discriminators.D0004?.label).toBeTruthy();
  });

  it("기본계약 대치 — 보통약관 조 자리 ← 기본계약 담보약관 조 (조연결) 한 줄", () => {
    const v = view({ document: "general", articleId: "g-art-pay" });
    expect(v.sources[0].article?.id).toBe("b-art-pay");
    expect(v.sources[0].kindLabel).toBe("담보약관");
    expect(v.sources[0].fillLine).toBe("보통약관 제2조 자리 ← 기본계약 「상해사망(기본계약)」 담보약관 제1조 (조연결)");
  });

  it("템플릿 조 — 원본 종류 「템플릿」, 대치 한 줄 없음", () => {
    const v = view({ document: "general", articleId: "g-art-def" });
    expect(v.sources[0].kindLabel).toBe("템플릿");
    expect(v.sources[0].article?.id).toBe("g-art-def");
  });

  it("상품 조 사본 — 원본은 사본 조 · 「사본」", () => {
    const copy = { id: "g-art-def", kind: "article" as const, title: [{ id: "c-t", kind: "text" as const, text: "용어의 정의" }], children: [] };
    const withCopy = { ...input, product: { ...input.product, articleCopies: new Map([["g-art-def", copy]]) } };
    const b = assemble(withCopy, withCopy);
    const v = buildSourceView(withCopy, withCopy, explainArticle(withCopy, withCopy, { document: "general", articleId: "g-art-def" }), b);
    expect(v.sources[0].kindLabel).toBe("사본");
    expect(v.sources[0].article).toBe(copy);
  });

  it("생략된 특약 조 — 생략 판정 기록 · 연결한 보통약관 조 표시", () => {
    const omitted = booklet.omitted.find((o) => o.disposition === "omitted")!;
    const v = view({ document: "special", productCoverageId: omitted.productCoverageId, articleId: omitted.articleId });
    expect(v.explanation.status).toBe("omitted");
    expect(v.linkedLabel).toMatch(/^제\d+조\(/);
  });

  it("문서 레코드 id 와 트리 id 가 다를 때 — 템플릿은 상품의 템플릿 id 로 찾고, 원본 문서 화면 주소는 레코드 id(`documentIds`)", () => {
    const g = input.generalDocuments.get("g-doc")!;
    const x = { ...input, generalDocuments: new Map([["rec-g", g]]), documentIds: new Map([["g-doc", "rec-g"], ["s-doc-death", "rec-s"]]), product: { ...input.product, generalDocumentId: "rec-g" } };
    const b = assemble(x, x);
    const v = buildSourceView(x, x, explainArticle(x, x, { document: "general", articleId: "g-art-def" }), b);
    expect(v.sources[0].article?.id).toBe("g-art-def");
    expect(v.sources[0].documentTitle).toBe("알파Plus 보통약관");
    expect(v.sources[0].documentRecordId).toBe("rec-g");
    const s = buildSourceView(x, x, explainArticle(x, x, { document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" }), b);
    expect(s.sources[0].documentRecordId).toBe("rec-s");
  });

  it("상품 이름 · id 를 싣는다 (상품 구성 바로가기)", () => {
    const v = view({ document: "general", articleId: "g-art-def" });
    expect(v.productId).toBe("prod-alpha");
  });
});

describe("buildSourceView — 조건식 한국어 표기 재료 (§3.7)", () => {
  it("담보약관 원본 — 그 상품담보의 노드 키 경로 → 머리 표기(노드 한정 구분자 「세부보장 01 · 이름 › …」)", () => {
    const v = view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" });
    const pc = input.coverages.find((c) => c.snapshot.id === "pc-basic")!.snapshot;
    const sub = pc.subCoverages[0]!;
    const ben = sub.benefits[0]!;
    expect(v.sources[0].nodeLabels?.[sub.key]).toBe(`세부보장 ${sub.key} · ${sub.name}`);
    expect(v.sources[0].nodeLabels?.[`${sub.key}.${ben.key}`]).toBe(`세부보장 ${sub.key} · ${sub.name} › 급부 ${ben.key} · ${ben.name}`);
  });

  it("템플릿 원본 — 노드 표기 없음", () => {
    const v = view({ document: "general", articleId: "g-art-def" });
    expect(v.sources[0].nodeLabels).toBeUndefined();
  });

  it("함수조항 열거 인자 → 열거형 코드(값 이름 재료), 열거형 필드 이름도 싣는다", () => {
    const e = input.enums[0]!;
    const changed = {
      ...input,
      clauses: input.clauses.map((c) => (c.code === "C0001" ? { ...c, params: [...(c.params ?? []), { name: "사유", type: { kind: "enum" as const, enumCode: e.code } }] } : c)),
      enums: input.enums.map((x) => (x.code === e.code ? { ...x, fields: [{ key: "F01", label: "약관표시명", type: "string" as const, order: 1 }] } : x)),
    };
    const target: ExplainTarget = { document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" };
    const v = buildSourceView(changed, changed, explainArticle(changed, changed, target), assemble(changed, changed));
    expect(v.clauses.C0001?.paramEnums).toEqual({ 사유: e.code });
    expect(v.enums[e.code]?.fields).toEqual({ F01: "약관표시명" });
  });
});

describe("liveSourceView — 실시간 화면의 출처 재료 (기능/조립산출 §4.2)", () => {
  it("설명 모드 한 번 — 값 조각까지 buildSourceView(explainArticle, assemble) 와 같다", () => {
    for (const t of [
      { document: "special", productCoverageId: "pc-basic", articleId: "s-art-pay" },
      { document: "general", articleId: "g-art-pay" },
      { document: "general", articleId: "g-art-def" },
    ] as ExplainTarget[]) {
      expect(liveSourceView(input, input, t)).toEqual(view(t));
    }
  });
});
