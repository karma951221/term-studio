/**
 * 출처 패널의 재료 (ADR-0092 결정 1 · 2 · 기능/조립산출 §3.7) — 설명 결과(`explainArticle`)에 패널이 그릴 것을 붙인다.
 *
 * - 모델링 원본 조(원본마다 — 템플릿 조 · 상품 조 사본 · 담보약관 조)와 그 문서 제목 · 조 서수, 대치 · 위임이면 「템플릿 조 자리 ←」 한 줄.
 * - 결과 자리 문구(「제2절 1. › 제3조(…)」)와 결과 조의 글 조각(노드 id → 글) — 값 자리에 들어간 값을 원본의 같은 슬롯 자리에 덧칠한다.
 *   슬롯 · 반복 복제본 · 펼친 함수조항 안의 노드는 결과에서도 같은 id(`@원소` 접미사 · `참조id/안쪽id`)를 쓴다(§3.4).
 * - 이름표 — 쓰인 함수조항 정의(모델 트리), 구분자 표시명 · 열거형, 담보속성 값 이름.
 *
 * 글 조각은 **보여 주는 그 결과**(저장본이면 저장본 책자, 실시간이면 그 계산)에서 꺼낸다 — 설명이 같은 입력이라는 것은 부르는 쪽이 보장한다
 * (오래된 결과면 패널을 열지 않는다, ADR-0092 결정 5). 이동 주소(URL)는 화면이 짓는다 — 여기는 재료만.
 *
 * DB · React import 금지 (순수층).
 */
import type { Clause } from "../clause/types";
import { keyPathOf, nodeKeyLabel } from "../coverage/keys";
import { clauseBodyToTree } from "../document/clauseTree";
import type { ArticleNode, BlockNode, DocumentNode } from "../document/nodes";
import { foldTitle } from "../document/title";
import { VERDICT_WORD, verdictText } from "../product/judgment";
import type { ProductCoverageSnapshot } from "../product/types";
import type { Code, Id } from "../types";
import type { ArticleExplanation, ArticleSource, ExplainTarget } from "./explain";
import type { Booklet, ErrorNode, MasterBundle, ProductInput, RenderedArticle, RenderedDoc, RenderedInline, RenderedStatic } from "./types";

/** 원본 하나의 그릴 재료 — `explanation.sources` 와 같은 순. */
export interface SourceViewSource {
  /** 모델링 원본 조 — 사본이면 사본 조. 찾지 못하면 없다. */
  article?: ArticleNode;
  /** 원본 문서 레코드 id — 문면 편집기 주소(`/documents/<id>`). 모르면 없다. */
  documentRecordId?: Id;
  /** 원본 문서 제목 — 템플릿 · 담보약관 문서. */
  documentTitle: string;
  /** 원본 종류 표기 — 템플릿 · 사본 · 담보약관. */
  kindLabel: "템플릿" | "사본" | "담보약관";
  /** 원본 문서 안 조 서수(1부터 — 모델의 조 순서). */
  ordinal?: number;
  /** 블록 탭 이름 — 상품담보명(없으면 문서 제목). */
  tabLabel: string;
  /** 담보약관 글이 템플릿 조 자리를 채웠다 — 「보통약관 제3조 자리 ← 기본계약 「상해사망」 담보약관 제1조 (조연결)」. */
  fillLine?: string;
  /** 노드 키 경로 → 머리 표기(「세부보장 01 · 이름 › 급부 1 · 이름」) — 노드 한정 구분자(`D0001@01`)의 조건식 표기. 담보약관 원본만. */
  nodeLabels?: Record<string, string>;
}

export interface SourceViewClause {
  label: string;
  /** 함수조항 본문의 모델 트리 — 문면 노드 모양(`clauseBodyToTree`), 조 하나(`clause-article`) 아래. */
  tree: DocumentNode;
  params: string[];
  /** 열거 인자 이름 → 열거형 코드 — 본문 식이 견주는 값 코드를 값 이름으로 찍는다(조건식 표기). 열거 인자가 없으면 없다. */
  paramEnums?: Record<string, Code>;
}

