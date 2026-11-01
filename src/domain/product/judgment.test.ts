import { describe, expect, it } from "vitest";

import type { Issue } from "../types";
import { judgmentImpact, judgmentSnapshot, verdictText } from "./judgment";

/**
 * 판정 변화 영향 (ADR-0082 결정 11 · 기능/상품 §3.8 · §3.10) — 저장 전후의 판정 · 회색 사본 · 사본의 블록 지정 참조를 견준다. 순수.
 */
describe("verdictText — 판정 배지 표기 (기능/상품 §3.12)", () => {
  it("특칙 · 공통 · 위임은 k/N, 공통항 분리 · 전체항 합침은 이름만, 마스터는 「마스터」", () => {
    expect(verdictText({ result: "special", k: 1, n: 2 })).toBe("특칙 1/2");
    expect(verdictText({ result: "common", k: 3, n: 3 })).toBe("공통 3/3");
    expect(verdictText({ result: "delegate", k: 2, n: 2 })).toBe("위임 2/2");
    expect(verdictText({ result: "delegate", k: 1, n: 1 })).toBe("위임 1/1");
    expect(verdictText({ result: "commonSplit", k: 2, n: 2 })).toBe("공통항 분리");
    expect(verdictText({ result: "joinAll", k: 2, n: 2 })).toBe("전체항 합침");
    expect(verdictText({ result: "master", k: 0, n: 2 })).toBe("마스터");
  });
});

const brokenRef = (articleId: string, message: string): Issue => ({ kind: "brokenRef", message, at: { articleId, nodePath: [articleId, "r1"] } });

describe("judgmentSnapshot — 저장 한쪽의 판정 재료", () => {
  it("절 형태 — 판정 기록의 마스터는 빼고 나머지를 배지 표기로", () => {
    const s = judgmentSnapshot({
      records: [
        { articleId: "a3", result: "special", k: 1, n: 2 },
        { articleId: "a5", result: "master", k: 0, n: 2 },
      ],
      locks: new Map([["a3", ["갑"]]]),
      copyIds: ["a3", "a9"],
      blockRefIssues: [],
    });
    expect([...s.verdicts]).toEqual([["a3", "특칙 1/2"]]);
    expect([...s.grayCopies]).toEqual(["a3"]);
  });

  it("대치 형태(판정 기록 없음) — 잠긴 조(기본계약이 조연결)는 「대치」", () => {
    const s = judgmentSnapshot({ locks: new Map([["a3", ["갑"]], ["a4", ["갑"]]]), copyIds: [], blockRefIssues: [] });
    expect([...s.verdicts]).toEqual([
      ["a3", "대치"],
      ["a4", "대치"],
    ]);
  });
});

describe("judgmentImpact — 저장 전후 견주기", () => {
  const label = (id: string) => `제${id.slice(1)}조`;
  const empty = judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [] });

  it("바뀐 것이 없으면 undefined", () => {
    expect(judgmentImpact(empty, empty, label)).toBeUndefined();
  });

  it("블록 1 → 2 — 「위임 1/1」 → 「특칙 1/2」 · 판정 대상에서 빠진 조는 「마스터」", () => {
    const before = judgmentSnapshot({ records: [{ articleId: "a3", result: "delegate", k: 1, n: 1 }, { articleId: "a4", result: "delegate", k: 1, n: 1 }], locks: new Map(), copyIds: [], blockRefIssues: [] });
    const after = judgmentSnapshot({ records: [{ articleId: "a3", result: "special", k: 1, n: 2 }, { articleId: "a6", result: "special", k: 1, n: 2 }], locks: new Map(), copyIds: [], blockRefIssues: [] });
    expect(judgmentImpact(before, after, label)?.verdicts).toEqual([
      { articleId: "a3", label: "제3조", before: "위임 1/1", after: "특칙 1/2" },
      { articleId: "a4", label: "제4조", before: "위임 1/1", after: "마스터" },
      { articleId: "a6", label: "제6조", before: "마스터", after: "특칙 1/2" },
    ]);
  });

  it("대치 형태끼리(기본계약 0 → 1 · 1 → 다른 1)는 판정 줄을 내지 않는다 — 절 형태 판정이 아니다(대치는 잠금 · 회색 사본 줄로만)", () => {
    const before = judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [] });
    const after = judgmentSnapshot({ locks: new Map([["a3", ["갑"]]]), copyIds: [], blockRefIssues: [] });
    expect(judgmentImpact(before, after, label)).toBeUndefined();
  });

  it("회색이 되는 사본 · 다시 쓰이는 사본", () => {
    const before = judgmentSnapshot({ locks: new Map([["a4", ["갑"]]]), copyIds: ["a4", "a7"], blockRefIssues: [] });
    const after = judgmentSnapshot({ locks: new Map([["a7", ["을"]]]), copyIds: ["a4", "a7"], blockRefIssues: [] });
    const impact = judgmentImpact(before, after, label)!;
    expect(impact.grayed).toEqual([{ articleId: "a7", label: "제7조" }]);
    expect(impact.revived).toEqual([{ articleId: "a4", label: "제4조" }]);
  });

  it("깨지는 블록 지정 참조 — 저장 뒤에만 있는 이슈", () => {
    const old = brokenRef("a25", "이미 깨진 참조");
    const before = judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [old] });
    const after = judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [old, brokenRef("a25", "블록 「갑」이 이 상품에 없습니다")] });
    expect(judgmentImpact(before, after, label)?.brokenRefs).toEqual([{ articleId: "a25", label: "제25조", message: "블록 「갑」이 이 상품에 없습니다" }]);
  });
});

