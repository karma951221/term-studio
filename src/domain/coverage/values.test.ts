import { describe, expect, it } from "vitest";

import type { EnumDef, SlotPath } from "../catalog";
import { type Coordinate, entered, type ValueSlot } from "../types";
import { addSubCoverage, createCoverageTree } from "./tree";
import type { Coverage, CoverageNodeRef } from "./types";
import { checkValueWrite, completeness, formPrefill, type MasterValues } from "./values";

const noticeEnum: EnumDef = {
  code: "E0002",
  label: "해약환급금유형",
  values: [
    { code: "V01", label: "지급형", order: 0 },
    { code: "V02", label: "미지급형", order: 1 },
  ],
};
const enums = (c: string) => (c === "E0002" ? noticeEnum : undefined);

let seq = 0;
const newId = () => `id-${++seq}`;

function unwrap<T>(r: { ok: true; value: T } | { ok: false; rejection: unknown }): T {
  if (!r.ok) throw new Error(`기대: ok, 실제: ${JSON.stringify(r.rejection)}`);
  return r.value;
}
function rejection(r: { ok: boolean; rejection?: unknown }) {
  if (r.ok) throw new Error("기대: 거부, 실제: ok");
  return r.rejection as { reason: string; what?: string; issues?: { kind: string; at: Coordinate }[] };
}

function values(slots: Record<string, Record<SlotPath, ValueSlot>> = {}): MasterValues {
  return { slots: new Map(Object.entries(slots).map(([id, s]) => [id, new Map(Object.entries(s))])) };
}

describe("담보 값 입력 — 값 쓰기 검사", () => {
  // 담보 레벨 마스터 폼은 없다 (보험금명 2026-10-21 삭제) — 값 쓰기는 급부 레벨 지급률로 본다
  const cov: CoverageNodeRef = { level: "coverage", id: "c1" };
  const ben1: CoverageNodeRef = { level: "benefit", id: "b1" };

  it("그 레벨 마스터 필드에 타입 맞는 값은 통과한다 — 부착이 없으니 자리는 늘 있다", () => {
    expect(checkValueWrite("pay.rate", 80, ben1, enums).ok).toBe(true);
  });

  it("타입 위반은 invalid + 좌표(refPath) — 담보 id 를 모르면 ownerId 도 비운다 (노드 id 를 담보 id 자리에 넣지 않는다)", () => {
    const r = rejection(checkValueWrite("pay.rate", true, ben1, enums));
    expect(r.reason).toBe("invalid");
    expect(r.issues?.[0]).toMatchObject({ kind: "typeMismatch", at: { document: "coverageMaster", node: ben1, refPath: "pay.rate" } });
    expect(r.issues?.[0]?.at.ownerId).toBeUndefined();
  });

  it("담보 id 를 주면 좌표의 ownerId 는 담보 id · node 는 값 소유 노드", () => {
    const ben: CoverageNodeRef = { level: "benefit", id: "b1" };
    const r = rejection(checkValueWrite("pay.rate", "백", ben, enums, undefined, "c1"));
    expect(r.issues?.[0]?.at).toMatchObject({ document: "coverageMaster", ownerId: "c1", node: ben, refPath: "pay.rate" });
  });

  it("레벨이 다른 자리 · 없는 자리는 notFound", () => {
    expect(rejection(checkValueWrite("waiver.applies", true, cov, enums)).reason).toBe("notFound");
    expect(rejection(checkValueWrite("coverage.nope", "x", cov, enums)).reason).toBe("notFound");
  });
});

describe("담보값입력 S4 — 기본값은 프리필로만", () => {
  it("폼 프리필은 명시 값이 있으면 그 값을, 없으면 기본값(있는 자리만) 을 돌려준다", () => {
    expect(formPrefill("coverage", new Map())).toEqual({}); // 담보 레벨은 자리가 없다
    const defaults = formPrefill("benefit", new Map());
    expect(defaults).not.toHaveProperty(["pay.rate"]); // 기본값 없는 자리는 비운다
    expect(defaults).toMatchObject({ "exemption.new_only": true });
    expect(formPrefill("benefit", new Map([["pay.rate", entered(80)], ["exemption.new_only", entered(false)]]))).toMatchObject({
      "pay.rate": 80,
      "exemption.new_only": false,
    });
  });
});

