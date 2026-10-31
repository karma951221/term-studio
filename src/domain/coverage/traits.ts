/**
 * 급부 특성(감액 · 면책)의 값 규칙 — 시드 폼 `reduction` · `exemption` 전용 (ADR-0065 · 기능/담보 §3.4).
 *
 * 폼 시스템은 타입만 안다(`validateValue`). 「구간은 엄격 오름차순」 같은 뜻은 시스템 폼이라 코드가 안다 — 여기가 그 자리다.
 * 동적 표 엔진이 감액 구간을 읽는 창구도 여기(`reductionPeriods`) — 폼 키 · 필드 키를 다른 곳에 흘리지 않는다.
 *
 * 감액 경계는 열거형 **「감액기간」**(E0010 — 초기값 90일 · 180일 · 1년 · 2년)의 값 코드다 (2026-10-31 사용자 결정, 기능/담보 §3.4 · 기능/열거형 §3.1).
 * 「엄격 오름차순」은 열거 값 순서로 견주고, 동적표의 경계 합집합 · 정렬 · 머리글 글자(「90일」 · 「1년」)도 그 순서 · 이름에서 나온다.
 */
import { isFormOpened, validateValue, type EnumDef, type EnumLookup, type SlotPath, type SlotReader } from "../catalog";
import { findForm, FIXED_TABLE_FORM, INSURED_AMOUNT_FORM, REDUCTION_PERIOD_ENUM } from "../master";
import { isFixedGrid, type Code, type Coordinate, type FieldType, type FixedGrid, type Issue, type TableRow } from "../types";

export const REDUCTION_PERIODS: SlotPath = "reduction.periods";
export const REDUCTION_AFTER_RATE: SlotPath = "reduction.after_rate";
export const EXEMPTION_MONTHS: SlotPath = "exemption.months";
/** 담보 「가입금액」 금액 표 (기능/담보 §3.3) · 급부 「정액표」 격자 (§3.4) — 2026-10-31. */
export const INSURED_AMOUNTS: SlotPath = `${INSURED_AMOUNT_FORM}.amounts`;
export const FIXED_GRID: SlotPath = `${FIXED_TABLE_FORM}.grid`;

export { REDUCTION_PERIOD_ENUM };

/** 「감액기간」 초기값 — 값 순서 = 기간 순서. 새 값은 시간 순 자리에 넣는다(끝에 붙이면 순서가 틀린다). */
export const REDUCTION_PERIOD_SEED_LABELS: readonly string[] = ["90일", "180일", "1년", "2년"];

/** 시드 「감액기간」 정의 그대로 — 시드 JSON · 테스트 · 마이그레이션 대조가 같은 것을 본다. */
export function reductionPeriodEnumSeed(): EnumDef {
  return {
    code: REDUCTION_PERIOD_ENUM,
    label: "감액기간",
    values: REDUCTION_PERIOD_SEED_LABELS.map((label, i) => ({ code: `V${String(i + 1).padStart(2, "0")}`, label, order: i })),
  };
}

function mismatch(message: string, at: Coordinate): Issue {
  return { kind: "typeMismatch", message, at };
}

/** 값 코드 → 열거 순서 (없는 값은 undefined). */
export type BoundaryOrder = (code: string) => number | undefined;
/** 값 코드 → 표시 글자 (없는 값은 undefined). */
export type BoundaryLabel = (code: string) => string | undefined;

/**
 * 감액 구간표 — 기간(end) 은 「감액기간」 값 코드, 엄격 오름차순은 열거 값 순서로 (같으면 중복, 앞이면 역전).
 * 열거형에 없는 코드는 여기서 견주지 않는다 — `validateValue` 가 brokenRef 「없는 값」으로 먼저 잡는다.
 * 옛 모양(`period` 열 — 개월 정수)도 받는다: 1 이상 · 수로 엄격 오름차순 (열거 열이 아닌 표 정의가 아직 이 규칙을 쓴다).
 */
