/**
 * 준용규정 함수조항의 준용예외 문장 — 조건 + 문장 안 반복 + 조 참조(현재 원소), 새 노드 없이 (ADR-0098 결정 2 · 기능/함수조항 §3.7).
 */
import { describe, expect, it } from "vitest";

import type { ExprType, Ref } from "../expression";
import { applyBindings } from "./bind";
import { analyzeBody } from "./body";
import type { Block } from "./nodes";
import type { ParamDef } from "./params";
import { expandClause } from "./reference";
import type { Clause } from "./types";

const 준용예외: ParamDef = { name: "준용예외", type: { kind: "list<ref>" }, default: { kind: "discriminator", code: "D0100" } };

/** 「이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다. 다만, 〔[준용예외마다] 조 참조(현재)〕은 제외합니다.」 */
function body(over: { connector?: string; current?: string; ref?: string } = {}): Block[] {
  return [
    {
      id: "p1",
      kind: "paragraph",
      code: "P0100",
      children: [
        { id: "t1", kind: "text", text: "이 특별약관에서 정하지 않은 사항은 " },
        { id: "doc", kind: "articleRef", targets: [] },
        { id: "t2", kind: "text", text: "을 따릅니다." },
        {
          id: "if",
          kind: "inlineCond",
          branches: [
            {
              id: "if-b",
              when: "count(arg.준용예외) > 0",
              children: [
                { id: "t3", kind: "text", text: " 다만, " },
                {
                  id: "each",
                  kind: "inlineFor",
                  source: { kind: "refList", ref: over.ref ?? "arg.준용예외" },
                  ...(over.connector === "" ? {} : { connector: (over.connector ?? "및") as "및" }),
                  children: [{ id: "ref", kind: "articleRef", targets: [{ restrict: { current: over.current ?? "each" } }] }],
                },
                { id: "t4", kind: "text", text: "은 제외합니다." },
              ],
            },
          ],
        },
      ],
    },
  ] as unknown as Block[];
}

const resolveType = (ref: Ref): ExprType | undefined => (ref.kind === "discriminator" && ref.code === "D0100" ? { kind: "list<ref>" } : undefined);

function issues(b: Block[], params: ParamDef[] = [준용예외]): string[] {
  const r = analyzeBody("block", b, [], { resolveType }, params);
  return r.ok ? [] : r.rejection.reason === "invalid" ? r.rejection.issues.map((i) => i.message) : [r.rejection.reason];
}

describe("준용규정 함수조항 본문 검사", () => {
  it("조건 + 조 참조 목록 인자의 문장 안 반복 + 현재 원소 조 참조를 받는다 · 요구 구분자에 기본 연결이 든다", () => {
    const r = analyzeBody("block", body(), [], { resolveType }, [준용예외]);
    expect(r).toEqual({ ok: true, value: { discriminators: ["D0100"], attributes: [] } });
  });

  it("연결어가 없으면 거부한다", () => {
    expect(issues(body({ connector: "" })).join()).toMatch(/연결어/);
  });

  it("원천은 조 참조 목록 인자여야 한다", () => {
    expect(issues(body(), [{ name: "준용예외", type: { kind: "boolean" } }]).join()).toMatch(/조 참조 목록/);
    expect(issues(body({ ref: "D0100" })).join()).toMatch(/인자/);
  });

  it("조 참조의 「현재」는 감싼 반복만 가리킨다", () => {
    expect(issues(body({ current: "other" })).join()).toMatch(/감싸지 않습니다/);
  });
});

describe("펼치기 · 인자 연결", () => {
  it("원천의 인자는 사용처 연결(구분자 코드)로, 조건의 count 도 바꿔 쓴다", () => {
    const clause = { code: "C0900", label: "준용규정", mode: "block", body: body(), options: [], params: [준용예외], required: { discriminators: ["D0100"], attributes: [] } } as unknown as Clause;
    const bound = applyBindings(clause, undefined, (v) => String(v));
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    const expanded = expandClause(bound.value, {}, "ref1");
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    const json = JSON.stringify(expanded.value);
    expect(json).toContain('"when":"count(D0100) > 0"');
    expect(json).toContain('"source":{"kind":"refList","ref":"D0100"}');
    // 반복 id 를 유일화하면 현재 원소 한정도 같은 id 를 가리킨다
    const each = json.match(/"id":"([^"]*each)","kind":"inlineFor"/)?.[1];
    expect(each).toBeDefined();
    expect(json).toContain(`"restrict":{"current":"${each}"}`);
  });
});
