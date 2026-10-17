/**
 * 조립 — 블록 지정 참조 렌더 (ADR-0082 결정 12 · 기능/조립산출 §3.10 · §3.12).
 * 상품 조 사본 안에서 이 상품의 블록 전체 「제2절 보장조항 {블록 머리} {제목}」 · 블록 조 「… 제N조(제목)」. 대상이 없으면 articleGone.
 */
import { describe, expect, it } from "vitest";

import type { ArticleNode, InlineNode } from "../document/nodes";
import { titleNodes } from "../document/title";
import { entered, type Id } from "../types";
import { assemble, assembleGeneral } from "./booklet";
import { alphaGeneralDocument, alphaPlusFixture } from "./fixture";
import type { AssemblyInput, RenderedDoc, RenderedInline } from "./types";

const run = (input: AssemblyInput) => assemble(input, input);

/** 제5조(장해의 분류 — 어느 블록도 조연결하지 않는 조)의 사본 — 본문에 블록 지정 참조. */
function copyWith(...inlines: InlineNode[]): ArticleNode {
  const original = alphaGeneralDocument().children.find((c) => c.kind === "article" && c.id === "g-art-disability") as ArticleNode;
  return { ...original, title: titleNodes("계약의 소멸", original.id), children: [{ id: "g-dis-copy-par", kind: "paragraph", code: "PZ0100", children: inlines }] };
}

function product(copy: ArticleNode, extra: Partial<AssemblyInput["product"]> = {}): AssemblyInput {
  const input = alphaPlusFixture();
  return { ...input, product: { ...input.product, baseContractIds: ["pc-base", "pc-basic"], articleCopies: new Map([[copy.id, copy]]), ...extra } };
}

function paragraphText(doc: RenderedDoc, articleTitle: string): string {
  const inline = (list: RenderedInline[]) => list.map((n) => (n.kind === "text" ? n.text : n.kind === "error" ? `⟦${n.issue.kind}⟧` : n.label)).join("");
  const a = doc.children.find((c) => c.kind === "article" && c.title === articleTitle);
  return a && a.kind === "article" ? a.children.flatMap((p) => (p.kind === "paragraph" ? [inline(p.children)] : [])).join("\n") : "";
}

const ref = (id: string, productCoverageId: Id, articleId?: Id): InlineNode => ({ id, kind: "blockRef", productCoverageId, ...(articleId ? { articleId } : {}) });
const txt = (id: string, text: string): InlineNode => ({ id, kind: "text", text });

describe("블록 지정 참조 — 절 형태(기본계약 2개)의 제1절 사본", () => {
  const copy = copyWith(txt("t1", "주된 보장인 "), ref("r1", "pc-base", "b-art-pay"), txt("t2", "의 보험금이 지급된 때와 "), ref("r2", "pc-basic"), txt("t3", "의 보장이 끝난 때 이 계약은 소멸합니다."));

  it("블록 조 「제2절 보장조항 1. {제목} 제N조(제목)」 · 블록 전체 「제2절 보장조항 2. {제목}」 — 블록 머리는 그룹 제목 표시를 따른다(끔 「N.」)", () => {
    const b = run(product(copy));
    expect(paragraphText(b.general!, "계약의 소멸")).toBe("주된 보장인 제2절 보장조항 1. 상해사망(기본계약) 제1조(보험금의 지급사유)의 보험금이 지급된 때와 제2절 보장조항 2. 일반상해사망의 보장이 끝난 때 이 계약은 소멸합니다.");
    expect(b.issues.filter((i) => i.kind === "articleGone")).toEqual([]);
  });

  it("그룹 제목 표시를 켜면 블록 머리 「Ⅰ-N.」", () => {
    const input = product(copy);
    const values = new Map(input.product.values);
    values.set("booklet.group_titles", entered(true));
    const b = run({ ...input, product: { ...input.product, values } });
    expect(paragraphText(b.general!, "계약의 소멸")).toMatch(/제2절 보장조항 Ⅰ-1\. 상해사망\(기본계약\) 제1조\(보험금의 지급사유\)/);
  });

  it("보통약관 미리보기(assembleGeneral)도 같은 표기", () => {
    const input = product(copy);
    expect(paragraphText(assembleGeneral(input, input)!.doc, "계약의 소멸")).toContain("제2절 보장조항 2. 일반상해사망의 보장");
  });

  it("대상 블록이 이 상품에 없으면(탑재 해제 · 우회 저장) articleGone — 오류 마커는 그 자리, 좌표는 제1절 그 사본 조", () => {
    const b = run(product(copyWith(txt("t1", "소멸 — "), ref("r9", "pc-gone"))));
    const gone = b.issues.filter((i) => i.kind === "articleGone");
    expect(gone).toHaveLength(1);
    expect(gone[0].at).toMatchObject({ document: "general", articleId: "g-art-disability", refPath: "pc-gone", section: { kind: "general" } });
    expect(paragraphText(b.general!, "계약의 소멸")).toBe("소멸 — ⟦articleGone⟧");
  });

  it("블록에 없는 조 · 대치 형태(블록 없음)도 articleGone", () => {
    expect(run(product(copyWith(ref("r8", "pc-base", "b-art-none")))).issues.filter((i) => i.kind === "articleGone").map((i) => i.at.refPath)).toEqual(["pc-base/b-art-none"]);
    const single = alphaPlusFixture();
    const b = run({ ...single, product: { ...single.product, articleCopies: new Map([["g-art-disability", copyWith(ref("r7", "pc-base"))]]) } });
    expect(b.issues.filter((i) => i.kind === "articleGone").map((i) => i.at.refPath)).toEqual(["pc-base"]);
  });
});
