// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { nodeBuilders, sequentialIds, type ArticleNode, type EditOp } from "@/domain/document";

import { alwaysSubmittable, articleOptionOps, followUpSpec, formSnapshot, panelTabsFor, pickedOf, submitLabel, tabOnEnterEdit, tabOnLeaveEdit, tabOnPick, useEditGuard } from "./editTabRules";

describe("우측 패널 탭 — 편집 탭은 편집 모드에만 맨 앞", () => {
  it("읽기 모드엔 편집 탭이 없다", () => {
    expect(panelTabsFor("special", false)).toEqual(["preview", "leaves", "issues"]);
    expect(panelTabsFor("general", false)).toEqual(["preview", "issues"]);
  });
  it("편집 모드면 맨 앞에 편집", () => {
    expect(panelTabsFor("special", true)).toEqual(["edit", "preview", "leaves", "issues"]);
  });
  it("편집에 들어가면 편집 탭으로 — 끝나면 들어오기 전 탭으로", () => {
    const s = tabOnEnterEdit({ tab: "issues", before: "preview" });
    expect(s).toEqual({ tab: "edit", before: "issues" });
    expect(tabOnLeaveEdit(s)).toEqual({ tab: "issues", before: "issues" });
  });
  it("편집 중 다른 탭으로 옮겨 두었으면 끝나도 그 탭", () => {
    expect(tabOnLeaveEdit({ tab: "leaves", before: "preview" })).toEqual({ tab: "leaves", before: "preview" });
  });
  it("무언가 고르면 편집 탭으로 — 돌아갈 탭은 고르기 직전 탭, 이미 편집 탭이면 그대로", () => {
    expect(tabOnPick({ tab: "preview", before: "issues" })).toEqual({ tab: "edit", before: "preview" });
    expect(tabOnPick({ tab: "edit", before: "issues" })).toEqual({ tab: "edit", before: "issues" });
  });
});

describe("편집 탭 폼의 주 버튼", () => {
  it("넣기 폼은 「넣기」, 고치기 폼은 「적용」", () => {
    expect(submitLabel({ kind: "newTable", at: { parentId: "a", slot: "children", index: 0 } })).toBe("넣기");
    expect(submitLabel({ kind: "repeatBlock", at: { parentId: "a", slot: "children", index: 0 } })).toBe("넣기");
    expect(submitLabel({ kind: "repeatBlock", nodeId: "f" })).toBe("적용");
    expect(submitLabel({ kind: "editChip", nodeId: "c" })).toBe("적용");
  });
  it("넣기 · 추천값으로 연 코드 고치기는 고친 것이 없어도 누를 수 있다", () => {
    expect(alwaysSubmittable({ kind: "boxPick", at: { parentId: "a", slot: "children", index: 0 } })).toBe(true);
    expect(alwaysSubmittable({ kind: "code", nodeId: "p", suggest: true })).toBe(true);
    expect(alwaysSubmittable({ kind: "code", nodeId: "p" })).toBe(false);
    expect(alwaysSubmittable({ kind: "editChip", nodeId: "c" })).toBe(false);
  });
});

describe("고른 것 — 본문 테두리 자리", () => {
  it("칩 · 블록은 그 노드, 조건 머리는 그 가지 머리", () => {
    expect(pickedOf({ kind: "editChip", nodeId: "c" })).toEqual({ id: "c" });
    expect(pickedOf({ kind: "condHead", branchId: "b" })).toEqual({ id: "b", head: true });
    expect(pickedOf({ kind: "link", articleId: "a" })).toEqual({ id: "a" });
    expect(pickedOf({ kind: "docTitle" })).toBeUndefined();
  });
});

