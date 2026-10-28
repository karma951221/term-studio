import { describe, expect, it } from "vitest";

import type { BoxNode, DocumentNode, Node } from "../../src/domain/document/nodes";

import { boxSites, diffRegion, planBoxes, replaceBox, type BoxSite } from "./boxes";
import { titleNodes } from "../../src/domain/document/title";

const box = (id: string, title: string, lines: string[]): BoxNode => ({ id, kind: "box", title, lines });

function doc(id: string, boxes: BoxNode[]): DocumentNode {
  return {
    id,
    kind: "document",
    title: id,
    children: [{ id: `${id}-a1`, kind: "article", title: titleNodes("조", `${id}-a1`), children: [{ id: `${id}-p1`, kind: "paragraph", children: [], items: [{ id: `${id}-i1`, kind: "item", children: [] }, ...boxes] }] }],
  };
}

const sitesOf = (d: DocumentNode, product: string, general = false): BoxSite[] => boxSites(d, { doc: d.id, product, general });

describe("원문 박스 → 정적 마스터 박스 (기능/박스 §3.1 · 최종 결정 9)", () => {
  it("낱말 경계로 넓힌 다른 구간 — 모두 같으면 없다", () => {
    expect(diffRegion(["회사가 청약서에서 질문한", "회사가 서면으로 질문한"])?.regions).toEqual(["청약서에서", "서면으로"]);
    expect(diffRegion(["같다", "같다"])).toBeUndefined();
  });

  it("같은 박스는 하나 · 한 곳만 써도 박스 · 띄어쓰기만 달라도 따로 — 제목이 같아도 된다(박스 이름 칸 없음)", () => {
    const a = doc("a", [box("a-b2", "보장개시일", ["보장을 개시하는 날"]), box("a-b3", "예금자보호", ["1 인당 1억원"])]);
    const m = doc("m", [box("m-b2", "보장개시일", ["보장을 개시하는 날"]), box("m-b3", "예금자보호", ["1인당 1억원"])]);
    const plans = planBoxes([...sitesOf(a, "alpha", true), ...sitesOf(m, "meritz")]);
    expect(plans.map((p) => p.record.title)).toEqual(["보장개시일", "예금자보호", "예금자보호"]);
    expect(plans[0].sites).toHaveLength(2);
    expect(plans[0].record).toEqual({ code: "", title: "보장개시일", lines: ["【보장개시일】", "보장을 개시하는 날"] });
  });

  it("자동 탑재 특약(`late`)의 박스는 앞 박스와 낱말만 달라도 그 무리에 들지 않는다 — 앞 박스 순서(코드)를 밀지 않는다", () => {
    const a = doc("a", [box("a-b1", "용어풀이", ["- 강제집행이란 국가의 집행기관이 하는 것"]), box("a-b2", "보험연도", ["계약일부터 1년"])]);
    const n = doc("n", [box("n-b1", "용어풀이", ["- 강제집행이란 법원의 집행기관이 하는 것"]), box("n-b2", "보험연도", ["계약일부터 1년"])]);
    const late = boxSites(n, { doc: n.id, product: "alpha2607", general: false, late: true });
    const plans = planBoxes([...sitesOf(a, "alpha", true), ...late]);
    expect(plans.map((p) => p.sites.map((s) => s.node.id))).toEqual([["a-b1"], ["a-b2", "n-b2"], ["n-b1"]]);
  });

  it("낱말만 달라도 박스를 따로 만든다 — 같은 제목 · 붙은 순서, 각 자리는 제 글의 박스를 놓는다", () => {
    const a = doc("a", [box("a-b1", "계약 전 알릴 의무", ["회사가 청약서에서 질문한 사항"])]);
    const m = doc("m", [box("m-b1", "계약 전 알릴 의무", ["회사가 서면으로 질문한 사항"])]);
    const plans = planBoxes([...sitesOf(a, "alpha", true), ...sitesOf(m, "meritz")]);
    expect(plans.map((p) => p.record.title)).toEqual(["계약 전 알릴 의무", "계약 전 알릴 의무"]);
    expect(plans.map((p) => p.record.lines)).toEqual([["【계약 전 알릴 의무】", "회사가 청약서에서 질문한 사항"], ["【계약 전 알릴 의무】", "회사가 서면으로 질문한 사항"]]);
    expect(plans.map((p) => p.sites.map((s) => s.node.id))).toEqual([["a-b1"], ["m-b1"]]);
  });

  it("원문 박스 머리(【제목】)는 레코드 본문 첫 줄이 되고 제목은 목록 이름으로 남는다 — 머리 없는 박스는 본문 그대로 (2026-10-28)", () => {
    const a = doc("a", [box("a-b1", "그림", ["자동차"]), box("a-b2", "", ["머리 없는 줄"])]);
    const plans = planBoxes(sitesOf(a, "alpha"));
    expect(plans.map((p) => p.record)).toEqual([
      { code: "", title: "그림", lines: ["【그림】", "자동차"] },
      { code: "", title: "", lines: ["머리 없는 줄"] },
    ]);
  });

  it("박스 자리는 같은 목록 자리의 박스 참조가 된다 (항의 호 목록 뒤)", () => {
    const a = doc("a", [box("a-b1", "용어풀이", ["줄"])]);
    const [site] = sitesOf(a, "alpha");
    replaceBox(site, "BX000007");
    const p = (a.children[0] as { children: Node[] }).children[0] as { items: Node[] };
    expect(p.items[1]).toEqual({ id: "a-b1-k", kind: "boxRef", boxCode: "BX000007" });
  });
});