export function checkReductionPeriods(rows: readonly TableRow[], at: Coordinate = {}, orderOf: BoundaryOrder = () => undefined, labelOf: BoundaryLabel = () => undefined): Issue[] {
  const issues: Issue[] = [];
  let prev: { code: string; order: number; name: string } | undefined;
  rows.forEach((row, i) => {
    const end = row.end;
    let order: number | undefined;
    let name: string;
    if (typeof end === "number") {
      if (end <= 0) return void issues.push(mismatch(`${i + 1}행 기간: 0 은 구간이 아닙니다`, at));
      order = end;
      name = `${end}개월`;
    } else if (typeof end === "string") {
      order = orderOf(end);
      if (order === undefined) return; // 없는 값 — validateValue 의 몫
      name = labelOf(end) ?? end;
    } else return; // 타입은 validateValue 가 본다
    if (prev && order <= prev.order) {
      issues.push(mismatch(`${i + 1}행 기간: 앞 행(${prev.name})보다 뒤 순서의 감액기간이어야 합니다 (같으면 중복 · 앞이면 역전)`, at));
    }
    if (!prev || order > prev.order) prev = { code: String(end), order, name };
  });
  return issues;
}

function integerIn(value: unknown, min: number, max: number | undefined, what: string, at: Coordinate): Issue[] {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    return [mismatch(max === undefined ? `${what} 는 ${min} 이상 정수여야 합니다` : `${what} 는 ${min}~${max} 정수여야 합니다`, at)];
  }
  return [];
}

/** 표 타입의 `end` 열이 가리키는 열거형 — 감액 구간표의 경계 열거(보통 E0010). */
function boundaryEnumOf(type: FieldType, enums: EnumLookup): EnumDef | undefined {
  if (type.kind !== "table") return undefined;
  const col = type.columns.find((c) => c.key === "end");
  return col?.type === "enum" && col.enumCode ? enums(col.enumCode) : undefined;
}

/** 가입금액 표 — 금액은 1 이상 정수(원) · 같은 금액 두 번 거부. 순서는 묻지 않는다(표는 오름차순으로 찍는다). */
export function checkInsuredAmounts(rows: readonly TableRow[], at: Coordinate = {}): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<number>();
  rows.forEach((row, i) => {
    const amount = row.amount;
    if (typeof amount !== "number") return; // 타입은 validateValue 가 본다
    if (!Number.isInteger(amount) || amount < 1) return void issues.push(mismatch(`${i + 1}행 금액: 1 이상 정수(원)여야 합니다`, at));
    if (seen.has(amount)) issues.push(mismatch(`${i + 1}행 금액: 같은 금액이 두 번입니다`, at));
    seen.add(amount);
  });
  return issues;
}

/** 정액표 격자의 뜻 — 글자 열 1개 이상(머리 비지 않음) · 행 1개 이상 · 행마다 글자 칸 수 = 열 수 · 가입금액 열(키는 원 단위 정수)마다 정액(0 이상 정수) 전부(공란 거부). */
export function checkFixedGrid(grid: FixedGrid, at: Coordinate = {}): Issue[] {
  const issues: Issue[] = [];
  if (grid.columns.length === 0) issues.push(mismatch("정액표에 글자 열이 하나는 있어야 합니다", at));
  grid.columns.forEach((c, i) => {
    if (c.trim() === "") issues.push(mismatch(`${i + 1}째 글자 열의 머리 이름이 비어 있습니다`, at));
  });
  if (grid.rows.length === 0) issues.push(mismatch("정액표에 행이 하나는 있어야 합니다", at));
  const amountKeys = [...new Set(grid.rows.flatMap((r) => Object.keys(r.amounts)))];
  for (const k of amountKeys) if (!/^[1-9]\d*$/.test(k)) issues.push(mismatch(`가입금액 열 ${k} — 금액은 원 단위 정수여야 합니다`, at));
  if (grid.rows.length > 0 && amountKeys.length === 0) issues.push(mismatch("정액표에 가입금액 열이 하나는 있어야 합니다", at));
  grid.rows.forEach((row, i) => {
    if (row.cells.length !== grid.columns.length) issues.push(mismatch(`${i + 1}행: 글자 칸이 ${row.cells.length}개 — 글자 열 ${grid.columns.length}개와 맞아야 합니다`, at));
    for (const k of amountKeys) {
      const v = row.amounts[k];
      if (v === undefined) issues.push(mismatch(`${i + 1}행: 가입금액 ${k} 의 정액이 비어 있습니다 (공란은 저장하지 않는다)`, at));
      else if (!Number.isInteger(v) || v < 0) issues.push(mismatch(`${i + 1}행: 가입금액 ${k} 의 정액은 0 이상 정수(원)여야 합니다`, at));
    }
  });
  return issues;
}

