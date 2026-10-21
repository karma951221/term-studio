import { describe, expect, it } from "vitest";

import { assemble, explainArticle, type Booklet, type FirstSectionRecord } from "@/domain/assembly";
import { alphaPlusFixture } from "@/domain/assembly/fixture";
import type { DocumentNode } from "@/domain/document";
import { titleNodes } from "@/domain/document/title";

import { omissionSlots } from "./omissionSlots";

/**
 * 생략 자리 (기능/조립산출 §3.7) — 특약 본문의 원래 조 자리에 번호 없는 회색 한 줄 「(생략) <조 제목> — 보통약관 제N조와 같음」.
 * 책자(산출본)는 바꾸지 않고 화면이 끼운다 — 재료는 생략 판정 기록(`omitted`) · 제1절 판정 기록(블록 조 생략 · 분리) · 담보약관 모델의 조 순서.
 */
const input = alphaPlusFixture();
const booklet = assemble(input, input);
const coverageOf = new Map(input.coverages.map((c) => [c.snapshot.id, c.snapshot.coverageId] as const));

describe("특약 조 생략 — 생략 판정 기록", () => {
  const slots = omissionSlots(booklet, input.specialDocuments, coverageOf);
  const omitted = booklet.omitted.filter((o) => o.disposition === "omitted");

  it("생략된 조마다 그 상품담보에 한 줄 — 제목 · 연결한 보통약관 조 번호", () => {
    expect(omitted.length).toBeGreaterThan(0);
    const o = omitted[0];
    const line = slots.get(o.productCoverageId)!.find((s) => s.articleId === o.articleId)!;
    expect(line.title).toBe(o.articleTitle);
    expect(line.note).toMatch(/^보통약관 제\d+조와 같음$/);
    // 설명 대상 — 누르면 그 조의 패널
    expect(explainArticle(input, input, { document: "special", productCoverageId: o.productCoverageId, articleId: line.articleId }).status).toBe("omitted");
  });

  it("자리 — 모델 순서상 앞에 있는 결과 조 바로 뒤(앞에 결과 조가 없으면 문서 맨 앞)", () => {
    const doc = input.specialDocuments.get("cov-death")!;
    const order = doc.children.flatMap((c) => (c.kind === "article" ? [c.id] : c.kind === "condBlock" ? c.branches.flatMap((b) => b.children.flatMap((x) => (x.kind === "article" ? [x.id] : []))) : []));
    for (const s of slots.get("pc-basic") ?? []) {
      const i = order.indexOf(s.articleId);
      const rendered = new Set(booklet.specials.flatMap((g) => g.docs).filter((d) => d.ownerId === "pc-basic").flatMap((d) => d.children.map((c) => c.id)));
      const before = order.slice(0, i).filter((id) => rendered.has(id)).at(-1);
      expect(s.afterId).toBe(before);
    }
  });

  it("준용 · 통째는 자리를 끼우지 않는다(준용 문구로 본문에 남는다)", () => {
    for (const o of booklet.omitted.filter((x) => x.disposition !== "omitted")) expect(slots.get(o.productCoverageId)?.some((s) => s.articleId === o.articleId) ?? false).toBe(false);
  });
});

describe("제1절에서 생략 · 분리되어 결과에 없는 블록 조", () => {
  it("판정 기록의 블록 처리가 생략이고 결과 블록에 없으면 회색 자리 — 「제1절 제N조와 같음」", () => {
    const block: DocumentNode = { id: "bd", kind: "document", title: "블록", children: [
      { id: "b1", kind: "article", title: titleNodes("보험금의 지급사유", "b1"), children: [] },
      { id: "b2", kind: "article", title: titleNodes("계약의 소멸", "b2"), linkedArticleId: "t-lapse", children: [] },
    ] };
    const fs: FirstSectionRecord = { articleId: "t-lapse", title: "계약의 소멸", number: 7, k: 2, n: 2, option: "none", result: "common", reason: "allSame", linked: [{ productCoverageId: "pcA", name: "A" }], unlinked: [], blocks: [{ productCoverageId: "pcA", name: "A", treatment: "omitted" }], substitutions: [] };
    const b = {
      form: "sectioned",
      general: { kind: "document", id: "g", document: "general", ownerId: "g", title: "g", children: [{ kind: "article", id: "t-lapse", number: 7, label: "제7조", title: "계약의 소멸", children: [] }] },
      blocks: [{ id: "grp", docs: [{ kind: "document", id: "pcA", document: "special", ownerId: "pcA", title: "블록", children: [{ kind: "article", id: "b1", number: 1, label: "제1조", title: "보험금의 지급사유", children: [] }] }] }],
      specials: [],
      omitted: [],
      firstSection: [fs],
    } as unknown as Booklet;
    const slots = omissionSlots(b, new Map([["covA", block]]), new Map([["pcA", "covA"]]));
    expect(slots.get("pcA")).toEqual([{ productCoverageId: "pcA", articleId: "b2", title: "계약의 소멸", afterId: "b1", note: "제1절 제7조와 같음" }]);
  });
});
