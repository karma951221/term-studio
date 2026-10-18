/**
 * 조연결 현황 패널 (기능/상품 §3.12 · §4.6) — 위 한 줄 `[조연결 현황]` 으로 펴고 접는다 · 칸 셋(연결함 · 안 함 · 조건으로 빠짐) · 행 끝 판정 · k/N.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: () => {}, refresh: () => {} }) }));

import type { LinkColumn, LinkRow } from "../../verdictView";
import { LinkStatusButton, LinkStatusPanel, LinkStatusProvider } from "./LinkStatus";
import { ProductEditProvider } from "./ProductEdit";

const columns: LinkColumn[] = [
  { productCoverageId: "pc-a", name: "상해사망", head: "1.", documentId: "doc-a", links: { a3: "제1조(지급사유)" } },
  { productCoverageId: "pc-b", name: "상해후유", head: "2.", documentId: "doc-b", links: { a3: "제1조(지급사유)" } },
];
const rows: LinkRow[] = [
  { articleId: "a3", label: "제3조(지급사유)", option: "none", cells: [{ kind: "linked", label: "제1조(지급사유)" }, { kind: "excluded", label: "제1조(지급사유)" }], result: "특칙", count: "1/2" },
  { articleId: "a4", label: "제4조(세부)", option: "common", cells: [{ kind: "linked", label: "제2조(세부)" }, { kind: "none" }], result: "특칙", count: "1/2", warning: "담보 1개가 … 연결되지 않은 담보: 상해후유" },
];

function view() {
  return render(
    <ProductEditProvider canEdit>
      <LinkStatusProvider>
        <LinkStatusButton />
        <LinkStatusPanel columns={columns} rows={rows} sectioned />
      </LinkStatusProvider>
    </ProductEditProvider>,
  );
}

afterEach(cleanup);

describe("LinkStatus — 조연결 현황", () => {
  it("처음엔 접혀 있고 [조연결 현황] 으로 펴고 다시 누르면 접힌다", () => {
    view();
    const button = screen.getByRole("button", { name: "조연결 현황" });
    expect(screen.queryByRole("region", { name: "조연결 현황" })).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "조연결 현황" })).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByRole("region", { name: "조연결 현황" })).toBeNull();
  });

  it("열 = 블록 머리 · 이름, 칸 = 연결한 블록 조 · 「연결했지만 조건으로 빠짐」 · 「연결 안 함」(담보약관으로), 행 끝 판정 k/N · 경고", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "조연결 현황" }));
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["템플릿 조", "준용하기", "1. 상해사망", "2. 상해후유", "판정"]);
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect([...first!.querySelectorAll("td")].map((td) => td.textContent)).toEqual(["없음", "제1조(지급사유)", "연결했지만 조건으로 빠짐", "특칙 1/2"]);
    expect([...second!.querySelectorAll("td")].map((td) => td.textContent)).toEqual(["공통항 모으기", "제2조(세부)", "연결 안 함", "특칙 1/2"]);
    expect(screen.getByRole("img", { name: "일부 연결 경고 · 제4조(세부)" }).getAttribute("title")).toContain("연결되지 않은 담보: 상해후유");
    fireEvent.click(screen.getByRole("link", { name: "연결 안 함" }));
    expect(push).toHaveBeenCalledWith("/documents/doc-b");
  });
});
