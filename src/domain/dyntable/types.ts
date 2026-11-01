/**
 * 동적표 정의 타입 (순수) — 기능/동적표 §3.1 ~ §3.3.
 *
 * - 동적표는 함수조항과 같은 뼈대의 독립 객체: 코드(시스템 발급) · 이름 · 인자(값 인자만 — `ParamDef`) · 본문 대신 **표 규칙**.
 * - 표 규칙 = 행 기준(급부명, 고정) · 구분 칸 머리글 · 열 머리글 템플릿 네 벌(첫 · 가운데 · 마지막 · 단일) · 셀 템플릿.
 *   열을 감액 구간으로 나눌지는 머리글 구조가 정한다(`tableShape` — 첫 · 가운데 · 마지막을 모두 비우면 늘 열 하나, 2026-10-21 열 기준 폐지).
 * - 템플릿은 인라인 노드(`Inline[]`, clause/nodes.ts) — 글 + 슬롯 + 조건 · 값별 분기. 조건 · 분기는 `arg.X` 만 읽고(§3.1),
 *   셀 템플릿의 「해당보장의」 조건만 담보 구조 내장값(`count(builtin.subCoverage.name) >= 2`)을 읽는다 — 그것은 조립이 담보 문맥에서 평가한다.
 * - 표 슬롯은 내장 경로 `builtin.table.<슬롯>` 으로 적는다(`DYN_TABLE_SLOTS`) — 펼침(`expandDynTable`)이 글로 바꾼 뒤 돌려주므로 평가 문맥에는 오지 않는다.
 *
 * DB·React import 금지 (순수층).
 */
import type { Inline } from "../clause/nodes";
import type { ParamDef } from "../clause/params";
import type { EscalationStep, ReductionPeriods } from "../coverage/traits";
import type { Code, FixedGrid, Id, Issue } from "../types";

/** 열 머리글 템플릿 네 벌 — 열 하나 = 단일, 둘 = 첫 + 마지막, 셋 이상 = 첫 + 가운데(열마다) + 마지막 (§3.3). */
export interface DynTableHeaders {
  first: Inline[];
  middle: Inline[];
  last: Inline[];
  single: Inline[];
}

/**
 * 정액형 표(통합치료비 — §3.7)의 칸 — 있으면 이 정의는 정액형이다: 행 · 정액은 담보의 급부 「정액표」 특성에서 읽고,
 * 가입금액마다 캡션 + 표, 정액표 급부가 둘 이상이면 급부 머리글. 지급금액 열 머리글(`headers`)은 감액 표와 같고 셀 템플릿은 `{금액}` 을 쓴다.
 */
export interface DynTableFixed {
  /** 캡션 템플릿 — 슬롯 `{가입금액}`, 기본 `<보험가입금액 {가입금액}>`. */
  caption: Inline[];
  /** 급부 머리글 템플릿 — 슬롯 `{번호}` · `{급부명}`, 기본 `{번호}. {급부명}`. 정액표가 있는 급부가 둘 이상일 때만 찍는다. */
  benefitHeader: Inline[];
}

export type DynTableKind = "rate" | "amount";

export interface DynTable {
  id: Id;
  /** 시스템 발급 코드 (`T0001` — 채번은 서비스 단계). */
  code: Code;
  label: string;
  /** 값 인자만 (§3.1) — 조 참조 인자는 저장 검사가 거부한다. */
  params: ParamDef[];
  /** 구분 칸 머리글 — 기본 「구 분」. 정액형에서는 쓰지 않는다(글자 열 머리는 정액표가 정한다). */
  rowHeader: string;
  headers: DynTableHeaders;
  /** 셀 템플릿 — 감액 표는 「보험가입금액의 {비율}%」(`defaultCellTemplate`), 정액형은 「{금액}」(`defaultAmountCellTemplate`). */
  cell: Inline[];
  /** 정액형 표의 칸(§3.7) — 있으면 정액형, 없으면 감액(비율) 표. */
  fixed?: DynTableFixed;
  createdAt?: Date;
  updatedAt?: Date;
  /** 마지막으로 저장한 사람의 id — 이름은 화면이 붙인다. */
  updatedBy?: Id;
}

