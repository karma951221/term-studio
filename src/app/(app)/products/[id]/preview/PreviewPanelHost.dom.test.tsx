// @vitest-environment jsdom
/**
 * 책자 미리보기 본문 클릭 → 출처 패널 대상 (기능/조립산출 §4.1) — 조 안 어디든 그 조, 값 조각이면 강조 노드, 생략 자리 줄이면 생략된 조.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/products/p/preview" }));

import { clickTarget } from "./PreviewPanelHost";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(html: string): void {
  document.body.innerHTML = html;
}

describe("clickTarget", () => {
  it("보통약관 조 안의 값 조각 — 조 id + 노드 id", () => {
    mount('<article class="ts-doc" data-owner="g" data-document="general"><section data-article="a1"><p><span id="x" data-n="slot1">50%</span></p></section></article>');
    expect(clickTarget(document.getElementById("x")!)).toEqual({ target: { document: "general", articleId: "a1" }, node: "slot1" });
  });

  it("특약 조 제목 — 상품담보 id (문서의 owner)", () => {
    mount('<article class="ts-doc" data-owner="pc1" data-document="special"><section data-article="s1"><h3 id="h">제1조</h3></section></article>');
    expect(clickTarget(document.getElementById("h")!)).toEqual({ target: { document: "special", productCoverageId: "pc1", articleId: "s1" } });
  });

  it("생략 자리 줄 — 생략된 조, 강조 노드 없음", () => {
    mount('<article class="ts-doc" data-owner="pc1" data-document="special"><p id="o" data-omitted-article="s9">(생략) …</p></article>');
    expect(clickTarget(document.getElementById("o")!)).toEqual({ target: { document: "special", productCoverageId: "pc1", articleId: "s9" } });
  });

  it("링크 · 본문 밖은 건드리지 않는다", () => {
    mount('<article class="ts-doc" data-owner="g" data-document="general"><section data-article="a1"><a id="l" href="#">x</a></section></article><p id="out">밖</p>');
    expect(clickTarget(document.getElementById("l")!)).toBeUndefined();
    expect(clickTarget(document.getElementById("out")!)).toBeUndefined();
  });
});
