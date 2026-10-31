import { describe, expect, it } from "vitest";

import type { EnumDef } from "../catalog";
import { entered } from "../types";
import { checkReductionPeriods, REDUCTION_PERIOD_ENUM, reductionBoundary, reductionPeriodEnumSeed, reductionPeriods, validateSlotValue } from "./traits";

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
