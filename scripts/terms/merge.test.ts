import { describe, expect, it } from "vitest";

import type { ArticleNode, DocumentNode, ParagraphNode, SectionNode } from "../../src/domain/document/nodes";
import { titleNodes } from "../../src/domain/document/title";

import { mergeGenerals, productGeneral, remapIds } from "./merge";

const paragraph = (id: string, text: string, code: string): ParagraphNode => ({ id, kind: "paragraph", code, children: [{ id: `${id}-x1`, kind: "text", text }] });
const article = (id: string, title: string, ...children: ParagraphNode[]): ArticleNode => ({ id, kind: "article", title: titleNodes(title, id), children });
const section = (id: string, title: string, ...children: ArticleNode[]): SectionNode => ({ id, kind: "section", title, children }) as SectionNode;
const doc = (id: string, title: string, ...children: SectionNode[]): DocumentNode => ({ id, kind: "document", title, children });

/** 바탕(2607 꼴) — 목적 · 용어의 정의 · 계약의 소멸. */
const base = () =>
  doc(
    "g",
    "알파 보통약관",
    section("g-s1", "총칙", article("g-a1", "목적", paragraph("g-a1-p1", "목적 글", "P0100")), article("g-a2", "용어의 정의", paragraph("g-a2-p1", "알파 정의", "P0100"))),
    section("g-s2", "소멸", article("g-a3", "계약의 소멸", paragraph("g-a3-p1", "알파 소멸", "P0100"))),
  );

/** 다른 상품(메리츠 꼴) — 조 id 체계가 다르고(m-), 자기만의 조(계약의 자동갱신)가 있고, 정의 · 소멸의 글이 다르다. */
const other = () =>
  doc(
    "m",
    "메리츠 보통약관",
    section(
      "m-s1",
      "총칙",
      article("m-a1", "목적", paragraph("m-a1-p1", "목적 글", "P0100")),
      article("m-a2", "용어의 정의", paragraph("m-a2-p1", "메리츠 정의", "P0100"), paragraph("m-a2-p2", "메리츠 정의 둘째", "P0200")),
      article("m-a3", "계약의 자동갱신", { ...paragraph("m-a3-p1", "갱신 글", "P0100"), children: [{ id: "m-a3-p1-x1", kind: "articleRef", targets: [{ articleId: "m-a2", code: "P0200" }], connector: "및", scope: "self" }] }),
    ),
    section("m-s2", "소멸", article("m-a4", "계약의 소멸", paragraph("m-a4-p1", "메리츠 소멸", "P0100"))),
  );

describe("remapIds — 다른 판의 조 id 를 바탕 조 id 로", () => {
  const map = new Map([["m-a2", "g-a2"]]);

  it("조 id 와 그 아래 노드 id(「-」 · 「.」 뒤)를 바꾼다", () => {
    expect(remapIds({ id: "m-a2-p1-x1", title: { id: "m-a2.title" }, articleId: "m-a2" }, map)).toEqual({ id: "g-a2-p1-x1", title: { id: "g-a2.title" }, articleId: "g-a2" });
  });

  it("번호가 이어지는 다른 조(m-a25)와 글은 그대로 둔다", () => {
    expect(remapIds({ articleId: "m-a25", text: "m-a2 를 본다" }, map)).toEqual({ articleId: "m-a25", text: "m-a2 를 본다" });
  });

  it("사본에서 PZ 로 바뀐 자리를 가리키는 참조는 코드도 바꾼다", () => {
    const codes = new Map([["g-a2", new Map([["P0200", "PZ0200"]])]]);
    expect(remapIds({ targets: [{ articleId: "m-a2", code: "P0200" }, { articleId: "m-a2", code: "P0100" }] }, map, codes)).toEqual({
      targets: [
        { articleId: "g-a2", code: "PZ0200" },
        { articleId: "g-a2", code: "P0100" },
      ],
    });
  });
});

