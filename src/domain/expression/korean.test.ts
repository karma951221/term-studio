import { describe, expect, it } from "vitest";

import { refPath, type Expr, type Ref } from "./ast";
import { formatKorean, koreanExpr, type KoreanLabels } from "./korean";
import { parse } from "./parser";

/** 시험용 이름표 — D0001 = 가입형태(열거: 1 일반 · 2 간편), A0001 = 갱신여부(1 비갱신 · 2 갱신), 노드 한정은 「세부보장 01 › …」. */
const NAMES: Record<string, string> = { D0001: "가입형태", D0002: "보험기간", "attr.A0001": "갱신여부", "arg.납입면제_있음": "납입면제_있음", "arg.사유": "사유" };
const ENUM: Record<string, Record<string, string>> = { D0001: { "1": "일반", "2": "간편" }, "attr.A0001": { "1": "비갱신", "2": "갱신" }, "arg.사유": { R1: "질병", R2: "상해" } };
const keyOfExpr = (e: Expr) => (e.kind === "ref" ? refPath(e.ref) : e.kind === "aggregate" ? refPath(e.ref) : undefined);
const labels: KoreanLabels = {
  name: (ref: Ref) => {
    if (ref.kind === "discriminator" && ref.node) return `세부보장 ${ref.node.path} › ${NAMES[ref.code] ?? ref.code}`;
    if (ref.kind === "output") return "작성위치";
    return NAMES[refPath(ref)] ?? refPath(ref);
  },
  value: (against, code) => {
    const k = keyOfExpr(against);
    const base = k?.replace(/@.*$/, "");
    return base ? ENUM[base]?.[code] : undefined;
  },
  member: (target, field) => (target.kind === "ref" && refPath(target.ref) === "arg.사유" && field === "F01" ? "사유.면책여부" : undefined),
};

const k = (s: string) => koreanExpr(s, labels);

describe("koreanExpr — 조건식을 한국어로 (출처 패널)", () => {
  it("작성위치 비교 — 값은 화면 말(대치 · 블록 · 특약)", () => {
    expect(k("builtin.output = 'replace'")).toBe("작성위치 = 대치");
    expect(k("builtin.output != 'special'")).toBe("작성위치 ≠ 특약");
  });

  it("exist(담보속성) 그리고 담보속성 = 코드 → 「갱신여부 있음 그리고 갱신여부 = 갱신」", () => {
    expect(k("exist(attr.A0001) and attr.A0001 = '2'")).toBe("갱신여부 있음 그리고 갱신여부 = 갱신");
  });

  it("함수조항 인자 = true → 「납입면제_있음 = 예」", () => {
    expect(k("arg.납입면제_있음 = true")).toBe("납입면제_있음 = 예");
    expect(k("arg.납입면제_있음 = false")).toBe("납입면제_있음 = 아니오");
  });

  it("열거 코드는 값 이름, 모르는 코드는 따옴표만 벗긴다", () => {
    expect(k("D0001 = '1'")).toBe("가입형태 = 일반");
    expect(k("D0001 = '9'")).toBe("가입형태 = 9");
    expect(k("D0002 = '20년'")).toBe("보험기간 = 20년");
    expect(k("'2' = D0001")).toBe("간편 = 가입형태");
  });

  it("노드 한정 구분자 — 표시명 훅 그대로, 값 이름도 그 구분자 열거로", () => {
    expect(k("D0001@01 = '2'")).toBe("세부보장 01 › 가입형태 = 간편");
  });

  it("비교 기호 — ≠ ≥ ≤ > <", () => {
    expect(k("D0002 >= 3 and D0002 <= 10")).toBe("보험기간 ≥ 3 그리고 보험기간 ≤ 10");
    expect(k("D0002 > 3 or D0002 < 1")).toBe("보험기간 > 3 또는 보험기간 < 1");
  });

  it("not — 「x 아님」, 묶인 식은 괄호, not exist 는 「없음」", () => {
    expect(k("not arg.납입면제_있음")).toBe("납입면제_있음 아님");
    expect(k("not (D0001 = '1')")).toBe("(가입형태 = 일반) 아님");
    expect(k("not (D0001 = '1' or D0001 = '2')")).toBe("(가입형태 = 일반 또는 가입형태 = 간편) 아님");
    expect(k("not exist(attr.A0001)")).toBe("갱신여부 없음");
    expect(k("notexist(attr.A0001)")).toBe("갱신여부 없음");
  });

  it("and / or 중첩 — 우선순위가 바뀌는 자리만 괄호", () => {
    expect(k("D0001 = '1' and (D0002 = 1 or D0002 = 2)")).toBe("가입형태 = 일반 그리고 (보험기간 = 1 또는 보험기간 = 2)");
    expect(k("D0001 = '1' and D0002 = 1 or D0002 = 2")).toBe("가입형태 = 일반 그리고 보험기간 = 1 또는 보험기간 = 2");
    expect(k("(D0001 = '1' or D0001 = '2') and not exist(attr.A0001)")).toBe("(가입형태 = 일반 또는 가입형태 = 간편) 그리고 갱신여부 없음");
  });

  it("그 밖의 집계 · 함수조항 연산도 같은 결", () => {
    expect(k("count(D0002) >= 2")).toBe("보험기간 개수 ≥ 2");
    expect(k("sum(D0002) > 0")).toBe("보험기간 합계 > 0");
    expect(k("any(D0001)")).toBe("가입형태 하나라도 예");
    expect(k("all(D0001)")).toBe("가입형태 모두 예");
    expect(k("arg.사유.있음('R1', 'R2')")).toBe("사유에 질병 또는 상해 있음");
    expect(k("arg.사유.비었음")).toBe("사유 비었음");
    expect(k("arg.사유.F01 = true")).toBe("사유.면책여부 = 예");
  });

  it("날짜 · 숫자 리터럴", () => {
    expect(k("D0002 = d'2026-01-01'")).toBe("보험기간 = 2026-01-01");
    expect(k("D0002 = -2.5")).toBe("보험기간 = -2.5");
  });

  it("파싱 실패면 원문 그대로", () => {
    expect(k("D0001 = = '1'")).toBe("D0001 = = '1'");
    expect(k("")).toBe("");
  });

  it("이름표 없이도 — 참조는 코드 경로, 연산 · 리터럴만 한국어", () => {
    const r = parse("exist(attr.A0001) and D0001 != '2'");
    if (!r.ok) throw new Error("parse");
    expect(formatKorean(r.value)).toBe("attr.A0001 있음 그리고 D0001 ≠ 2");
  });
});