/** 생성 입력 — 코드 · id · 저장 메타 없음. */
export type NewDynTable = Omit<DynTable, "id" | "code" | "createdAt" | "updatedAt" | "updatedBy">;

/** 목록 화면용 요약. */
export interface DynTableSummary {
  code: Code;
  label: string;
  updatedAt?: Date;
  updatedBy?: Id;
}

/** 펼침 입력의 급부 하나 — 담보 트리 순서(세부보장 순 → 급부 순)로 준다. */
export interface DynBenefit {
  subCoverageKey: string;
  subCoverageName: string;
  key: string;
  /** 급부명 — 행 기준. 같으면 한 행으로 묶인다 (§3.2 · §3.4). */
  name: string;
  /** 지급률 `pay.rate` (%). undefined = 안 적음 = 100 (`DEFAULT_PAY_RATE`). */
  payRate?: number;
  /** 감액 구간 — undefined = 감액 폼을 열지 않음(모든 열 100). */
  reduction?: ReductionPeriods;
  /** 정액표 특성 (§3.7) — undefined = 정액표 없음(정액형 표에 나오지 않는다). */
  fixedGrid?: FixedGrid;
  /** 체증 특성 (기능/구분자 §3.7) — 구분마다 한 행. undefined · 빈 목록 = 체증 없음. */
  escalation?: EscalationStep[];
}

export interface ExpandedDynTableRow {
  name: string;
  /** 이 행에 묶인 급부 키 (트리 순). */
  benefitKeys: string[];
  /** `[급부명 글, 셀1 .. 셀N]` — 셀은 템플릿을 바꿔 쓴 인라인(표 슬롯은 글로, `arg.X` 는 연결로). */
  cells: Inline[][];
}

export interface ExpandedDynTable {
  /** `[구분 칸 머리글, 열1 머리글 .. 열N 머리글]`. */
  header: Inline[][];
  rows: ExpandedDynTableRow[];
  /** 연결 오류(argUnbound 등) · 묶기 충돌 경고(dynTableMergeConflict). 표 구조는 그래도 돌려준다. */
  issues: Issue[];
}

/** 표 슬롯의 내장 경로 — 머리글 `{경계}` · `{앞경계}`, 셀 `{비율}` (§3.3); 정액형 `{금액}` · 캡션 `{가입금액}` · 급부 머리글 `{번호}` · `{급부명}` (§3.7). */
export const DYN_TABLE_SLOTS = {
  boundary: "builtin.table.boundary",
  prevBoundary: "builtin.table.prevBoundary",
  rate: "builtin.table.rate",
  amount: "builtin.table.amount",
  insuredAmount: "builtin.table.insuredAmount",
  benefitNo: "builtin.table.benefitNo",
  benefitName: "builtin.table.benefitName",
} as const;

export type DynTableSlotRef = (typeof DYN_TABLE_SLOTS)[keyof typeof DYN_TABLE_SLOTS];

/** 표 슬롯의 표시명 — 편집기 칩 · 오류 문구용 (경로 → 「경계」 · 「앞경계」 · 「비율」). */
export const DYN_TABLE_SLOT_LABEL: Record<DynTableSlotRef, string> = {
  [DYN_TABLE_SLOTS.boundary]: "경계",
  [DYN_TABLE_SLOTS.prevBoundary]: "앞경계",
  [DYN_TABLE_SLOTS.rate]: "비율",
  [DYN_TABLE_SLOTS.amount]: "금액",
  [DYN_TABLE_SLOTS.insuredAmount]: "가입금액",
  [DYN_TABLE_SLOTS.benefitNo]: "번호",
  [DYN_TABLE_SLOTS.benefitName]: "급부명",
};

export type DynTableTemplateKey = keyof DynTableHeaders | "cell" | "caption" | "benefitHeader";

/**
 * 템플릿마다 쓸 수 있는 표 슬롯 (§3.3 · §3.7 표) — 첫 · 마지막: 경계, 가운데: 경계 + 앞경계, 단일: 없음,
 * 셀: 감액 표는 비율 · 정액형은 금액(`allowedCellSlots`), 캡션: 가입금액, 급부 머리글: 번호 · 급부명.
 */
