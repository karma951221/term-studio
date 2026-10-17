/**
 * 조립 — 잠긴 조의 사본(회색 사본)은 쓰지 않는다 · 경고 `grayCopy` (ADR-0082 결정 10 · 기능/조립산출 §3.11 · 기능/상품 §3.10).
 * 잠금 = 이 상품의 블록 · 기본계약 담보약관이 조연결한 템플릿 조(정적 연결). 대치 형태 · 절 형태 공통.
 */
import { describe, expect, it } from "vitest";

import type { ArticleNode } from "../document/nodes";
import { titleNodes } from "../document/title";
import type { Id } from "../types";
import { assemble } from "./booklet";
import { alphaGeneralDocument, alphaPlusFixture } from "./fixture";
import type { AssemblyInput, RenderedDoc, RenderedInline } from "./types";

const run = (input: AssemblyInput) => assemble(input, input);

const copyOf = (id: Id, text: string, title?: string): ArticleNode => {
  const original = alphaGeneralDocument().children.find((c) => c.kind === "article" && c.id === id) as ArticleNode;
  return { ...original, ...(title ? { title: titleNodes(title, id) } : {}), children: [{ id: `${id}-copy-par`, kind: "paragraph", children: [{ id: `${id}-copy-txt`, kind: "text", text }] }] };
};

function withCopies(extra: Partial<AssemblyInput["product"]>, ...copies: ArticleNode[]): AssemblyInput {
  const input = alphaPlusFixture();
  return { ...input, product: { ...input.product, ...extra, articleCopies: new Map(copies.map((a) => [a.id, a])) } };
}

function text(doc: RenderedDoc): string {
  const inline = (list: RenderedInline[]) => list.map((n) => (n.kind === "text" ? n.text : n.kind === "error" ? `⟦${n.issue.kind}⟧` : n.label)).join("");
  const out: string[] = [];
  for (const a of doc.children) {
    if (a.kind !== "article") continue;
    out.push(`${a.label}(${a.title})`);
    for (const p of a.children) if (p.kind === "paragraph") out.push(inline(p.children));
  }
  return out.join("\n");
}

describe("대치 형태 — 기본계약이 조연결한 조(대치 자리)는 잠긴다", () => {
  it("대치 자리의 사본은 쓰이지 않는다 — 기본계약 조가 서고 경고 grayCopy(상품 › 보통약관 탭, 조 자리)", () => {
    const b = run(withCopies({}, copyOf("g-art-pay", "사본 본문", "지급사유(상품)")));
    expect(text(b.general!)).toContain("피보험자가 보험기간 중 상해로 사망한 경우 보험금을 지급합니다.");
    expect(text(b.general!)).not.toContain("사본 본문");
    const gray = b.issues.filter((i) => i.kind === "grayCopy");
    expect(gray).toHaveLength(1);
    expect(gray[0]).toMatchObject({ severity: "warning", at: { document: "general", articleId: "g-art-pay" }, source: { document: "product", ownerId: "prod-alpha", articleId: "g-art-pay" } });
    expect(gray[0].message).toBe("「보험금의 지급사유」의 사본은 쓰이지 않습니다 — 상해사망(기본계약) 이(가) 조연결한 조라 잠겼습니다. 조연결한 담보를 해제하면 다시 쓰입니다");
    expect(b.complete).toBe(true);
  });

  it("잠기지 않은 조의 사본은 그대로 쓰이고 경고가 없다", () => {
    const b = run(withCopies({}, copyOf("g-art-def", "상품 정의")));
    expect(text(b.general!)).toContain("상품 정의");
    expect(b.issues.filter((i) => i.kind === "grayCopy")).toEqual([]);
  });

  it("잠금을 만든 담보가 기본계약이 아니게 되면(해제) 회색 사본이 다시 쓰인다", () => {
    const b = run(withCopies({ baseContractIds: [] }, copyOf("g-art-pay", "다시 쓰이는 사본")));
    expect(text(b.general!)).toContain("다시 쓰이는 사본");
    expect(b.issues.filter((i) => i.kind === "grayCopy")).toEqual([]);
  });

  it("잠금은 정적 연결 — 기본계약의 조건으로 빠지는 조가 연결한 자리도 잠긴다", () => {
    const input = withCopies({}, copyOf("g-art-exempt", "조건 안 연결 자리의 사본"));
    // 기본계약 문면에 거짓 조건 안의 조 — g-art-exempt 에 조연결
    const base = input.specialDocuments.get("cov-base-death")!;
    const docs = new Map(input.specialDocuments);
    docs.set("cov-base-death", { ...base, children: [...base.children, { id: "b-cond", kind: "condBlock", branches: [{ id: "b-cond-if", when: "D0005 = false", children: [{ id: "b-art-exempt", kind: "article", title: titleNodes("면책", "b-art-exempt"), linkedArticleId: "g-art-exempt", children: [] }] }] }] });
    const b = run({ ...input, specialDocuments: docs });
    expect(b.issues.filter((i) => i.kind === "grayCopy").map((i) => i.at.articleId)).toEqual(["g-art-exempt"]);
    expect(text(b.general!)).not.toContain("조건 안 연결 자리의 사본");
  });
});

describe("절 형태 — 블록이 조연결한 조(판정 대상)는 잠긴다", () => {
  it("기본계약 2개 — 연결 조의 사본은 판정에 들지 않는다(템플릿 제목 · 위임 문구) · grayCopy 경고는 제1절 이름공간", () => {
    const b = run(withCopies({ baseContractIds: ["pc-base", "pc-basic"] }, copyOf("g-art-pay", "사본 본문", "지급사유(상품)")));
    expect(text(b.general!)).not.toContain("지급사유(상품)");
    expect(text(b.general!)).toContain("제2조(보험금의 지급사유)는 제2절 보장조항에서 정합니다.");
    const gray = b.issues.find((i) => i.kind === "grayCopy");
    expect(gray?.at).toMatchObject({ articleId: "g-art-pay", section: { kind: "general", label: "제1절" } });
    expect(gray?.message).toContain("상해사망(기본계약) · 일반상해사망 이(가) 조연결한 조라 잠겼습니다");
  });
});
