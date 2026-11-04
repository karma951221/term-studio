/**
 * 보통약관 여러 벌 → 템플릿 하나 + 상품별 조 노출 · 조 사본 (2026-10-28 사용자 결정 — 보통약관 템플릿은 「보통약관(일반)」 하나).
 *
 * 상품마다 원문 보통약관을 따로 변환한 뒤(조 참조 · 함수조항 · 박스가 제 원문으로 풀린다) 마지막에 합친다.
 * - 템플릿 = 바탕 판(알파Plus2607) + 다른 판에만 있는 조(메리츠 계약의 자동갱신 · 갱신계약 해제 — 그 판의 앞 조 뒤에, 감싼 조건 블록째).
 * - 상품군마다 모양이 다른 조(`variants` — 납입면제 세 조, ADR-0086 결정 7)는 두 판의 것을 다 템플릿에 두고 조 노출로 고른다 —
 *   상품군 함수조항이 그 판의 자리(항 · 호)를 가리키므로 사본으로는 못 둔다(함수조항의 보통약관 참조는 템플릿에 있어야 한다).
 * - 같은 조는 조 명으로 맞춘다. 다른 판의 조 id(`m-a26` …)는 바탕 조 id(`g-a25` …)로 바꾼다 — 그 판의 담보약관 · 함수조항 참조도 같은 표로 고친다.
 * - 상품의 차이는 상품이 보통약관에 하는 일로만 남는다(기능/상품 §3.6 · ADR-0079) — 바탕 판에 없는 조는 **조 노출 끔**,
 *   설정이 고른 조(`copies` — 조 명)는 그 판의 글 그대로 **조 사본**. 고르지 않은 조는 템플릿(바탕 판) 글로 찍힌다 — 판 표기 차이(박스 나눔 · 띄어쓰기)는
 *   실물 재현의 알려진 차이로 적는다(`src/db/seed/knownDifferences.ts`).
 * - 사본에서 템플릿 조에 없는 자리(노드 id)는 PZ 코드다(ADR-0081 결정 4) — 그 자리를 가리키는 그 판의 참조 코드도 함께 바꾼다.
 */
import { indexTree, type ArticleNode, type DocumentNode } from "../../src/domain/document/nodes";
import { numberTree } from "../../src/domain/document/numbering";
import { isPCode, nodesOfTarget } from "../../src/domain/document/pcode";
import { foldTitle } from "../../src/domain/document/title";
import type { Code, Id } from "../../src/domain/types";

export interface GeneralSource {
  /** 보통약관 시드 코드 (상품 설정의 `general.code`). */
  code: string;
  tree: DocumentNode;
}

export interface OtherGeneral extends GeneralSource {
  /** 그 판의 글로 상품 조 사본을 만들 조 — 조 명. */
  copies: readonly string[];
  /** 조 이름 별칭 — 그 판 조 명 → 바탕 판 조 명(같은 조를 판이 다른 이름으로 쓴다 — 상해안심2610 「보험금의 청구」). 사본은 그 판 이름 그대로다. */
  aliases?: Readonly<Record<string, string>>;
  /** 앞 판(상품 보통약관 코드)의 변형을 함께 쓴다 — 고른 이름(`titles`)의 조는 바탕 조가 아니라 그 판의 변형 조에 잇는다. */
  variantsFrom?: { from: string; titles: readonly string[] };
  /** 그 판의 조째 템플릿에 함께 둘 조 — 조 명. 바탕 판의 같은 조와 서로 조 노출을 끈다. */
  variants?: readonly string[];
}

export interface MergedProduct {
  /** 그 판의 조 id → 템플릿 조 id (바탕 판은 비어 있다). */
  idMap: Map<Id, Id>;
  /** 템플릿 조 id → (사본에서 PZ 로 바뀐 P 코드 → PZ 코드). */
  codeMap: Map<Id, Map<Code, Code>>;
  /** 조 노출 끔 — 템플릿 조 중 그 판에 없는 것 (문서 순). */
  hidden: Id[];
  /** 조 사본 — 조 id 는 템플릿 조 id. */
  copies: ArticleNode[];
}

/** 조 id 꼴(`<접두>-a<번호>`, 가지번호 `_N`)과 그 아래 노드 id(「-」 · 「.」 뒤)의 앞머리. */
const ARTICLE_ID_HEAD = /^([a-z0-9]+-a\d+(?:_\d+)?)(?=$|[-.])/;

/**
 * 조 id 대응표로 노드 id · 참조 대상을 바꾼 사본. 글(`text`)은 건드리지 않는다.
 * `codes` 가 있으면 바뀐 조를 가리키는 참조(`articleId` + `code`)의 코드도 바꾼다 — 사본에서 PZ 가 된 자리.
 */