export const DYN_TABLE_ALLOWED_SLOTS: Record<DynTableTemplateKey, readonly DynTableSlotRef[]> = {
  first: [DYN_TABLE_SLOTS.boundary],
  middle: [DYN_TABLE_SLOTS.boundary, DYN_TABLE_SLOTS.prevBoundary],
  last: [DYN_TABLE_SLOTS.boundary],
  single: [],
  cell: [DYN_TABLE_SLOTS.rate],
  caption: [DYN_TABLE_SLOTS.insuredAmount],
  benefitHeader: [DYN_TABLE_SLOTS.benefitNo, DYN_TABLE_SLOTS.benefitName],
};

/** 정의의 종류 — 정액형 칸이 있으면 `amount`, 없으면 `rate`(감액 지급금액 표). */
export function dynTableKind(def: Pick<DynTable, "fixed">): DynTableKind {
  return def.fixed ? "amount" : "rate";
}

/** 셀 템플릿에 쓸 수 있는 표 슬롯 — 정의 종류별. */
export function allowedCellSlots(def: Pick<DynTable, "fixed">): readonly DynTableSlotRef[] {
  return dynTableKind(def) === "amount" ? [DYN_TABLE_SLOTS.amount] : [DYN_TABLE_SLOTS.rate];
}

const SLOT_REFS = new Set<string>(Object.values(DYN_TABLE_SLOTS));

export function isDynTableSlotRef(ref: string): ref is DynTableSlotRef {
  return SLOT_REFS.has(ref);
}

export const DEFAULT_ROW_HEADER = "구 분";

/** 기본 셀 템플릿 「보험가입금액의 {비율}%」 — 새 정의의 씨앗. `idPrefix` 로 노드 id 를 정한다. */
export function defaultCellTemplate(idPrefix = "cell"): Inline[] {
  return [
    { id: `${idPrefix}-t1`, kind: "text", text: "보험가입금액의 " },
    { id: `${idPrefix}-rate`, kind: "slot", ref: DYN_TABLE_SLOTS.rate },
    { id: `${idPrefix}-t2`, kind: "text", text: "%" },
  ];
}

/** 기본 단일 열 머리글 「지급금액」 — 새 정의의 씨앗. */
export function defaultSingleHeader(idPrefix = "single"): Inline[] {
  return [{ id: `${idPrefix}-t1`, kind: "text", text: "지급금액" }];
}

/** 정액형 기본 셀 템플릿 「{금액}」 (§3.7). */
export function defaultAmountCellTemplate(idPrefix = "cell"): Inline[] {
  return [{ id: `${idPrefix}-amount`, kind: "slot", ref: DYN_TABLE_SLOTS.amount }];
}

/** 정액형 기본 캡션 「<보험가입금액 {가입금액}>」 (§3.7). */
export function defaultCaptionTemplate(idPrefix = "caption"): Inline[] {
  return [
    { id: `${idPrefix}-t1`, kind: "text", text: "<보험가입금액 " },
    { id: `${idPrefix}-amount`, kind: "slot", ref: DYN_TABLE_SLOTS.insuredAmount },
    { id: `${idPrefix}-t2`, kind: "text", text: ">" },
  ];
}

/** 정액형 기본 급부 머리글 「{번호}. {급부명}」 (§3.7). */
export function defaultBenefitHeaderTemplate(idPrefix = "bh"): Inline[] {
  return [
    { id: `${idPrefix}-no`, kind: "slot", ref: DYN_TABLE_SLOTS.benefitNo },
    { id: `${idPrefix}-t1`, kind: "text", text: ". " },
    { id: `${idPrefix}-name`, kind: "slot", ref: DYN_TABLE_SLOTS.benefitName },
  ];
}

/** 정액형 정의의 씨앗 — 캡션 · 급부 머리글 기본 템플릿. */
export function defaultFixed(): DynTableFixed {
  return { caption: defaultCaptionTemplate(), benefitHeader: defaultBenefitHeaderTemplate() };
}
