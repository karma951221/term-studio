/**
 * 준용예외 구분자 조립 (기능/조립산출 §3.5 · ADR-0098 결정 2 ~ 7) — 값 = 특약 · 블록 문맥마다 판정한 조 목록,
 * 준용규정 함수조항은 「IF count(준용예외) > 0 · 다만, 〔[준용예외마다] 조 참조(현재)〕은 제외합니다.」로 찍는다.
 */
import { describe, expect, it } from "vitest";

import type { Clause } from "../clause/types";
import type { Discriminator } from "../catalog/types";
import type { ArticleNode, DocumentNode } from "../document/nodes";
import { titleNodes } from "../document/title";
import { assemble, assembleSpecial } from "./booklet";
import { explainArticle } from "./explain";
import { buildSourceView } from "./sourceView";
import { alphaDeathDocument, alphaPlusFixture } from "./fixture";
import type { AssemblyInput, Booklet, RenderedDoc, RenderedInline } from "./types";

const 준용예외 = (candidates: string[]): Discriminator => ({ code: "D0100", label: "준용예외", level: "coverage", expression: "", description: "", resultType: { kind: "list<ref>" }, candidates });

const 준용규정: Clause = {
  code: "C0100",
  label: "준용규정",
  mode: "block",
  params: [{ name: "준용예외", type: { kind: "list<ref>" }, default: { kind: "discriminator", code: "D0100" } }],
  body: [
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
                { id: "each", kind: "inlineFor", source: { kind: "refList", ref: "arg.준용예외" }, connector: "및", children: [{ id: "ref", kind: "articleRef", targets: [{ restrict: { current: "each" } }] }] },
                { id: "t4", kind: "text", text: "은 제외합니다." },
              ],
            },
          ],
        },
      ],
    },
  ],
  options: [],
  required: { discriminators: ["D0100"], attributes: [] },
} as unknown as Clause;

const applicationArticle: ArticleNode = { id: "s-art-application", kind: "article", title: titleNodes("준용규정", "s-art-application"), children: [{ id: "s-clause-application", kind: "clauseBlockRef", clauseCode: "C0100", options: {} }] };

function withExclusion(candidates: string[], over: (input: AssemblyInput) => AssemblyInput = (x) => x): AssemblyInput {
  const input = alphaPlusFixture();
  const death: DocumentNode = { ...alphaDeathDocument(), children: [...alphaDeathDocument().children, applicationArticle] };
  return over({
    ...input,
    catalog: [...input.catalog, 준용예외(candidates)],
    clauses: [...input.clauses, 준용규정],
    specialDocuments: new Map([...input.specialDocuments, ["cov-death", death]]),
  });
}

const text = (list: RenderedInline[]) => list.map((n) => (n.kind === "text" ? n.text : n.kind === "error" ? `⟦${n.issue.kind}: ${n.issue.message}⟧` : n.label)).join("");

/** 문서의 준용규정 조 첫 항 글. */
function application(doc: RenderedDoc | undefined): string | undefined {
  for (const c of doc?.children ?? []) {
    if (c.kind !== "article" || c.title !== "준용규정") continue;
    const p = c.children[0];
    return p?.kind === "paragraph" ? text(p.children) : undefined;
  }
  return undefined;
}

const special = (b: Booklet, ownerId: string) => b.specials.flatMap((g) => g.docs).find((d) => d.ownerId === ownerId);
const block = (b: Booklet, ownerId: string) => (b.blocks ?? []).flatMap((g) => g.docs).find((d) => d.ownerId === ownerId);
const run = (input: AssemblyInput) => assemble(input, input);

