/**
 * 조 편집 패널의 툴바 · 오른쪽 클릭 목록 (ADR-0079 · 기능/상품 §4.6) — 문면 저작 목록을 그대로 짓고, 조 밖을 바꾸는 항목을 잠근다.
 */
import { describe, expect, it } from "vitest";

import { placeMenu, type MenuEnv } from "@/app/(app)/documents/[id]/_components/menus";
import { indexTree, type DocumentNode } from "@/domain/document";

import { BLOCK_REF_ITEM, COPY_REFUSAL, copyScopeMenu, withBlockRefItems } from "./copyMenus";
import { titleNodes } from "@/domain/document/title";

const tree: DocumentNode = {
  id: "doc",
  kind: "document",
  title: "보통약관",
  children: [
    { id: "a1", kind: "article", title: titleNodes("목적", "a1"), children: [{ id: "p1", kind: "paragraph", children: [{ id: "t1", kind: "text", text: "본문" }] }] },
    { id: "a2", kind: "article", title: titleNodes("지급", "a2"), children: [] },
  ],
};
let n = 0;
const env: MenuEnv = { tree, ix: indexTree(tree), docKind: "general", newId: () => `new-${++n}` };
const state = (sections: ReturnType<typeof copyScopeMenu>, label: string) => {
  const item = sections.flat().find((i) => i.label === label);
  return item ? (item.refusal ? "잠김" : "열림") : "없음";
};

describe("copyScopeMenu — 조 사본은 그 조 안만", () => {
  it("조 제목 자리 — 조 · 관 넣기 · 조 옮기기 · 복제 · 삭제 · 조 감싸기는 잠그고, 조 안에 넣기는 연다", () => {
    const place = { kind: "articleTitle", id: "a1" } as const;
    const sections = copyScopeMenu(placeMenu(env, place), place, "a1");
    // 준용하기 옵션은 템플릿 조의 속성이다 — 사본에서 바꾸지 않는다 (ADR-0082 결정 5)
    for (const label of ["아래에 조 추가", "아래에 관 추가", "아래로", "복제", "삭제", "조건으로 감싸기", "준용하기…"]) expect(state(sections, label)).toBe("잠김");
    for (const label of ["항 추가", "함수조항 참조 추가…", "박스 추가…"]) expect(state(sections, label)).toBe("열림");
    expect(sections.flat().find((i) => i.label === "삭제")?.refusal).toBe(COPY_REFUSAL);
  });

  it("조 안의 블록 — 블록 넣기 · 옮기기 · 복제 · 삭제 · 감싸기는 그대로", () => {
    const place = { kind: "block", id: "p1" } as const;
    const sections = copyScopeMenu(placeMenu(env, place), place, "a1");
    for (const label of ["아래에 항 추가", "삭제", "복제", "조건으로 감싸기"]) expect(state(sections, label)).toBe("열림");
  });
});

describe("withBlockRefItems — 블록 지정 참조 넣기 줄 (ADR-0082 결정 12)", () => {
  const textPlace = { kind: "inline", at: { parentId: "p1" } } as const;
  it("블록이 있으면 「조 참조…」 바로 뒤에 「블록 지정 참조…」 — 같은 자리 · 같은 잠금", () => {
    const sections = withBlockRefItems(copyScopeMenu(placeMenu(env, textPlace), textPlace, "a1"), true);
    const labels = sections.flat().map((i) => i.label);
    expect(labels.indexOf(BLOCK_REF_ITEM)).toBe(labels.indexOf("조 참조…") + 1);
    const item = sections.flat().find((i) => i.label === BLOCK_REF_ITEM)!;
    expect(item.action).toMatchObject({ do: "popup", popup: { kind: "insertInline", what: "blockRef", at: { parentId: "p1" } } });
  });
  it("블록이 없으면(대치 형태) 그대로", () => {
    const sections = withBlockRefItems(copyScopeMenu(placeMenu(env, textPlace), textPlace, "a1"), false);
    expect(sections.flat().some((i) => i.label === BLOCK_REF_ITEM)).toBe(false);
  });
});
