/**
 * 생략 기준 해소 → 특약 판정 (ADR-0093 결정 3 · 6) — 실효 기준은 상품 표 → 템플릿 원본 조에서만 읽는다.
 * 픽스처: 일반상해사망 특약의 「보험금의 감액지급」(g-art-refund 연결)을 첫 항만 남겨 특약 ⊂ 보통약관으로 만든다.
 */
import { describe, expect, it } from "vitest";

import type { ArticleNode, ArticleOmitMode, DocumentNode } from "../document/nodes";
import type { Id } from "../types";
import { assemble } from "./booklet";
import { alphaPlusFixture } from "./fixture";
import type { AssemblyInput, Booklet } from "./types";

function containedFixture(opts: { template?: boolean; product?: ReadonlyMap<Id, ArticleOmitMode>; copy?: boolean } = {}): AssemblyInput {
  const input = alphaPlusFixture();
  const special = structuredClone(input.specialDocuments.get("cov-death")!) as DocumentNode;
  const reduce = special.children.find((c) => c.id === "s-art-reduce") as ArticleNode;
  reduce.children = reduce.children.filter((c) => c.id === "s-par-refund-1");
  const general = structuredClone(input.generalDocuments.get("g-doc")!) as DocumentNode;
  const refund = general.children.find((c) => c.id === "g-art-refund") as ArticleNode;
  if (opts.template) refund.omitMode = "contained";
  const product = {
    ...input.product,
    ...(opts.product ? { articleOmitModes: opts.product } : {}),
    // 사본에 남은 omitMode 는 읽지 않는다 — 템플릿 원본만
    ...(opts.copy ? { articleCopies: new Map([["g-art-refund", { ...refund, omitMode: "contained" as const }]]) } : {}),
  };
  return {
    ...input,
    product,
    generalDocuments: new Map([["g-doc", general]]),
    specialDocuments: new Map([...input.specialDocuments, ["cov-death", special]]),
  };
}

const shownSpecialIds = (b: Booklet) => b.specials.flatMap((g) => g.docs.flatMap((d) => d.children.flatMap((c) => (c.kind === "article" ? [c.id] : []))));
const recordOf = (b: Booklet) => b.omitted.find((o) => o.articleId === "s-art-reduce")!;

describe("포함 생략 — 해소 순위 · 판정 기록 (ADR-0093)", () => {
  it("포함 관계 특약 조 — 기본은 통째로 찍힌다 · 템플릿 「포함하면」이면 책자에서 빠지고 기록 basis contained · omitRule template · 상품 exact 면 다시 통째 · 상품 contained(템플릿 없음)면 source product", () => {
    const plain = assemble(containedFixture(), containedFixture());
    expect(shownSpecialIds(plain)).toContain("s-art-reduce");
    expect(recordOf(plain).disposition).toBe("full");
    expect("omitRule" in recordOf(plain)).toBe(false);

    const tpl = containedFixture({ template: true });
    const byTemplate = assemble(tpl, tpl);
    expect(shownSpecialIds(byTemplate)).not.toContain("s-art-reduce");
    expect(recordOf(byTemplate)).toMatchObject({ disposition: "omitted", basis: "contained", omitRule: { mode: "contained", source: "template" } });

    const off = containedFixture({ template: true, product: new Map([["g-art-refund", "exact"]]) });
    const offBooklet = assemble(off, off);
    expect(shownSpecialIds(offBooklet)).toContain("s-art-reduce");
    expect(recordOf(offBooklet).disposition).toBe("full");
    expect("omitRule" in recordOf(offBooklet)).toBe(false);

    const prod = containedFixture({ product: new Map([["g-art-refund", "contained"]]) });
    expect(recordOf(assemble(prod, prod))).toMatchObject({ disposition: "omitted", basis: "contained", omitRule: { mode: "contained", source: "product" } });
  });

  it("조 사본에 복사된 omitMode 는 읽지 않는다 — 템플릿 원본에 없으면 통째", () => {
    const copied = containedFixture({ copy: true });
    const b = assemble(copied, copied);
    expect(recordOf(b).disposition).toBe("full");
    expect("omitRule" in recordOf(b)).toBe(false);
  });
});
