import { describe, expect, it } from "vitest";

import type { FirstSectionRecord } from "@/domain/assembly";

import { articleMarks, JOIN_MODE_LABEL, linkMatrix, type LinkColumn } from "./verdictView";

/** 판정 기록 한 줄 — 필요한 칸만 채운다. */
function record(articleId: string, over: Partial<FirstSectionRecord>): FirstSectionRecord {
  return { articleId, title: articleId, k: 0, n: 2, option: "none", result: "master", reason: "unlinked", linked: [], unlinked: [], blocks: [], substitutions: [], ...over };
}
const A = { productCoverageId: "pc-a", name: "상해사망" };
const B = { productCoverageId: "pc-b", name: "상해후유" };

describe("articleMarks — 목차 · 모델링 패널의 판정 배지 · 잠김 · 일부 연결 경고 (기능/상품 §3.12)", () => {
  it("특칙 — 배지 「특칙 1/2」, 마우스를 올리면 조연결한 · 안 한 담보", () => {
    const marks = articleMarks([record("a3", { result: "special", reason: "partial", k: 1, linked: [A], unlinked: [B] })], ["a3"]);
    expect(marks.get("a3")).toEqual({ verdict: { text: "특칙 1/2", tip: "조연결한 담보: 상해사망 — 조연결하지 않은 담보: 상해후유" }, locked: true });
  });

  it("마스터는 배지가 없다 · 잠김만", () => {
    const marks = articleMarks([record("a5", {})], ["a5"]);
    expect(marks.get("a5")).toEqual({ locked: true });
  });

  it("위임 · 공통항 분리 — 배지 tip 은 조연결한 담보", () => {
    const marks = articleMarks([record("a4", { result: "delegate", reason: "differentNoCommon", k: 2, linked: [A, B] }), record("a6", { result: "commonSplit", option: "common", reason: "differentWithCommon", k: 2, linked: [A, B] })], []);
    expect(marks.get("a4")?.verdict).toEqual({ text: "위임 2/2", tip: "조연결한 담보: 상해사망 · 상해후유" });
    expect(marks.get("a6")?.verdict?.text).toBe("공통항 분리");
    expect(marks.get("a4")?.locked).toBeUndefined();
  });

  it("준용하기 옵션 조의 일부 연결 — 경고 문구(연결하지 않은 담보), 옵션 없음 조의 일부 연결은 경고 없음 (편집 추정 1)", () => {
    const marks = articleMarks(
      [record("a4", { result: "special", option: "common", reason: "partialOption", k: 1, linked: [A], unlinked: [B] }), record("a3", { result: "special", reason: "partial", k: 1, linked: [A], unlinked: [B] })],
      [],
    );
    expect(marks.get("a4")?.warning).toBe("담보 1개가 이 조에 조연결되지 않아 준용하기 옵션이 적용되지 않습니다 — 연결되지 않은 담보: 상해후유");
    expect(marks.get("a3")?.warning).toBeUndefined();
  });

  it("판정 기록이 없는 잠긴 조(대치 형태 · 조건으로 빠짐) — 잠김만", () => {
    expect(articleMarks(undefined, ["a3"]).get("a3")).toEqual({ locked: true });
  });

  it("준용하기 옵션 이름", () => {
    expect(JOIN_MODE_LABEL).toEqual({ none: "없음", common: "공통항 모으기", all: "전체항 모으기" });
  });
});

describe("linkMatrix — 조연결 현황 표 (기능/상품 §3.12 · §4.6)", () => {
  const articles = [
    { id: "a1", label: "제1조(목적)" },
    { id: "a3", label: "제3조(지급사유)" },
    { id: "a4", label: "제4조(세부규정)", joinMode: "common" as const },
    { id: "a7", label: "제7조(소멸)", joinMode: "all" as const },
  ];
  const columns: LinkColumn[] = [
    { productCoverageId: "pc-a", name: "상해사망", head: "1.", documentId: "doc-a", links: { a3: "제1조(보험금의 지급사유)", a4: "제2조(세부)" } },
    { productCoverageId: "pc-b", name: "상해후유", head: "2.", documentId: "doc-b", links: { a3: "제1조(보험금의 지급사유)" } },
  ];

  it("절 형태 — 행 = 판정 대상 조 + 옵션 조(연결 0 이어도), 칸 = 연결함 · 안 함 · 연결했지만 조건으로 빠짐, 행 끝 판정 · k/N", () => {
    const rows = linkMatrix({
      articles,
      columns,
      sectioned: true,
      records: [
        record("a3", { result: "special", reason: "partial", k: 1, linked: [A], unlinked: [B] }),
        record("a4", { result: "delegate", option: "common", reason: "single", k: 1, n: 2, linked: [A], unlinked: [B] }),
      ],
    });
    expect(rows.map((r) => r.articleId)).toEqual(["a3", "a4", "a7"]);
    expect(rows[0]).toMatchObject({
      label: "제3조(지급사유)",
      option: "none",
      cells: [
        { kind: "linked", label: "제1조(보험금의 지급사유)" },
        { kind: "excluded", label: "제1조(보험금의 지급사유)" },
      ],
      result: "특칙",
      count: "1/2",
    });
    expect(rows[1].cells).toEqual([{ kind: "linked", label: "제2조(세부)" }, { kind: "none" }]);
    expect(rows[1].option).toBe("common");
    // 연결 0 인 옵션 조 — 행은 서고 결과는 마스터 0/N
    expect(rows[2]).toMatchObject({ articleId: "a7", option: "all", cells: [{ kind: "none" }, { kind: "none" }], result: "마스터", count: "0/2" });
  });

  it("일부 연결 경고는 행에도 — 옵션 조만", () => {
    const rows = linkMatrix({ articles, columns, sectioned: true, records: [record("a4", { result: "special", option: "common", reason: "partialOption", k: 1, linked: [A], unlinked: [B] })] });
    expect(rows.find((r) => r.articleId === "a4")?.warning).toContain("연결되지 않은 담보: 상해후유");
  });

  it("판정 기록이 없는 정적 연결 조(전부 조건으로 빠짐) — 칸은 「조건으로 빠짐」, 결과 마스터", () => {
    const rows = linkMatrix({ articles, columns, sectioned: true, records: [] });
    expect(rows.find((r) => r.articleId === "a3")).toMatchObject({ cells: [{ kind: "excluded" }, { kind: "excluded" }], result: "마스터", count: "0/2" });
  });

  it("대치 형태 — 기본계약 담보 한 열, 연결한 조는 「대치」", () => {
    const rows = linkMatrix({ articles, columns: [columns[0]], sectioned: false });
    expect(rows.map((r) => [r.articleId, r.result, r.count])).toEqual([
      ["a3", "대치", undefined],
      ["a4", "대치", undefined],
      ["a7", "마스터", undefined],
    ]);
    expect(rows[0].cells).toEqual([{ kind: "linked", label: "제1조(보험금의 지급사유)" }]);
  });
});