export function remapIds<T>(value: T, idMap: ReadonlyMap<Id, Id>, codes: ReadonlyMap<Id, ReadonlyMap<Code, Code>> = new Map()): T {
  const visit = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") {
      if (key === "text") return v;
      const head = ARTICLE_ID_HEAD.exec(v)?.[1];
      const to = head === undefined ? undefined : idMap.get(head);
      return to === undefined ? v : `${to}${v.slice(head!.length)}`;
    }
    if (Array.isArray(v)) return v.map((x) => visit(x));
    if (!v || typeof v !== "object") return v;
    const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visit(x, k)])) as Record<string, unknown>;
    if (typeof out.articleId === "string" && typeof out.code === "string" && out.articleId !== (v as Record<string, unknown>).articleId) {
      const renamed = codes.get(out.articleId)?.get(out.code);
      if (renamed) out.code = renamed;
    }
    return out;
  };
  return visit(value) as T;
}

/** 조를 담는 목록(문서 · 관 · 조건 블록 가지) 전부 — 조를 넣을 자리를 찾을 때. */
function childLists(node: unknown): unknown[][] {
  if (!node || typeof node !== "object") return [];
  const own = directLists(node);
  return [...own, ...own.flatMap((list) => list.flatMap(childLists))];
}

/** 문서 순 조 전부 (관 · 조건 블록 안 포함). */
function articlesOf(tree: DocumentNode): ArticleNode[] {
  const out: ArticleNode[] = [];
  const visit = (list: readonly unknown[]): void => {
    for (const n of list) {
      if ((n as { kind?: string }).kind === "article") out.push(n as ArticleNode);
      else for (const inner of directLists(n)) visit(inner);
    }
  };
  visit(tree.children);
  return out;
}

/** 노드 바로 아래 목록 — 관 · 조건 블록 가지. */
function directLists(node: unknown): unknown[][] {
  const n = node as { kind?: string; children?: unknown; branches?: { children: unknown[] }[] };
  if (n.kind === "article") return [];
  return [...(Array.isArray(n.children) ? [n.children as unknown[]] : []), ...(n.branches ?? []).map((b) => b.children)];
}

/** 넣고 빼는 단위 — 관(또는 문서) 바로 아래 조 · 조를 감싼 조건 블록. 문서 순. */
interface Unit {
  node: { id: Id };
  articles: ArticleNode[];
}

function unitsOf(tree: DocumentNode): Unit[] {
  const out: Unit[] = [];
  const visit = (list: readonly unknown[]): void => {
    for (const n of list) {
      const kind = (n as { kind?: string }).kind;
      if (kind === "section") visit((n as { children: unknown[] }).children);
      else if (kind === "article") out.push({ node: n as ArticleNode, articles: [n as ArticleNode] });
      else {
        const articles = articlesOf({ id: "", kind: "document", title: "", children: [n] } as unknown as DocumentNode);
        if (articles.length > 0) out.push({ node: n as { id: Id }, articles });
      }
    }
  };
  visit(tree.children);
  return out;
}

/** `anchor` 단위 바로 뒤에 `node` 를 넣는다. */
function insertAfter(tree: DocumentNode, anchor: Id, node: unknown): void {
  for (const list of childLists(tree)) {
    const at = list.findIndex((n) => (n as { id?: string }).id === anchor);
    if (at >= 0) {
      list.splice(at + 1, 0, node);
      return;
    }
  }
  throw new Error(`보통약관 합치기: ${anchor} 를 찾을 수 없다`);
}

/** 코드 자리 노드(항 · 호 · 목 · 함수조항 블록) 전부 — id · code 가 있는 객체. */
function codedNodes(value: unknown): { id: Id; code: Code }[] {
  const out: { id: Id; code: Code }[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.code === "string") out.push(o as { id: Id; code: Code });
    Object.values(o).forEach(visit);
  };
  visit(value);
  return out;
}

/**
 * 조 안의 조 참조가 찍는 대상 — 조 명 + 번호(제N항 · 제N호 …), 문서 순. 코드가 아니라 번호로 본다 — 판마다 박스 수가 달라 P코드가 밀려도
 * 같은 항을 가리키면 찍히는 글이 같다. 번호는 그 판 트리(`tree`)에서 매긴다.
 */
function refLabels(article: ArticleNode, tree: DocumentNode): string[] {
  const ix = indexTree(tree);
  const numbers = numberTree(tree);
  const label = (t: { articleId: Id; code?: Code }): string => {
    const target = ix.nodes.get(t.articleId)?.node;
    const title = target?.kind === "article" ? foldTitle(target.title) : t.articleId;
    if (t.code === undefined) return title;
    const chain: string[] = [];
    for (let id: Id | undefined = nodesOfTarget(ix, t)[0]; id !== undefined && id !== t.articleId; id = ix.nodes.get(id)?.parentId) {
      const n = numbers.get(id);
      if (n) chain.unshift(`${n.kind}${n.n}`);
    }
    return `${title}#${chain.join(".") || t.code}`;
  };
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o.kind === "articleRef" && Array.isArray(o.targets)) for (const t of o.targets as { articleId: Id; code?: Code }[]) out.push(label(t));
    Object.values(o).forEach(visit);
  };
  visit(article.children);
  return out;
}

