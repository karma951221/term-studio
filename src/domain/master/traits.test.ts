import { describe, expect, it } from "vitest";

import { entered, type ValueSlot } from "../types";

import { describeTraitDetachment, traitDetachments } from "./traits";

const saved = (pairs: [string, unknown][]) => new Map<string, ValueSlot>(pairs.map(([p, v]) => [p, entered(v as never)]));

describe("traitDetachments — 상품담보 저장이 떼는 특성 (기능/상품 §3.4 · §4.8)", () => {
  it("저장된 특성의 값이 이번 제출로 하나도 안 남으면 「해제」 — 사라질 값을 싣는다", () => {
    const before = saved([["exemption.months", 3], ["exemption.new_only", true], ["pay.rate", 90]]);
    const out = traitDetachments("benefit", before, [
      { path: "exemption.months", value: undefined },
      { path: "exemption.new_only", value: undefined },
    ]);
    expect(out).toEqual([
      {
        form: { key: "exemption", label: "면책" },
        lost: [
          { path: "exemption.months", label: "기간", value: 3 },
          { path: "exemption.new_only", label: "신규계약만 적용", value: true },
        ],
      },
    ]);
  });

  it("값 하나만 비워 다른 칸이 남으면 해제가 아니다", () => {
    const before = saved([["exemption.months", 3], ["exemption.new_only", true]]);
    expect(traitDetachments("benefit", before, [{ path: "exemption.months", value: undefined }])).toEqual([]);
  });

  it("없던 특성을 붙이는 것 · 특성 아닌 폼(pay)을 비우는 것은 해제가 아니다", () => {
    const before = saved([["pay.rate", 90]]);
    expect(traitDetachments("benefit", before, [{ path: "pay.rate", value: undefined }, { path: "reduction.new_only", value: true }])).toEqual([]);
  });

  it("다른 레벨에는 특성이 없다", () => {
    expect(traitDetachments("coverage", new Map(), [])).toEqual([]);
  });
});

describe("describeTraitDetachment — 저장 확인 줄 「특성 해제 · {급부명} — 사라질 값」", () => {
  it("값은 타입대로 — 예/아니오 · 표는 n행", () => {
    expect(
      describeTraitDetachment("암진단급부", {
        form: { key: "exemption", label: "면책" },
        lost: [
          { path: "exemption.months", label: "기간", value: 3 },
          { path: "exemption.age15_only", label: "15세 이상만 적용", value: false },
        ],
      }),
    ).toBe("특성 해제 · 암진단급부 · 면책 — 사라질 값: 기간 3 · 15세 이상만 적용 아니오");
    expect(
      describeTraitDetachment("수술급부", { form: { key: "reduction", label: "감액" }, lost: [{ path: "reduction.periods", label: "구간", value: [{ end: 12, rate: 50 }] }] }),
    ).toBe("특성 해제 · 수술급부 · 감액 — 사라질 값: 구간 1행");
  });
});
