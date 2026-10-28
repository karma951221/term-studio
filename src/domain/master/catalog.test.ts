import { describe, expect, it } from "vitest";

import { parse } from "../expression/parser";
import { NOT_ENTERED, entered, type ValueSlot } from "../types";
import { MASTER, NOTICE_KIND, allMasterFields, findForm, findMasterField, formRuleIssues, isFieldShown, noticeAffixOf } from "./index";

/**
 * 카탈로그 불변식 — 마스터의 모든 `폼키.필드키` 가 식 파서를 지나 **정확히 그 마스터 참조**가 된다.
 *
 * 파서는 `attr` · `builtin` 네임스페이스와 `and` · `or` · `any` 같은 예약어를 먼저 가른다 — 폼키 `attr` 은
 * 담보속성으로 파싱되고, 폼키 `builtin` 은 두 토막이라 문법 오류가 되며, 필드키 `and` 는 예약어라 참조할 수 없다.
 * 그런 폼 · 필드는 구분자 식에서 읽을 길이 없으니 카탈로그에 올라와서는 안 된다 (코덱스 리뷰 Minor 2).
 */
describe("마스터 카탈로그 불변식 — 파서와 충돌하지 않는다", () => {
  it("모든 필드 경로가 파서를 지나 같은 master ref 가 된다", () => {
    const fields = allMasterFields();
    expect(fields.length).toBeGreaterThan(0);
    for (const ref of fields) {
      const r = parse(ref.path);
      expect(r.ok, `${ref.path} 파싱 실패`).toBe(true);
      if (!r.ok) continue;
      expect(r.value, ref.path).toEqual({ kind: "ref", ref: { kind: "master", form: ref.form.key, field: ref.field.key } });
    }
  });

  it("폼키 · 필드키 는 예약 네임스페이스 · 예약어와 겹치지 않는다 (불변식이 잡아낼 사례)", () => {
    // 불변식 테스트가 실제로 충돌을 잡는지 — 가짜 카탈로그로 반례를 확인한다
    for (const bad of ["attr.x", "builtin.x", "form.and", "any.x"]) {
      const r = parse(bad);
      const same = r.ok && r.value.kind === "ref" && r.value.ref.kind === "master";
      expect(same, `${bad} 는 마스터 참조가 되면 안 된다`).toBe(false);
    }
    expect(MASTER.every((f) => !["attr", "builtin"].includes(f.key))).toBe(true);
  });
});

describe("폼 교차 규칙 — 납입면제(waiver) 「적용여부 = 예면 사유 1개 이상」 (결정 16 · 기능/상품 §3.9)", () => {
  const waiver = findForm("waiver")!;
  const reader = (slots: Record<string, ValueSlot>) => (path: string) => slots[path];

  it("적용여부 예 + 사유 0개(빈 목록)면 사유 자리에 오류", () => {
    const issues = formRuleIssues(waiver, reader({ "waiver.applies": entered(true), "waiver.reasons": entered([]) }));
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("typeMismatch");
    expect(issues[0].message).toContain("납입면제사유");
    expect(issues[0].at.refPath).toBe("waiver.reasons");
  });

  it("적용여부 예 + 사유 미입력도 0개 — 오류", () => {
    expect(formRuleIssues(waiver, reader({ "waiver.applies": entered(true) }))).toHaveLength(1);
  });

  it("적용여부 예 + 사유 1개 이상이면 통과", () => {
    expect(formRuleIssues(waiver, reader({ "waiver.applies": entered(true), "waiver.reasons": entered(["V01"]) }))).toEqual([]);
  });

  it("적용여부 아니오 + 사유 0개는 통과", () => {
    expect(formRuleIssues(waiver, reader({ "waiver.applies": entered(false), "waiver.reasons": entered([]) }))).toEqual([]);
    expect(formRuleIssues(waiver, reader({ "waiver.applies": entered(false) }))).toEqual([]);
  });

  it("적용여부 미입력이면 규칙이 서지 않는다 — 미입력은 상태다 (ADR-0004)", () => {
    expect(formRuleIssues(waiver, reader({}))).toEqual([]);
  });

  it("좌표를 넘기면 오류 좌표에 싣는다 (refPath 는 규칙이 가리키는 필드)", () => {
    const [issue] = formRuleIssues(waiver, reader({ "waiver.applies": entered(true) }), { ownerId: "opt-1" });
    expect(issue.at).toEqual({ ownerId: "opt-1", refPath: "waiver.reasons" });
  });

  it("규칙이 없는 폼은 늘 통과", () => {
    expect(formRuleIssues(findForm("no_surrender")!, reader({}))).toEqual([]);
  });
});

