/**
 * 기본정보 저장 확인 모달 (2026-10-01) — 화면 위쪽 모달 · 서비스가 준 줄을 그대로 · 취소 / 바꾸고 저장.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SaveConfirmDialog } from "./SaveConfirmDialog";

describe("SaveConfirmDialog", () => {
  const render = (impact: Parameters<typeof SaveConfirmDialog>[0]["impact"]) =>
    renderToStaticMarkup(<SaveConfirmDialog impact={impact} onCancel={() => {}} onConfirm={() => {}} />);

  it("화면 위쪽 모달 — 제목 · 영향 줄 · 취소 / 바꾸고 저장(위험)", () => {
    const html = render({ valueRowsLost: 2, brokenRefs: [], cascade: ["보험종목 삭제 · 제2종(형)", "기본계약 해제 · 일반상해사망 — 상품담보는 특별약관 표에 남습니다"] });
    expect(html).toContain('class="ts-dialog ts-dialog-top"');
    expect(html).toContain("저장하면 아래 내용이 함께 바뀝니다");
    expect(html).toContain("<li>입력한 값 2건이 함께 삭제됩니다</li>");
    expect(html).toContain("<li>보험종목 삭제 · 제2종(형)</li>");
    expect(html).toContain("<li>기본계약 해제 · 일반상해사망 — 상품담보는 특별약관 표에 남습니다</li>");
    expect(html).toMatch(/<button type="button"[^>]*>취소<\/button>/);
    expect(html).toMatch(/<button type="button" class="danger"[^>]*>바꾸고 저장<\/button>/);
  });

  it("잃는 값이 없으면 값 줄은 없다 — 기본계약 해제만", () => {
    const html = render({ valueRowsLost: 0, brokenRefs: [], cascade: ["기본계약 해제 · 일반상해사망 — 상품담보는 특별약관 표에 남습니다"] });
    expect(html).not.toContain("입력한 값");
    expect(html.match(/<li>/g)).toHaveLength(1);
  });

  it("판정 변화 (ADR-0082 결정 11) — 판정이 바뀌는 조(전 → 후) · 회색이 되는 사본 · 다시 쓰이는 사본 · 깨지는 참조 묶음", () => {
    const html = render({
      valueRowsLost: 0,
      brokenRefs: [],
      cascade: [],
      judgment: {
        verdicts: [{ articleId: "a3", label: "제3조(지급사유)", before: "위임 2/2", after: "위임 1/1" }],
        grayed: [{ articleId: "a4", label: "제4조(세부규정)" }],
        revived: [],
        brokenRefs: [{ articleId: "a25", label: "제25조(계약의 소멸)", message: "블록 「갑」이 이 상품의 블록이 아닙니다" }],
      },
    });
    expect(html).toContain("판정이 바뀌는 조");
    expect(html).toContain("<li>제3조(지급사유) — 위임 2/2 → 위임 1/1</li>");
    expect(html).toContain("회색이 되는 사본");
    expect(html).toContain("<li>제4조(세부규정) — 사본이 쓰이지 않습니다(지우지 않는다)</li>");
    expect(html).not.toContain("다시 쓰이는 사본");
    expect(html).toContain("깨지는 참조");
    expect(html).toContain("<li>제25조(계약의 소멸) — 블록 「갑」이 이 상품의 블록이 아닙니다</li>");
  });
  it("특약 조 판정이 바뀌는 조 묶음", () => {
    const html = render({
      valueRowsLost: 0,
      brokenRefs: [],
      cascade: [],
      judgment: { verdicts: [], grayed: [], revived: [], brokenRefs: [], specials: [{ productCoverageId: "pc1", articleId: "b1", label: "암진단 › 제1조(보험금의 지급사유)", before: "통째", after: "생략" }] },
    });
    expect(html).toContain("특약 조 판정이 바뀌는 조");
    expect(html).toContain("<li>암진단 › 제1조(보험금의 지급사유) — 통째 → 생략</li>");
    expect(html).not.toContain(">판정이 바뀌는 조</span>");
  });
});
