/**
 * 동적표 도메인 (순수) — 기능/동적표.
 *
 * - types.ts      : DynTable · 템플릿 · 표 슬롯(`builtin.table.*`) · 펼침 입력 · 결과
 * - codes.ts      : DT000001 코드 규칙 (formatDynTableCode)
 * - check.ts      : checkDynTable — 저장 검사(인자 표 · 템플릿이 읽는 것 · 표 슬롯 자리 · 값별 분기)
 * - expand.ts     : expandDynTable — 경계 합집합 · 행 묶기 · 셀 계산 · 템플릿 바꿔 쓰기
 * - regions.ts    : 칸의 영역(corner · first · middle · last · single · cell · row) · 자리표시자 노드 — 상세 화면 칸 ↔ 필드
 * - fixture.ts    : 표본 정의 A · A′ · R (인수기준 · 시드)
 * - samples.ts    : 시스템 견본 다섯 · 견본이 인자를 채우는 규칙 (상세 화면 견본 표)
 * - sampleView.ts : renderDynTableSample — 견본으로 펼친 표, 칸마다 영역 + 글 조각(자리표시자 값 · 조건 글)
 */
export * from "./check";
export * from "./codes";
export * from "./expand";
export * from "./fixture";
export * from "./regions";
export * from "./samples";
export * from "./sampleView";
export * from "./types";
