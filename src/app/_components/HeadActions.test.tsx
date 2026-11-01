/**
 * 제목 줄 조작 줄 — 글자 버튼과 아이콘 버튼이 한 조작군: 높이 32 · 모서리 6 · 테두리가 같다 (디자인원칙 §1.9, 2026-10-28).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeadActions, HeadButton, HeadIconButton } from "./HeadActions";
import { MoreMenu } from "./MoreMenu";

// 높이 32 — 글자 버튼은 h-8, 아이콘 버튼은 size-8(32×32)
const SAME_BOX = ["rounded-md", "border"];
const classOf = (html: string, name: string) => html.match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*(?:aria-label="${name}"|>${name}<)`))?.[1] ?? "";

describe("HeadActions — 제목 줄 오른쪽 조작 줄", () => {
  const html = renderToStaticMarkup(
    <HeadActions>
      <MoreMenu items={[{ label: "삭제", href: "?confirm=x", danger: true }]} />
      <HeadIconButton label="편집 취소" icon={<svg />} />
      <HeadButton primary>저장</HeadButton>
    </HeadActions>,
  );

  it("더보기 · ✕ · 저장 모두 같은 상자 — 높이 32 · 모서리 6 · 테두리", () => {
    for (const name of ["더보기", "편집 취소", "저장"]) {
      const cls = classOf(html, name).split(/\s+/);
      for (const c of SAME_BOX) expect(cls, `${name} 에 ${c}`).toContain(c);
      expect(cls.includes("h-8") || cls.includes("size-8"), `${name} 높이 32`).toBe(true);
    }
  });

  it("아이콘 버튼은 이름을 title · aria-label 로 — 더보기는 ⋯ 아이콘", () => {
    expect(html).toContain('title="더보기" aria-label="더보기"');
    expect(html).toContain('title="편집 취소" aria-label="편집 취소"');
    expect(html).not.toMatch(/>더보기</);
  });

  it("주 동작 저장은 주칠 테두리", () => {
    expect(html).toMatch(/<button[^>]*data-variant="primary"[^>]*>저장</);
  });

  it("삭제 아이콘(danger)도 테두리 — 평소 뉴트럴, hover 에서만 error", () => {
    const del = renderToStaticMarkup(<HeadIconButton label="별표 삭제" icon={<svg />} danger />);
    expect(del).toContain("ts-iconbtn danger");
    expect(del).toMatch(/data-variant="destructive"/);
  });
});
