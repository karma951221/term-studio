import { describe, expect, it } from "vitest";

import {
  MASTER,
  allMasterFields,
  fieldsOfForm,
  fieldsOfLevel,
  findForm,
  findMasterField,
  formsOfLevel,
  isMasterOwnedPath,
  isMasterPathShape,
  levelDepth,
  productOwnedMaster,
  masterFieldFullLabel,
  masterFieldLabel,
  masterPath,
  type MasterTree,
} from "./index";

const fixture: MasterTree = [
  { key: "a", label: "폼A", level: "plan", fields: [{ key: "x", label: "엑스", type: { kind: "boolean" } }] },
  { key: "b", label: "폼B", level: "benefit", fields: [{ key: "y", label: "와이", type: { kind: "number" } }, { key: "z", label: "제트", type: { kind: "string" } }] },
];

describe("마스터 경로 — 폼키.필드키", () => {
  it("경로는 두 토막이다", () => {
    expect(masterPath("waiver", "applies")).toBe("waiver.applies");
  });

  it("MVP 정본 — 폼 12벌 · 필드 23자리, 선언 순서 — 담보 레벨은 특성 「가입금액」 하나(여는 폼, 2026-10-31), 급부 「정액표」는 마스터 소유", () => {
    expect(MASTER.map((f) => f.key)).toEqual([
      "disclosure", "feature", "booklet", "waiver", "no_surrender", "conversion", "business_type", "insured_amount", "pay", "reduction", "exemption", "fixed_table",
    ]);
    expect(allMasterFields().map((r) => r.path)).toEqual([
      "disclosure.avg_rate",
      "feature.contract_kind", "feature.renewable", "feature.fetal", "feature.group_contract", "feature.notice_kind", "feature.notice_affix",
      "booklet.group_titles",
      "waiver.applies", "waiver.reasons", "waiver.age15", "no_surrender.type", "conversion.converts", "business_type.applies",
      "insured_amount.amounts",
      "pay.rate",
      "reduction.periods", "reduction.after_rate", "reduction.new_only",
      "exemption.months", "exemption.age15_only", "exemption.new_only",
      "fixed_table.grid",
    ]);
    expect(findForm("insured_amount")).toMatchObject({ level: "coverage", optional: true, system: true });
    expect(findForm("fixed_table")).toMatchObject({ level: "benefit", optional: true, system: true, owner: "master" });
  });

  it("pay.first_only(최초1회한)는 없다 — 2026-09-27 삭제 (기능/마스터 §6.2)", () => {
    expect(findMasterField("pay.first_only")).toBeUndefined();
  });

  it("보험금지급의 지급률은 선택 필드다 (2026-09-27) — 면책여부(pay.exempt)는 없다: 면책은 면책 특성이 붙었는지로만 (2026-10-21)", () => {
    expect(findMasterField("pay.rate")?.field.optional).toBe(true);
    expect(findMasterField("pay.exempt")).toBeUndefined();
  });

  it("폼키는 전역 유일 · 필드키는 폼 안에서 유일", () => {
    const keys = MASTER.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const form of MASTER) {
      const fieldKeys = form.fields.map((f) => f.key);
      expect(new Set(fieldKeys).size).toBe(fieldKeys.length);
    }
  });

  it("레벨별 폼 · 레벨별 필드", () => {
    expect(formsOfLevel("plan").map((f) => f.key)).toEqual(["waiver", "no_surrender", "conversion", "business_type"]);
    // 상품 레벨 — 공시이율 · 상품특성 (기본정보 › 상품정보, 2026-09-28) · 책자 (그룹 제목 표시, ADR-0090 결정 8)
    expect(formsOfLevel("product").map((f) => f.key)).toEqual(["disclosure", "feature", "booklet"]);
    expect(formsOfLevel("subCoverage")).toEqual([]);
    expect(formsOfLevel("coverage").map((f) => f.key)).toEqual(["insured_amount"]);
    expect(fieldsOfLevel("benefit").map((r) => r.path)).toEqual([
      "pay.rate",
      "reduction.periods", "reduction.after_rate", "reduction.new_only",
      "exemption.months", "exemption.age15_only", "exemption.new_only",
      "fixed_table.grid",
    ]);
    expect(fieldsOfLevel("benefit", fixture).map((r) => r.path)).toEqual(["b.y", "b.z"]);
  });

  it("findForm · fieldsOfForm", () => {
    expect(findForm("pay")?.label).toBe("보험금지급");
    expect(findForm("nope")).toBeUndefined();
    expect(fieldsOfForm(fixture[1]).map((r) => r.path)).toEqual(["b.y", "b.z"]);
  });

  it("findMasterField — 레벨은 폼에서 온다", () => {
    const ref = findMasterField("waiver.applies");
    expect(ref?.level).toBe("plan");
    expect(ref?.form.key).toBe("waiver");
    expect(ref?.field.label).toBe("적용여부");
    expect(findMasterField("plan.waiver.applies")).toBeUndefined();
    expect(findMasterField("waiver.nope")).toBeUndefined();
    expect(findMasterField("a.x", fixture)?.level).toBe("plan");
  });

  it("isMasterPathShape — 두 토막 코드 모양", () => {
    expect(isMasterPathShape("waiver.applies")).toBe(true);
    expect(isMasterPathShape("nope.nothing")).toBe(true);
    expect(isMasterPathShape("plan.waiver.applies")).toBe(false);
    expect(isMasterPathShape("D0001")).toBe(false);
    expect(isMasterPathShape("attr.A0001")).toBe(true); // 모양만 본다 — 파서가 attr 을 먼저 가른다
  });

  it("표시명 — 「폼 › 필드」 · 「레벨 · 폼 › 필드」", () => {
    const ref = findMasterField("waiver.applies")!;
    expect(masterFieldLabel(ref)).toBe("납입면제 › 적용여부");
    expect(masterFieldFullLabel(ref)).toBe("세목 · 납입면제 › 적용여부");
  });

  it("레벨 깊이는 부착 레벨 순서", () => {
    expect(levelDepth("product")).toBe(0);
    expect(levelDepth("benefit")).toBe(4);
  });
});