describe("특약 조 판정 (ADR-0093 결정 6) — 생략 기준이 바꾸는 생략 · 준용 · 통째", () => {
  const label = (id: string) => `제${id.slice(1)}조`;
  const rec = (disposition: "omitted" | "applied" | "full", articleId = "b1") => ({ productCoverageId: "pc1", productCoverageName: "암진단", articleId, articleTitle: "제1조(보험금의 지급사유)", disposition });

  it("특약 조 판정 — 통째 → 생략인 조를 specials 로 · 같으면 줄 없음 · 대치 형태에서도 낸다(절 형태 여부와 무관)", () => {
    const before = judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [], omitted: [rec("full"), rec("applied", "b2")] });
    const after = judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [], omitted: [rec("omitted"), rec("applied", "b2")] });
    expect(before.specials.get("pc1/b1")).toEqual({ label: "암진단 › 제1조(보험금의 지급사유)", word: "통째" });
    expect(after.specials.get("pc1/b2")?.word).toBe("준용");
    expect(judgmentImpact(before, after, label)).toEqual({
      verdicts: [],
      grayed: [],
      revived: [],
      brokenRefs: [],
      specials: [{ productCoverageId: "pc1", articleId: "b1", label: "암진단 › 제1조(보험금의 지급사유)", before: "통째", after: "생략" }],
    });
    expect(judgmentImpact(after, after, label)).toBeUndefined();
    // 절 형태 판정 기록이 있어도 같은 줄 — 다른 판정이 없으면 specials 만
    const sectioned = (o: ReturnType<typeof rec>[]) => judgmentSnapshot({ records: [{ articleId: "a3", result: "special", k: 1, n: 2 }], locks: new Map(), copyIds: [], blockRefIssues: [], omitted: o });
    expect(judgmentImpact(sectioned([rec("full")]), sectioned([rec("omitted")]), label)?.specials).toHaveLength(1);
    // 판정 줄이 없으면 specials 키가 없다 — 상품담보 탭 카드 모양 그대로
    expect(judgmentImpact(before, before, label)).toBeUndefined();
  });
});

describe("준용예외 (ADR-0098 결정 7) — 저장 전후 준용예외 값 견주기", () => {
  const label = (id: string) => `제${id.slice(3)}조`;
  const snap = (value: string[], pcs = [{ productCoverageId: "pc1", name: "암진단" }]) =>
    judgmentSnapshot({ locks: new Map(), copyIds: [], blockRefIssues: [], productName: "알파", exclusions: pcs.map((p) => ({ ...p, code: "D0013", value })) });

  it("특약마다 추가 · 빠진 조를 「상품 · 특약 — 준용예외에 제N조 추가 / 빠짐」 한 줄로", () => {
    const impact = judgmentImpact(snap(["g-a9", "g-a10"]), snap(["g-a9", "g-a38"]), label);
    expect(impact?.exclusions).toEqual([{ productCoverageId: "pc1", label: "알파 · 암진단", added: [{ articleId: "g-a38", label: "제38조" }], removed: [{ articleId: "g-a10", label: "제10조" }] }]);
    expect(judgmentImpact(snap(["g-a9"]), snap(["g-a9"]), label)).toBeUndefined();
  });

  it("탑재 · 해제로 생기거나 사라진 특약은 견주지 않는다", () => {
    expect(judgmentImpact(snap(["g-a9"], []), snap(["g-a9", "g-a10"]), label)).toBeUndefined();
  });
});