function nodeIds(value: unknown): Set<Id> {
  const out = new Set<Id>();
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.id === "string") out.add(o.id);
    Object.values(o).forEach(visit);
  };
  visit(value);
  return out;
}

/**
 * 보통약관 여러 벌을 템플릿 하나로 — 바탕 판 + 다른 판에만 있는 조. 상품(보통약관 시드 코드)마다 조 노출 끔 · 조 사본 · 참조를 고칠 대응표.
 */
export function mergeGenerals(
  base: GeneralSource,
  others: readonly OtherGeneral[],
  target: { id: Id; title: string },
): { tree: DocumentNode; products: Map<string, MergedProduct>; refMismatches: { general: string; article: string }[] } {
  const tree: DocumentNode = { ...structuredClone(base.tree), id: target.id, title: target.title };
  const baseByTitle = new Map(articlesOf(base.tree).map((a) => [foldTitle(a.title), a] as const));
  const products = new Map<string, MergedProduct>([[base.code, { idMap: new Map(), codeMap: new Map(), hidden: [], copies: [] }]]);
  /** 상품마다 템플릿에서 제 것인 조 id. */
  const owned = new Map<string, Set<Id>>([[base.code, new Set(articlesOf(base.tree).map((a) => a.id))]]);
  /** 사본으로 고르지 않았는데 템플릿 조와 다른 대상을 가리키는 그 판의 조 — 글이 같아도 그 판의 조립이 달라진다(사본으로 골라야 한다). */
  const refMismatches: { general: string; article: string }[] = [];
  /** 앞 판이 넣은(바탕 판에 없는) 조 — 뒤 판의 같은 조는 이것에 잇는다(변형은 빼고). */
  const addedByTitle = new Map<string, ArticleNode>();
  /** 판마다 넣은 변형 조 — 뒤 판이 `variantsFrom` 으로 함께 쓴다. */
  const variantsOf = new Map<string, Map<string, ArticleNode>>();

  for (const o of others) {
    const own = articlesOf(o.tree);
    const variants = new Set(o.variants ?? []);
    const idMap = new Map<Id, Id>();
    for (const a of own) {
      const t = o.aliases?.[foldTitle(a.title)] ?? foldTitle(a.title);
      const shared = o.variantsFrom?.titles.includes(t) ? variantsOf.get(o.variantsFrom.from)?.get(t) : undefined;
      const b = variants.has(foldTitle(a.title)) ? undefined : (shared ?? baseByTitle.get(t) ?? addedByTitle.get(t));
      if (b) idMap.set(a.id, b.id);
    }
    // 사본 — 템플릿 조에 없는 자리의 P 코드는 PZ 로 (그 자리를 가리키는 참조도 같은 표로 고친다)
    const picked = o.copies.map((title) => {
      const a = own.find((x) => foldTitle(x.title) === title);
      const b = baseByTitle.get(o.aliases?.[title] ?? title);
      if (!a || !b) throw new Error(`보통약관 합치기: ${o.code} 의 사본 조 「${title}」 이(가) ${a ? "바탕 판" : "그 판"}에 없다`);
      return { a, b };
    });
    const codeMap = new Map<Id, Map<Code, Code>>();
    for (const { a, b } of picked) {
      const templateIds = nodeIds(b);
      const fresh = codedNodes(remapIds(a, idMap)).filter((n) => !templateIds.has(n.id) && isPCode(n.code));
      if (fresh.length > 0) codeMap.set(b.id, new Map(fresh.map((n) => [n.code, `PZ${n.code.slice(1)}`])));
    }
    const copies = picked.map(({ a, b }) => {
      const copy = remapIds(a, idMap, codeMap);
      const templateIds = nodeIds(b);
      for (const n of codedNodes(copy)) if (!templateIds.has(n.id)) n.code = codeMap.get(b.id)?.get(n.code) ?? n.code;
      return copy;
    });
    // 그 판에만 있는 조 · 변형을 감싼 조건 블록째 넣는다 — 변형은 바탕의 같은 조(의 단위) 바로 뒤(바탕 판의 조 번호가 변형 때문에 밀리지 않는다),
    // 그 판에만 있는 조는 그 판의 앞 단위(템플릿에 있는 조의 단위) 뒤. 같은 자리 뒤에 여럿이면 원문 순서대로
    const unitOfArticle = new Map(unitsOf(tree).flatMap((u) => u.articles.map((a) => [a.id, u.node.id] as const)));
    const lastAfter = new Map<Id, Id>();
    const inserted: Id[] = [];
    const units = unitsOf(o.tree);
    const isVariant = (u: Unit) => u.articles.every((a) => variants.has(foldTitle(a.title)));
    /** 잇닿은 변형 묶음의 마지막 단위 — 묶음째 그 바탕 조 뒤에 둔다(바탕 조 사이에 엇갈려 끼지 않게). */
    const runEnd = (i: number): Unit => (i + 1 < units.length && isVariant(units[i + 1]) ? runEnd(i + 1) : units[i]);
    let anchor: Id | undefined;
    for (const [i, u] of units.entries()) {
      const mapped = u.articles.filter((a) => idMap.has(a.id));
      if (mapped.length === u.articles.length) {
        anchor = unitOfArticle.get(idMap.get(mapped.at(-1)!.id)!);
        continue;
      }
      if (mapped.length > 0) throw new Error(`보통약관 합치기: ${o.code} 의 조건 블록 ${u.node.id} 에 바탕 판에 있는 조와 없는 조가 섞였다`);
      const counterpart = isVariant(u) ? baseByTitle.get(foldTitle(runEnd(i).articles.at(-1)!.title)) : undefined;
      const at = counterpart ? unitOfArticle.get(counterpart.id) : anchor;
      if (!at) throw new Error(`보통약관 합치기: ${o.code} 의 첫 조 「${foldTitle(u.articles[0].title)}」 이(가) 바탕 판에 없다`);
      insertAfter(tree, lastAfter.get(at) ?? at, remapIds(u.node, idMap, codeMap));
      lastAfter.set(at, u.node.id);
      inserted.push(...u.articles.map((a) => a.id));
    }
    const copied = new Set(o.copies);
    for (const a of own) {
      const title = foldTitle(a.title);
      const candidate = baseByTitle.get(o.aliases?.[title] ?? title);
      // 바탕 조에 이은 조만 견준다(앞 판 변형 · 앞 판이 넣은 조에 이은 조는 바탕 조와 다른 조다)
      const b = idMap.get(a.id) === candidate?.id && !copied.has(title) ? candidate : undefined;
      if (b && refLabels(a, o.tree).join("|") !== refLabels(b, base.tree).join("|")) refMismatches.push({ general: o.code, article: title });
    }
    const mine = new Map<string, ArticleNode>();
    for (const u of units) if (isVariant(u)) for (const a of u.articles) if (inserted.includes(a.id)) mine.set(foldTitle(a.title), remapIds(a, idMap, codeMap));
    variantsOf.set(o.code, mine);
    for (const u of units) {
      if (isVariant(u)) continue;
      for (const a of u.articles) if (inserted.includes(a.id) && !addedByTitle.has(foldTitle(a.title))) addedByTitle.set(foldTitle(a.title), remapIds(a, idMap, codeMap));
    }
    products.set(o.code, { idMap, codeMap, hidden: [], copies });
    owned.set(o.code, new Set([...idMap.values(), ...inserted]));
  }

  const all = articlesOf(tree).map((a) => a.id);
  for (const [code, p] of products) p.hidden = all.filter((id) => !owned.get(code)!.has(id));
  return { tree, products, refMismatches };
}

