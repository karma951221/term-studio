import { describe, expect, it } from "vitest";

import { parsePanelQuery, panelQuery } from "./query";

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
