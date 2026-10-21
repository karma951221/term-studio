/**
 * 생략 자리 (기능/조립산출 §3.7) — 특약 · 블록 본문의 원래 조 자리에 끼울 번호 없는 회색 한 줄의 재료.
 * 책자(산출본)는 바꾸지 않는다 — 화면이 생략 판정 기록(`omitted` 의 생략) · 제1절 판정 기록(블록 조 생략 · 분리로 결과에 없는 조)과
 * 담보약관 모델의 조 순서로 자리를 정한다. 자리 = 모델 순서상 앞에 있는 결과 조 바로 뒤(없으면 문서 맨 앞).
 */
import type { Booklet, RenderedArticle, RenderedDoc } from "@/domain/assembly";
import type { ArticleNode, BlockNode, DocumentNode } from "@/domain/document";
import { foldTitle } from "@/domain/document/title";
import type { Id } from "@/domain/types";

export interface OmissionSlot {
  productCoverageId: Id;
  /** 생략된 담보약관 조 id — 누르면 그 조의 출처 패널. */
  articleId: Id;
  title: string;
  /** 바로 앞 결과 조 id — 없으면 문서 맨 앞. */
  afterId?: Id;
  /** 「보통약관 제12조와 같음」 · 절 형태 「제1절 제7조와 같음」. */
  note: string;
}

function modelOrder(nodes: readonly unknown[], out: ArticleNode[] = []): ArticleNode[] {
  for (const n of nodes as BlockNode[]) {
    if (n.kind === "article") out.push(n);
    else if (n.kind === "section") modelOrder(n.children, out);
    else if (n.kind === "condBlock") for (const b of n.branches) modelOrder(b.children, out);
  }
  return out;
}

function renderedIds(doc: RenderedDoc): Set<Id> {
  const ids = new Set<Id>();
  for (const c of doc.children) {
    if (c.kind === "article") ids.add(c.id);
    else if (c.kind === "section") for (const a of c.children) if (a.kind === "article") ids.add(a.id);
  }
  return ids;
}

function generalArticle(booklet: Pick<Booklet, "general">, id: Id): RenderedArticle | undefined {
  for (const c of booklet.general?.children ?? []) {
    if (c.kind === "article" && c.id === id) return c;
    if (c.kind === "section") for (const a of c.children) if (a.kind === "article" && a.id === id) return a;
  }
  return undefined;
}

/** 상품담보 id → 끼울 자리(모델 순). `docsByCoverage` 는 담보 id → 담보약관 모델, `coverageOf` 는 상품담보 id → 담보 id. */
export function omissionSlots(
  booklet: Pick<Booklet, "form" | "general" | "specials" | "blocks" | "omitted" | "firstSection">,
  docsByCoverage: ReadonlyMap<Id, DocumentNode>,
  coverageOf: ReadonlyMap<Id, Id>,
): Map<Id, OmissionSlot[]> {
  const sectioned = booklet.form === "sectioned";
  const head = sectioned ? "제1절" : "보통약관";
  const docs = new Map<Id, RenderedDoc>();
  for (const g of [...(booklet.blocks ?? []), ...booklet.specials]) for (const d of g.docs) if (d.document === "special" && !docs.has(d.ownerId)) docs.set(d.ownerId, d);

  // 상품담보 → (조 id → 제목 · 연결한 보통약관 조)
  const wanted = new Map<Id, Map<Id, { title?: string; linked: Id }>>();
  const want = (pc: Id, article: Id, linked: Id, title?: string) => {
    const m = wanted.get(pc) ?? new Map();
    if (!m.has(article)) m.set(article, { ...(title !== undefined ? { title } : {}), linked });
    wanted.set(pc, m);
  };
  for (const o of booklet.omitted ?? []) if (o.disposition === "omitted") want(o.productCoverageId, o.articleId, o.linkedArticleId, o.articleTitle);
  for (const fs of booklet.firstSection ?? []) {
    for (const b of fs.blocks) {
      if (b.treatment !== "omitted" && b.treatment !== "split") continue;
      const model = docsByCoverage.get(coverageOf.get(b.productCoverageId) ?? "");
      const a = model ? modelOrder(model.children).find((x) => x.linkedArticleId === fs.articleId) : undefined;
      if (a) want(b.productCoverageId, a.id, fs.articleId);
    }
  }

  const out = new Map<Id, OmissionSlot[]>();
  for (const [pc, articles] of wanted) {
    const rendered = docs.get(pc);
    const model = docsByCoverage.get(coverageOf.get(pc) ?? "");
    if (!rendered || !model) continue;
    const shown = renderedIds(rendered);
    const order = modelOrder(model.children);
    const slots: OmissionSlot[] = [];
    let after: Id | undefined;
    for (const a of order) {
      if (shown.has(a.id)) {
        after = a.id;
        continue;
      }
      const w = articles.get(a.id);
      if (!w) continue;
      const g = generalArticle(booklet, w.linked);
      slots.push({ productCoverageId: pc, articleId: a.id, title: w.title ?? foldTitle(a.title), ...(after !== undefined ? { afterId: after } : {}), note: `${head} ${g ? g.label : "조"}와 같음` });
    }
    if (slots.length > 0) out.set(pc, slots);
  }
  return out;
}