describe("mergeGenerals — 보통약관 여러 벌을 템플릿 하나 + 상품별 조 노출 · 조 사본으로", () => {
  const merged = () => mergeGenerals({ code: "base", tree: base() }, [{ code: "other", tree: other(), copies: ["용어의 정의", "계약의 소멸"] }], { id: "general", title: "보통약관(일반)" });

  it("템플릿은 바탕 판에 다른 판에만 있는 조를 그 판의 앞 조 뒤에 넣은 것이다 — 이름은 새 이름", () => {
    const { tree } = merged();
    expect(tree.title).toBe("보통약관(일반)");
    expect(tree.id).toBe("general");
    const s1 = tree.children[0] as SectionNode;
    expect(s1.children.map((a) => a.id)).toEqual(["g-a1", "g-a2", "m-a3"]);
    // 넣은 조 안의 참조도 바탕 조 id 로 — 정의 둘째 항은 사본에만 있어 PZ 가 된다
    expect(JSON.stringify(s1.children[2])).toContain('"articleId":"g-a2","code":"PZ0200"');
  });

  it("다른 판에만 있는 조를 뒤 판도 가지면 앞 판이 넣은 조에 잇는다 — 템플릿에 한 번만 (상해안심2610 계약의 자동갱신 ↔ 메리츠)", () => {
    const third = doc("sa", "상해안심 보통약관", section("sa-s1", "총칙", article("sa-a1", "목적", paragraph("sa-a1-p1", "목적 글", "P0100")), article("sa-a7", "계약의 자동갱신", paragraph("sa-a7-p1", "갱신 글", "P0100"))));
    const { tree, products } = mergeGenerals({ code: "base", tree: base() }, [{ code: "other", tree: other(), copies: [] }, { code: "third", tree: third, copies: [] }], { id: "general", title: "보통약관(일반)" });
    expect((tree.children[0] as SectionNode).children.map((a) => a.id)).toEqual(["g-a1", "g-a2", "m-a3"]);
    expect(products.get("third")!.idMap.get("sa-a7")).toBe("m-a3");
    expect(products.get("third")!.hidden).not.toContain("m-a3");
  });

  it("조 이름 별칭 — 그 판이 다른 이름으로 쓴 바탕 조(「보험금의 청구」 ↔ 「보험금 등의 청구」)에 잇고, 사본은 그 판 이름 그대로", () => {
    const third = doc("sa", "상해안심 보통약관", section("sa-s1", "총칙", article("sa-a1", "목적", paragraph("sa-a1-p1", "목적 글", "P0100")), article("sa-a2", "정의", paragraph("sa-a2-p1", "상해안심 정의", "P0100"))));
    const { tree, products } = mergeGenerals({ code: "base", tree: base() }, [{ code: "third", tree: third, copies: ["정의"], aliases: { 정의: "용어의 정의" } }], { id: "general", title: "보통약관(일반)" });
    expect((tree.children[0] as SectionNode).children.map((a) => a.id)).toEqual(["g-a1", "g-a2"]);
    expect(products.get("third")!.idMap.get("sa-a2")).toBe("g-a2");
    expect(products.get("third")!.copies.map((a) => [a.id, JSON.stringify(a.title)])).toEqual([["g-a2", expect.stringContaining("정의")]]);
    expect(JSON.stringify(products.get("third")!.copies[0].title)).not.toContain("용어의");
  });

  it("다른 판에 없는 바탕 조 · 다른 판에만 있는 조는 그 상품에서 조 노출을 끈다", () => {
    const { products } = merged();
    expect(products.get("base")!.hidden).toEqual(["m-a3"]);
    expect(products.get("other")!.hidden).toEqual([]);
  });

  it("사본으로 고른 조만 그 판의 글로 상품 조 사본이 된다 — 조 id 는 바탕 조, 템플릿에 없는 자리는 PZ", () => {
    const { products } = merged();
    const copies = products.get("other")!.copies;
    expect(copies.map((c) => c.id)).toEqual(["g-a2", "g-a3"]);
    expect(copies[0].children.map((p) => [p.id, (p as ParagraphNode).code])).toEqual([
      ["g-a2-p1", "P0100"],
      ["g-a2-p2", "PZ0200"],
    ]);
    expect(JSON.stringify(copies[1])).toContain("메리츠 소멸");
    expect(products.get("base")!.copies).toEqual([]);
  });

  it("상품마다 조 id 대응표와 PZ 코드 대응표를 돌려준다 — 그 판의 담보약관 · 함수조항 참조를 고칠 때 쓴다", () => {
    const { products } = merged();
    const p = products.get("other")!;
    expect(p.idMap.get("m-a4")).toBe("g-a3");
    expect(p.idMap.has("m-a3")).toBe(false);
    expect(p.codeMap.get("g-a2")?.get("P0200")).toBe("PZ0200");
  });

  it("변형으로 고른 조는 사본이 아니라 그 판의 조째(감싼 조건 블록째) 템플릿에 들어간다 — 서로 상대 판의 같은 조는 조 노출을 끈다", () => {
    const waiver = (prefix: string, text: string) => ({
      id: `${prefix}-w`,
      kind: "condBlock",
      branches: [{ id: `${prefix}-w-b1`, when: "D0008", children: [article(`${prefix}-a9`, "보험료의 납입면제", paragraph(`${prefix}-a9-p1`, text, "P0100"))] }],
    });
    const withWaiver = (tree: DocumentNode, prefix: string, text: string): DocumentNode => {
      const s1 = tree.children[0] as SectionNode;
      return { ...tree, children: [{ ...s1, children: [...s1.children, waiver(prefix, text)] } as unknown as SectionNode, ...tree.children.slice(1)] };
    };
    const { tree, products } = mergeGenerals({ code: "base", tree: withWaiver(base(), "g", "알파 면제") }, [{ code: "other", tree: withWaiver(other(), "m", "메리츠 면제"), copies: [], variants: ["보험료의 납입면제"] }], {
      id: "general",
      title: "보통약관(일반)",
    });
    const s1 = tree.children[0] as SectionNode;
    // 변형은 바탕의 같은 조(감싼 단위) 바로 뒤 — 바탕 판의 조 번호가 변형 때문에 밀리지 않는다. 그 판에만 있는 조는 그 판의 앞 조 뒤
    expect(s1.children.map((n) => n.id)).toEqual(["g-a1", "g-a2", "m-a3", "g-w", "m-w"]);
    expect(products.get("base")!.hidden).toEqual(["m-a3", "m-a9"]);
    expect(products.get("other")!.hidden).toEqual(["g-a9"]);
    expect(products.get("other")!.idMap.has("m-a9")).toBe(false);
  });

  it("앞 판의 변형을 함께 쓴다(variantsFrom) — 같은 이름의 조를 바탕 조가 아니라 그 판이 넣은 변형 조에 잇는다(The좋은 알파 ↔ 통합간편 일반상해사망 지급사유)", () => {
    const flat = (prefix: string, titles: string[]) => doc(prefix, "보통약관", section(`${prefix}-s1`, "관", ...titles.map((t, i) => article(`${prefix}-a${i + 1}`, t, paragraph(`${prefix}-a${i + 1}-p1`, `${prefix} ${t}`, "P0100")))));
    const titles = ["목적", "보험금의 지급사유", "약관의 해석"];
    const { products } = mergeGenerals(
      { code: "base", tree: flat("g", titles) },
      [
        { code: "other", tree: flat("m", titles), copies: [], variants: ["보험금의 지급사유"] },
        { code: "third", tree: flat("ga", titles), copies: [], variantsFrom: { from: "other", titles: ["보험금의 지급사유"] } },
      ],
      { id: "general", title: "보통약관(일반)" },
    );
    expect(products.get("third")!.idMap.get("ga-a2")).toBe("m-a2");
    expect(products.get("third")!.idMap.get("ga-a1")).toBe("g-a1");
    expect(products.get("third")!.hidden).toEqual(["g-a2"]);
  });

  it("잇닿은 변형 여럿은 묶음째 — 묶음 마지막 조의 바탕 조 뒤에 원문 순서대로 (바탕 조 사이에 엇갈려 끼지 않는다)", () => {
    const flat = (prefix: string, titles: string[]) => doc(prefix, "보통약관", section(`${prefix}-s1`, "관", ...titles.map((t, i) => article(`${prefix}-a${i + 1}`, t, paragraph(`${prefix}-a${i + 1}-p1`, `${prefix} ${t}`, "P0100")))));
    const titles = ["목적", "보험금의 지급사유", "보험금 지급에 관한 세부규정", "약관의 해석"];
    const { tree, products } = mergeGenerals({ code: "base", tree: flat("g", titles) }, [{ code: "other", tree: flat("m", titles), copies: [], variants: ["보험금의 지급사유", "보험금 지급에 관한 세부규정"] }], { id: "general", title: "보통약관(일반)" });
    expect((tree.children[0] as SectionNode).children.map((a) => a.id)).toEqual(["g-a1", "g-a2", "g-a3", "m-a2", "m-a3", "g-a4"]);
    expect(products.get("other")!.hidden).toEqual(["g-a2", "g-a3"]);
  });

  it("사본으로 고르지 않은 조가 템플릿과 다른 대상을 가리키면 알린다 — 글이 같아도 그 판의 조립이 달라진다", () => {
    const pointing = (prefix: string, code: string) => ({ ...paragraph(`${prefix}-a1-p1`, "목적 글", "P0100"), children: [{ id: `${prefix}-a1-p1-x1`, kind: "articleRef", targets: [{ articleId: `${prefix}-a2`, code }], connector: "및", scope: "self" }] });
    const b = base();
    ((b.children[0] as SectionNode).children[0] as ArticleNode).children = [pointing("g", "P0100") as ParagraphNode];
    const o = other();
    ((o.children[0] as SectionNode).children[0] as ArticleNode).children = [pointing("m", "P0200") as ParagraphNode];
    const { refMismatches } = mergeGenerals({ code: "base", tree: b }, [{ code: "other", tree: o, copies: ["용어의 정의"] }], { id: "general", title: "보통약관(일반)" });
    expect(refMismatches).toEqual([{ general: "other", article: "목적" }]);
    // 판마다 P코드가 밀렸을 뿐 같은 번호(제1항)를 가리키면 알리지 않는다 — 찍히는 글이 같다
    const shifted = other();
    const def = (shifted.children[0] as SectionNode).children[1] as ArticleNode;
    def.children = [paragraph("m-a2-p1", "메리츠 정의", "P0300")];
    ((shifted.children[0] as SectionNode).children[0] as ArticleNode).children = [pointing("m", "P0300") as ParagraphNode];
    expect(mergeGenerals({ code: "base", tree: b }, [{ code: "other", tree: shifted, copies: [] }], { id: "general", title: "보통약관(일반)" }).refMismatches).toEqual([]);
    // 사본으로 고르면 알리지 않는다
    expect(mergeGenerals({ code: "base", tree: b }, [{ code: "other", tree: o, copies: ["용어의 정의", "목적"] }], { id: "general", title: "보통약관(일반)" }).refMismatches).toEqual([]);
  });

  it("사본으로 고른 조가 그 판에 없으면 멈춘다", () => {
    expect(() => mergeGenerals({ code: "base", tree: base() }, [{ code: "other", tree: other(), copies: ["없는 조"] }], { id: "general", title: "보통약관(일반)" })).toThrow(/없는 조/);
  });
});

describe("productGeneral — 상품이 보는 보통약관 (템플릿 + 조 사본 − 노출 끈 조)", () => {
  it("사본은 갈아 끼우고 끈 조는 뺀다 — 관 · 조건 블록 안도", () => {
    const { tree, products } = mergeGenerals({ code: "base", tree: base() }, [{ code: "other", tree: other(), copies: ["계약의 소멸"] }], { id: "general", title: "보통약관(일반)" });
    const seen = (code: string) => {
      const p = products.get(code)!;
      return productGeneral(tree, { hiddenArticles: p.hidden, copies: p.copies.map((a) => ({ article: a.id, replace: a })) });
    };
    const ids = (d: DocumentNode) => d.children.flatMap((s) => (s as SectionNode).children.map((a) => a.id));
    expect(ids(seen("base"))).toEqual(["g-a1", "g-a2", "g-a3"]);
    expect(ids(seen("other"))).toEqual(["g-a1", "g-a2", "m-a3", "g-a3"]);
    expect(JSON.stringify(seen("other"))).toContain("메리츠 소멸");
    expect(JSON.stringify(seen("base"))).not.toContain("메리츠 소멸");
  });
});
