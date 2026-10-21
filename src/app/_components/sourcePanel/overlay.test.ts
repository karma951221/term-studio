import { describe, expect, it } from "vitest";

import type { ConditionDecision, DecisionRecord, RepeatDecision, SourceView } from "@/domain/assembly";
import { entered, NOT_ENTERED } from "@/domain/types";

import { argText, BRANCH_OUTCOME_LABEL, clauseScope, elementScope, elementForNode, indexDecisions, keyOf, links, readsText, ROOT_SCOPE, slotText } from "./overlay";

const cond = (nodeId: string, inner: DecisionRecord[] = []): ConditionDecision => ({
  kind: "condition",
  nodeId,
  inline: false,
  branches: [
    { id: `${nodeId}-if`, when: "D0001 = true", outcome: "taken", condition: { expression: "D0001 = true", value: true, discriminators: [{ code: "D0001", slot: entered(true) }], attributes: [], reads: [] }, decisions: inner },
    { id: `${nodeId}-else`, outcome: "skipped", decisions: [] },
  ],
});

describe("결정 노드 색인 — 원본 자리 id 로 기록을 찾는다", () => {
  it("가지 · 함수조항 · 반복 원소 안의 기록까지 평평하게", () => {
    const repeat: RepeatDecision = { kind: "repeat", nodeId: "r", form: "block", source: { kind: "planOptions", form: "waiver" }, elements: [{ id: "e1", kind: "planOption", label: "1종", decisions: [cond("c@e1")] }] };
    const index = indexDecisions([cond("a", [{ kind: "clause", nodeId: "call", clauseCode: "C1", args: [], options: {}, overridden: [], decisions: [cond("call/in")] }]), repeat]);
    expect([...index.keys()].sort()).toEqual(["a", "c@e1", "call", "call/in", "r"]);
  });
});

describe("원본 자리 id — 반복 원소는 `@원소` 접미사, 펼친 함수조항은 `참조id/` 앞마디 (기능/조립산출 §3.4)", () => {
  it("뿌리는 그대로", () => {
    expect(keyOf(ROOT_SCOPE, "x")).toBe("x");
  });

  it("반복 원소 안 — 바깥 → 안쪽 접미사", () => {
    const s = elementScope(elementScope(ROOT_SCOPE, "종1"), "V01");
    expect(keyOf(s, "p")).toBe("p@종1@V01");
  });

  it("함수조항 펼치기 — 참조 id(접미사 포함) 뒤 `/`, 안쪽은 접미사 없음", () => {
    const s = clauseScope(elementScope(ROOT_SCOPE, "종1"), "ref");
    expect(keyOf(s, "in")).toBe("ref@종1/in");
  });
});

describe("반복 원소 탭 — 결과에서 누른 원소가 처음부터 골라진다", () => {
  const rec: RepeatDecision = { kind: "repeat", nodeId: "r", form: "block", source: { kind: "planOptions", form: "waiver" }, elements: [{ id: "opt-1", kind: "planOption", label: "1종", decisions: [] }, { id: "opt-2", kind: "planOption", label: "2종", decisions: [] }] };
  it("누른 노드 id 에 그 원소 접미사가 있으면 그 원소", () => {
    expect(elementForNode(rec, "slot@opt-2")).toBe("opt-2");
  });
  it("없으면 첫 원소 · 원소 0개면 없음", () => {
    expect(elementForNode(rec, "slot")).toBe("opt-1");
    expect(elementForNode({ ...rec, elements: [] }, undefined)).toBeUndefined();
  });
});

describe("값 표기", () => {
  const view = { discriminators: { D0001: { label: "갱신여부" }, D0009: { label: "사유", enumCode: "E1" } }, enums: { E1: { label: "사유", values: { V01: "암" } } }, attributes: {} } as unknown as SourceView;
  it("참거짓 · 수 · 열거값(이름) · 목록 · 미입력 · 자리 없음 · 미결", () => {
    expect(slotText(entered(true))).toBe("예");
    expect(slotText(entered(false))).toBe("아니오");
    expect(slotText(entered(24))).toBe("24");
    expect(slotText(entered("V01"), view.enums.E1)).toBe("암 (V01)");
    expect(slotText(entered(["V01", "V02"]), view.enums.E1)).toBe("암 (V01) · V02");
    expect(slotText(NOT_ENTERED)).toBe("미입력");
    expect(slotText("missing")).toBe("자리 없음");
    expect(slotText("undetermined")).toBe("미결");
  });

  it("조건 근거 — 「구분자 이름 = 유효값」", () => {
    expect(readsText({ expression: "", discriminators: [{ code: "D0001", slot: entered(true) }, { code: "D0009", slot: entered("V01") }], attributes: [], reads: [] }, view)).toEqual(["갱신여부 = 예", "사유 = 암 (V01)"]);
  });

  it("함수조항 인자 — 「인자 ← 구분자 이름 = 값」 · 상수 · 연결 없음", () => {
    expect(argText({ name: "면책기간", binding: { kind: "discriminator", code: "D0001" }, value: true }, view)).toBe("면책기간 ← 갱신여부 = 예");
    expect(argText({ name: "율", binding: { kind: "const", value: 50 }, value: 50 }, view)).toBe("율 = 50 (상수)");
    expect(argText({ name: "x" }, view)).toBe("x — 연결 없음");
  });

  it("가지 표식 넷", () => {
    expect(BRANCH_OUTCOME_LABEL).toEqual({ taken: "탐", false: "거짓", skipped: "앞 가지에서 결정 — 평가 안 함", blocked: "막힘" });
  });
});

describe("이동 주소 — 고치러 가기 표(§3.4) 그대로", () => {
  const view = {
    productId: "p1",
    explanation: { target: { document: "special", productCoverageId: "pc1", articleId: "a" }, status: "shown", sources: [{ kind: "coverage", documentId: "doc1", articleId: "a", productCoverageId: "pc1", coverageId: "cov1", decisions: [] }] },
    readOwners: { "sub-1": "pc1" },
    sources: [{ documentRecordId: "rec1" }],
  } as unknown as SourceView;

  it("문면 조 · 함수조항 · 구분자 · 열거값 · 상품 구성", () => {
    expect(links.source(view, 0)).toBe("/documents/rec1?node=a");
    expect(links.source({ ...view, sources: [{}] } as unknown as SourceView, 0)).toBe("/coverages/cov1");
    expect(links.clause("C0001")).toBe("/functions/C0001");
    expect(links.discriminator("D0001")).toBe("/catalog/D0001");
    expect(links.enumValue("E1", "V01")).toBe("/enums/E1?value=V01");
    expect(links.productCoverage(view, "pc1")).toBe("/products/p1/coverages/pc1");
  });

  it("사본 — 상품 보통약관 탭의 그 조", () => {
    const copy = { ...view, explanation: { ...view.explanation, sources: [{ kind: "copy", documentId: "g", articleId: "t", decisions: [] }] } } as unknown as SourceView;
    expect(links.source(copy, 0)).toBe("/products/p1?tab=general&art=t");
  });

  it("값 — 상품 값 · 세목은 기본정보, 상품담보 · 세부보장 · 급부 값은 그 상품담보", () => {
    expect(links.read(view, { owner: { kind: "product", id: "p1" }, masterId: "p1", path: "x", slot: NOT_ENTERED })).toBe("/products/p1?tab=basic");
    expect(links.read(view, { owner: { kind: "productSubCoverage", id: "sub-1" }, masterId: "m", path: "x", slot: NOT_ENTERED })).toBe("/products/p1/coverages/pc1");
  });
});
