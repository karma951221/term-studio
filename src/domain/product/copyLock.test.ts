/**
 * 연결 조의 사본 잠금 · 회색 사본 (ADR-0082 결정 10 · 기능/상품 §3.10) — 잠금은 **정적 연결**(탑재 블록 · 기본계약 담보약관의 조연결)로 센다.
 */
import { describe, expect, it } from "vitest";

import type { DocumentNode } from "@/domain/document";
import { titleNodes } from "@/domain/document/title";

import { blockCoverageIds, copyBlockRefIssues, copyLocks, grayCopyIds, lockingCoverageIds, staticLinkLabels, staticLinks } from "./copyLock";

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

describe("staticLinkLabels — 조연결 현황의 칸 글: 템플릿 조 id → 연결한 블록 조 「제N조(제목)」", () => {
  it("조연결한 조만 · 같은 템플릿 조에 둘이면 앞의 것(duplicateLink 는 조립 오류)", () => {
    expect(staticLinkLabels(doc("d", ["g1", undefined, "g2", "g1"]))).toEqual({ g1: "제1조(조0)", g2: "제3조(조2)" });
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

describe("블록 지정 참조의 대상 — 이 상품의 블록 (ADR-0082 결정 12)", () => {
  const mounts = ["pc1", "pc2", "pc3"];
  it("blockCoverageIds — 절 형태의 블록 후보: 주계약 기본계약 2개 이상 · 독립특약 탑재 전부, 대치 형태(기본계약 1개)는 블록이 없다", () => {
    expect([...blockCoverageIds({ standalone: false, baseContractIds: ["pc1"], mountIds: mounts })]).toEqual([]);
    expect([...blockCoverageIds({ standalone: false, baseContractIds: ["pc1", "pc2"], mountIds: mounts })]).toEqual(["pc1", "pc2"]);
    expect([...blockCoverageIds({ standalone: true, baseContractIds: [], mountIds: mounts })]).toEqual(mounts);
  });

  it("copyBlockRefIssues — 사본 안 블록 지정 참조마다 대상 검사(블록 아님 · 블록에 없는 조), 좌표는 그 사본 조 · 그 노드", () => {
    const article = { id: "g1", kind: "article" as const, title: titleNodes("계약의 소멸", "g1"), children: [{ id: "p1", kind: "paragraph" as const, code: "PZ0100", children: [{ id: "r1", kind: "blockRef" as const, productCoverageId: "pc1", articleId: "x9" }, { id: "r2", kind: "blockRef" as const, productCoverageId: "pc7" }] }] };
    const blocks = new Map([["pc1", { name: "상해사망", articleIds: new Set(["x1"]) }]]);
    const issues = copyBlockRefIssues([{ articleId: "g1", article }], blocks, { document: "product", ownerId: "prod" });
    expect(issues.map((i) => [i.kind, i.at.articleId, i.at.nodePath?.at(-1), i.at.refPath])).toEqual([
      ["brokenRef", "g1", "r1", "pc1/x9"],
      ["brokenRef", "g1", "r2", "pc7"],
    ]);
  });
});
