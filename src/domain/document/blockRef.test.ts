/**
 * 블록 지정 참조 (ADR-0082 결정 12 · 기능/문면 §3.5 · 기능/상품 §3.10) — 상품 조 사본 안에서만 이 상품의 블록 전체 · 블록 조를 가리킨다.
 * 대상 키 = 상품담보 id(+ 블록 조 id). 템플릿 · 담보약관 본문에서는 쓰지 않는다(저장 거부).
 */
import { describe, expect, it } from "vitest";

import { nodeBuilders, sequentialIds } from "./builders";
import { blockRefsIn, type DocumentNode } from "./nodes";
import { validateTree } from "./nodes";

const b = nodeBuilders(sequentialIds("n"));
const withRef = (ref: ReturnType<typeof b.blockRef>): DocumentNode => b.document("d", [b.article("a1", [b.paragraph([b.text("계약은 "), ref, b.text(" 에 따라 소멸합니다.")])])]);
const structure = (doc: DocumentNode, env: Parameters<typeof validateTree>[1]) => validateTree(doc, env).map((i) => [i.kind, i.message]);

describe("블록 지정 참조 노드 — 대상 = 상품담보 id(블록 전체) · + 블록 조 id(블록 조)", () => {
  it("builder 모양 — 블록 조를 안 주면 키를 싣지 않는다", () => {
    expect(b.blockRef("pc1")).toMatchObject({ kind: "blockRef", productCoverageId: "pc1" });
    expect("articleId" in b.blockRef("pc1")).toBe(false);
    expect(b.blockRef("pc1", "s-art-1")).toMatchObject({ kind: "blockRef", productCoverageId: "pc1", articleId: "s-art-1" });
  });

  it("blockRefsIn — 문서 순으로 노드 · 그 조", () => {
    const doc = withRef(b.blockRef("pc1", "x1"));
    expect(blockRefsIn(doc).map((r) => [r.node.productCoverageId, r.node.articleId, r.articleId])).toEqual([["pc1", "x1", doc.children[0].id]]);
  });
});

describe("저장 검사 — 상품 조 사본(copyCodes)에서만, 대상은 이 상품의 블록", () => {
  it("템플릿 · 담보약관 저장은 거부 — 「상품 조 사본 안에서만」", () => {
    const doc = withRef(b.blockRef("pc1"));
    expect(structure(doc, { kind: "general" })).toEqual([["structure", "블록 지정 참조는 상품 조 사본 안에서만 쓴다 — 템플릿 · 담보약관 본문에서는 블록을 가리키지 않는다"]]);
    expect(structure(doc, { kind: "special" })).toHaveLength(1);
  });

  it("사본 — 블록 목록을 모르면(편집기 · 문서 검증) 대상 검사를 건너뛴다", () => {
    expect(structure(withRef(b.blockRef("pc9")), { kind: "general", copyCodes: true })).toEqual([]);
  });

  it("사본 — 이 상품의 블록이 아니면 · 블록에 없는 조면 brokenRef", () => {
    const blocks = new Map([["pc1", { name: "상해사망", articleIds: new Set(["x1"]) }]]);
    const env = { kind: "general" as const, copyCodes: true, blocks };
    expect(structure(withRef(b.blockRef("pc1")), env)).toEqual([]);
    expect(structure(withRef(b.blockRef("pc1", "x1")), env)).toEqual([]);
    expect(structure(withRef(b.blockRef("pc9")), env)).toEqual([["brokenRef", "블록 지정 참조의 대상이 이 상품의 블록이 아닙니다 — 이 상품의 블록(주계약 기본계약 2개 이상 · 독립특약 탑재 담보)만 가리킨다"]]);
    expect(structure(withRef(b.blockRef("pc1", "x9")), env)).toEqual([["brokenRef", "블록 지정 참조의 대상 조가 블록 「상해사망」의 담보약관에 없습니다"]]);
  });
});
