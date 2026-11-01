/**
 * 표 구분자 자리 `tableRef` — 문면의 블록 자리에 시스템 표 구분자를 놓는다 (기능/구분자 §3.7, ADR-0099).
 */
import { describe, expect, it } from "vitest";

import { nodeBuilders, sequentialIds } from "./builders";
import { allowedChildren, allowedListChildren, validateTree } from "./nodes";

function make() {
  return nodeBuilders(sequentialIds("n"));
}

describe("표 구분자 자리 tableRef — 블록 자리 (기능/구분자 §3.7)", () => {
  it("조 자리 · 항의 호 목록 자리에 선다, 호의 목 목록에는 못 선다 — 잎", () => {
    expect(allowedChildren.article).toContain("tableRef");
    expect(allowedListChildren["paragraph.items"]).toContain("tableRef");
    expect(allowedListChildren["item.subitems"]).not.toContain("tableRef");
    expect(allowedChildren.tableRef).toEqual([]);
  });

  it("빌더 — 코드 하나, 인자 연결은 없다", () => {
    expect(make().tableRef("DT000001")).toEqual({ id: "n1", kind: "tableRef", code: "DT000001" });
  });

  it("조 아래 · 항 아래 목록은 통과", () => {
    const b = make();
    const ok = b.document("d", [b.article("a", [b.paragraph([b.text("표")], [b.tableRef("DT000002")]), b.tableRef("DT000001")])]);
    expect(validateTree(ok, { kind: "special" })).toEqual([]);
  });

  it("보통약관 문맥(general)에는 넣을 수 없다 — structure", () => {
    const b = make();
    const doc = b.document("d", [b.article("a", [b.tableRef("DT000001")])]);
    expect(validateTree(doc, { kind: "general" }).map((i) => [i.kind, i.message])).toEqual([["structure", "표 구분자는 담보약관(상품담보) 문맥에서만 쓸 수 있습니다 — 보통약관에는 넣을 수 없습니다"]]);
  });

  it("표 구분자가 아닌 코드는 brokenRef", () => {
    const b = make();
    const doc = b.document("d", [b.article("a", [b.tableRef("D0001")])]);
    expect(validateTree(doc, { kind: "special" }).map((i) => [i.kind, i.message, i.at.nodePath?.at(-1)])).toEqual([["brokenRef", "표 구분자 D0001 이(가) 없습니다", "n1"]]);
  });
});
