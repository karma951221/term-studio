/**
 * 조 참조 목록(준용예외 구분자)을 식에서 읽기 — `count` 만 (기능/구분자 §3.8 · ADR-0098 결정 2).
 */
import { describe, expect, it } from "vitest";

import { entered } from "../types";
import type { Expr } from "./ast";
import { evaluate, type EvalContext } from "./evaluate";
import { parse } from "./parser";
import { checkCondition, checkTypes, type ExprType } from "./typecheck";

function ast(src: string): Expr {
  const r = parse(src);
  if (!r.ok) throw new Error(`파싱 실패: ${JSON.stringify(r.rejection)}`);
  return r.value;
}

const REF_LIST: ExprType = { kind: "list<ref>" };
const resolve = () => REF_LIST;

describe("count(조 참조 목록)", () => {
  it("타입은 숫자 — 조건 `count(준용예외) > 0` 이 선다", () => {
    expect(checkTypes(ast("count(D0100)"), resolve)).toEqual({ ok: true, value: { kind: "number" } });
    expect(checkCondition(ast("count(D0100) > 0"), resolve).ok).toBe(true);
  });

  it("함수조항 식(인자)에서도 조 참조 목록의 count 는 쓸 수 있다 — 다른 count 는 여전히 없다", () => {
    const params = (name: string): ExprType | undefined => (name === "준용예외" ? REF_LIST : name === "n" ? { kind: "number" } : undefined);
    expect(checkCondition(ast("count(arg.준용예외) > 0"), () => undefined, undefined, params).ok).toBe(true);
    expect(checkCondition(ast("count(arg.n) > 0"), () => undefined, undefined, params).ok).toBe(false);
  });

  it("조 참조 목록은 조건 · 비교에 그대로 서지 않는다", () => {
    expect(checkCondition(ast("D0100 = 'x'"), resolve).ok).toBe(false);
  });

  it("count 밖으로는 읽지 못한다 — 있음 · 비교 · 그대로 쓰기는 저장 오류 (B7)", () => {
    for (const src of ["exist(D0100)", "notexist(D0100)", "D0100 = D0101", "D0100 ≠ D0101"]) {
      const r = checkCondition(ast(src), resolve);
      expect(r.ok, src).toBe(false);
      if (!r.ok) expect(JSON.stringify(r.rejection), src).toContain("count");
    }
    const bare = checkTypes(ast("D0100"), resolve);
    expect(bare.ok).toBe(false);
  });

  it("값 = 그 문맥의 조 목록 — 개수는 원소 수", () => {
    const one = (ids: string[]): EvalContext => ({
      lookup: () => ({ kind: "slot", slot: entered(ids) }),
      attribute: () => ({ kind: "unused" }),
      children: () => [one(ids)],
    });
    expect(evaluate(ast("count(D0100)"), one(["g-a9", "g-a10"]))).toEqual({ kind: "value", value: 2 });
    expect(evaluate(ast("count(D0100) > 0"), one([]))).toEqual({ kind: "value", value: false });
  });
});
