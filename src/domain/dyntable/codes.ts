/**
 * 표 구분자 코드 (기능/구분자 §3.7, ADR-0099) — 시스템이 정해 둔 고정 코드. 채번하지 않는다(DB 행이 없다).
 *
 * 옛 동적표 코드(`DT000001` …)를 그대로 이어 쓴다 — 구분자 순번(`D0001`)과 섞이지 않는다.
 * 의존 없는 잎 모듈이라 식 검사(catalog) · 문면 검사(document)가 순환 없이 「표 구분자인가」를 묻는다.
 */
import type { Code } from "../types";

/** 보험금 지급금액표 · 갱신 보험금 지급금액표 · 통합치료비 지급금액표 · 갱신 통합치료비 지급금액표. 정의는 `system.ts`. */
export const TABLE_DISCRIMINATOR_CODES: readonly Code[] = ["DT000001", "DT000002", "DT000003", "DT000004"];

const CODES = new Set<string>(TABLE_DISCRIMINATOR_CODES);

export function isTableDiscriminatorCode(code: string): boolean {
  return CODES.has(code);
}
