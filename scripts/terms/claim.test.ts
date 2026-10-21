import { describe, expect, it } from "vitest";

import type { DocumentNode } from "../../src/domain/document/nodes";

import { CLAIM_SLOT, inlineClaimNames } from "./claim";
import type { ClauseRecord } from "./clauses";

const tree = (id: string, children: unknown[]): DocumentNode => ({ id, kind: "document", title: id, children } as unknown as DocumentNode);
const clause = (code: string, params: ClauseRecord["params"]): ClauseRecord => ({ code, label: code, mode: "block", description: "", body: [], options: [], ...(params ? { params } : {}) });

describe("inlineClaimNames — 보험금명 슬롯 · 인자 기본 연결을 글자 · 상수로 (ADR-0091)", () => {
  it("담보약관의 보험금명 슬롯은 같은 id 의 글 노드가 된다 — 글자는 그 담보약관의 보험금명", () => {
    const doc = tree("d", [{ id: "a1", kind: "article", children: [{ id: "p1", kind: "paragraph", children: [{ id: "t", kind: "text", text: "금액을 " }, { id: "s", kind: "slot", ref: CLAIM_SLOT }, { id: "u", kind: "text", text: "으로 지급합니다." }] }] }]);
    const out = inlineClaimNames([{ code: "d", tree: doc }], [], new Map([["d", "사망보험금"]]));
    expect(JSON.stringify(out.documents[0].tree)).toContain('{"id":"s","kind":"text","text":"사망보험금"}');
    expect(JSON.stringify(out.documents[0].tree)).not.toContain(CLAIM_SLOT);
    expect(out.slots).toBe(1);
  });

  it("인자 기본 연결이 보험금명이면 기본 연결을 지우고, 사용처마다 그 담보의 보험금명 상수로 연결한다 — 이미 다른 연결이 있으면 그대로", () => {
    const c = clause("C0001", [
      { name: "조", type: { kind: "articleRef" } },
      { name: "담보명", type: { kind: "string" }, default: { kind: "discriminator", code: CLAIM_SLOT } },
    ]);
    const other = clause("C0002", [{ name: "x", type: { kind: "string" }, default: { kind: "discriminator", code: "D0009" } }]);
    const use = (id: string, bindings?: Record<string, unknown>) => ({ id, kind: "clauseBlockRef", clauseCode: "C0001", options: {}, ...(bindings ? { bindings } : {}) });
    const doc = tree("d", [{ id: "a1", kind: "article", children: [use("k1", { 조: { kind: "articleRef", targets: [], scope: "self" } }), use("k2", { 담보명: { kind: "const", value: "다른 이름" } }), { id: "k3", kind: "clauseBlockRef", clauseCode: "C0002", options: {} }] }]);
    const out = inlineClaimNames([{ code: "d", tree: doc }], [c, other], new Map([["d", "골절진단비"]]));
    expect(out.clauses[0].params).toEqual([
      { name: "조", type: { kind: "articleRef" } },
      { name: "담보명", type: { kind: "string" } },
    ]);
    expect(out.clauses[1]).toBe(other);
    const kids = (out.documents[0].tree.children[0] as unknown as { children: { bindings?: unknown }[] }).children;
    expect(kids[0].bindings).toEqual({ 조: { kind: "articleRef", targets: [], scope: "self" }, 담보명: { kind: "const", value: "골절진단비" } });
    expect(kids[1].bindings).toEqual({ 담보명: { kind: "const", value: "다른 이름" } });
    expect(kids[2].bindings).toBeUndefined();
    expect(out.bindings).toBe(1);
  });

  it("보험금명을 모르는 문서에 슬롯 · 기본 연결 쓰임이 있으면 멈춘다 — 조용히 빈 글자를 찍지 않는다", () => {
    const doc = tree("g", [{ id: "s", kind: "slot", ref: CLAIM_SLOT }]);
    expect(() => inlineClaimNames([{ code: "g", tree: doc }], [], new Map())).toThrow(/g/);
  });
});