describe("대치 형태의 특약 — 후보이고 특약에 없는 조만", () => {
  it("특약이 조연결한 후보는 빼고, 다른 템플릿의 후보는 보지 않는다", () => {
    const b = run(withExclusion(["g-art-def", "g-art-refund", "m-a9"]));
    expect(application(special(b, "pc-basic"))).toBe("이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다. 다만, 보통약관 제1조(용어의 정의)은 제외합니다.");
    expect(b.issues.filter((i) => i.severity !== "warning")).toEqual([]);
  });

  it("둘 이상이면 한 덩어리 조 참조로 잇는다 — 「보통약관」 머리는 한 번", () => {
    const b = run(withExclusion(["g-art-disability", "g-art-def"]));
    expect(application(special(b, "pc-basic"))).toBe("이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다. 다만, 보통약관 제1조(용어의 정의) 및 제5조(장해의 분류)은 제외합니다.");
  });

  it("값이 비면 「다만 …」 문장이 조건으로 통째 빠진다 — 노출을 끈 조는 ③ 트리에 없음", () => {
    const b = run(withExclusion(["g-art-def"], (input) => ({ ...input, product: { ...input.product, hiddenArticleIds: new Set(["g-art-def"]) } })));
    expect(application(special(b, "pc-basic"))).toBe("이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다.");
  });

  it("판정 기록 — 특약 · 조마다 넣음 / 안 넣음 · 갈래 · 사유", () => {
    const b = run(withExclusion(["g-art-def", "g-art-refund"]));
    const rec = b.exclusions?.find((r) => r.productCoverageId === "pc-basic");
    expect(rec).toMatchObject({ code: "D0100", context: "special", value: ["g-art-def"] });
    expect(rec?.judgments).toEqual([
      { articleId: "g-art-def", included: true, branch: "single" },
      { articleId: "g-art-refund", included: false, branch: "single", reason: "hasArticle" },
    ]);
  });

  it("상품담보 미리보기도 같은 값 · 대치 자리(기본계약)에는 값이 없다", () => {
    const input = withExclusion(["g-art-def"]);
    const r = assembleSpecial(input, input, "pc-basic");
    expect(r.ok && application(r.value.doc)).toBe("이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다. 다만, 보통약관 제1조(용어의 정의)은 제외합니다.");
    expect(run(input).exclusions?.some((x) => x.productCoverageId === "pc-base")).toBe(false);
  });
});

describe("절 형태 — 위임 조는 특약에 늘 · 블록은 후보만", () => {
  /** 주계약 기본계약 둘 — 기본계약 문면 · 일반상해사망이 블록, 일반상해사망 추가가 특약. 둘 다 g-art-pay 를 조연결해 위임된다. */
  const twoBase = (candidates: string[]) => withExclusion(candidates, (input) => ({ ...input, product: { ...input.product, baseContractIds: ["pc-base", "pc-basic"] } }));

  it("특약은 위임 조를 후보와 무관하게 넣는다 — 특약이 그 조를 조연결했어도", () => {
    const b = run(twoBase(["g-art-def"]));
    const rec = b.exclusions?.find((r) => r.productCoverageId === "pc-addon");
    expect(rec?.value).toEqual(["g-art-def", "g-art-pay"]);
    expect(rec?.judgments.find((j) => j.articleId === "g-art-pay")).toEqual({ articleId: "g-art-pay", included: true, branch: "delegated" });
    expect(application(special(b, "pc-addon"))).toMatch(/다만, 보통약관 제1절 일반조항 제1조\(용어의 정의\) 및 제2조\(보험금의 지급사유\)은 제외합니다\.$/);
  });

  it("블록은 제1절에 찍힌 후보 조 중 블록에 연결 조가 없는 것만 — 위임 조는 넣지 않는다", () => {
    const b = run(twoBase(["g-art-def", "g-art-refund"]));
    const rec = b.exclusions?.find((r) => r.productCoverageId === "pc-basic");
    expect(rec).toMatchObject({ context: "block", value: ["g-art-def"] });
    // 같은 항에서 「제1절 일반조항」을 이미 밝혔으면 접두를 생략한다 — 위치 호칭 규칙(기능/조립산출 §3.10) 그대로
    expect(application(block(b, "pc-basic"))).toBe("이 특별약관에서 정하지 않은 사항은 제1절 일반조항을 따릅니다. 다만, 제1조(용어의 정의)은 제외합니다.");
  });

  it("최소형(준용규정 조가 없는 특약)은 ② 위임 조만 싣는다", () => {
    const input = twoBase([]);
    const plain = { ...input, specialDocuments: new Map([...input.specialDocuments, ["cov-death", alphaDeathDocument()]]) };
    const b = run(plain);
    expect(application(special(b, "pc-addon"))).toBe("이 특별약관에서 정하지 않은 사항은 보통약관 제1절 일반조항을 따릅니다. 다만, 보통약관 제1절 일반조항 제2조(보험금의 지급사유)은 제외합니다.");
  });
});

