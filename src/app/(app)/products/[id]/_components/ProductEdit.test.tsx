/**
 * 상품 상세의 편집 상태 — 편집 중 떠나는 조작(✕ 취소 · 탭 링크 · 경로 링크)의 가드 (점검 M21 · 디자인원칙 §1.7).
 * 클릭은 DOM 없이 재현할 수 없어 판정 함수와 서버 렌더 문자열로 본다 — 클릭 흐름은 E2E(T8) 몫.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));

import { leaveNeedsConfirm, ProductEditButtons, ProductEditProvider, ProductHeadActions } from "./ProductEdit";
import { ProductTabs } from "./ProductTabs";

describe("ProductEdit — 떠나는 조작의 판정 (M21)", () => {
  it("편집 중이고 고친 것이 있을 때만 「고친 내용을 버립니까?」", () => {
    expect(leaveNeedsConfirm({ editing: true, dirty: true })).toBe(true);
  });

  it("편집 중이어도 고친 것이 없으면 확인 없이 바로 (취소 · 탭 · 경로 모두)", () => {
    expect(leaveNeedsConfirm({ editing: true, dirty: false })).toBe(false);
  });

  it("읽기 중이면 묻지 않는다", () => {
    expect(leaveNeedsConfirm({ editing: false, dirty: true })).toBe(false);
  });
});

describe("ProductTabs — 편집 상태 안에서 그려진다", () => {
  const html = renderToStaticMarkup(
    <ProductEditProvider canEdit={false}>
      <ProductTabs productId="p1" current="special" />
    </ProductEditProvider>,
  );

  it("탭은 URL — 기본정보 · 상품담보 · 보통약관 · 특별약관 네 링크(한 줄)와 현재 탭 표시 (2026-10-03)", () => {
    const labels = [...html.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    expect(labels).toEqual(["기본정보", "상품담보", "보통약관", "특별약관"]);
    expect(html).toContain('href="/products/p1?tab=basic"');
    expect(html).toContain('href="/products/p1?tab=coverages"');
    expect(html).toContain('href="/products/p1?tab=general"');
    const current = html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0];
    expect(current).toContain('href="/products/p1?tab=special"');
  });

  it("둘째 줄 하위 탭은 없다 — nav 하나, sub= 없음", () => {
    expect(html.match(/<nav/g)).toHaveLength(1);
    expect(html).not.toContain("sub=");
    expect(html).not.toContain("ts-subtabs-second");
  });
});

describe("ProductHeadActions — 제목 줄 오른쪽 끝: 더보기 · 편집 조작 (2026-10-28, ADR-0094 — 영역 세그먼트가 상품명 옆이라 편집이 지금 영역의 것으로 읽힌다)", () => {
  const render = (canEdit: boolean, initialEditing = false) =>
    renderToStaticMarkup(
      <ProductEditProvider canEdit={canEdit} initialEditing={initialEditing}>
        <ProductHeadActions menu={[]} />
      </ProductEditProvider>,
    );

  it("편집이 있는 영역이면 ⋯ 다음 [편집] — 편집이 없는 영역은 ⋯ 만", () => {
    expect(render(true)).toMatch(/더보기[\s\S]*>편집</);
    expect(render(false)).toContain("더보기");
    expect(render(false)).not.toContain(">편집<");
  });

  it("편집 중에는 더보기를 비우고 ✕ [저장] — 미리보기 링크가 「버립니까?」 없이 떠나지 않게", () => {
    const html = render(true, true);
    expect(html).not.toContain("더보기");
    expect(html).toMatch(/aria-label="편집 취소"[\s\S]*>저장</);
  });
});

describe("ProductEditButtons — 편집 조작만 (상품담보 값 화면의 제목 줄)", () => {
  const render = (canEdit: boolean, initialEditing = false) =>
    renderToStaticMarkup(
      <ProductEditProvider canEdit={canEdit} initialEditing={initialEditing}>
        <ProductEditButtons />
      </ProductEditProvider>,
    );

  it("편집할 것이 없는 영역에는 버튼이 없다", () => {
    expect(render(false)).not.toContain("<button");
  });

  it("읽기는 [편집], 편집은 같은 자리에 ✕ [저장]", () => {
    expect(render(true)).toContain(">편집<");
    const editing = render(true, true);
    expect(editing).not.toContain(">편집<");
    expect(editing).toContain('aria-label="편집 취소"');
    expect(editing).toMatch(/border-mark[^>]*>저장</);
  });
});
