// @vitest-environment jsdom
/**
 * 조립 검사 한 줄 (디자인원칙 §9.2 · 기능/조립산출 §4.1) — 평가 대기 c · 막힌 분기 목록 · 옛 산출본 고정 문구.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PendingBranch } from "@/domain/assembly";
import type { Issue } from "@/domain/types";

import { AssemblyCheckLine } from "./AssemblyCheckLine";

afterEach(cleanup);

const issue: Issue = { kind: "notEntered", message: "갱신여부 미입력", at: {} };
const pending: PendingBranch = {
  nodeId: "b-cond",
  at: { document: "special", ownerId: "pc-1", ownerName: "일반상해사망", articleId: "s-a", articleTitle: "막힘", articleNumber: 3 },
  source: { document: "product", ownerId: "p1", nodePath: ["pc-1"] },
  message: "갱신여부 미입력",
};

describe("AssemblyCheckLine", () => {
  it("옛 산출본(pending 없음) — 고정 문구 그대로", () => {
    const { container } = render(<AssemblyCheckLine issues={[issue]} />);
    expect(container.textContent).toContain("조립 검사: 오류 1 · 경고 0 — 분기 미결로 미검사 범위가 있을 수 있음");
    expect(container.textContent).toContain("내용 검토: 미실시");
  });

  it("막힌 분기 0 — 「평가 대기 0」을 붙인다", () => {
    const { container } = render(<AssemblyCheckLine issues={[]} pending={[]} />);
    expect(container.textContent).toBe("조립 검사: 오류 0 · 경고 0 · 평가 대기 0 · 내용 검토: 미실시");
  });

  it("막힌 분기 c — 「평가 대기 c」를 누르면 목록: 결과 자리 · 원인 · 미리보기에서 보기 · 고치러 가기", () => {
    const { container } = render(<AssemblyCheckLine issues={[issue]} pending={[pending]} viewHref={(p) => `?article=${p.at.articleId}&node=${p.nodeId}`} />);
    expect(container.querySelector("summary")!.textContent).toBe("조립 검사: 오류 1 · 경고 0 · 평가 대기 1 · 내용 검토: 미실시");
    const list = screen.getByRole("list", { name: "평가 대기 — 막힌 분기" });
    expect(list.textContent).toContain("제3조(막힘) — 갱신여부 미입력");
    expect(screen.getByRole("link", { name: "미리보기에서 보기" }).getAttribute("href")).toBe("?article=s-a&node=b-cond");
    expect(screen.getByRole("link", { name: "고치러 가기" }).getAttribute("href")).toBe("/products/p1/coverages/pc-1");
  });
});
