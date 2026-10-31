/**
 * 동적표 표본 정의 — QA/인수기준 「동적표(감액 지급금액 표) 인수 케이스」가 쓰는 정의 셋 (순수, JSON 으로 그대로 저장할 수 있는 모양).
 *
 * - A  (감액 표)   : 첫 · 가운데 · 마지막 머리글을 채운 감액 구간형 · 인자 `갱신형`(boolean). 〔기준일〕 = 조건 `arg.갱신형` → 「최초계약일」, 그 밖 「계약일」.
 *                    첫 「〔기준일〕부터 {경계}경과시점 전일 이전」 · 가운데 「〔기준일〕부터 {앞경계}경과시점 이후 〔기준일〕부터 {경계}경과시점 전일 이전」 ·
 *                    마지막 「〔기준일〕부터 {경계}경과시점 이후」 · 단일 「지급금액」 · 셀 「〔세부보장 수 ≥ 2 이면 「해당보장의 」〕보험가입금액의 {비율}%」.
 * - A′ (주요치료비) : A + 글 인자 `단서` — 첫 · 마지막 열 끝에 ` {arg.단서}`.
 * - R  ((갱신) 표)  : 첫 · 가운데 · 마지막을 비운 단일형 · 단일 「지급금액」 · 셀은 A 와 같다.
 * - F  (정액 표)    : 정액형(§3.7, 통합치료비) — 머리글은 A 와 같고(인자 `갱신형`), 셀 「{금액}」 · 캡션 「<보험가입금액 {가입금액}>」 · 급부 머리글 「{번호}. {급부명}」.
 * - FR ((갱신) 정액 표): F 의 단일형 — 첫 · 가운데 · 마지막을 비우고 인자 없음.
 *
 * 노드 id 는 고정이라 시드 · 테스트가 같은 정의를 본다. 테스트 전용이 아니다 — 시드(뒷 단계)가 그대로 쓴다.
 */
import type { Inline } from "../clause/nodes";
import { DEFAULT_ROW_HEADER, DYN_TABLE_SLOTS, defaultAmountCellTemplate, defaultBenefitHeaderTemplate, defaultCaptionTemplate, type NewDynTable } from "./types";

/** 「해당보장의」 조건식 — 그 담보의 세부보장 수 ≥ 2 (기능/동적표 §3.3; 조립이 담보 문맥에서 평가한다). */
export const SUB_COVERAGE_COUNT_COND = "count(builtin.subCoverage.name) >= 2";

const text = (id: string, t: string): Inline => ({ id, kind: "text", text: t });
const slot = (id: string, ref: string): Inline => ({ id, kind: "slot", ref });

/** 〔기준일〕 — 갱신형이면 「최초계약일」, 아니면 「계약일」. */
function baseDate(id: string): Inline {
  return {
    id,
    kind: "inlineCond",
    branches: [
      { id: `${id}-b1`, when: "arg.갱신형", children: [text(`${id}-b1-t`, "최초계약일")] },
      { id: `${id}-b2`, children: [text(`${id}-b2-t`, "계약일")] },
    ],
  };
}

/** 셀 「〔세부보장 수 ≥ 2 이면 「해당보장의 」〕보험가입금액의 {비율}%」. */
function cellTemplate(): Inline[] {
  return [
    { id: "cell-prefix", kind: "inlineCond", branches: [{ id: "cell-prefix-b1", when: SUB_COVERAGE_COUNT_COND, children: [text("cell-prefix-b1-t", "해당보장의 ")] }] },
    text("cell-t1", "보험가입금액의 "),
    slot("cell-rate", DYN_TABLE_SLOTS.rate),
    text("cell-t2", "%"),
  ];
}

function firstHeader(): Inline[] {
  return [baseDate("first-base"), text("first-t1", "부터 "), slot("first-boundary", DYN_TABLE_SLOTS.boundary), text("first-t2", "경과시점 전일 이전")];
}

function middleHeader(): Inline[] {
  return [
    baseDate("middle-base1"),
    text("middle-t1", "부터 "),
    slot("middle-prev", DYN_TABLE_SLOTS.prevBoundary),
    text("middle-t2", "경과시점 이후 "),
    baseDate("middle-base2"),
    text("middle-t3", "부터 "),
    slot("middle-boundary", DYN_TABLE_SLOTS.boundary),
    text("middle-t4", "경과시점 전일 이전"),
  ];
}

function lastHeader(): Inline[] {
  return [baseDate("last-base"), text("last-t1", "부터 "), slot("last-boundary", DYN_TABLE_SLOTS.boundary), text("last-t2", "경과시점 이후")];
}

function singleHeader(): Inline[] {
  return [text("single-t1", "지급금액")];
}

/** 정의 A — 감액 지급금액 표. */
export function dynTableFixtureA(): NewDynTable {
  return {
    label: "감액 지급금액 표",
    params: [{ name: "갱신형", type: { kind: "boolean" } }],
    rowHeader: DEFAULT_ROW_HEADER,
    headers: { first: firstHeader(), middle: middleHeader(), last: lastHeader(), single: singleHeader() },
    cell: cellTemplate(),
  };
}

/** 정의 A′ — 주요치료비(단서문구 글 인자 `단서`가 첫 · 마지막 열 끝에 붙는다). */
export function dynTableFixtureAPrime(): NewDynTable {
  const a = dynTableFixtureA();
  return {
    ...a,
    label: "감액 지급금액 표(단서)",
    params: [...a.params, { name: "단서", type: { kind: "string" } }],
    headers: {
      ...a.headers,
      first: [...a.headers.first, text("first-t3", " "), slot("first-clause", "arg.단서")],
      last: [...a.headers.last, text("last-t3", " "), slot("last-clause", "arg.단서")],
    },
  };
}

/** 정의 R — (갱신) 표: 단일형(첫 · 가운데 · 마지막 비움), 단일 열 「지급금액」, 셀은 A 와 같다. */
export function dynTableFixtureR(): NewDynTable {
  return {
    label: "(갱신) 지급금액 표",
    params: [],
    rowHeader: DEFAULT_ROW_HEADER,
    headers: { first: [], middle: [], last: [], single: singleHeader() },
    cell: cellTemplate(),
  };
}

/** 정의 F — 정액 지급금액 표(통합치료비): 머리글 · 인자는 A 와 같고, 셀 「{금액}」 · 캡션 · 급부 머리글 (§3.7). */
export function dynTableFixtureF(): NewDynTable {
  return {
    label: "정액 지급금액 표",
    params: [{ name: "갱신형", type: { kind: "boolean" } }],
    rowHeader: DEFAULT_ROW_HEADER,
    headers: { first: firstHeader(), middle: middleHeader(), last: lastHeader(), single: singleHeader() },
    cell: defaultAmountCellTemplate(),
    fixed: { caption: defaultCaptionTemplate(), benefitHeader: defaultBenefitHeaderTemplate() },
  };
}

/** 정의 FR — (갱신) 정액 지급금액 표: F 의 단일형(첫 · 가운데 · 마지막 비움 · 인자 없음). 문면의 갱신형 조건 블록에 넣는다 (§3.7). */
export function dynTableFixtureFR(): NewDynTable {
  return {
    label: "(갱신) 정액 지급금액 표",
    params: [],
    rowHeader: DEFAULT_ROW_HEADER,
    headers: { first: [], middle: [], last: [], single: singleHeader() },
    cell: defaultAmountCellTemplate(),
    fixed: { caption: defaultCaptionTemplate(), benefitHeader: defaultBenefitHeaderTemplate() },
  };
}
