/**
 * 조 참조 칸의 노출 판정 · 미리보기 (기능/문면 §4.3, 2026-10-29) — 화면(`ArticleRefFields`)이 그리기만 하게 판정을 여기 모은다.
 *
 * - 값 · 키 한정 칸은 고른 대상이나 참조 자리가 반복 안일 때만 선다 — 평범한 항 하나에 「없음 — 펼친 것 전부」를 늘어놓지 않는다.
 * - 연결어는 여러 번호가 될 수 있을 때만 고른다(결정 14) — 못 고르면 화면은 라디오 대신 한 줄로 줄인다.
 * - 미리보기는 칩과 같은 덩어리 규칙(`referenceChunkLabel`) — 편집기 번호라 분기 · 반복 펼침은 조립이 확정한다.
 */
import { referenceChunkLabel, type ReferenceTarget } from "@/domain/document";
import type { ReferenceConnector } from "@/domain/types";

export interface RefFieldsState {
  /** 고른 대상 수. */
  count: number;
  /** 고른 대상 중 반복 블록 안 · 반복 블록 · 함수조항 참조가 있나 — 하나여도 여러 번호가 될 수 있다. */
  repeatedPicked: boolean;
  /** 고른 한정 (`restrictMode` 값, `""` 없음). */
  mode: string;
  /** 문서에 사유(열거값) 반복이 있어 「해당 값들」 후보가 있나. */
  hasValues: boolean;
  /** 참조 자리를 감싼 사유 반복이 있나 — 「현재 값」 후보. */
  hasValueLoops: boolean;
  /** 고른 대상이 선 담보 트리 반복의 레벨 — 「해당 키들」 · 「현재 세부보장」. */
  treeLevel: "subCoverage" | "benefit" | undefined;
}

export function restrictShown(s: RefFieldsState): boolean {
  if (s.mode !== "") return true;
  if (s.count === 0) return false;
  if (s.treeLevel !== undefined) return true;
  return s.hasValues && (s.repeatedPicked || s.hasValueLoops);
}

export function connectorEnabled(s: Pick<RefFieldsState, "count" | "repeatedPicked" | "mode">): boolean {
  return s.count >= 2 || s.repeatedPicked || s.mode !== "";
}

/** 고른 대상(문서 순서)이 찍힐 문구 — 연결어를 못 고르는 상태면 연결어 없이, 고를 수 있는데 아직이면 자리표시. */
export function pickedPreview(targets: readonly ReferenceTarget[], connector: ReferenceConnector | undefined, joins: boolean): string | undefined {
  if (targets.length === 0) return undefined;
  return referenceChunkLabel(targets, joins ? connector : undefined);
}

/**
 * 미리보기 끝의 한정 표기 — 칩(`articleRefText`)과 같은 말. `picked` = 지금 고른 값 이름 · 키 이름 · 「현재」 반복 이름.
 * 「해당 값들 · 키들」인데 아직 하나도 안 골랐으면 「?」 — 그대로 적용하면 거부된다.
 */
export function restrictSuffix(mode: string, picked: { values: readonly string[]; keys: readonly string[]; current?: string }): string {
  if (mode === "") return "";
  if (mode.startsWith("current:")) return ` ⟨현재 값 — ${picked.current ?? "반복"}⟩`;
  if (mode === "keys") return ` ⟨해당 키 — ${picked.keys.length > 0 ? picked.keys.join(" · ") : "?"}⟩`;
  return ` ⟨값 = ${picked.values.length > 0 ? picked.values.join(" · ") : "?"}⟩`;
}