describe("상품특성(feature) — 고지는 접사만 (2026-10-29 사용자 결정, 기능/상품 §3.1)", () => {
  const feature = findForm("feature")!;
  const field = (key: string) => findMasterField(`feature.${key}`)!.field;
  const reader = (slots: Record<string, ValueSlot>) => (path: string) => slots[path];
  const keyReader = (slots: Record<string, ValueSlot>) => (key: string) => slots[key];

  it("칸은 주계약/독립특약 구분 · 갱신형여부 · 태아보장여부 · 단체계약여부 · 고지유형 · 담보명 접사 — 세부고지유형 칸은 없다", () => {
    expect(feature.fields.map((f) => f.key)).toEqual(["contract_kind", "renewable", "fetal", "group_contract", "notice_kind", "notice_affix"]);
    expect(field("contract_kind").label).toBe("주계약/독립특약 구분");
    expect(field("contract_kind").display).toBe("radio");
    expect(field("notice_affix").type).toEqual({ kind: "string" });
  });

  it("태아보장 · 단체계약 · 고지유형은 기본값이면 감춘다 — 「+」로 꺼낸다", () => {
    expect(["fetal", "group_contract", "notice_kind"].map((k) => field(k).hiddenByDefault)).toEqual([true, true, true]);
    expect(field("renewable").hiddenByDefault).toBeUndefined();
  });

  it("담보명 접사는 고지유형이 일반심사가 아닐 때만 자리가 있다 — 미입력이어도 없다", () => {
    expect(isFieldShown(field("notice_affix"), keyReader({ notice_kind: entered(NOTICE_KIND.review) }))).toBe(true);
    expect(isFieldShown(field("notice_affix"), keyReader({ notice_kind: entered(NOTICE_KIND.health) }))).toBe(true);
    expect(isFieldShown(field("notice_affix"), keyReader({ notice_kind: entered(NOTICE_KIND.general) }))).toBe(false);
    expect(isFieldShown(field("notice_affix"), keyReader({}))).toBe(false);
    expect(isFieldShown(field("notice_affix"), keyReader({ notice_kind: NOT_ENTERED }))).toBe(false);
  });

  it("갱신형여부 · 고지유형은 비울 수 없다 — 접사는 비워도 된다", () => {
    const issues = formRuleIssues(feature, reader({ "feature.notice_kind": entered(NOTICE_KIND.review) }));
    expect(issues.map((i) => i.at.refPath)).toEqual(["feature.renewable"]);
    expect(formRuleIssues(feature, reader({ "feature.renewable": entered(true) })).map((i) => i.at.refPath)).toEqual(["feature.notice_kind"]);
    expect(formRuleIssues(feature, reader({ "feature.renewable": entered(false), "feature.notice_kind": entered(NOTICE_KIND.general) }))).toEqual([]);
  });

  it("noticeAffixOf — 일반심사가 아니면 접사(앞뒤 공백 없이), 일반심사 · 미입력이면 빈 글자", () => {
    const slots = (kind: string | undefined, affix?: string) =>
      new Map<string, ValueSlot>([...(kind ? [["feature.notice_kind", entered(kind)] as const] : []), ...(affix !== undefined ? [["feature.notice_affix", entered(affix)] as const] : [])]);
    expect(noticeAffixOf(slots(NOTICE_KIND.review, " (통합간편심사형) "))).toBe("(통합간편심사형)");
    expect(noticeAffixOf(slots(NOTICE_KIND.health))).toBe("");
    expect(noticeAffixOf(slots(NOTICE_KIND.general, "(남은 접사)"))).toBe("");
    expect(noticeAffixOf(slots(undefined))).toBe("");
  });
});

describe("조건부 필드 — notEquals 조건 (2026-10-29)", () => {
  const read = (slots: Record<string, ValueSlot>) => (key: string) => slots[key];
  const affix = { key: "a", label: "a", type: { kind: "string" as const }, visibleWhen: { field: "k", notEquals: "V01" } };
  it("조건 필드가 입력돼 있고 그 값이 아닐 때만", () => {
    expect(isFieldShown(affix, read({ k: entered("V02") }))).toBe(true);
    expect(isFieldShown(affix, read({ k: entered("V01") }))).toBe(false);
    expect(isFieldShown(affix, read({}))).toBe(false);
  });
});

describe("세목 선택지는 기본값으로 태어난다 — plan 폼 필드의 코드 defaultValue (기능/상품 §3.2)", () => {
  const def = (form: string, field: string) => findForm(form)!.fields.find((f) => f.key === field)!.defaultValue;
  it("납입면제 적용여부 = 아니오 · 무저해지 유형 = 해약환급금지급형(E0002 V01) · 계약전환 = 아니오 · 영위업종 = 아니오", () => {
    expect(def("waiver", "applies")).toBe(false);
    expect(def("no_surrender", "type")).toBe("V01");
    expect(def("conversion", "converts")).toBe(false);
    expect(def("business_type", "applies")).toBe(false);
  });
  it("납입면제사유(list<enum>)는 기본값이 없다", () => {
    expect(def("waiver", "reasons")).toBeUndefined();
  });
});

describe("납입면제 「15세 이상 적용」 — 종 하나에 하나 · 기본 아니오 (기능/상품 §3.9)", () => {
  const waiver = findForm("waiver")!;
  it("waiver 폼의 age15 — 참거짓, 기본값 아니오", () => {
    expect(waiver.fields.find((f) => f.key === "age15")).toMatchObject({ label: "15세 이상 적용", type: { kind: "boolean" }, defaultValue: false });
  });
  it("미입력이어도 폼 규칙 오류가 없다 — 템플릿이 아직 읽지 않는다", () => {
    const slots: Record<string, ValueSlot> = { applies: entered(true), reasons: entered(["V01"]), age15: NOT_ENTERED };
    expect(formRuleIssues(waiver, (key) => slots[key])).toEqual([]);
  });
});