describe("필드별 소유 — 마스터 소유 폼 (ADR-0097, 2026-10-31)", () => {
  const owned: MasterTree = [
    { key: "pay", label: "보험금지급", level: "benefit", fields: [{ key: "rate", label: "지급률", type: { kind: "number" } }] },
    { key: "fixed", label: "정액표", level: "benefit", optional: true, owner: "master", fields: [{ key: "grid", label: "격자", type: { kind: "string" } }] },
  ];
  it("isMasterOwnedPath — 소유 표식이 있는 폼의 자리만, 없는 경로는 아니다", () => {
    expect(isMasterOwnedPath("fixed.grid", owned)).toBe(true);
    expect(isMasterOwnedPath("pay.rate", owned)).toBe(false);
    expect(isMasterOwnedPath("nope.x", owned)).toBe(false);
  });
  it("productOwnedMaster — 상품 소유 폼만 남긴 마스터 (스냅샷 완결성 · 복사의 재료)", () => {
    expect(productOwnedMaster(owned).map((f) => f.key)).toEqual(["pay"]);
  });
  it("MVP 정본의 마스터 소유 폼은 정액표 하나 — 지급률 · 감액 · 면책 · 가입금액은 상품 소유", () => {
    expect(productOwnedMaster().map((f) => f.key)).toEqual(MASTER.filter((f) => f.key !== "fixed_table").map((f) => f.key));
    expect(isMasterOwnedPath("fixed_table.grid")).toBe(true);
    expect(isMasterOwnedPath("insured_amount.amounts")).toBe(false);
  });
});
