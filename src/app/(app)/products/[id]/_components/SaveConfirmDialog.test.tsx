// @vitest-environment jsdom
/**
 * 기본정보 저장 확인 모달 (2026-10-01) — 화면 위쪽 모달 · 서비스가 준 줄을 그대로 · 취소 / 바꾸고 저장.
 * Radix Dialog 는 포털이라 서버 렌더에 안 나온다 — jsdom 에서 role 로 본다.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaveConfirmDialog } from "./SaveConfirmDialog";

describe("SaveConfirmDialog", () => {
  afterEach(cleanup);
  const open = (impact: Parameters<typeof SaveConfirmDialog>[0]["impact"], handlers: { onCancel?: () => void; onConfirm?: () => void } = {}) => {
    render(<SaveConfirmDialog impact={impact} onCancel={handlers.onCancel ?? (() => {})} onConfirm={handlers.onConfirm ?? (() => {})} />);
    return screen.getByRole("dialog").innerHTML;
  };

  it("화면 위쪽 모달 — 제목 · 영향 줄 · 취소 / 바꾸고 저장(위험)", () => {
    const html = open({ valueRowsLost: 2, brokenRefs: [], cascade: ["보험종목 삭제 · 제2종(형)", "기본계약 해제 · 일반상해사망 — 상품담보는 특별약관 표에 남습니다"] });
    expect(screen.getByRole("dialog", { name: "저장하면 아래 내용이 함께 바뀝니다" })).toBeTruthy();
    expect(html).toContain("저장하면 아래 내용이 함께 바뀝니다");
    expect(html).toContain("<li>입력한 값 2건이 함께 삭제됩니다</li>");
    expect(html).toContain("<li>보험종목 삭제 · 제2종(형)</li>");
    expect(html).toContain("<li>기본계약 해제 · 일반상해사망 — 상품담보는 특별약관 표에 남습니다</li>");
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "바꾸고 저장" }).getAttribute("data-slot")).toBe("button");
  });

  it("잃는 값이 없으면 값 줄은 없다 — 기본계약 해제만", () => {
    const html = open({ valueRowsLost: 0, brokenRefs: [], cascade: ["기본계약 해제 · 일반상해사망 — 상품담보는 특별약관 표에 남습니다"] });
    expect(html).not.toContain("입력한 값");
    expect(html.match(/<li>/g)).toHaveLength(1);
  });

  it("판정 변화 (ADR-0082 결정 11) — 판정이 바뀌는 조(전 → 후) · 회색이 되는 사본 · 다시 쓰이는 사본 · 깨지는 참조 묶음", () => {
    const html = open({
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
  it("준용예외가 바뀌는 특약 (ADR-0098 결정 7) — 「상품 · 특약 — 준용예외에 제N조 추가 / 빠짐」 한 줄", () => {
    const html = open({
      valueRowsLost: 0,
      brokenRefs: [],
      cascade: [],
      judgment: { verdicts: [], grayed: [], revived: [], brokenRefs: [], exclusions: [{ productCoverageId: "pc1", label: "알파 · 암진단", added: [{ articleId: "a9", label: "제9조(적립이율)" }], removed: [{ articleId: "a5", label: "제5조(면책)" }] }] },
    });
    expect(html).toContain("준용예외가 바뀌는 특약");
    expect(html).toContain("<li>알파 · 암진단 — 준용예외에 제9조(적립이율) 추가 · 제5조(면책) 빠짐</li>");
  });
  it("특약 조 판정이 바뀌는 조 묶음", () => {
    const html = open({
      valueRowsLost: 0,
      brokenRefs: [],
      cascade: [],
      judgment: { verdicts: [], grayed: [], revived: [], brokenRefs: [], specials: [{ productCoverageId: "pc1", articleId: "b1", label: "암진단 › 제1조(보험금의 지급사유)", before: "통째", after: "생략" }] },
    });
    expect(html).toContain("특약 조 판정이 바뀌는 조");
    expect(html).toContain("<li>암진단 › 제1조(보험금의 지급사유) — 통째 → 생략</li>");
    expect(html).not.toContain(">판정이 바뀌는 조</span>");
  });

  it("취소 · Esc 는 onCancel, 「바꾸고 저장」은 onConfirm", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    open({ valueRowsLost: 1, brokenRefs: [], cascade: [] }, { onCancel, onConfirm });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "바꾸고 저장" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
