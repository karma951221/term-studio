/**
 * 우측 패널 「편집」 탭의 규칙 (2026-10-21, 기능/문면 §4.3) — 탭 전환 · 폼 주 버튼 · 고른 것 · 넣은 뒤 이어 열 폼 · 미적용 가로채기.
 *
 * - 편집 탭은 편집 모드에만, 탭 줄 맨 앞에 선다. 편집에 들어가거나 본문에서 무언가 고르면 편집 탭으로, 편집이 끝나면 들어오기 전 탭으로.
 * - 폼의 주 버튼은 넣기 폼이면 「넣기」, 고치기 폼이면 「적용」 — 적용은 편집본에만(저장은 바의 `저장` 한 번, ADR-0074).
 * - 적용하지 않은 변경이 있는 채 다른 것을 고르거나 저장 · ✕ · 경로 링크를 누르면 확인 카드(적용 / 버리기 / 돌아가기).
 */
import { useCallback, useRef, useState } from "react";

import { isArticleOmitMode, isJoinMode, type ArticleNode, type EditOp } from "@/domain/document";
import type { Id } from "@/domain/types";

import { insertedChip } from "./editOps";
import type { PopupSpec } from "./menus";

export type PanelTab = "edit" | "preview" | "leaves" | "issues";

export interface TabState {
  tab: PanelTab;
  /** 편집이 끝나면 돌아갈 탭 — 편집에 들어오기 직전 탭. */
  before: PanelTab;
}

export function panelTabsFor(docKind: "special" | "general", editing: boolean): PanelTab[] {
  return [...(editing ? (["edit"] as const) : []), "preview", ...(docKind === "special" ? (["leaves"] as const) : []), "issues"];
}

export function tabOnEnterEdit(s: TabState): TabState {
  return { tab: "edit", before: s.tab === "edit" ? s.before : s.tab };
}

/** 본문에서 무언가 골랐다 — 편집 탭으로. */
export const tabOnPick = tabOnEnterEdit;

export function tabOnLeaveEdit(s: TabState): TabState {
  return s.tab === "edit" ? { tab: s.before, before: s.before } : s;
}

/**
 * 조 옵션 폼(준용하기 · 생략 기준 — 보통약관 템플릿 조, ADR-0082 결정 5 · ADR-0093)의 명령 — 바뀐 값만.
 * 모르는 값은 기본(없음 · 같을 때만)으로, 둘 다 그대로면 빈 목록(폼은 그냥 닫는다). 「같을 때만」은 `omitMode exact`(속성 삭제).
 */
export function articleOptionOps(a: ArticleNode, joinMode: string, omitMode: string): EditOp[] {
  const join = isJoinMode(joinMode) ? joinMode : "none";
  const omit = isArticleOmitMode(omitMode) ? omitMode : "exact";
  const ops: EditOp[] = [];
  if (join !== (a.joinMode ?? "none")) ops.push({ type: "joinMode", articleId: a.id, mode: join });
  if (omit !== (a.omitMode ?? "exact")) ops.push({ type: "omitMode", articleId: a.id, mode: omit });
  return ops;
}

/** 넣기 폼인가 — 주 버튼 「넣기」. */
export function isInsertSpec(spec: PopupSpec): boolean {
  switch (spec.kind) {
    case "insertInline":
    case "newTable":
    case "clauseBlock":
    case "boxPick":
    case "dynTable":
    case "repeatInline":
      return true;
    case "repeatBlock":
      return spec.nodeId === undefined;
    default:
      return false;
  }
}

export const submitLabel = (spec: PopupSpec): "넣기" | "적용" => (isInsertSpec(spec) ? "넣기" : "적용");

/** 고친 것이 없어도 주 버튼을 누를 수 있는 폼 — 넣기(처음 값 그대로 넣는다) · 추천값으로 연 코드 고치기. */
export function alwaysSubmittable(spec: PopupSpec): boolean {
  return isInsertSpec(spec) || (spec.kind === "code" && spec.suggest === true);
}

/** 본문에 테두리를 칠 자리 — `head` 면 조건 가지 머리 줄(`data-cond-head`), 아니면 노드(`data-node`). */
export function pickedOf(spec: PopupSpec): { id: Id; head?: true } | undefined {
  switch (spec.kind) {
    case "editChip":
    case "code":
      return { id: spec.nodeId };
    case "condHead":
      return { id: spec.branchId, head: true };
    case "repeatBlock":
      return spec.nodeId !== undefined ? { id: spec.nodeId } : undefined;
    case "tableProps":
    case "repeat":
      return { id: spec.tableId };
    case "link":
    case "joinMode":
      return { id: spec.articleId };
    default:
      return undefined;
  }
}

/** 넣은 뒤 이어 열 폼 — 넣은 칩 · 블록이 고른 것이 된다. 고칠 것이 없는 것(박스 · 구조 표기)이면 없음(빈 편집 탭). */
export function followUpSpec(ops: readonly EditOp[]): PopupSpec | undefined {
  const chip = insertedChip(ops);
  if (chip) {
    const kind = ops.flatMap((op) => (op.type === "setInlines" ? op.runs : [])).flatMap((r) => ("node" in r && r.node.id === chip ? [r.node.kind] : []))[0];
    return kind === "structKey" ? undefined : { kind: "editChip", nodeId: chip };
  }
  for (const op of ops) {
    if (op.type !== "insert") continue;
    const n = op.node;
    if (n.kind === "clauseBlockRef" || n.kind === "dynTableRef") return { kind: "editChip", nodeId: n.id };
    if (n.kind === "forBlock") return { kind: "repeatBlock", nodeId: n.id };
    if (n.kind === "table") return { kind: "tableProps", tableId: n.id };
  }
  return undefined;
}

/** 폼 값 → 견줄 글자 (순서 무관). 처음 값과 다르면 고친 것이 있다. */
export function formSnapshot(entries: Iterable<readonly [string, unknown]>): string {
  return [...entries]
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : v instanceof Blob ? "(파일)" : String(v)}`)
    .sort()
    .join("\u0001");
}

export type GuardChoice = "apply" | "discard" | "stay";

/**
 * 미적용 가로채기 — `guard(run)` 은 고친 것이 없으면 곧바로 돌리고, 있으면 멈춰 카드를 띄운다(`pending`).
 * `resolve` — 적용(거부되면 돌지 않고 폼에 남는다) · 버리기(적용 없이 돈다) · 돌아가기(아무것도 안 함).
 */
export function useEditGuard(dirty: boolean) {
  const [pending, setPending] = useState(false);
  const action = useRef<(() => void) | undefined>(undefined);
  const guard = useCallback(
    (run: () => void) => {
      if (!dirty) {
        run();
        return;
      }
      action.current = run;
      setPending(true);
    },
    [dirty],
  );
  const resolve = useCallback((choice: GuardChoice, apply: () => boolean) => {
    const run = action.current;
    action.current = undefined;
    setPending(false);
    if (!run || choice === "stay") return;
    if (choice === "apply" && !apply()) return;
    run();
  }, []);
  return { guard, pending, resolve };
}
