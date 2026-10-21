import { describe, expect, it } from "vitest";

import { nodeBuilders, sequentialIds } from "@/domain/document";

import { addCase, addElif, addElse, branchDraftOf, branchFormOps, removeDraftBranch, setDraftCase, setDraftSubject, setDraftWhen } from "./branchForm";

const b = nodeBuilders(sequentialIds("n"));
const cond = () => {
  const node = b.inlineCond([b.inlineBranch("D1 = true", [b.text("가")]), b.inlineBranch(undefined, [b.text("나")])]);
  return node;
};

describe("문장 안 조건 폼 — 고친 것을 모았다가 적용 때 명령으로 (편집 탭)", () => {
  it("고친 것이 없으면 명령도 없다", () => {
    const node = cond();
    expect(branchFormOps(node, branchDraftOf(node))).toEqual([]);
  });

  it("식을 고치면 setWhen 하나", () => {
    const node = cond();
    const d = setDraftWhen(branchDraftOf(node), node.branches[0].id, "D1 = false");
    expect(branchFormOps(node, d)).toEqual([{ type: "setWhen", branchId: node.branches[0].id, when: "D1 = false" }]);
  });

  it("ELIF 는 ELSE 앞에 선다 — 넣는 명령의 자리도 ELSE 앞, 새 가지는 고친 식을 실은 채", () => {
    const node = cond();
    let d = addElif(branchDraftOf(node), () => "new1");
    d = setDraftWhen(d, "new1", "D2 = true");
    expect(d.branches.map((x) => x.id)).toEqual([node.branches[0].id, "new1", node.branches[1].id]);
    expect(branchFormOps(node, d)).toEqual([{ type: "addBranch", condId: node.id, branch: { id: "new1", when: "D2 = true", children: [] }, index: 1 }]);
  });

  it("ELSE 가 없으면 끝에 하나 — 있으면 더하지 않는다", () => {
    const only = b.inlineCond([b.inlineBranch("D1", [])]);
    const d = addElse(branchDraftOf(only), () => "e");
    expect(branchFormOps(only, d)).toEqual([{ type: "addBranch", condId: only.id, branch: { id: "e", children: [] }, index: 1 }]);
    const node = cond();
    expect(addElse(branchDraftOf(node), () => "x").branches).toHaveLength(2);
  });

  it("가지 삭제는 넣기 · 고치기 뒤에 — 원래 가지를 다 지우고 새 가지만 남겨도 「마지막 가지」에 걸리지 않는다", () => {
    const node = cond();
    let d = addElif(branchDraftOf(node), () => "new1");
    d = removeDraftBranch(d, node.branches[0].id);
    d = removeDraftBranch(d, node.branches[1].id);
    const ops = branchFormOps(node, d);
    expect(ops.map((o) => o.type)).toEqual(["addBranch", "removeBranch", "removeBranch"]);
    // 넣는 자리는 지울 가지가 아직 있는 목록 기준 — IF 뒤(ELSE 앞)
    expect(ops[0]).toMatchObject({ index: 1 });
  });

  it("새로 넣은 가지를 지우면 명령이 없다", () => {
    const node = cond();
    const d = removeDraftBranch(addElif(branchDraftOf(node), () => "new1"), "new1");
    expect(branchFormOps(node, d)).toEqual([]);
  });

  it("남은 가지가 하나면 지우지 않는다", () => {
    const only = b.inlineCond([b.inlineBranch("D1", [])]);
    expect(removeDraftBranch(branchDraftOf(only), only.branches[0].id).branches).toHaveLength(1);
  });
});

describe("문장 안 값별 분기 폼", () => {
  const sw = () => {
    const node = b.inlineCond([
      { id: "c1", values: ["V1"], children: [] },
      { id: "c2", values: ["V2"], children: [b.text("둘")] },
    ]);
    return { ...node, switchOn: "arg.사유" };
  };

  it("칸 값 · 문구 없음을 고치면 setCase", () => {
    const node = sw();
    const d = setDraftCase(branchDraftOf(node), "c1", ["V1", "V3"], true);
    expect(branchFormOps(node, d)).toEqual([{ type: "setCase", branchId: "c1", values: ["V1", "V3"], empty: true }]);
  });

  it("대상을 바꾸면 setSwitch 뒤에 칸마다 남는 값만 — 바뀐 칸만 setCase", () => {
    const node = sw();
    const d = setDraftSubject(branchDraftOf(node), "arg.종", new Set(["V2"]));
    expect(branchFormOps(node, d)).toEqual([
      { type: "setSwitch", nodeId: node.id, on: "arg.종" },
      { type: "setCase", branchId: "c1", values: [], empty: false },
    ]);
  });

  it("칸 추가는 끝에", () => {
    const node = sw();
    const d = addCase(branchDraftOf(node), () => "c3", ["V9"]);
    expect(branchFormOps(node, d)).toEqual([{ type: "addBranch", condId: node.id, branch: { id: "c3", values: ["V9"], children: [] }, index: 2 }]);
  });
});
