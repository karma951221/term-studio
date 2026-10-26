import { describe, expect, it } from "vitest";

import { entered, type Issue, type ValueSlot } from "@/domain/types";
import { buildForm, formReducer } from "@/forms";

import { initSnapshotDraft, issuesOfOwner, snapshotDraftDirty, snapshotWritesOf, type SnapshotOwnerModel } from "./lib";

const benefit = (mine: [string, ValueSlot][], theirs: [string, ValueSlot][] = []) =>
  buildForm("benefit", () => undefined, new Map(mine), { masterLabel: "급부 (마스터)", masterValues: new Map(theirs) });

const owners = (): SnapshotOwnerModel[] => [
  { owner: { kind: "productBenefit", id: "b1" }, model: benefit([["exemption.months", entered(3)], ["exemption.age15_only", entered(false)], ["exemption.new_only", entered(true)]], [["exemption.months", entered(3)]]) },
  { owner: { kind: "productBenefit", id: "b2" }, model: benefit([["pay.rate", entered(80)]]) },
];

describe("상품담보 값 화면 초안 (기능/상품 §4.8)", () => {
  it("편집 시작 초안은 고친 것이 없다 — 저장할 값도 없다", () => {
    const list = owners();
    const draft = initSnapshotDraft(list);
    expect(snapshotDraftDirty(list, draft)).toBe(false);
    expect(snapshotWritesOf(list, draft)).toEqual({ writes: [], invalid: false });
  });

  it("고치면 dirty · 그 노드만 쓰기에 실린다. 입력했다 되돌리면 dirty 가 아니다", () => {
    const list = owners();
    let draft = initSnapshotDraft(list);
    draft = { ...draft, b2: formReducer(draft.b2!, { type: "edit", path: "pay.rate", draft: "70" }) };
    expect(snapshotDraftDirty(list, draft)).toBe(true);
    expect(snapshotWritesOf(list, draft).writes).toEqual([{ owner: { kind: "productBenefit", id: "b2" }, entries: [{ path: "pay.rate", value: 70 }] }]);
    draft = { ...draft, b2: formReducer(draft.b2!, { type: "edit", path: "pay.rate", draft: "80" }) };
    expect(snapshotDraftDirty(list, draft)).toBe(false);
  });

  it("특성 ⊖ — 폼을 닫으면 dirty, 저장된 값은 지우기로 실린다", () => {
    const list = owners();
    let draft = initSnapshotDraft(list);
    draft = { ...draft, b1: formReducer(draft.b1!, { type: "closeForm", form: "exemption" }) };
    expect(snapshotDraftDirty(list, draft)).toBe(true);
    expect(snapshotWritesOf(list, draft).writes[0]!.entries).toEqual([
      { path: "exemption.months", value: undefined },
      { path: "exemption.age15_only", value: undefined },
      { path: "exemption.new_only", value: undefined },
    ]);
  });

  it("저장값이 없는 칸의 기본값 제안은 저장에 실린다 — 저장이 곧 확인 (ADR-0004)", () => {
    const list: SnapshotOwnerModel[] = [{ owner: { kind: "productBenefit", id: "b3" }, model: benefit([["exemption.months", entered(3)]]) }];
    expect(snapshotDraftDirty(list, initSnapshotDraft(list))).toBe(false);
    expect(snapshotWritesOf(list, initSnapshotDraft(list)).writes[0]!.entries).toEqual([
      { path: "exemption.age15_only", value: false },
      { path: "exemption.new_only", value: true },
    ]);
  });

  it("해석할 수 없는 칸이 있으면 invalid — 저장하지 않는다", () => {
    const list = owners();
    let draft = initSnapshotDraft(list);
    draft = { ...draft, b2: formReducer(draft.b2!, { type: "edit", path: "pay.rate", draft: "많이" }) };
    expect(snapshotWritesOf(list, draft).invalid).toBe(true);
  });

  it("서버 이슈는 그 노드 것만", () => {
    const issues: Issue[] = [
      { kind: "typeMismatch", message: "a", at: { ownerId: "b1", refPath: "exemption.months" } },
      { kind: "typeMismatch", message: "b", at: { ownerId: "b2", refPath: "pay.rate" } },
    ];
    expect(issuesOfOwner(issues, "b2").map((i) => i.message)).toEqual(["b"]);
  });
});
