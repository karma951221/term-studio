// @vitest-environment jsdom
/**
 * 출처 패널 자리 (기능/조립산출 §4.1 · §4.2) — 본문 클릭 → 패널 대상, URL 에 패널을 합치기(화면 쿼리 지키기), 한 겹 덮기.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/products/p" }));

import { clickTarget, PreviewPanelHost, SourceOverlay } from "./PanelHost";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  push.mockReset();
  window.history.replaceState(null, "", "/");
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

  it("조 하나만 그린 자리(문면 편집기 미리보기 탭) — 문서 표지가 감싼 div 여도 된다", () => {
    mount('<div class="ts-doc" data-owner="pc1" data-document="special"><section data-article="s1"><p id="p">본문</p></section></div>');
    expect(clickTarget(document.getElementById("p")!)).toEqual({ target: { document: "special", productCoverageId: "pc1", articleId: "s1" } });
  });

  it("생략 자리 줄 — 생략된 조, 강조 노드 없음", () => {
    mount('<article class="ts-doc" data-owner="pc1" data-document="special"><p id="o" data-omitted-article="s9">(생략) …</p></article>');
    expect(clickTarget(document.getElementById("o")!)).toEqual({ target: { document: "special", productCoverageId: "pc1", articleId: "s9" } });
  });

  it("링크 · 본문 밖 · 출처 패널 안은 건드리지 않는다", () => {
    mount('<article class="ts-doc" data-owner="g" data-document="general"><section data-article="a1"><a id="l" href="#">x</a></section></article><p id="out">밖</p><div class="ts-src-body ts-doc"><section data-article="a1"><p id="in">패널</p></section></div>');
    expect(clickTarget(document.getElementById("l")!)).toBeUndefined();
    expect(clickTarget(document.getElementById("out")!)).toBeUndefined();
    expect(clickTarget(document.getElementById("in")!)).toBeUndefined();
  });
});

const doc = (
  <article className="ts-doc" data-owner="pc2" data-document="special">
    <section data-article="s1">
      <p>본문 조</p>
    </section>
  </article>
);

describe("PreviewPanelHost — 오른쪽 고정 패널: URL 에 패널을 합친다", () => {
  beforeEach(() => window.history.replaceState(null, "", "/products/p?tab=special&cov=c1&pc=pc1"));

  it("조를 누르면 화면 쿼리를 지키고 패널 키를 붙인다 — 화면이 쓰는 pc(own)는 대상 상품담보로", () => {
    render(
      <PreviewPanelHost state={{ showOmitted: true }} own={["pc"]}>
        {doc}
      </PreviewPanelHost>,
    );
    fireEvent.click(screen.getByText("본문 조"));
    expect(push).toHaveBeenCalledWith("/products/p?tab=special&cov=c1&pc=pc2&article=s1", { scroll: false });
  });

  it("✕ — 패널 키만 뺀다(own 은 남는다)", () => {
    window.history.replaceState(null, "", "/products/p?tab=special&pc=pc2&article=s1");
    render(
      <PreviewPanelHost content={{ state: "error", message: "x" }} state={{ target: { document: "special", productCoverageId: "pc2", articleId: "s1" }, showOmitted: true }} own={["pc"]}>
        {doc}
      </PreviewPanelHost>,
    );
    fireEvent.click(screen.getByRole("button", { name: "출처 패널 닫기" }));
    expect(push).toHaveBeenCalledWith("/products/p?tab=special&pc=pc2", { scroll: false });
  });
});

describe("SourceOverlay — 미리보기 패널 안에서 한 겹 덮기", () => {
  it("열리면 미리보기는 숨기고(자리 유지) 출처 패널을 그 자리에, ✕ 는 닫기 콜백", () => {
    const onClose = vi.fn();
    render(
      <SourceOverlay content={{ state: "error", message: "설명 실패" }} onClose={onClose}>
        <p>미리보기 본문</p>
      </SourceOverlay>,
    );
    expect(screen.getByText("미리보기 본문").closest("[hidden]")).not.toBeNull();
    expect(screen.getByRole("complementary", { name: "출처" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "출처 패널 닫기" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("닫혀 있으면 미리보기 그대로 — 패널 없음", () => {
    render(
      <SourceOverlay onClose={() => {}}>
        <p>미리보기 본문</p>
      </SourceOverlay>,
    );
    expect(screen.getByText("미리보기 본문").closest("[hidden]")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "출처" })).toBeNull();
  });
});
