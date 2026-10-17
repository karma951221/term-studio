/**
 * 연결 조의 사본 잠금 · 회색 사본 (ADR-0082 결정 10 · 기능/상품 §3.10) — 잠금은 **정적 연결**(탑재 블록 · 기본계약 담보약관의 조연결)로 센다.
 */
import { describe, expect, it } from "vitest";

import type { DocumentNode } from "@/domain/document";
import { titleNodes } from "@/domain/document/title";

import { copyLocks, grayCopyIds, lockingCoverageIds, staticLinks } from "./copyLock";

const doc = (id: string, links: (string | undefined)[], cond = false): DocumentNode => {
  const articles = links.map((l, i) => ({ id: `${id}-a${i}`, kind: "article" as const, title: titleNodes(`조${i}`, `${id}-a${i}`), ...(l ? { linkedArticleId: l } : {}), children: [] }));
  return {
    id,
    kind: "document",
    title: id,
    // 조건 블록 안의 조도 정적 연결이다 — 조건은 평가하지 않는다
    children: cond ? [{ id: `${id}-c`, kind: "condBlock", branches: [{ id: `${id}-c-b`, when: "D0001 = true", children: articles }] }] : articles,
  };
};

describe("staticLinks — 조연결은 조건 가지 안까지(평가하지 않는다)", () => {
  it("조 자리 · 조건 블록 가지 안의 조연결을 문서 순으로", () => {
    expect(staticLinks(doc("d", ["g1", undefined, "g2"]))).toEqual(["g1", "g2"]);
    expect(staticLinks(doc("d", ["g3"], true))).toEqual(["g3"]);
  });
});

describe("lockingCoverageIds — 잠금을 만드는 상품담보", () => {
  const mounts = ["pc1", "pc2", "pc3"];
  it("주계약 = 기본계약 상품담보(1개 대치 · 2+ 절 형태 공통)", () => {
    expect([...lockingCoverageIds({ standalone: false, baseContractIds: ["pc1"], mountIds: mounts })]).toEqual(["pc1"]);
    expect([...lockingCoverageIds({ standalone: false, baseContractIds: ["pc1", "pc2"], mountIds: mounts })]).toEqual(["pc1", "pc2"]);
    expect([...lockingCoverageIds({ standalone: false, baseContractIds: [], mountIds: mounts })]).toEqual([]);
  });
  it("독립특약 = 탑재 상품담보 전부(블록 후보)", () => {
    expect([...lockingCoverageIds({ standalone: true, baseContractIds: [], mountIds: mounts })]).toEqual(mounts);
  });
});

describe("copyLocks — 템플릿 조 id → 그 조에 조연결한 상품담보 이름", () => {
  it("여러 블록이 같은 조를 연결하면 이름을 모은다(블록 순서) · 같은 블록의 중복 연결은 한 번", () => {
    const locks = copyLocks([
      { productCoverageId: "pc1", name: "상해사망", links: ["g1", "g2", "g1"] },
      { productCoverageId: "pc2", name: "질병사망", links: ["g1"] },
    ]);
    expect(Object.fromEntries(locks)).toEqual({ g1: ["상해사망", "질병사망"], g2: ["상해사망"] });
  });
});

describe("grayCopyIds — 잠긴 조에 남은 사본(회색 · 쓰이지 않음)", () => {
  it("사본 중 잠긴 조의 것만 · 잠기지 않은 사본은 쓰인다", () => {
    const locks = new Map([["g1", ["상해사망"]]]);
    expect([...grayCopyIds(["g1", "g9"], locks)]).toEqual(["g1"]);
    expect([...grayCopyIds(["g9"], locks)]).toEqual([]);
  });
});
