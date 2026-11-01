import { describe, expect, it } from "vitest";

import type { Discriminator } from "../../src/domain/catalog/types";
import type { ClauseRecord } from "./clauses";
import { rewriteExclusions } from "./exclusion";

const D = (code: string, candidates: string[]): Discriminator => ({ code, label: code, level: "coverage", expression: "", description: "", resultType: { kind: "list<ref>" }, candidates });
const catalog = [D("D0013", ["g-a9", "g-a10", "g-a38"]), D("D0014", ["g-a9", "g-a10", "g-a27_1", "g-a27_2", "g-a38"])];

const head = [
  { id: "h1", kind: "text", text: "이 특별약관에서 정하지 않은 사항은 " },
  { id: "h4", kind: "articleRef", targets: [] },
  { id: "n2", kind: "text", text: "을 따릅니다. 다만, " },
];
const ref = (id: string, ids: string[]) => ({ id, kind: "articleRef", targets: ids.map((articleId) => ({ articleId })), connector: "및" });
const clause = (children: unknown[]): ClauseRecord => ({
  code: "C0900",
  label: "준용규정(시험)",
  mode: "block",
  description: "",
  options: [],
  body: [{ id: "out", kind: "condBlock", branches: [{ id: "out-b", when: "builtin.output ≠ 'replace'", children: [{ id: "p", kind: "paragraph", code: "P0100", children }] }] }],
} as unknown as ClauseRecord);

describe("준용규정 함수조항 — 수동 제외 조 목록 → 준용예외 구분자 + 조건 + 문장 안 반복 (ADR-0098 결정 2)", () => {
  it("「다만, [목록]은 제외합니다.」를 count 조건 안 반복으로 · 뒤 문장(납입면제 단서)은 밖에 둔다", () => {
    const c = clause([...head, ref("r", ["g-a9", "g-a10", "g-a38"]), { id: "t", kind: "text", text: "은 제외합니다. 또한, 1종인 경우 " }, ref("w", ["m-a29"]), { id: "t2", kind: "text", text: "은 제외합니다." }]);
    expect(rewriteExclusions([c], catalog)).toEqual([]);
    expect(c.params).toEqual([{ name: "준용예외", type: { kind: "list<ref>" }, default: { kind: "discriminator", code: "D0013" } }]);
    const p = (c.body[0] as unknown as { branches: { children: { children: unknown[] }[] }[] }).branches[0].children[0];
    expect(p.children).toEqual([
      ...head.slice(0, 2),
      { id: "n2", kind: "text", text: "을 따릅니다." },
      {
        id: "r-if",
        kind: "inlineCond",
        branches: [
          {
            id: "r-if-b",
            when: "count(arg.준용예외) > 0",
            children: [
              { id: "r-if-t", kind: "text", text: " 다만, " },
              { id: "r-each", kind: "inlineFor", source: { kind: "refList", ref: "arg.준용예외" }, alias: "준용예외마다", connector: "및", children: [{ id: "r", kind: "articleRef", targets: [{ restrict: { current: "r-each" } }] }] },
              { id: "t", kind: "text", text: "은 제외합니다." },
            ],
          },
        ],
      },
      { id: "t-rest", kind: "text", text: " 또한, 1종인 경우 " },
      ref("w", ["m-a29"]),
      { id: "t2", kind: "text", text: "은 제외합니다." },
    ]);
  });

  it("목록이 문장 안 조건 가지에 있으면 가지마다 항으로 펴고(조건 안 조건 금지) 가지마다 구분자를 고른다", () => {
    const c = clause([
      ...head,
      {
        id: "x",
        kind: "inlineCond",
        branches: [
          { id: "x-r", when: "renew", children: [ref("a", ["g-a9", "g-a10", "g-a27_1", "g-a27_2", "g-a38"]), { id: "a-t", kind: "text", text: "은 제외합니다." }] },
          { id: "x-e", children: [ref("b", ["g-a9", "g-a10", "g-a38"]), { id: "b-t", kind: "text", text: "은 제외합니다." }] },
        ],
      },
    ]);
    expect(rewriteExclusions([c], catalog)).toEqual([]);
    expect(c.params?.map((p) => [p.name, p.default])).toEqual([
      ["준용예외", { kind: "discriminator", code: "D0014" }],
      ["준용예외2", { kind: "discriminator", code: "D0013" }],
    ]);
    const out = (c.body[0] as unknown as { branches: { children: unknown[] }[] }).branches[0].children;
    expect(out).toHaveLength(1);
    const block = out[0] as { kind: string; branches: { when?: string; children: { kind: string; code: string; id: string }[] }[] };
    expect(block.kind).toBe("condBlock");
    expect(block.branches.map((b) => b.when)).toEqual(["renew", undefined]);
    expect(block.branches.map((b) => [b.children[0].kind, b.children[0].code])).toEqual([["paragraph", "P0100"], ["paragraph", "P0100"]]);
    // 가지마다 복사한 머리 노드 id 는 서로 다르다 (함수조항 안 노드 id 유일)
    const ids = JSON.stringify(block).match(/"id":"[^"]+"/g)!;
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(block)).toContain('"when":"count(arg.준용예외) > 0"');
    expect(JSON.stringify(block)).toContain('"when":"count(arg.준용예외2) > 0"');
  });

  it("후보가 같은 준용예외 구분자가 카탈로그에 없으면 보고한다", () => {
    const c = clause([...head, ref("r", ["g-a5"]), { id: "t", kind: "text", text: "은 제외합니다." }]);
    expect(rewriteExclusions([c], catalog)[0]).toMatch(/g-a5/);
  });
});