describe("판정 기록 → 출처 패널 (결정 7)", () => {
  it("준용예외를 읽는 조(준용규정)의 패널 재료에 조마다 넣음 / 안 넣음 · 갈래 · 사유를 싣는다", () => {
    const input = withExclusion(["g-art-def", "g-art-refund"]);
    const b = run(input);
    const target = { document: "special" as const, productCoverageId: "pc-basic", articleId: "s-art-application" };
    const view = buildSourceView(input, input, explainArticle(input, input, target), b);
    expect(view.exclusions).toEqual([
      {
        code: "D0100",
        label: "준용예외",
        context: "special",
        rows: [
          { articleId: "g-art-def", label: "제1조(용어의 정의)", included: true, branch: "대치 형태 — 보통약관에 있음" },
          { articleId: "g-art-refund", label: "제6조(해약환급금)", included: false, branch: "대치 형태 — 보통약관에 있음", reason: "특약에 그 조가 있음(조연결)" },
        ],
      },
    ]);
    // 준용예외를 읽지 않는 조에는 없다
    const other = buildSourceView(input, input, explainArticle(input, input, { ...target, articleId: "s-art-lapse" }), b);
    expect(other.exclusions).toBeUndefined();
  });
});

describe("담보약관 문면에 직접 쓴 준용예외 반복 (B5) — 함수조항 없이 구분자 원천 · 현재 원소 조 참조", () => {
  /** 「이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다.〔IF count(D0100) > 0〕 다만, 〔[D0100마다] 현재 조〕은 제외합니다.〔END〕」 — 문면 트리 모양(대상 조 id 빈 문자열). */
  const direct: ArticleNode = {
    id: "s-art-direct",
    kind: "article",
    title: titleNodes("준용규정", "s-art-direct"),
    children: [
      {
        id: "s-direct-p",
        kind: "paragraph",
        children: [
          { id: "s-d-t1", kind: "text", text: "이 특별약관에서 정하지 않은 사항은 " },
          { id: "s-d-doc", kind: "articleRef", targets: [], scope: "general" },
          { id: "s-d-t2", kind: "text", text: "을 따릅니다." },
          {
            id: "s-d-if",
            kind: "inlineCond",
            branches: [
              {
                id: "s-d-if-b",
                when: "count(D0100) > 0",
                children: [
                  { id: "s-d-t3", kind: "text", text: " 다만, " },
                  { id: "s-d-each", kind: "inlineFor", source: { kind: "refList", ref: "D0100" }, connector: "및", children: [{ id: "s-d-ref", kind: "articleRef", targets: [{ articleId: "", restrict: { current: "s-d-each" } }], scope: "general" }] },
                  { id: "s-d-t4", kind: "text", text: "은 제외합니다." },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as ArticleNode;

  it("함수조항으로 쓴 것과 같은 글 — 판정 값 · 한 덩어리 조 참조 · 빈 값이면 조건으로 빠진다", () => {
    const input = withExclusion(["g-art-disability", "g-art-def"], (x) => ({ ...x, specialDocuments: new Map([...x.specialDocuments, ["cov-death", { ...alphaDeathDocument(), children: [...alphaDeathDocument().children, direct] }]]) }));
    const b = run(input);
    expect(application(special(b, "pc-basic"))).toBe("이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다. 다만, 보통약관 제1조(용어의 정의) 및 제5조(장해의 분류)은 제외합니다.");
    expect(b.issues.filter((i) => i.severity !== "warning")).toEqual([]);
    const none = run(withExclusion([], (x) => ({ ...x, specialDocuments: new Map([...x.specialDocuments, ["cov-death", { ...alphaDeathDocument(), children: [...alphaDeathDocument().children, direct] }]]) })));
    expect(application(special(none, "pc-basic"))).toBe("이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다.");
  });
});
