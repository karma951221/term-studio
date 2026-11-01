/**
 * 준용예외 구분자 — 결과 타입 「조 참조 목록」 · 정의 = 후보 (기능/구분자 §3.8 · ADR-0098 결정 1).
 */
import { describe, expect, it } from "vitest";

import type { NextSeq } from "./codes";
import { createDiscriminator, setCandidates, setExpression, setResultType, type CatalogContext } from "./definitions";
import { discriminatorResultType } from "./expression";
import { isRefListDiscriminator, REF_LIST_TYPE, type Discriminator } from "./types";

function memorySeq(): NextSeq {
  let n = 0;
  return () => ++n;
}

function ctx(over: Partial<CatalogContext> = {}): CatalogContext {
  return { nextSeq: memorySeq(), existing: [], findEnum: () => undefined, ...over };
}

const 준용예외: Discriminator = { code: "D0100", label: "준용예외", level: "coverage", expression: "", description: "", resultType: REF_LIST_TYPE, candidates: ["g-a9", "g-a10"] };

describe("준용예외 구분자 — 정의 = 후보", () => {
  it("결과 타입 「조 참조 목록」이면 식 없이 후보 조로 만든다", async () => {
    const r = await createDiscriminator({ label: "준용예외", level: "coverage", expression: "", resultType: REF_LIST_TYPE, candidates: ["g-a9", "m-a9", "g-a9"] }, ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.expression).toBe("");
    expect(r.value.candidates).toEqual(["g-a9", "m-a9"]); // 같은 조 한 번
    expect(isRefListDiscriminator(r.value)).toBe(true);
  });

  it("식을 쓰면 거부한다 — 계산은 조립이 한다", async () => {
    const r = await createDiscriminator({ label: "준용예외", level: "coverage", expression: "true", resultType: REF_LIST_TYPE, candidates: [] }, ctx());
    expect(r.ok).toBe(false);
  });

  it("담보 레벨만 — 값은 특약 · 블록(상품담보) 문맥마다다", async () => {
    const r = await createDiscriminator({ label: "준용예외", level: "product", expression: "", resultType: REF_LIST_TYPE, candidates: [] }, ctx());
    expect(r.ok).toBe(false);
  });

  it("다른 결과 타입에는 후보를 두지 않는다", async () => {
    const r = await createDiscriminator({ label: "x", level: "product", expression: "true", resultType: { kind: "boolean" }, candidates: ["g-a9"] }, ctx());
    expect(r.ok).toBe(false);
  });

  it("후보 바꾸기 · 식 · 결과 타입은 바꾸지 못한다", () => {
    const next = setCandidates(준용예외, ["g-a38", "g-a9"]);
    expect(next.ok && next.value.candidates).toEqual(["g-a38", "g-a9"]);
    expect(setExpression(준용예외, "true").ok).toBe(false);
    expect(setResultType(준용예외, { kind: "boolean" }, { findEnum: () => undefined }).ok).toBe(false);
    const plain: Discriminator = { code: "D0001", label: "a", level: "product", expression: "true", description: "", resultType: { kind: "boolean" } };
    expect(setCandidates(plain, ["g-a9"]).ok).toBe(false);
    expect(setResultType(plain, REF_LIST_TYPE, { findEnum: () => undefined }).ok).toBe(false);
  });

  it("결과 타입은 선언 그대로 — 식에서 추론하지 않는다", () => {
    expect(discriminatorResultType(준용예외)).toEqual({ kind: "list<ref>" });
  });
});
