import { describe, expect, it } from "vitest";

import type { EnumDef } from "../catalog";
import { entered } from "../types";
import { findForm, findMasterField } from "../master";
import { BASE_DATE_CHIP, checkReductionPeriods, ESCALATION_STEPS, escalationSteps, FIXED_GRID, PROVISO_TEXT, provisoText, resolveBaseDateChip, fixedGrid, INSURED_AMOUNTS, insuredAmounts, REDUCTION_PERIOD_ENUM, reductionBoundary, reductionPeriodEnumSeed, reductionPeriods, validateSlotValue } from "./traits";

/** 시드 「감액기간」 — 90일 V01 · 180일 V02 · 1년 V03 · 2년 V04 (기능/열거형 §3.1, 값 순서 = 기간 순서). */
const 감액기간: EnumDef = reductionPeriodEnumSeed();
const enums = (code: string) => (code === REDUCTION_PERIOD_ENUM ? 감액기간 : undefined);
const orderOf = (code: string) => 감액기간.values.find((v) => v.code === code)?.order;

describe("감액기간 열거형 시드 — 초기값 넷, 값 순서 = 기간 순서 (기능/열거형 §3.1 · 2026-10-31)", () => {
  it("E0010 · 90일 · 180일 · 1년 · 2년", () => {
    expect(REDUCTION_PERIOD_ENUM).toBe("E0010");
    expect(감액기간.code).toBe("E0010");
    expect(감액기간.label).toBe("감액기간");
    expect(감액기간.values.map((v) => [v.code, v.label, v.order])).toEqual([
      ["V01", "90일", 0],
      ["V02", "180일", 1],
      ["V03", "1년", 2],
      ["V04", "2년", 3],
    ]);
  });
});

describe("checkReductionPeriods — 엄격 오름차순은 열거 값 순서로 (기능/담보 §3.4)", () => {
  it("열거 순서대로면 통과", () => {
    expect(checkReductionPeriods([{ end: "V01", rate: 10 }, { end: "V03", rate: 50 }], {}, orderOf)).toEqual([]);
  });
  it("같은 값 두 번(중복) · 앞 순서(역전)면 행 좌표 오류 — 앞 행 이름을 말한다", () => {
    const dup = checkReductionPeriods([{ end: "V03", rate: 50 }, { end: "V03", rate: 60 }], {}, orderOf, (c) => 감액기간.values.find((v) => v.code === c)?.label);
    expect(dup).toHaveLength(1);
    expect(dup[0].message).toContain("2행");
    expect(dup[0].message).toContain("1년");
    expect(checkReductionPeriods([{ end: "V03", rate: 50 }, { end: "V01", rate: 60 }], {}, orderOf)[0].message).toContain("2행");
  });
  it("열거형에 없는 값은 순서를 못 견준다 — 여기서는 건너뛴다(없는 값은 validateValue 가 brokenRef 로 잡는다)", () => {
    expect(checkReductionPeriods([{ end: "V09", rate: 50 }, { end: "V01", rate: 60 }], {}, orderOf)).toEqual([]);
  });
});

describe("validateSlotValue — 경로별 규칙", () => {
  const type = { kind: "table", columns: [{ key: "end", label: "기간", type: "enum", enumCode: REDUCTION_PERIOD_ENUM }, { key: "rate", label: "지급률", type: "percent" }] } as const;
  it("reduction.periods 는 표 검사(열거값 코드) + 구간 규칙(열거 순서)", () => {
    expect(validateSlotValue("reduction.periods", type, [{ end: "V03", rate: 50 }, { end: "V01", rate: 10 }], enums)).toHaveLength(1);
    expect(validateSlotValue("reduction.periods", type, [{ end: "V01", rate: 10 }, { end: "V03", rate: 50 }], enums)).toEqual([]);
  });
  it("열거형에 없는 값 코드는 brokenRef 「없는 값」 — 구간 규칙은 그 뒤다", () => {
    const issues = validateSlotValue("reduction.periods", type, [{ end: "V09", rate: 10 }], enums);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("brokenRef");
    expect(issues[0].message).toContain("없는 값 V09");
  });
  it("reduction.after_rate 는 0~100 정수 · exemption.months 는 0 이상 정수", () => {
    expect(validateSlotValue("reduction.after_rate", { kind: "number" }, 150, enums)).toHaveLength(1);
    expect(validateSlotValue("reduction.after_rate", { kind: "number" }, 100, enums)).toEqual([]);
    expect(validateSlotValue("exemption.months", { kind: "number" }, 1.5, enums)).toHaveLength(1);
    expect(validateSlotValue("exemption.months", { kind: "number" }, 3, enums)).toEqual([]);
  });
  it("다른 경로는 validateValue 그대로", () => {
    expect(validateSlotValue("pay.rate", { kind: "number" }, "x", enums)).toHaveLength(1);
  });
});