/** 출처 패널 한 장의 재료 — 서버가 만들어 화면(클라이언트)으로 그대로 넘긴다(순수 데이터). */
export interface SourceView {
  productId: Id;
  productName: string;
  explanation: ArticleExplanation;
  /** 결과 자리 — 「보통약관 › 제2조(…)」 · 「제2절 1. › 제3조(…)」 · 「일반상해사망 특별약관 › 제4조(…)」. 결과에 없으면 원본 조 명. */
  place: string;
  sources: SourceViewSource[];
  /** 결과 조의 글 조각 — 노드 id → 글 (값 자리의 값). */
  values: Record<Id, string>;
  clauses: Record<Code, SourceViewClause>;
  discriminators: Record<Code, { label: string; enumCode?: Code }>;
  /** `fields` = 열거형 필드 키 → 이름(필드 읽기 `arg.사유.F01` 표기). 필드가 없으면 없다. */
  enums: Record<Code, { label: string; values: Record<Code, string>; fields?: Record<Code, string> }>;
  attributes: Record<Code, { label: string; values: Record<Code, string> }>;
  /** 생략 · 준용 · 제1절 판정의 상대 — 연결한 보통약관(제1절) 조의 결과 표시(「제12조(보험금의 청구)」). */
  linkedLabel?: string;
  /** 제1절 판정 배지 표기(「공통 3/3」 · 「위임 2/2」). 판정 기록이 없거나 마스터면 없다. */
  verdict?: string;
  /** 읽은 값 소유자(스냅샷 노드 id) → 상품담보 id — 「값」 바로가기의 목적지. */
  readOwners: Record<Id, Id>;
}

// ───────────────────────────── 결과 자리 ─────────────────────────────

function articlesOf(doc: RenderedDoc | undefined): RenderedArticle[] {
  const out: RenderedArticle[] = [];
  for (const c of doc?.children ?? []) {
    if (c.kind === "article") out.push(c);
    else if (c.kind === "section") for (const a of c.children) if (a.kind === "article") out.push(a);
  }
  return out;
}

const articleLabel = (a: RenderedArticle) => `${a.label}(${a.title})`;

/** 그 조가 결과에서 서는 자리 · 결과 조. 결과에 없으면 `article` 이 없고 자리는 문서까지만. */
export function locateRendered(booklet: Pick<Booklet, "general" | "specials" | "blocks" | "form">, target: ExplainTarget): { place: string; article?: RenderedArticle; doc?: RenderedDoc } {
  const sectioned = booklet.form === "sectioned";
  if (target.document === "general") {
    const article = articlesOf(booklet.general).find((a) => a.id === target.articleId);
    const head = sectioned ? "제1절" : "보통약관";
    return { place: article ? `${head} › ${articleLabel(article)}` : head, ...(article ? { article } : {}), ...(booklet.general ? { doc: booklet.general } : {}) };
  }
  for (const g of booklet.blocks ?? []) {
    for (const d of g.docs) {
      if (d.ownerId !== target.productCoverageId) continue;
      const article = articlesOf(d).find((a) => a.id === target.articleId);
      const head = `제2절${d.head ? ` ${d.head}` : ""}`;
      return { place: article ? `${head} › ${articleLabel(article)}` : `${head} ${d.title}`, ...(article ? { article } : {}), doc: d };
    }
  }
  for (const g of booklet.specials) {
    for (const d of g.docs) {
      if (d.ownerId !== target.productCoverageId) continue;
      const article = articlesOf(d).find((a) => a.id === target.articleId);
      return { place: article ? `${d.title} › ${articleLabel(article)}` : d.title, ...(article ? { article } : {}), doc: d };
    }
  }
  return { place: "" };
}

/** 결과 조의 글 조각 — 노드 id → 글. 항 · 호 · 목 · 표 셀 · 글머리 항목의 글(슬롯이 낸 값은 그 슬롯 id). */
export function renderedValues(article: RenderedArticle): Record<Id, string> {
  const out: Record<Id, string> = {};
  const inlines = (list: readonly RenderedInline[]) => {
    for (const n of list) if (n.kind === "text") out[n.id] = n.text;
  };
  const statics = (n: RenderedStatic | ErrorNode) => {
    if (n.kind === "table") for (const row of n.rows) for (const cell of row.cells) inlines(cell as RenderedInline[]);
    if (n.kind === "bulletList") for (const b of n.items) inlines(b.children);
  };
  for (const p of article.children) {
    if (p.kind !== "paragraph") {
      statics(p);
      continue;
    }
    inlines(p.children);
    for (const it of p.items ?? []) {
      if (it.kind !== "item") {
        statics(it);
        continue;
      }
      inlines(it.children);
      for (const s of it.subitems ?? []) {
        if (s.kind === "subitem") inlines(s.children);
        else statics(s);
      }
    }
  }
  return out;
}

// ───────────────────────────── 원본 ─────────────────────────────

