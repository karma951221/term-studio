/**
 * 문장 안 조건 · 문장 안 값별 분기 폼의 초안 (편집 탭, 2026-10-21) — 식 · 가지 추가 · 삭제 · 칸 값을 폼 안에 모았다가
 * 「적용」 때 명령 묶음(`branchFormOps`)으로 한꺼번에 편집본에 넣는다. 예전 팝업은 고칠 때마다 곧바로 적용했다.
 *
 * 가지 문장(그 자리 편집기)은 초안에 들지 않는다 — 본문 문장과 같이 초점이 떠날 때 편집본에 들어간다.
 * 그래서 새로 더한 가지의 문장은 적용한 뒤에 쓴다.
 */
import type { EditOp, InlineBranch } from "@/domain/document";
import type { Code, Id } from "@/domain/types";

export interface DraftBranch {
  id: Id;
  when?: string;
  values?: readonly Code[];
  empty?: boolean;
  /** 폼에서 새로 더한 가지 — 적용 때 `addBranch`. */
  added?: true;
  /** 지울 원래 가지 — 화면에서 숨기고 적용 때 `removeBranch`. 넣는 자리를 셀 때는 아직 있다. */
  removed?: true;
}

export interface BranchDraft {
  switchOn?: string;
  branches: DraftBranch[];
}

interface BranchOwner {
  id: Id;
  switchOn?: string;
  branches: readonly InlineBranch[];
}

export function branchDraftOf(node: BranchOwner): BranchDraft {
  return {
    ...(node.switchOn !== undefined ? { switchOn: node.switchOn } : {}),
    branches: node.branches.map((br) => ({
      id: br.id,
      ...(br.when !== undefined ? { when: br.when } : {}),
      ...(br.values ? { values: [...br.values] } : {}),
      ...(br.empty ? { empty: true } : {}),
    })),
  };
}

/** 화면에 보이는 가지 — 지울 것을 뺀다. */
export const shownBranches = (d: BranchDraft): DraftBranch[] => d.branches.filter((b) => !b.removed);

const patch = (d: BranchDraft, id: Id, p: Partial<DraftBranch>): BranchDraft => ({ ...d, branches: d.branches.map((b) => (b.id === id ? { ...b, ...p } : b)) });

export const setDraftWhen = (d: BranchDraft, id: Id, when: string): BranchDraft => patch(d, id, { when });

export function setDraftCase(d: BranchDraft, id: Id, values: readonly Code[], empty: boolean): BranchDraft {
  return patch(d, id, { values: [...values], empty });
}

/** 대상을 바꾼다 — 칸마다 새 대상에 있는 값만 남긴다. */
export function setDraftSubject(d: BranchDraft, on: string, keep: ReadonlySet<Code>): BranchDraft {
  return { ...d, switchOn: on, branches: d.branches.map((b) => ({ ...b, values: (b.values ?? []).filter((v) => keep.has(v)) })) };
}

/** ELIF — ELSE 가 있으면 그 앞, 없으면 끝. */
export function addElif(d: BranchDraft, newId: () => Id): BranchDraft {
  const at = d.branches.findIndex((b) => !b.removed && b.when === undefined);
  const branch: DraftBranch = { id: newId(), when: "", added: true };
  const branches = [...d.branches];
  branches.splice(at >= 0 ? at : branches.length, 0, branch);
  return { ...d, branches };
}

/** ELSE — 이미 있으면 그대로. */
export function addElse(d: BranchDraft, newId: () => Id): BranchDraft {
  if (shownBranches(d).some((b) => b.when === undefined)) return d;
  return { ...d, branches: [...d.branches, { id: newId(), added: true }] };
}

/** 값별 분기의 칸 추가 — 끝에. */
export function addCase(d: BranchDraft, newId: () => Id, values: readonly Code[]): BranchDraft {
  return { ...d, branches: [...d.branches, { id: newId(), values: [...values], added: true }] };
}

/** 가지 삭제 — 남은 가지가 하나면 지우지 않는다. 새로 더한 가지면 초안에서 뺀다. */
export function removeDraftBranch(d: BranchDraft, id: Id): BranchDraft {
  if (shownBranches(d).length <= 1) return d;
  const target = d.branches.find((b) => b.id === id);
  if (!target) return d;
  if (target.added) return { ...d, branches: d.branches.filter((b) => b.id !== id) };
  return patch(d, id, { removed: true });
}

const sameList = (a: readonly Code[] | undefined, b: readonly Code[] | undefined) => (a ?? []).join("|") === (b ?? []).join("|");

/**
 * 초안 → 명령. 순서: 대상(setSwitch) → 넣기(addBranch, 지울 가지가 아직 있는 목록의 자리) → 식 · 칸(setWhen · setCase) → 지우기(removeBranch).
 * 넣기를 지우기보다 먼저 해 「마지막 남은 가지」 거부에 걸리지 않는다.
 */
export function branchFormOps(node: BranchOwner, d: BranchDraft): EditOp[] {
  const ops: EditOp[] = [];
  const isSwitch = node.switchOn !== undefined;
  if (isSwitch && d.switchOn !== undefined && d.switchOn !== node.switchOn) ops.push({ type: "setSwitch", nodeId: node.id, on: d.switchOn });
  d.branches.forEach((b, index) => {
    if (!b.added) return;
    const branch: InlineBranch = isSwitch
      ? { id: b.id, values: [...(b.values ?? [])], ...(b.empty ? { empty: true as const } : {}), children: [] }
      : { id: b.id, ...(b.when !== undefined ? { when: b.when } : {}), children: [] };
    ops.push({ type: "addBranch", condId: node.id, branch, index });
  });
  for (const b of d.branches) {
    if (b.added || b.removed) continue;
    const before = node.branches.find((x) => x.id === b.id);
    if (!before) continue;
    if (!isSwitch && b.when !== undefined && b.when !== before.when) ops.push({ type: "setWhen", branchId: b.id, when: b.when });
    if (isSwitch && (!sameList(b.values, before.values) || (b.empty === true) !== (before.empty === true))) ops.push({ type: "setCase", branchId: b.id, values: [...(b.values ?? [])], empty: b.empty === true });
  }
  for (const b of d.branches) if (b.removed) ops.push({ type: "removeBranch", branchId: b.id });
  return ops;
}
