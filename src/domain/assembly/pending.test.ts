/**
 * 막힌 분기 — `Booklet.pending` · `SpecialPreview.pending` (ADR-0092 결정 6 · 기능/조립산출 §3.7 · §4.1 「평가 대기 c」).
 *
 * 조건 평가 오류로 어느 가지도 고르지 못한 분기를 일반 조립 때 기록한다 — 결과 자리 · 원천(그 오류의 source) · 노드 id.
 * 막힌 분기 안쪽은 평가하지 않으므로 기록되지 않는다(ADR-0016).
 */
import { describe, expect, it } from "vitest";

import type { Clause } from "../clause/types";
import type { ArticleNode, BlockNode, DocumentNode, InlineNode } from "../document/nodes";
import { titleNodes } from "../document/title";
import { assemble, assembleSpecial } from "./booklet";
import { alphaPlusFixture, deathCoverage } from "./fixture";
import type { AssemblyInput } from "./types";

const text = (id: string, value: string): InlineNode => ({ id, kind: "text", text: value });
const para = (id: string, children: InlineNode[]): BlockNode => ({ id, kind: "paragraph", children }) as BlockNode;
const article = (id: string, title: string, children: BlockNode[]): ArticleNode => ({ id, kind: "article", title: titleNodes(title, id), children });

function withSpecial(extra: DocumentNode["children"], patch: (input: AssemblyInput) => AssemblyInput = (x) => x): AssemblyInput {
  const input = alphaPlusFixture();
  const doc = input.specialDocuments.get("cov-death")!;
  return patch({ ...input, specialDocuments: new Map([...input.specialDocuments, ["cov-death", { ...doc, children: [...doc.children, ...extra] }]]) });
}

/** 갱신여부를 비운 일반상해사망 탑재분 — 갱신여부(D0001) 조건 평가가 막힌다. 추가 탑재분(pc-addon)은 그대로. */
function withoutRenewal(input: AssemblyInput): AssemblyInput {
  const c = deathCoverage("pc-basic", "일반상해사망", [{ kindCode: "A0002", valueCode: "1" }]);
  (c.values.get("pc-basic") as Map<string, unknown>).delete("coverage_basic.renewal");
  return { ...input, coverages: input.coverages.map((x) => (x.snapshot.id === "pc-basic" ? c : x)) };
}

describe("Booklet.pending — 막힌 분기", () => {
  const blocked = article("s-art-b", "막힘 표본", [
    {
      id: "b-cond",
      kind: "condBlock",
      branches: [
        // 막힌 가지 안의 막힌 분기는 평가하지 않는다 — 기록되지 않는다
        { id: "b-if", when: "D0001 = true", children: [{ id: "b-inner", kind: "condBlock", branches: [{ id: "b-inner-if", when: "D0001 = false", children: [para("b-p0", [text("b-t0", "안쪽")])] }] } as BlockNode] },
        { id: "b-else", children: [para("b-p2", [text("b-t2", "그 밖")])] },
      ],
    } as BlockNode,
  ]);
  const input = withSpecial([blocked], withoutRenewal);

  it("결과 자리 · 원천(그 원인 오류의 source) · 노드 id · 문구 — 안쪽 분기는 없다", () => {
    const booklet = assemble(input, input);
    const issue = booklet.issues.find((i) => i.kind === "notEntered" && i.at.articleId === "s-art-b")!;
    expect(issue).toBeDefined();
    expect(issue.source).toBeDefined();
    expect(booklet.pending).toEqual([{ nodeId: "b-cond", at: issue.at, source: issue.source, message: issue.message }]);
  });

  it("막힌 분기가 없으면 빈 목록 — 옛 산출본(필드 없음)과 가른다", () => {
    const fine = alphaPlusFixture();
    expect(assemble(fine, fine).pending).toEqual([]);
  });

  it("인라인 조건도 막히면 평가 대기", () => {
    const inline = article("s-art-bi", "인라인 막힘", [para("bi-p", [{ id: "bi-inl", kind: "inlineCond", branches: [{ id: "bi-if", when: "D0001 = true", children: [text("bi-t", "갱신")] }] }])]);
    const x = withSpecial([inline], withoutRenewal);
    expect(assemble(x, x).pending!.map((p) => p.nodeId)).toEqual(["bi-inl"]);
  });

  it("값별 분기의 대상 값을 평가하지 못하면 평가 대기 — 펼친 함수조항 안이면 노드 id 는 펼친 id", () => {
    const sw: Clause = {
      code: "C0910",
      label: "분기 표본",
      mode: "block",
      body: [{ id: "sw", kind: "switchBlock", on: "arg.값", cases: [{ id: "k1", values: ["V01"], children: [{ id: "k1p", kind: "paragraph", children: [{ id: "k1t", kind: "text", text: "일반" }] }] }] }],
      options: [],
      params: [{ name: "값", type: { kind: "enum", enumCode: "E0001" } }],
      required: { discriminators: [], attributes: [] },
    };
    const call = article("s-art-sw", "분기 막힘", [{ id: "sw-call", kind: "clauseBlockRef", clauseCode: "C0910", options: {}, bindings: { 값: { kind: "discriminator", code: "D0001" } } } as BlockNode]);
    const x = withSpecial([call], (y) => withoutRenewal({ ...y, clauses: [...y.clauses, sw] }));
    // 미입력(pc-basic) · 목록값 코드가 아님(pc-addon — 갱신여부는 참거짓) 모두 대상 값을 정하지 못해 막힌다
    expect(assemble(x, x).pending!.map((p) => [p.nodeId, p.at.ownerId])).toEqual([["sw-call/sw", "pc-basic"], ["sw-call/sw", "pc-addon"]]);
  });

  it("상품담보 미리보기(SpecialPreview)에도 같은 필드 — 그 담보약관 한 벌의 막힌 분기", () => {
    const r = assembleSpecial(input, input, "pc-basic");
    if (!r.ok) throw new Error("미리보기 실패");
    expect(r.value.pending!.map((p) => p.nodeId)).toEqual(["b-cond"]);
    const addon = assembleSpecial(input, input, "pc-addon");
    if (!addon.ok) throw new Error("미리보기 실패");
    expect(addon.value.pending).toEqual([]);
  });
});
