/**
 * 상품담보 값 화면의 편집 초안 — 순수 (기능/상품 §4.8, M12 재작성).
 *
 * 초안 = 스냅샷 실체(상품담보 · 세부보장 · 급부)마다 폼 편집 상태(`FormState`). `편집`이 저장값으로 세우고, `저장` 하나가
 * 고친 노드의 값만 모아 한 번에 보낸다(`saveSnapshotAction`). 값 비우기 · 가져오기 · 특성 붙이기/떼기는 전부 `formReducer` 액션이다.
 */
import { isDirty } from "@/app/_lib/edit";
import type { Issue } from "@/domain/types";
import { initFormState, toSubmission, type FormModel, type FormState } from "@/forms";
import type { SnapshotOwner, SnapshotWrites } from "@/services/product";

/** 노드 하나 — 스냅샷 실체와 그 레벨의 값 폼 모델(저장값 + 마스터 값). */
export interface SnapshotOwnerModel {
  owner: SnapshotOwner;
  model: FormModel;
}

export type SnapshotDraft = Record<string, FormState>;

/** 저장값으로 세운 초안 — 노드 id → 편집 상태. */
export function initSnapshotDraft(owners: readonly SnapshotOwnerModel[]): SnapshotDraft {
  return Object.fromEntries(owners.map(({ owner, model }) => [owner.id, initFormState(model)]));
}

/** 비교할 모양 — 입력 원문과 여는 폼만(파싱 결과 · 손댐 표식은 보지 않는다). */
function shape(draft: SnapshotDraft) {
  return Object.fromEntries(
    Object.entries(draft).map(([id, state]) => [id, { open: state.open, drafts: Object.fromEntries(Object.entries(state.fields).map(([path, f]) => [path, f.draft])) }]),
  );
}

/** 초안이 편집 시작(= 저장값)과 달라졌나 — `취소` · 경로 링크의 「고친 내용을 버립니까?」 판정. 입력했다 되돌리면 아니다. */
export function snapshotDraftDirty(owners: readonly SnapshotOwnerModel[], draft: SnapshotDraft): boolean {
  return isDirty(shape(initSnapshotDraft(owners)), shape(draft));
}

/** 저장할 것 — 값이 바뀐 노드만. 해석할 수 없는 칸이 하나라도 있으면 `invalid`(칸에 오류가 이미 보인다). */
export function snapshotWritesOf(owners: readonly SnapshotOwnerModel[], draft: SnapshotDraft): { writes: SnapshotWrites[]; invalid: boolean } {
  const writes: SnapshotWrites[] = [];
  let invalid = false;
  for (const { owner } of owners) {
    const state = draft[owner.id];
    if (!state) continue;
    const submission = toSubmission(state);
    if (submission.issues.length > 0) invalid = true;
    if (submission.values.length > 0) writes.push({ owner, entries: submission.values });
  }
  return { writes, invalid };
}

/** 서버 이슈 중 그 노드 것 — 칸(`refPath`)은 폼이 가려 붙인다. */
export function issuesOfOwner(issues: readonly Issue[], ownerId: string): Issue[] {
  return issues.filter((i) => i.at.ownerId === ownerId);
}