/** 상품의 보통약관 설정 — 시드 상품(`products.json` · `samples.json`)의 모양. */
export interface ProductGeneralSetting {
  hiddenArticles?: readonly Id[];
  copies?: readonly { article: Id; replace?: ArticleNode }[];
}

/** 상품이 보는 보통약관 — 템플릿에 조 사본(통째 `replace`)을 갈아 끼우고 노출 끈 조를 뺀 트리 (변환 결과를 읽는 테스트 · 점검용). */
export function productGeneral(template: DocumentNode, setting: ProductGeneralSetting): DocumentNode {
  const hidden = new Set(setting.hiddenArticles ?? []);
  const replaced = new Map((setting.copies ?? []).flatMap((c) => (c.replace ? [[c.article, c.replace] as const] : [])));
  const visit = (list: readonly unknown[]): unknown[] =>
    list.flatMap((n) => {
      const node = n as { id?: Id; kind?: string; children?: unknown[]; branches?: { children: unknown[] }[] };
      if (node.kind === "article") return hidden.has(node.id!) ? [] : [replaced.get(node.id!) ?? node];
      return [{ ...node, ...(Array.isArray(node.children) ? { children: visit(node.children) } : {}), ...(node.branches ? { branches: node.branches.map((b) => ({ ...b, children: visit(b.children) })) } : {}) }];
    });
  return { ...template, children: visit(template.children) as DocumentNode["children"] };
}
