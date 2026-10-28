import { describe, expect, it } from "vitest";

import { MAX_ITEM_TABS, NO_TABS, closeTab, editBlocker, itemKeyOf, openTab, parseTabs, pruneTabs, type ItemTabs } from "./itemTabs";

const keys = (s: ItemTabs) => s.tabs.map((t) => t.key);

describe("itemKeyOf — 상세 주소 → 항목 키 (ADR-0094)", () => {
  it("메뉴 바로 아래 한 마디가 항목 키다 — 더 깊은 상세2 도 그 항목", () => {
    expect(itemKeyOf("/documents/abc", "/documents")).toBe("abc");
    expect(itemKeyOf("/products/p1/coverages/pc9", "/products")).toBe("p1");
    expect(itemKeyOf("/products/p1/preview", "/products")).toBe("p1");
  });

  it("목록 자체 · 생성 화면 · 하위 탭 화면은 항목이 아니다", () => {
    expect(itemKeyOf("/documents", "/documents")).toBeUndefined();
    expect(itemKeyOf("/documents/", "/documents")).toBeUndefined();
    expect(itemKeyOf("/documents/new", "/documents")).toBeUndefined();
    expect(itemKeyOf("/attributes/template", "/attributes", { exclude: ["template"] })).toBeUndefined();
    expect(itemKeyOf("/coverages/x", "/documents")).toBeUndefined();
    expect(itemKeyOf("/documentsx/a", "/documents")).toBeUndefined();
  });

  it("인코딩된 마디는 풀고, 구분 글자가 있으면 그 앞까지 — 폼 필드 상세(폼키.필드키)는 폼 탭", () => {
    expect(itemKeyOf("/functions/C%2001", "/functions")).toBe("C 01");
    expect(itemKeyOf("/master/waiver.apply", "/master", { keySeparator: "." })).toBe("waiver");
    expect(itemKeyOf("/master/%E0%A4", "/master")).toBe("%E0%A4");
  });
});

describe("openTab — 고른 항목은 탭으로 쌓인다", () => {
  it("없으면 끝에 붙는다", () => {
    const s = openTab(openTab(NO_TABS, "a", "/x/a"), "b", "/x/b");
    expect(keys(s)).toEqual(["a", "b"]);
  });

  it("이미 열린 항목이면 새 탭을 만들지 않고 그 탭의 마지막 주소만 바꾼다 — 자리는 그대로", () => {
    let s = openTab(openTab(NO_TABS, "a", "/x/a"), "b", "/x/b");
    s = openTab(s, "a", "/x/a?tab=general");
    expect(keys(s)).toEqual(["a", "b"]);
    expect(s.tabs[0]!.href).toBe("/x/a?tab=general");
  });

  it(`${MAX_ITEM_TABS}개를 넘으면 가장 오래 안 본 탭부터 닫힌다 — 편집 중 탭은 남는다`, () => {
    let s = NO_TABS;
    for (let i = 0; i < MAX_ITEM_TABS; i++) s = openTab(s, `k${i}`, `/x/k${i}`);
    s = openTab(s, "k0", "/x/k0"); // k0 을 다시 봄 — 이제 가장 오래 안 본 것은 k1
    s = openTab(s, "new", "/x/new-item", { editing: "k1" });
    expect(s.tabs).toHaveLength(MAX_ITEM_TABS);
    expect(keys(s)).toContain("k1");
    expect(keys(s)).not.toContain("k2");
    expect(keys(s).at(-1)).toBe("new");
  });
});

describe("closeTab — 닫고 갈 곳", () => {
  const s = openTab(openTab(openTab(NO_TABS, "a", "/x/a"), "b", "/x/b?tab=2"), "c", "/x/c");

  it("현재 탭이 아니면 그 자리에 머문다", () => {
    const r = closeTab(s, "a", "b");
    expect(keys(r.state)).toEqual(["b", "c"]);
    expect(r.next).toBeUndefined();
  });

  it("현재 탭을 닫으면 오른쪽 이웃, 끝이면 왼쪽 — 그 탭이 마지막으로 본 주소로", () => {
    expect(closeTab(s, "a", "a").next).toBe("/x/b?tab=2");
    expect(closeTab(s, "c", "c").next).toBe("/x/b?tab=2");
  });

  it("마지막 탭을 닫으면 전체 목록(null)", () => {
    const one = openTab(NO_TABS, "a", "/x/a");
    expect(closeTab(one, "a", "a")).toEqual({ state: { tabs: [], clock: one.clock }, next: null });
  });
});

describe("editBlocker — 편집은 한 번에 한 탭만", () => {
  it("다른 탭이 편집 중이면 그 탭 키, 아니면 없음", () => {
    expect(editBlocker(undefined, "a")).toBeUndefined();
    expect(editBlocker("a", "a")).toBeUndefined();
    expect(editBlocker("a", "b")).toBe("a");
  });
});

describe("parseTabs · pruneTabs — 저장소 값은 믿지 않는다", () => {
  it("깨진 값 · 모양이 틀린 줄은 버린다", () => {
    expect(parseTabs(null)).toEqual(NO_TABS);
    expect(parseTabs("x")).toEqual(NO_TABS);
    expect(parseTabs({ tabs: "x" })).toEqual(NO_TABS);
    const s = parseTabs({ clock: 3, tabs: [{ key: "a", href: "/x/a", seen: 2 }, { key: 1 }, { key: "b", href: "//evil" , seen: 1 }, { key: "a", href: "/x/a2", seen: 3 }] });
    expect(keys(s)).toEqual(["a"]);
    expect(s.clock).toBe(3);
  });

  it(`${MAX_ITEM_TABS}개를 넘게 들고 와도 앞에서 그만큼만`, () => {
    const tabs = Array.from({ length: MAX_ITEM_TABS + 3 }, (_, i) => ({ key: `k${i}`, href: `/x/k${i}`, seen: i }));
    expect(parseTabs({ clock: 99, tabs }).tabs).toHaveLength(MAX_ITEM_TABS);
  });

  it("없어진 항목(지워진 것)의 탭은 뺀다 — 바뀐 것이 없으면 같은 값", () => {
    const s = openTab(openTab(NO_TABS, "a", "/x/a"), "b", "/x/b");
    expect(keys(pruneTabs(s, (k) => k !== "a"))).toEqual(["b"]);
    expect(pruneTabs(s, () => true)).toBe(s);
  });
});