describe("reductionPeriods — 동적 표 창구: 경계는 열거값(코드 · 순서 · 표시 글자)", () => {
  it("안 연 폼은 undefined · 열렸으면 구간 + 이후 지급률(없으면 100)", () => {
    expect(reductionPeriods(() => undefined, enums)).toBeUndefined();
    const read = (p: string) => (p === "reduction.periods" ? entered([{ end: "V03", rate: 50 }]) : undefined);
    expect(reductionPeriods(read, enums)).toEqual({ periods: [{ end: { code: "V03", order: 2, label: "1년" }, rate: 50 }], afterRate: 100 });
  });
  it("열거형에서 지워진 값은 missing 표식 + 「없는 값」 글자 — 순서는 맨 뒤", () => {
    expect(reductionBoundary(감액기간, "V09")).toEqual({ code: "V09", order: Number.POSITIVE_INFINITY, label: "없는 값 V09", missing: true });
    expect(reductionBoundary(undefined, "V01")).toEqual({ code: "V01", order: Number.POSITIVE_INFINITY, label: "없는 값 V01", missing: true });
  });
});

describe("담보 「가입금액」 · 급부 「정액표」 특성 — 값 규칙 · 읽는 창구 (기능/담보 §3.3 · §3.4, 2026-10-31)", () => {
  const enums = () => undefined;
  const amountsType = { kind: "table", columns: [{ key: "amount", label: "금액(원)", type: "number" }] } as const;
  it("가입금액 — 금액은 1 이상 정수 · 같은 금액 두 번 거부", () => {
    expect(validateSlotValue(INSURED_AMOUNTS, amountsType, [{ amount: 30_000_000 }, { amount: 50_000_000 }], enums)).toEqual([]);
    expect(validateSlotValue(INSURED_AMOUNTS, amountsType, [{ amount: 0 }], enums)[0].message).toContain("1행");
    expect(validateSlotValue(INSURED_AMOUNTS, amountsType, [{ amount: 1.5 }], enums)[0].message).toContain("정수");
    expect(validateSlotValue(INSURED_AMOUNTS, amountsType, [{ amount: 100 }, { amount: 100 }], enums)[0].message).toContain("2행");
  });
  it("insuredAmounts — 폼을 안 열었으면 undefined · 열렸으면 오름차순 금액", () => {
    expect(insuredAmounts(() => undefined)).toBeUndefined();
    const read = (p: string) => (p === INSURED_AMOUNTS ? entered([{ amount: 50_000_000 }, { amount: 30_000_000 }]) : undefined);
    expect(insuredAmounts(read)).toEqual([30_000_000, 50_000_000]);
  });
  it("정액표 — 글자 열 1개 이상(비지 않은 머리) · 행 1개 이상 · 행마다 글자 칸 수 = 열 수 · 가입금액 열마다 정액(공란 거부 · 0 이상 정수)", () => {
    const ok = { columns: ["분류", "치료항목"], rows: [{ cells: ["상해", "입원"], amounts: { "30000000": 50_000 } }] };
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, ok, enums)).toEqual([]);
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: [], rows: ok.rows }, enums)[0].message).toContain("글자 열");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: ["분류", " "], rows: ok.rows }, enums)[0].message).toContain("머리");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: ok.columns, rows: [] }, enums)[0].message).toContain("행");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: ok.columns, rows: [{ cells: ["상해"], amounts: { "30000000": 1 } }] }, enums)[0].message).toContain("1행");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: ok.columns, rows: [{ cells: ["상해", "입원"], amounts: {} }] }, enums)[0].message).toContain("가입금액");
    const blank = { columns: ok.columns, rows: [{ cells: ["상해", "입원"], amounts: { "30000000": 50_000, "50000000": 80_000 } }, { cells: ["질병", "입원"], amounts: { "30000000": 50_000 } }] };
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, blank, enums)[0].message).toContain("2행");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: ok.columns, rows: [{ cells: ["상해", "입원"], amounts: { "30000000": -1 } }] }, enums)[0].message).toContain("정수");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, { columns: ok.columns, rows: [{ cells: ["상해", "입원"], amounts: { abc: 1 } }] }, enums)[0].message).toContain("금액");
    expect(validateSlotValue(FIXED_GRID, { kind: "grid" }, "x", enums)[0].kind).toBe("typeMismatch");
  });
  it("fixedGrid — 폼을 안 열었으면 undefined · 열렸으면 격자 그대로", () => {
    expect(fixedGrid(() => undefined)).toBeUndefined();
    const g = { columns: ["분류"], rows: [{ cells: ["상해"], amounts: { "30000000": 1 } }] };
    expect(fixedGrid((p) => (p === FIXED_GRID ? entered(g) : undefined))).toEqual(g);
  });
});

