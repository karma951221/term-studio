// @vitest-environment jsdom
/**
 * 출처 패널 — 덧칠한 원본의 배치 · 문구 (기능/조립산출 §3.7 · §4.1). 표본은 축약 픽스처(알파Plus)를 실제로 조립 · 설명한 결과.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assemble, buildSourceView, explainArticle, type ExplainTarget } from "@/domain/assembly";
import { alphaPlusFixture } from "@/domain/assembly/fixture";

import { SourcePanel } from "./SourcePanel";

afterEach(cleanup);

const input = alphaPlusFixture();
const booklet = assemble(input, input);
const view = (target: ExplainTarget) => buildSourceView(input, input, explainArticle(input, input, target), booklet);

describe("머리 — 결과 자리 · 원본 종류 · 이동 아이콘 · 닫기", () => {
  it("특약 조 — 결과 자리 · 「담보약관」 · 원본 조 · 상품 구성 아이콘 링크(tooltip) · ✕ 가 닫기 콜백", async () => {
    const onClose = vi.fn();
    render(<SourcePanel content={{ state: "ok", view: view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-pay" }) }} onClose={onClose} />);
    const panel = screen.getByRole("complementary", { name: "출처" });
    expect((panel).textContent).toMatch(/특별약관 › 제\d+조\(보험금의 지급사유\)/);
    expect(within(panel).getByText("담보약관")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: /^원본 조 열기/ }).getAttribute("href")).toBe("/documents/s-doc-death?node=s-art-pay");
    expect(within(panel).getByRole("link", { name: /^상품 구성 열기/ }).getAttribute("href")).toBe("/products/prod-alpha/coverages/pc-basic");
    expect(within(panel).queryByRole("link", { name: /미리보기로/ })).toBeNull();
    await userEvent.click(within(panel).getByRole("button", { name: "출처 패널 닫기" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("기본계약 대치 — 대치 한 줄", () => {
    render(<SourcePanel content={{ state: "ok", view: view({ document: "general", articleId: "g-art-pay" }) }} onClose={() => {}} />);
    expect(screen.getByText("보통약관 제2조 자리 ← 기본계약 「상해사망(기본계약)」 담보약관 제1조 (조연결)")).toBeTruthy();
  });
});

describe("본문 — 덧칠", () => {
  it("인라인 조건: 탄 가지 진하게 · 안 탄 가지 회색 + 표식 · 값 자리에 들어간 값", () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-pay" }) }} onClose={() => {}} />);
    const branches = [...container.querySelectorAll('[data-node="s-inl-renew"] > .ts-src-branch')];
    expect(branches.map((b) => b.getAttribute("data-outcome"))).toEqual(["false", "taken"]);
    expect(branches[0].className).toContain("is-dim");
    expect(branches[1].className).toContain("is-taken");
    expect((branches[0]).textContent).toMatch("거짓");
    const slot = container.querySelector('[data-node="s-slot-rate"]')!;
    expect(slot.querySelector(".ts-src-value")?.textContent).toMatch(/^ = .+/);
  });

  it("조 자리 조건 — 조건으로 빠진 조: 「조건으로 빠짐」 + 감싼 조건의 가지", () => {
    const v = view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-exempt" });
    render(<SourcePanel content={{ state: "ok", view: v }} onClose={() => {}} />);
    if (v.explanation.status === "absent") {
      expect(screen.getByText("이 상품에서는 조건으로 빠짐")).toBeTruthy();
      expect((screen.getByRole("region", { name: "조 자리 조건" })).textContent).toMatch("D0005 = true");
    } else {
      expect((screen.getByRole("region", { name: "조 자리 조건" })).textContent).toMatch("탐");
    }
  });

  it("함수조항 — 접힌 호출 줄(이름 · 옵션 · 정의 링크) → 펼치면 본문", async () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-lapse" }) }} onClose={() => {}} />);
    const call = container.querySelector('[data-node="s-clause-lapse"]')!;
    expect((call).textContent).toMatch("옵션: O01 = V02");
    expect(within(call as HTMLElement).getByRole("link", { name: /^함수조항 정의 열기/ }).getAttribute("href")).toBe("/functions/C0001");
    expect(call.querySelector(".ts-src-call-body")).toBeNull();
    await userEvent.click(within(call as HTMLElement).getByRole("button", { name: /^펼치기/ }));
    expect(call.querySelector(".ts-src-call-body")).not.toBeNull();
  });

  it("강조 — 누른 값 조각의 원본 자리", () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: view({ document: "special", productCoverageId: "pc-basic", articleId: "s-art-pay" }) }} focus="s-slot-rate" onClose={() => {}} />);
    expect(container.querySelector('[data-node="s-slot-rate"]')!.className).toContain("is-focus");
  });

  it("생략된 조 — 생략 근거(항별 대조)", () => {
    const o = booklet.omitted.find((x) => x.disposition === "omitted")!;
    render(<SourcePanel content={{ state: "ok", view: view({ document: "special", productCoverageId: o.productCoverageId, articleId: o.articleId }) }} onClose={() => {}} />);
    expect(screen.getByText(/^이 상품 결과에서 생략 — 보통약관 제\d+조\(.+\)와 같음/)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "보통약관 항" })).toBeTruthy();
  });
});

describe("상태", () => {
  it("오래된 결과 — 차단 문구 + 다시 실행(화면이 넣은 폼)", () => {
    render(<SourcePanel content={{ state: "stale" }} onClose={() => {}} rerun={<button type="submit">다시 실행</button>} />);
    expect((screen.getByRole("status")).textContent).toMatch("입력이 바뀌어 출처를 볼 수 없습니다 — 다시 실행");
    expect(screen.getByRole("button", { name: "다시 실행" })).toBeTruthy();
  });
});