/** 타입 검사 + 경로별 규칙. 값 쓰기(담보 마스터 · 상품 스냅샷 · 폼 제출)가 전부 이것을 부른다. */
export function validateSlotValue(path: SlotPath, type: FieldType, value: unknown, enums: EnumLookup, at: Coordinate = {}): Issue[] {
  const base = validateValue(type, value, enums, at);
  if (base.length > 0) return base;
  switch (path) {
    case REDUCTION_PERIODS: {
      const def = boundaryEnumOf(type, enums);
      const find = (code: string) => def?.values.find((v) => v.code === code);
      return checkReductionPeriods(value as TableRow[], at, (code) => find(code)?.order, (code) => find(code)?.label);
    }
    case REDUCTION_AFTER_RATE:
      return integerIn(value, 0, 100, "이후 지급률", at);
    case EXEMPTION_MONTHS:
      return integerIn(value, 0, undefined, "면책 기간(개월)", at);
    case INSURED_AMOUNTS:
      return checkInsuredAmounts(value as TableRow[], at);
    case FIXED_GRID:
      return isFixedGrid(value) ? checkFixedGrid(value, at) : [];
    default:
      return [];
  }
}

/**
 * 감액 경계 하나 — 「감액기간」 값의 코드 · 열거 순서 · 표시 글자. 동적표는 순서로 합집합 · 정렬 · 「≥」 견주기를 하고 글자를 머리글에 찍는다.
 * 열거형에서 지워진 값은 `missing` — 순서는 맨 뒤, 글자는 「없는 값 V09」(조립이 brokenRef 로 드러낸다).
 */
export interface ReductionBoundary {
  code: Code;
  order: number;
  label: string;
  missing?: true;
}

/** 값 코드 → 경계. 열거형이 없거나 값이 없으면 `missing`. */
export function reductionBoundary(def: EnumDef | undefined, code: Code): ReductionBoundary {
  const v = def?.values.find((x) => x.code === code);
  if (!v) return { code, order: Number.POSITIVE_INFINITY, label: `없는 값 ${code}`, missing: true };
  return { code, order: v.order, label: v.label };
}

export interface ReductionPeriods {
  periods: { end: ReductionBoundary; rate: number }[];
  /** 마지막 구간 이후 지급률. 자리가 비면 100. */
  afterRate: number;
}

/** 급부 하나의 감액 구간 — 폼을 안 열었으면 undefined (= 감액 없음). 동적 표 엔진의 창구. 경계는 `enums` 의 「감액기간」으로 푼다. */
export function reductionPeriods(read: SlotReader, enums: EnumLookup): ReductionPeriods | undefined {
  const form = findForm("reduction");
  if (!form || !isFormOpened(form, read)) return undefined;
  const slot = read(REDUCTION_PERIODS);
  if (!slot?.entered || !Array.isArray(slot.value)) return undefined;
  const def = enums(REDUCTION_PERIOD_ENUM);
  const periods = (slot.value as TableRow[]).map((r) => ({ end: reductionBoundary(def, String(r.end)), rate: Number(r.rate) }));
  const after = read(REDUCTION_AFTER_RATE);
  return { periods, afterRate: after?.entered && typeof after.value === "number" ? after.value : 100 };
}

/** 담보의 가입금액 — 폼을 안 열었으면 undefined, 열렸으면 오름차순 금액(원). 마스터면 가능한 금액 전체, 상품담보면 운영 가입금액 (기능/담보 §3.3). */
export function insuredAmounts(read: SlotReader): number[] | undefined {
  const form = findForm(INSURED_AMOUNT_FORM);
  if (!form || !isFormOpened(form, read)) return undefined;
  const slot = read(INSURED_AMOUNTS);
  if (!slot?.entered || !Array.isArray(slot.value)) return undefined;
  return (slot.value as TableRow[]).map((r) => Number(r.amount)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

/** 급부의 정액표 — 폼을 안 열었으면 undefined (= 정액표 없음). 정액형 동적표의 창구 (기능/동적표 §3.7). */
export function fixedGrid(read: SlotReader): FixedGrid | undefined {
  const form = findForm(FIXED_TABLE_FORM);
  if (!form || !isFormOpened(form, read)) return undefined;
  const slot = read(FIXED_GRID);
  return slot?.entered && isFixedGrid(slot.value) ? slot.value : undefined;
}