describe("담보값입력 S3 — 완결성 조회는 마스터 자리 전부가 대상", () => {
  function fixture() {
    seq = 0;
    const accident = unwrap(createCoverageTree({ name: "일반상해사망", benefitName: "일반상해사망보험금" }, newId, []));
    let surgery = unwrap(
      createCoverageTree({ name: "수술비", subCoverageName: "1종수술", benefitName: "수술보험금" }, newId, ["일반상해사망"]),
    );
    surgery = unwrap(addSubCoverage(surgery, { name: "2종수술", benefitName: "수술보험금" }, newId));
    return { accident, surgery };
  }

  it("트리 순서 · 레벨별 마스터 자리 순서로 보고된다 — 부착 여부를 묻지 않는다", () => {
    const { accident } = fixture();
    const b = accident.subCoverages[0].benefits[0];
    // 급부는 면책 폼을 연(신규만 입력) 상태 — 선택 필드(면책여부 · 지급률)는 값이 없으면 세지 않는다 (2026-09-27)
    const opened = values({ [b.id]: { "exemption.new_only": entered(true) } });
    expect(completeness(accident, opened).map((m) => [m.owner.level, m.ownerName, m.path])).toEqual([
      // 담보 레벨 자리는 없다 (보험금명 2026-10-21 삭제)
      ["benefit", "일반상해사망 > 일반상해사망 > 일반상해사망보험금", "exemption.months"],
      ["benefit", "일반상해사망 > 일반상해사망 > 일반상해사망보험금", "exemption.age15_only"],
    ]);
    expect(completeness(accident, opened)[0]).toMatchObject({
      label: "면책 › 기간",
      owner: { id: b.id },
    });
  });

  it("입력한 자리는 빠진다", () => {
    const { surgery } = fixture();
    const b = surgery.subCoverages[0].benefits[0];
    const missing = completeness(
      surgery,
      values({
        [b.id]: { "pay.rate": entered(100), "exemption.months": entered(3), "exemption.age15_only": entered(false), "exemption.new_only": entered(true) },
        [surgery.subCoverages[1].benefits[0].id]: { "exemption.new_only": entered(true) },
      }),
    );
    const other = surgery.subCoverages[1].benefits[0].id;
    expect(missing.map((m) => m.owner.id)).toEqual([other, other]);
  });

  it("실행 기반 필터(CompletenessFilter)를 얹으면 그 결과가 조회 결과다 — C2 가 실제 타는 분기로 좁힌다", () => {
    const { surgery } = fixture();
    const opened = values({ [surgery.subCoverages[0].benefits[0].id]: { "exemption.new_only": entered(true) } });
    const all = completeness(surgery, opened);
    const filtered = completeness(surgery, opened, (items) => items.filter((m) => m.path === "exemption.months"));
    expect(all.length).toBeGreaterThan(filtered.length);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((m) => m.path === "exemption.months")).toBe(true);
  });
});

describe("완결성 결과의 좌표", () => {
  it("각 항목은 담보 마스터 문서 좌표(document · ownerId · ownerName · refPath)를 갖는다", () => {
    seq = 0;
    // 담보 레벨 자리는 없다 — 급부의 면책 폼을 열어 미입력 자리를 만든다
    const tree: Coverage = unwrap(createCoverageTree({ name: "일반상해사망", benefitName: "일반상해사망보험금" }, newId, []));
    const benefit = tree.subCoverages[0].benefits[0];
    const [m] = completeness(tree, values({ [benefit.id]: { "exemption.new_only": entered(true) } }));
    expect(m.at).toEqual({
      document: "coverageMaster",
      ownerId: tree.id,
      ownerName: "일반상해사망 > 일반상해사망 > 일반상해사망보험금",
      node: { level: "benefit", id: benefit.id },
      refPath: "exemption.months",
    });
  });

  it("급부 자리의 좌표 — ownerId 는 담보 id, node 는 값을 소유한 급부 (고치러 가기가 그 레벨 탭 · 그 노드로 간다)", () => {
    seq = 0;
    const surgery = unwrap(createCoverageTree({ name: "수술비", subCoverageName: "1종수술", benefitName: "수술보험금" }, newId, []));
    const benefit = surgery.subCoverages[0].benefits[0];
    const m = completeness(surgery, values({ [benefit.id]: { "exemption.new_only": entered(true) } })).find((x) => x.owner.id === benefit.id)!;
    expect(m.at).toMatchObject({ document: "coverageMaster", ownerId: surgery.id, node: { level: "benefit", id: benefit.id } });
  });
});
