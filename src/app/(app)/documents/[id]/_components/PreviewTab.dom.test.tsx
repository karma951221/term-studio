// @vitest-environment jsdom
/**
 * 문면 편집기 미리보기 탭의 출처 패널 (기능/문면 §3.9 · 조립산출 §4.2) — 조를 누르면 탭 안에서 한 겹 덮어 그 조의 출처, ✕ 로 돌아옴.
 * 편집 중인 글로 계산하고, 「원본 조 열기」가 이 문서면 화면을 떠나지 않고 가운데 그 노드로 간다.
 * 표본은 축약 픽스처(알파Plus) — 담보약관 「일반상해사망」을 특약 「pc-addon」 문맥으로.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../preview-actions", () => ({ loadPreviewMaterialAction: async () => ({ ok: false, message: "테스트" }) }));

import { alphaDeathDocument, alphaPlusFixture } from "@/domain/assembly/fixture";

import { PreviewTab } from "./PreviewTab";
import type { PreviewSelection } from "./previewSelection";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const input = alphaPlusFixture();
const master = { ...input, documentIds: new Map([["s-doc-death", "rec-death"]]) };
const product = { product: input.product, coverages: input.coverages };
const selection: PreviewSelection = {
  products: [{ productId: "prod-alpha", productName: "알파Plus", productCoverageId: "pc-addon", productCoverageName: "일반상해사망 추가" }],
  selected: { productId: "prod-alpha", productName: "알파Plus", productCoverageId: "pc-addon", productCoverageName: "일반상해사망 추가" },
  pick: () => {},
  outcome: { ok: true, material: { master, product } },
};

function renderTab(tree = alphaDeathDocument(), openNode = vi.fn()) {
  render(<PreviewTab docKind="special" selection={selection} tree={tree} articleId="s-art-pay" editing openNode={openNode} />);
  return openNode;
}

describe("미리보기 탭 — 출처 패널 한 겹 덮기", () => {
  it("조를 누르면 미리보기 자리를 덮어 그 조의 출처, ✕ 로 미리보기로 돌아온다", () => {
    renderTab();
    const article = document.querySelector<HTMLElement>("[data-article='s-art-pay']")!;
    fireEvent.click(article.querySelector("h3")!);
    const panel = screen.getByRole("complementary", { name: "출처" });
    expect(panel.textContent).toMatch(/제1조\(보험금의 지급사유\)/);
    expect(article.closest("[hidden]")).not.toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: "출처 패널 닫기" }));
    expect(screen.queryByRole("complementary", { name: "출처" })).toBeNull();
    expect(article.closest("[hidden]")).toBeNull();
  });

  it("편집 중인 글로 계산한다 — 패널의 원본 · 값이 넘긴 트리", () => {
    const tree = alphaDeathDocument();
    const pay = tree.children[0];
    if (pay.kind !== "article" || pay.children[0].kind !== "paragraph" || pay.children[0].children[0].kind !== "text") throw new Error("픽스처 모양");
    pay.children[0].children[0].text = "편집 중인 회사는 ";
    renderTab(tree);
    fireEvent.click(document.querySelector<HTMLElement>("[data-article='s-art-pay'] h3")!);
    expect(screen.getByRole("complementary", { name: "출처" }).textContent).toContain("편집 중인 회사는");
  });

  it("「원본 조 열기」가 이 문서면 떠나지 않고 가운데 그 노드로 (openNode)", () => {
    window.history.replaceState(null, "", "/documents/rec-death");
    const openNode = renderTab();
    fireEvent.click(document.querySelector<HTMLElement>("[data-article='s-art-pay'] h3")!);
    const link = within(screen.getByRole("complementary", { name: "출처" })).getByRole("link", { name: /^원본 조 열기/ });
    expect(link.getAttribute("href")).toBe("/documents/rec-death?node=s-art-pay");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(openNode).toHaveBeenCalledWith("s-art-pay");
  });
});