describe("급부 「체증」 · 담보 「단서문구」 특성 — 값 규칙 · 읽는 창구 (기능/담보 §3.4 · 기능/구분자 §3.7, 2026-11-01)", () => {
  const enums = () => undefined;
  const stepsType = { kind: "table", columns: [{ key: "label", label: "구분", type: "string", chips: [{ label: "(최초)계약일", text: "〔(최초)계약일〕" }] }, { key: "ratio", label: "비율", type: "number" }] } as const;
  it("폼 — 체증 escalation(급부 · 마스터 소유) · 단서문구 proviso(담보 · 마스터 소유)", () => {
    expect(findForm("escalation")).toMatchObject({ label: "체증", level: "benefit", optional: true, system: true, owner: "master" });
    expect(findMasterField(ESCALATION_STEPS)?.field.type).toEqual(stepsType);
    expect(findForm("proviso")).toMatchObject({ label: "단서문구", level: "coverage", optional: true, system: true, owner: "master" });
    expect(findMasterField(PROVISO_TEXT)?.field.type).toEqual({ kind: "string" });
  });
  it("체증 — 0행 거부 · 구분 비면 거부 · 비율은 0 보다 큰 수", () => {
    expect(validateSlotValue(ESCALATION_STEPS, stepsType, [{ label: "1차 연도", ratio: 1 }, { label: "2차 연도", ratio: 1.2 }], enums)).toEqual([]);
    expect(validateSlotValue(ESCALATION_STEPS, stepsType, [], enums)[0].message).toContain("행이 하나");
    expect(validateSlotValue(ESCALATION_STEPS, stepsType, [{ label: " ", ratio: 1 }], enums)[0].message).toContain("1행 구분");
    expect(validateSlotValue(ESCALATION_STEPS, stepsType, [{ label: "1차", ratio: 1 }, { label: "2차" }], enums)[0].message).toContain("2행 비율");
    expect(validateSlotValue(ESCALATION_STEPS, stepsType, [{ label: "1차", ratio: 0 }], enums)[0].message).toContain("1행 비율");
  });
  it("escalationSteps — 폼을 안 열었으면 undefined · 열렸으면 행 순서대로 구분 · 비율", () => {
    expect(escalationSteps(() => undefined)).toBeUndefined();
    const read = (p: string) => (p === ESCALATION_STEPS ? entered([{ label: `${BASE_DATE_CHIP}부터 5년경과시점 전일 이전`, ratio: 1 }, { label: "이후", ratio: 1.5 }]) : undefined);
    expect(escalationSteps(read)).toEqual([{ label: "〔(최초)계약일〕부터 5년경과시점 전일 이전", ratio: 1 }, { label: "이후", ratio: 1.5 }]);
  });
  it("(최초)계약일 칩 — 갱신형이면 「최초계약일」, 아니면 「계약일」", () => {
    expect(BASE_DATE_CHIP).toBe("〔(최초)계약일〕");
    expect(resolveBaseDateChip(`${BASE_DATE_CHIP}부터 1년 · ${BASE_DATE_CHIP}`, true)).toBe("최초계약일부터 1년 · 최초계약일");
    expect(resolveBaseDateChip(`${BASE_DATE_CHIP}부터 1년`, false)).toBe("계약일부터 1년");
  });
  it("provisoText — 폼을 안 열었거나 빈 글이면 undefined", () => {
    expect(provisoText(() => undefined)).toBeUndefined();
    expect(provisoText((p) => (p === PROVISO_TEXT ? entered("  ") : undefined))).toBeUndefined();
    expect(provisoText((p) => (p === PROVISO_TEXT ? entered("「2대질환」으로 진단확정시") : undefined))).toBe("「2대질환」으로 진단확정시");
  });
});
