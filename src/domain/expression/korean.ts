/**
 * 식 → 한국어 읽기 표기 (기능/조립산출 §3.7 — 출처 패널). 소스 문법(`format`)과 달리 사람이 읽는 말로 찍는다 — 다시 파싱하지 않는다.
 *
 * - 참조는 표시명 훅(`name` — 없으면 코드 경로), 열거값 필드 읽기는 `member` 훅.
 * - 리터럴: `true`/`false` → 예/아니오, 문자열은 따옴표를 벗긴다. 열거값 코드는 `value` 훅(비교 상대 식 → 값 이름), 모르면 코드.
 *   작성위치(`builtin.output`)와 견준 값은 화면 말(대치 · 블록 · 특약 — `OUTPUT_LABEL`).
 * - 연산: and → 그리고, or → 또는, `not x` → 「x 아님」(`not exist` 는 「없음」), 집계 `exist(x)` → 「x 있음」 등, 비교 기호는 = ≠ > ≥ < ≤.
 * - 괄호는 소스와 같은 우선순위 규칙 — 자식이 부모보다 약하게 묶일 때만(의미가 바뀌지 않게).
 */

import { refPath, type CompareOp, type Expr, type Literal } from "./ast";
import type { DisplayName, MemberName } from "./format";
import { isOutputPosition, OUTPUT_LABEL } from "./output";
import { parse } from "./parser";

export interface KoreanLabels {
  name?: DisplayName;
  member?: MemberName;
  /** 열거값 코드 → 값 이름. `against` = 그 값을 견주는 식(비교 상대 · `있음` 대상 · `거르기` 필드). 모르면 undefined. */
  value?: (against: Expr, code: string) => string | undefined;
}

const PRECEDENCE: Record<Expr["kind"], number> = { or: 1, and: 2, compare: 3, not: 4, literal: 5, ref: 5, aggregate: 5, member: 5, call: 5 };

const OP_WORD: Record<CompareOp, string> = { "=": "=", "≠": "≠", "<": "<", "<=": "≤", ">": ">", ">=": "≥" };

const AGGREGATE_WORD = { exist: "있음", notexist: "없음", count: "개수", sum: "합계", any: "하나라도 예", all: "모두 예" } as const;

export function formatKorean(expr: Expr, labels: KoreanLabels = {}): string {
  const name = labels.name ?? refPath;

  const literal = (lit: Literal, against?: Expr): string => {
    switch (lit.type) {
      case "boolean":
        return lit.value ? "예" : "아니오";
      case "number":
        return String(lit.value);
      case "date":
        return lit.value;
      case "string":
        if (against?.kind === "ref" && against.ref.kind === "output" && !against.ref.prop && isOutputPosition(lit.value)) return OUTPUT_LABEL[lit.value];
        return (against && labels.value?.(against, lit.value)) ?? lit.value;
    }
  };

  const child = (e: Expr, parent: Expr, side: "left" | "right" | "only", against?: Expr): string => {
    const text = go(e, against);
    const pc = PRECEDENCE[parent.kind];
    const cc = PRECEDENCE[e.kind];
    if (cc < pc) return `(${text})`;
    if (cc === pc && side === "right" && (e.kind === "and" || e.kind === "or")) return `(${text})`;
    if (e.kind === "compare" && parent.kind === "compare") return `(${text})`;
    return text;
  };

  const go = (e: Expr, against?: Expr): string => {
    switch (e.kind) {
      case "literal":
        return literal(e.literal, against);
      case "ref":
        return name(e.ref);
      case "aggregate":
        return `${name(e.ref)} ${AGGREGATE_WORD[e.op]}`;
      case "member":
        return labels.member?.(e.target, e.field) ?? `${go(e.target)}.${e.field}`;
      case "call":
        switch (e.op) {
          case "합치기":
            return `${go(e.target)}에서 ${name(e.ref)} 합치기`;
          case "있음":
            return `${go(e.target)}에 ${e.values.map((v) => literal({ type: "string", value: v }, e.target)).join(" 또는 ")} 있음`;
          case "거르기": {
            const field: Expr = { kind: "member", target: e.target, field: e.field };
            return `${go(e.target)} 중 ${go(field)} = ${literal(e.value, field)}인 것`;
          }
          case "비었음":
            return `${go(e.target)} 비었음`;
        }
      case "not":
        // not exist(x) → 「x 없음」, not notexist(x) → 「x 있음」 — 「있음 아님」보다 바로 읽힌다
        if (e.operand.kind === "aggregate" && (e.operand.op === "exist" || e.operand.op === "notexist")) return go({ ...e.operand, op: e.operand.op === "exist" ? "notexist" : "exist" });
        return `${child(e.operand, e, "only")} 아님`;
      case "compare":
        return `${child(e.left, e, "left", e.right)} ${OP_WORD[e.op]} ${child(e.right, e, "right", e.left)}`;
      case "and":
      case "or":
        return `${child(e.left, e, "left")} ${e.kind === "and" ? "그리고" : "또는"} ${child(e.right, e, "right")}`;
    }
  };

  return go(expr);
}

/** 소스 → 한국어 표기. 빈 식 · 파싱 실패면 원문 그대로. */
export function koreanExpr(source: string, labels?: KoreanLabels): string {
  if (!source) return source;
  const parsed = parse(source);
  return parsed.ok ? formatKorean(parsed.value, labels) : source;
}