describe("넣은 뒤 이어 열 폼 — 새 칩 · 블록이 고른 것이 된다", () => {
  const at = { parentId: "a", slot: "children" as const, index: 0 };
  it("문장에 넣은 칩이면 그 칩의 고치기", () => {
    const ops: EditOp[] = [{ type: "setInlines", at: { parentId: "p" }, runs: [{ id: "t1" }, { node: { id: "s1", kind: "slot", ref: "D1" } }] } as unknown as EditOp];
    expect(followUpSpec(ops)).toEqual({ kind: "editChip", nodeId: "s1" });
  });
  it("함수조항 · 동적표 · 반복 · 표는 그 속성 폼, 박스는 없음", () => {
    expect(followUpSpec([{ type: "insert", at, node: { id: "c", kind: "clauseBlockRef", clauseCode: "C1", options: {} } } as unknown as EditOp])).toEqual({ kind: "editChip", nodeId: "c" });
    expect(followUpSpec([{ type: "insert", at, node: { id: "f", kind: "forBlock" } } as unknown as EditOp])).toEqual({ kind: "repeatBlock", nodeId: "f" });
    expect(followUpSpec([{ type: "insert", at, node: { id: "t", kind: "table" } } as unknown as EditOp])).toEqual({ kind: "tableProps", tableId: "t" });
    expect(followUpSpec([{ type: "insert", at, node: { id: "x", kind: "boxRef", boxCode: "B1" } } as unknown as EditOp])).toBeUndefined();
  });
});

describe("폼 값 스냅숏 — 고친 것이 있는가", () => {
  it("순서가 달라도 같은 값이면 같다", () => {
    expect(formSnapshot([["a", "1"], ["b", "2"]])).toBe(formSnapshot([["b", "2"], ["a", "1"]]));
    expect(formSnapshot([["a", "1"]])).not.toBe(formSnapshot([["a", "2"]]));
  });
});

describe("미적용 가로채기 — 적용하지 않은 변경이 있으면 확인 카드", () => {
  it("고친 것이 없으면 곧바로 돈다", () => {
    const { result } = renderHook(() => useEditGuard(false));
    const run = vi.fn();
    act(() => result.current.guard(run));
    expect(run).toHaveBeenCalledOnce();
    expect(result.current.pending).toBe(false);
  });
  it("고친 것이 있으면 멈추고 카드 — 돌아가기면 버린다", () => {
    const { result } = renderHook(() => useEditGuard(true));
    const run = vi.fn();
    act(() => result.current.guard(run));
    expect(run).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);
    act(() => result.current.resolve("stay", () => true));
    expect(run).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
  it("버리기면 적용하지 않고 돈다", () => {
    const { result } = renderHook(() => useEditGuard(true));
    const run = vi.fn();
    const apply = vi.fn(() => true);
    act(() => result.current.guard(run));
    act(() => result.current.resolve("discard", apply));
    expect(apply).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
  });
  it("적용이면 적용하고 돈다 — 적용이 거부되면 돌지 않고 폼에 남는다", () => {
    const { result } = renderHook(() => useEditGuard(true));
    const run = vi.fn();
    act(() => result.current.guard(run));
    act(() => result.current.resolve("apply", () => false));
    expect(run).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
    act(() => result.current.guard(run));
    act(() => result.current.resolve("apply", () => true));
    expect(run).toHaveBeenCalledOnce();
  });
});

describe("조 옵션 폼 (보통약관 템플릿 · ADR-0082 결정 5 · ADR-0093)", () => {
  const b = nodeBuilders(sequentialIds("o"));
  const art = (extra: Partial<ArticleNode> = {}): ArticleNode => ({ ...b.article("지급사유", []), ...extra });

  it("준용하기 · 생략 기준 폼 — 바뀐 값만 명령으로, 둘 다 그대로면 빈 목록, 「같을 때만」은 omitMode exact(속성 삭제)", () => {
    const plain = art();
    expect(articleOptionOps(plain, "none", "exact")).toEqual([]);
    expect(articleOptionOps(plain, "common", "exact")).toEqual([{ type: "joinMode", articleId: plain.id, mode: "common" }]);
    expect(articleOptionOps(plain, "none", "contained")).toEqual([{ type: "omitMode", articleId: plain.id, mode: "contained" }]);
    const both = art({ joinMode: "all", omitMode: "contained" });
    expect(articleOptionOps(both, "all", "contained")).toEqual([]);
    expect(articleOptionOps(both, "none", "exact")).toEqual([
      { type: "joinMode", articleId: both.id, mode: "none" },
      { type: "omitMode", articleId: both.id, mode: "exact" },
    ]);
    // 모르는 값은 기본(없음 · 같을 때만)으로
    expect(articleOptionOps(both, "??", "??")).toEqual([
      { type: "joinMode", articleId: both.id, mode: "none" },
      { type: "omitMode", articleId: both.id, mode: "exact" },
    ]);
    expect(articleOptionOps(plain, "??", "??")).toEqual([]);
  });
});
