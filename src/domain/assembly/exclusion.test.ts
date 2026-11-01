/**
 * 준용예외 판정표 (기능/조립산출 §3.5 · ADR-0098 결정 3 · 4 · 6).
 */
import { describe, expect, it } from "vitest";

import { judgeExclusions, type ArticleState } from "./exclusion";

const order = ["a5", "a9", "a10", "a20", "a38"];
const states = (m: Record<string, ArticleState>) => (id: string): ArticleState => m[id] ?? "content";

describe("특약의 판정표 (결정 3)", () => {
  it("대치 형태 · ① 제1절에 찍힘 — 후보이고 특약에 없을 때만 넣는다", () => {
    const r = judgeExclusions({ candidates: ["a9", "a10", "a38"], order, state: states({ a9: "single", a10: "single", a38: "single" }), linked: new Set(["a10"]), context: "special" });
    expect(r.value).toEqual(["a9", "a38"]);
    expect(r.judgments).toEqual([
      { articleId: "a9", included: true, branch: "single" },
      { articleId: "a10", included: false, branch: "single", reason: "hasArticle" },
      { articleId: "a38", included: true, branch: "single" },
    ]);
  });

  it("② 위임 — 후보 여부 · 특약에 있음과 무관하게 넣는다", () => {
    const r = judgeExclusions({ candidates: ["a9"], order, state: states({ a20: "delegated", a5: "delegated" }), linked: new Set(["a5"]), context: "special" });
    expect(r.value).toEqual(["a5", "a9", "a20"]); // 이 상품 보통약관의 조 순서
    expect(r.judgments.find((j) => j.articleId === "a20")).toEqual({ articleId: "a20", included: true, branch: "delegated" });
  });

  it("③ 최종 트리에 없음 — 넣지 않는다", () => {
    const r = judgeExclusions({ candidates: ["a9", "a38"], order, state: states({ a38: "absent" }), linked: new Set(), context: "special" });
    expect(r.value).toEqual(["a9"]);
    expect(r.judgments[1]).toEqual({ articleId: "a38", included: false, branch: "absent", reason: "notInTree" });
  });

  it("후보는 이 상품 템플릿의 조만 본다 — 다른 템플릿 조는 기록도 없다", () => {
    const r = judgeExclusions({ candidates: ["m-a9", "a9"], order, state: states({}), linked: new Set(), context: "special" });
    expect(r.value).toEqual(["a9"]);
    expect(r.judgments.map((j) => j.articleId)).toEqual(["a9"]);
  });

  it("후보 아닌 ① 조는 기록하지 않는다 — 판정 대상이 아니다", () => {
    const r = judgeExclusions({ candidates: [], order, state: states({}), linked: new Set(), context: "special" });
    expect(r).toEqual({ value: [], judgments: [] });
  });
});

describe("블록(제2절)은 후보 판정만 (결정 4)", () => {
  it("제1절에 찍힌 후보 조인데 블록에 연결 조가 없으면 넣는다 · 위임 자동 포함은 없다", () => {
    const r = judgeExclusions({ candidates: ["a9", "a10"], order, state: states({ a20: "delegated" }), linked: new Set(["a10"]), context: "block" });
    expect(r.value).toEqual(["a9"]);
    expect(r.judgments).toEqual([
      { articleId: "a9", included: true, branch: "content" },
      { articleId: "a10", included: false, branch: "content", reason: "hasArticle" },
    ]);
  });

  it("블록의 위임 후보 조는 넣지 않는다 — 블록이 자기 조를 갖는다", () => {
    const r = judgeExclusions({ candidates: ["a20"], order, state: states({ a20: "delegated" }), linked: new Set(), context: "block" });
    expect(r.value).toEqual([]);
    expect(r.judgments).toEqual([{ articleId: "a20", included: false, branch: "delegated", reason: "blockDelegated" }]);
  });
});