/** 상품담보 스냅샷의 노드 키 경로 → 머리 표기 (`keyPathLabel` 과 같은 꼴). 노드가 없으면 undefined. */
function nodeLabelsOf(snapshot: ProductCoverageSnapshot): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const sub of snapshot.subCoverages) {
    const head = nodeKeyLabel("subCoverage", sub.key, sub.name);
    out[sub.key] = head;
    for (const b of sub.benefits) out[keyPathOf(sub, b)] = `${head} › ${nodeKeyLabel("benefit", b.key, b.name)}`;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 문서의 조(관 · 조 자리 조건 가지 안까지) — 모델 순서. */
function modelArticles(nodes: readonly unknown[], out: ArticleNode[] = []): ArticleNode[] {
  for (const n of nodes as BlockNode[]) {
    if (n.kind === "article") out.push(n);
    else if (n.kind === "section") modelArticles(n.children, out);
    else if (n.kind === "condBlock") for (const b of n.branches) modelArticles(b.children, out);
  }
  return out;
}

const FILL_WORD = { replace: "조연결", delegate: VERDICT_WORD.delegate, common: VERDICT_WORD.common, commonSplit: VERDICT_WORD.commonSplit, joinAll: VERDICT_WORD.joinAll } as const;

/** 모델 트리 · 기록에 나오는 코드 — 구분자(`D0001`) · 담보속성(`A0001`). 식 문자열까지 훑는다. */
function codesIn(json: string, prefix: "D" | "A"): Set<Code> {
  return new Set(json.match(new RegExp(`\\b${prefix}\\d{4}\\b`, "g")) ?? []);
}

/** 트리 · 기록이 부르는 함수조항 코드 — 정의 본문 안의 호출까지(재귀). */
function clauseCodesIn(json: string): Set<Code> {
  return new Set([...json.matchAll(/"clauseCode":"(C\d+)"/g)].map((m) => m[1]));
}

/** 출처 패널 재료를 짓는다 — 결정적 · 순수. `booklet` 은 지금 보여 주는 그 결과(글 조각 · 결과 자리의 재료). */
export function buildSourceView(master: MasterBundle, product: ProductInput, explanation: ArticleExplanation, booklet: Pick<Booklet, "general" | "specials" | "blocks" | "form">): SourceView {
  const target = explanation.target;
  const located = locateRendered(booklet, target);
  const generalArticles = articlesOf(booklet.general);
  const generalLabel = (id: Id | undefined) => {
    const a = id === undefined ? undefined : generalArticles.find((x) => x.id === id);
    return a ? a.label : undefined;
  };
  const sectioned = booklet.form === "sectioned";
  const baseIds = new Set(product.product.baseContractIds);

  const sources = explanation.sources.map((s: ArticleSource): SourceViewSource => {
    if (s.kind !== "coverage") {
      // 보통약관 지도는 레코드 id 로 매겨져 있다 — 원본의 documentId 는 트리 id 라 상품의 템플릿 id 로 찾는다
      const doc = product.product.generalDocumentId === undefined ? undefined : master.generalDocuments.get(product.product.generalDocumentId);
      const article = s.kind === "copy" ? product.product.articleCopies?.get(s.articleId) : doc ? modelArticles(doc.children).find((a) => a.id === s.articleId) : undefined;
      const ordinal = doc ? modelArticles(doc.children).findIndex((a) => a.id === s.articleId) + 1 : 0;
      const record = master.documentIds?.get(s.documentId) ?? product.product.generalDocumentId;
      return { ...(article ? { article } : {}), ...(record ? { documentRecordId: record } : {}), documentTitle: doc?.title ?? "", kindLabel: s.kind === "copy" ? "사본" : "템플릿", ...(ordinal > 0 ? { ordinal } : {}), tabLabel: doc?.title ?? "" };
    }
    const doc = s.coverageId === undefined ? undefined : master.specialDocuments.get(s.coverageId);
    const list = doc ? modelArticles(doc.children) : [];
    const index = list.findIndex((a) => a.id === s.articleId);
    const article = index >= 0 ? list[index] : undefined;
    const name = s.productCoverageName ?? doc?.title ?? "";
    let fillLine: string | undefined;
    if (s.fills) {
      const place = generalLabel(s.fills.templateArticleId) ?? "조";
      const role = s.productCoverageId !== undefined && baseIds.has(s.productCoverageId) ? "기본계약" : sectioned ? "블록" : "특약";
      fillLine = `${sectioned ? "제1절" : "보통약관"} ${place} 자리 ← ${role} 「${name}」 담보약관${index >= 0 ? ` 제${index + 1}조` : ""} (${FILL_WORD[s.fills.via]})`;
    }
    const record = master.documentIds?.get(s.documentId);
    const snapshot = s.productCoverageId === undefined ? undefined : product.coverages.find((c) => c.snapshot.id === s.productCoverageId)?.snapshot;
    const nodeLabels = snapshot ? nodeLabelsOf(snapshot) : undefined;
    return { ...(article ? { article } : {}), ...(record ? { documentRecordId: record } : {}), documentTitle: doc?.title ?? "", kindLabel: "담보약관", ...(index >= 0 ? { ordinal: index + 1 } : {}), tabLabel: name, ...(fillLine ? { fillLine } : {}), ...(nodeLabels ? { nodeLabels } : {}) };
  });

  // 이름표 — 원본 트리 · 기록이 부르는 것만
  const seed = JSON.stringify([sources.map((s) => s.article), explanation.sources.map((s) => [s.decisions, s.enclosing])]);
  const clauses: Record<Code, SourceViewClause> = {};
  const clauseOf = new Map(master.clauses.map((c) => [c.code, c] as const));
  const pending = [...clauseCodesIn(seed)];
  let scanned = seed;
  while (pending.length > 0) {
    const code = pending.pop()!;
    if (clauses[code]) continue;
    const c: Clause | undefined = clauseOf.get(code);
    if (!c) continue;
    const tree = clauseBodyToTree(c.mode, c.body, c.label);
    const paramEnums = Object.fromEntries((c.params ?? []).flatMap((p) => (p.type.kind === "enum" || p.type.kind === "list<enum>" ? [[p.name, p.type.enumCode]] : [])));
    clauses[code] = { label: c.label, tree, params: (c.params ?? []).map((p) => p.name), ...(Object.keys(paramEnums).length > 0 ? { paramEnums } : {}) };
    const json = JSON.stringify([tree, c.params ?? []]);
    scanned += json;
    for (const inner of clauseCodesIn(json)) if (!clauses[inner]) pending.push(inner);
  }

  const enumCodes = new Set<Code>();
  const discriminators: SourceView["discriminators"] = {};
  const usedD = codesIn(scanned, "D");
  for (const d of master.catalog) {
    if (!usedD.has(d.code)) continue;
    const t = d.resultType;
    const enumCode = t && (t.kind === "enum" || t.kind === "list<enum>") ? t.enumCode : undefined;
    if (enumCode) enumCodes.add(enumCode);
    discriminators[d.code] = { label: d.label, ...(enumCode ? { enumCode } : {}) };
  }
  for (const c of Object.keys(clauses)) for (const p of clauseOf.get(c)?.params ?? []) if (p.type.kind === "enum" || p.type.kind === "list<enum>") enumCodes.add(p.type.enumCode);
  const enums: SourceView["enums"] = {};
  for (const e of master.enums) {
    if (!enumCodes.has(e.code)) continue;
    const fields = e.fields && e.fields.length > 0 ? { fields: Object.fromEntries(e.fields.map((f) => [f.key, f.label])) } : {};
    enums[e.code] = { label: e.label, values: Object.fromEntries(e.values.map((v) => [v.code, v.label])), ...fields };
  }
  const usedA = codesIn(scanned, "A");
  const attributes: SourceView["attributes"] = {};
  for (const k of master.attributeKinds) if (usedA.has(k.code)) attributes[k.code] = { label: k.label, values: Object.fromEntries(k.values.map((v) => [v.code, v.label])) };

  // 읽은 값의 소유자 → 상품담보 (값 바로가기)
  const readOwners: Record<Id, Id> = {};
  const readIds = new Set([...seed.matchAll(/"owner":\{"kind":"product(?:Coverage|SubCoverage|Benefit)","id":"([^"]+)"/g)].map((m) => m[1]));
  for (const c of product.coverages) {
    const pc = c.snapshot.id;
    if (readIds.has(pc)) readOwners[pc] = pc;
    for (const sub of c.snapshot.subCoverages) {
      if (readIds.has(sub.id)) readOwners[sub.id] = pc;
      for (const b of sub.benefits) if (readIds.has(b.id)) readOwners[b.id] = pc;
    }
  }

  const linkedTemplate = explanation.omission?.linkedArticleId ?? explanation.firstSection?.articleId;
  const linkedLabel = linkedTemplate === undefined ? undefined : generalArticles.find((a) => a.id === linkedTemplate);
  const fs = explanation.firstSection;
  const verdict = fs && fs.result !== "master" ? verdictText(fs) : undefined;

  // 결과에 없는 조의 자리 — 원본 조 명
  const fallbackTitle = sources[0]?.article ? `「${foldTitle(sources[0].article.title)}」` : "";
  const place = located.article ? located.place : [located.place, fallbackTitle].filter((x) => x !== "").join(" › ");

  return {
    productId: product.product.id,
    productName: product.product.name,
    explanation,
    place,
    sources,
    values: located.article ? renderedValues(located.article) : {},
    clauses,
    discriminators,
    enums,
    attributes,
    ...(linkedLabel ? { linkedLabel: articleLabel(linkedLabel) } : {}),
    ...(verdict ? { verdict } : {}),
    readOwners,
  };
}

