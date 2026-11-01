// @vitest-environment jsdom
/**
 * 문서 저장 확인 모달 — 깨질 참조(ADR-0072 결정 6 · ADR-0081 결정 3)와 판정 변화(ADR-0082 결정 11 · ADR-0098 결정 7)를 한 창에.
 * 판정 변화 묶음은 상품담보 탭 확인 모달과 같은 줄(`JudgmentLines`)을 상품마다 묶는다. 막지 않는다 — 확인하면 저장.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Impact } from "@/domain/types";

import { DocumentSaveConfirm } from "./DocumentSaveConfirm";

const judgments: NonNullable<Impact["judgments"]> = [
  {
    productId: "p1",
    productName: "알파Plus보장보험",
    judgment: {
      verdicts: [],
      grayed: [],
      revived: [],
      brokenRefs: [],
      exclusions: [{ productCoverageId: "pc1", label: "알파Plus보장보험 · 일반상해사망보장", added: [], removed: [{ articleId: "g-a9", label: "제11조(적립부분 적립이율에 관한 사항)" }] }],
    },
  },
  {
    productId: "p2",
    productName: "표본 — 기본계약 2개(주계약)",
    judgment: { verdicts: [{ articleId: "g-a9", label: "제11조(적립부분 적립이율에 관한 사항)", before: "마스터", after: "특칙 1/2" }], grayed: [], revived: [], brokenRefs: [] },
  },
];

describe("DocumentSaveConfirm", () => {
  afterEach(cleanup);

  it("판정 변화만 — 제목 「저장하면 아래 내용이 함께 바뀝니다」 · 상품마다 묶음 · 준용예외 줄 · 〔바꾸고 저장〕", async () => {
    const onConfirm = vi.fn();
    render(<DocumentSaveConfirm impact={{ valueRowsLost: 0, cascade: [], brokenRefs: [], judgments }} onCancel={() => {}} onConfirm={onConfirm} />);
    const dialog = screen.getByRole("dialog", { name: "저장하면 아래 내용이 함께 바뀝니다" });
    expect(dialog.textContent).toContain("이 문서를 쓰는 상품 2개에서 판정이 바뀝니다");
    expect(screen.getByText("알파Plus보장보험", { exact: true })).toBeTruthy();
    expect(screen.getByText("준용예외가 바뀌는 특약")).toBeTruthy();
    expect(screen.getByText("알파Plus보장보험 · 일반상해사망보장 — 준용예외에 제11조(적립부분 적립이율에 관한 사항) 빠짐")).toBeTruthy();
    expect(screen.getByText("판정이 바뀌는 조")).toBeTruthy();
    expect(screen.getByText("제11조(적립부분 적립이율에 관한 사항) — 마스터 → 특칙 1/2")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "바꾸고 저장" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("깨질 참조만 — 옛 제목 · 〔참조 N건 끊고 저장〕, 판정 묶음 없음", () => {
    render(
      <DocumentSaveConfirm
        impact={{ valueRowsLost: 0, cascade: [], brokenRefs: [{ document: "special", ownerId: "c1", ownerName: "골절진단", subjectName: "제3조 조연결" }] }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: "저장하면 참조 1건이 깨진다" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "참조 1건 끊고 저장" })).toBeTruthy();
    expect(screen.queryByText(/판정이 바뀝니다/)).toBeNull();
  });

  it("둘 다 — 참조 제목 · 판정 묶음도 함께", () => {
    render(
      <DocumentSaveConfirm
        impact={{ valueRowsLost: 0, cascade: [], brokenRefs: [{ document: "special", ownerId: "c1", ownerName: "골절진단", subjectName: "제3조 조연결" }], judgments: judgments.slice(0, 1) }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: "저장하면 참조 1건이 깨진다" })).toBeTruthy();
    expect(screen.getByText(/이 문서를 쓰는 상품 1개에서 판정이 바뀝니다/)).toBeTruthy();
  });
});
