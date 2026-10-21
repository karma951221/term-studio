/**
 * 표 모양 (순수) — 기능/동적표 §3.2 「표 모양은 머리글 구조가 정한다」(2026-10-21, 열 기준 `columnBasis` 폐지).
 *
 * - **단일형**: 첫 · 가운데 · 마지막 열 머리글이 모두 비었다 → 담보에 감액이 있어도 늘 열 하나(단일 열 템플릿), 비율 = 지급률. (갱신) 표(DT000002)가 이 모양.
 * - **감액 구간형**: 첫 · 가운데 · 마지막을 모두 채웠다 → 감액 경계 합집합으로 열을 나눈다. 경계가 없는 담보면 단일 열 템플릿으로 열 하나.
 * - 일부만 채움(첫/마지막 중 하나만 · 가운데만 · 가운데만 빔)은 저장 검사 오류(`tableShapeIssues`) — 빈 쪽 자리에 낸다.
 *   가운데만 비운 정의는 경계가 둘 이상인 담보에서 가운데 열 머리글이 빈 칸으로 찍히고, 첫/마지막 중 하나만 채우면 경계가 하나만 있어도 빈 머리글이 생긴다.
 *   편집 중(저장 전) 미리보기는 셋 중 하나라도 채웠으면 감액 구간형으로 펼쳐 빈 칸을 그대로 보인다.
 * - 단일 열 머리글은 두 모양 모두 쓰인다(감액 구간형도 감액 없는 담보에서) — 비면 저장 검사 오류.
 * - 「비었다」 = 노드가 없거나 공백 글뿐.
 *
 * DB·React import 금지 (순수층).
 */
import type { Inline } from "../clause/nodes";
import type { Issue } from "../types";
import type { DynTableHeaders } from "./types";

export type DynTableShape = "split" | "single";

/** 템플릿이 비었나 — 노드가 없거나 공백 글뿐. */
export function isBlankTemplate(inlines: readonly Inline[] | undefined): boolean {
  return (inlines ?? []).every((n) => n.kind === "text" && n.text.trim() === "");
}

const SPLIT_KEYS = ["first", "middle", "last"] as const;

const SPLIT_LABEL: Record<(typeof SPLIT_KEYS)[number], string> = { first: "첫 열", middle: "가운데 열", last: "마지막 열" };

/** 표 모양 — 첫 · 가운데 · 마지막이 모두 비면 단일형, 하나라도 채웠으면 감액 구간형. */
export function tableShape(headers: DynTableHeaders): DynTableShape {
  return SPLIT_KEYS.every((k) => isBlankTemplate(headers[k])) ? "single" : "split";
}

/** 모양 검사 — 일부만 채운 감액 구간 머리글(빈 쪽마다) · 빈 단일 열 머리글. */
export function tableShapeIssues(headers: DynTableHeaders): Issue[] {
  const issues: Issue[] = [];
  const blank = SPLIT_KEYS.filter((k) => isBlankTemplate(headers[k]));
  if (blank.length > 0 && blank.length < SPLIT_KEYS.length) {
    for (const k of blank)
      issues.push({
        kind: "structure",
        message: `${SPLIT_LABEL[k]} 머리글이 비어 있습니다 — 감액 구간으로 열을 나누려면 첫 · 가운데 · 마지막을 모두 채우고, 열 하나로 두려면 셋 다 비운다`,
        at: { refPath: `headers.${k}` },
      });
  }
  if (isBlankTemplate(headers.single)) issues.push({ kind: "structure", message: "단일 열 머리글이 비어 있습니다 — 열이 하나일 때(감액 없는 담보 · 단일형) 쓰인다", at: { refPath: "headers.single" } });
  return issues;
}
