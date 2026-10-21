import { describe, expect, it } from "vitest";

import { mergePanelQuery, parsePanelQuery, panelQuery, pendingPanel } from "./query";

/**
 * 출처 패널의 URL (기능/조립산출 §4.1) — `?article=<조 id>` (특약 · 블록 조면 `&pc=<상품담보 id>`) · 값 조각 · 막힌 분기 강조 `&node=<노드 id>` ·
 * 생략 자리 끄기 `&omitted=off`. 새로고침 · 공유해도 같은 패널이 열린다.
 */
describe("parsePanelQuery", () => {
  it("article 만 — 보통약관(제1절) 조", () => {
    expect(parsePanelQuery({ article: "g-art-pay" })).toEqual({ target: { document: "general", articleId: "g-art-pay" }, showOmitted: true });
  });

  it("article + pc — 그 상품담보의 담보약관 조 · node 는 강조할 노드", () => {
    expect(parsePanelQuery({ article: "s-art", pc: "pc-1", node: "slot@01" })).toEqual({ target: { document: "special", productCoverageId: "pc-1", articleId: "s-art" }, node: "slot@01", showOmitted: true });
  });

  it("article 이 없으면 패널 없음 — pc · node 만으로는 열지 않는다", () => {
    expect(parsePanelQuery({ pc: "pc-1", node: "x" })).toEqual({ showOmitted: true });
  });

  it("omitted=off 면 생략 자리를 끈다 — 그 밖의 값은 켬(기본)", () => {
    expect(parsePanelQuery({ omitted: "off" }).showOmitted).toBe(false);
    expect(parsePanelQuery({ omitted: "on" }).showOmitted).toBe(true);
  });

  it("배열(같은 키 여럿) · 빈 문자열 · 제어 문자는 버린다", () => {
    expect(parsePanelQuery({ article: ["a", "b"] })).toEqual({ target: { document: "general", articleId: "a" }, showOmitted: true });
    expect(parsePanelQuery({ article: "" })).toEqual({ showOmitted: true });
    expect(parsePanelQuery({ article: "a\nb" })).toEqual({ showOmitted: true });
  });
});

describe("panelQuery — 거꾸로(링크)", () => {
  it("보통약관 조", () => {
    expect(panelQuery({ target: { document: "general", articleId: "g 1" } })).toBe("?article=g+1");
  });

  it("특약 조 + 노드 + 생략 자리 끔", () => {
    expect(panelQuery({ target: { document: "special", productCoverageId: "pc-1", articleId: "s" }, node: "n/1", showOmitted: false })).toBe("?article=s&pc=pc-1&node=n%2F1&omitted=off");
  });

  it("패널 없음 · 생략 자리 켬(기본)이면 빈 문자열", () => {
    expect(panelQuery({})).toBe("");
    expect(panelQuery({ showOmitted: true })).toBe("");
  });

  it("왕복 — 만든 쿼리를 다시 읽으면 같은 상태", () => {
    const state = { target: { document: "special" as const, productCoverageId: "pc", articleId: "a" }, node: "x@1", showOmitted: false };
    const sp = Object.fromEntries(new URLSearchParams(panelQuery(state)));
    expect(parsePanelQuery(sp)).toEqual(state);
  });
});

describe("pendingPanel — 「평가 대기」 줄의 「미리보기에서 보기」 = 그 조 패널 + 그 분기 강조", () => {
  it("보통약관 자리 — article + node", () => {
    expect(pendingPanel({ nodeId: "c1", at: { document: "general", ownerId: "g-doc", articleId: "g-a" }, message: "" })).toEqual({ target: { document: "general", articleId: "g-a" }, node: "c1" });
  });
  it("특약 · 블록 자리 — 결과 좌표의 ownerId 가 상품담보", () => {
    expect(pendingPanel({ nodeId: "ref/sw", at: { document: "special", ownerId: "pc-1", articleId: "s-a" }, message: "" })).toEqual({ target: { document: "special", productCoverageId: "pc-1", articleId: "s-a" }, node: "ref/sw" });
  });
  it("조를 모르면(조 자리 조건 등) 없다", () => {
    expect(pendingPanel({ nodeId: "c", at: { document: "general" }, message: "" })).toBeUndefined();
  });
});

/**
 * 다른 쿼리를 쓰는 화면에 패널 쿼리 합치기 (기능/조립산출 §4.2) — 상품 탭(`tab` · `art` · `cov` · `pc`)은 제 쿼리를 지키고 패널 키만 바꾼다.
 * 특별약관 탭의 `pc` 는 고른 상품담보이자 패널 대상의 상품담보 — 그 화면은 `pc` 를 제 것(`own`)으로 두어 패널을 닫아도 남긴다.
 */
describe("mergePanelQuery", () => {
  it("화면의 다른 쿼리는 그대로, 패널 키만 바꾼다", () => {
    expect(mergePanelQuery("?tab=general&art=a0", { target: { document: "general", articleId: "a1" }, node: "n1" })).toBe("?tab=general&art=a0&article=a1&node=n1");
  });

  it("닫기 — 패널 키(article · pc · node)를 뺀다, 생략 자리 끔은 상태대로", () => {
    expect(mergePanelQuery("?tab=general&article=a1&node=n1&omitted=off", { showOmitted: false })).toBe("?tab=general&omitted=off");
    expect(mergePanelQuery("?article=s1&pc=pc1&omitted=off", {})).toBe("");
  });

  it("같은 키를 화면도 쓰면(own) 닫아도 남긴다 — 특약 대상이면 그 값으로 맞춘다", () => {
    const own = ["pc"];
    expect(mergePanelQuery("?tab=special&pc=pc1&article=s1", {}, { own })).toBe("?tab=special&pc=pc1");
    expect(mergePanelQuery("?tab=special&cov=c1", { target: { document: "special", productCoverageId: "pc2", articleId: "s1" } }, { own })).toBe("?tab=special&cov=c1&pc=pc2&article=s1");
  });

  it("set — 화면 쿼리를 함께 바꾼다(보통약관 탭은 연 조를 `art` 로도 — 새로고침하면 같은 관)", () => {
    expect(mergePanelQuery("?tab=general&art=a0", { target: { document: "general", articleId: "a1" } }, { set: { art: "a1" } })).toBe("?tab=general&art=a1&article=a1");
  });

  it("앞의 `?` 없는 검색 문자열도 받는다 · 오류 배너 쿼리는 버린다", () => {
    expect(mergePanelQuery("tab=general&error=x", { target: { document: "general", articleId: "a1" } })).toBe("?tab=general&article=a1");
  });
});
