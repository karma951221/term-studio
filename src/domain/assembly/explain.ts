/**
 * 설명 모드 — 조 하나의 출처 (ADR-0092 결정 2 · 3 · 4 · 기능/조립산출 §3.7).
 *
 * 조립과 같은 결과여야 하므로 조립 파이프라인(`runAssembly`)을 그대로 돌며 **그 조 안**의 결정 노드만 기록한다 — 규칙을 따로 두지 않는다.
 * 조 하나를 꺼내도 번호 · 참조 · 준용 판정 때문에 책자 전체를 돈다. 저장하지 않는다(산출 `Booklet` 에 싣지 않음).
 *
 * - 원본은 「실제 글을 그린 곳」(결정 2): 보통약관 조는 템플릿 조(상품 조 사본이 쓰이면 사본), 특약 · 블록 조는 담보약관 조.
 *   기본계약 대치 · 제1절 위임 · 공통 · 공통항 분리 · 전체항 합침으로 담보약관 글이 템플릿 조 자리를 채웠으면 그 담보약관 조(블록마다)가 원본이고
 *   「템플릿 조 자리 ← 담보약관 조」(`fills`)를 단다.
 * - 조 단위로 생략 · 준용 판정 기록(`OmissionRecord`) · 제1절 판정 기록(`FirstSectionRecord`)을 잇는다. 생략된 조 · 결과에 없는 조도 설명 대상이다.
 * - 조 자리를 정한 조건 분기(조를 감싼 조건)는 원본의 `enclosing` — 조건으로 사라진 조의 까닭이다.
 * - 평가하지 않은 가지는 평가하지 않는다(결정 4) — 건너뛴 가지는 「평가 안 함」, 막힌 가지 뒤는 「막힘」.
 * - 결정적이다 — 기록 모음 · 읽기 받이는 호출마다 새로 만든다(전역 상태 · 모듈 캐시 없음).
 *
 * DB · React import 금지 (순수층).
 */
import type { ArticleNode, BlockNode, CondBlockNode } from "../document/nodes";
import type { Coordinate, Id } from "../types";
import { runAssembly } from "./booklet";
import { assemblyCopyLocks } from "./context";
import type { ExplainHooks } from "./resolve";
import { planForm, type BlockTreatment, type VerdictKind } from "./section";
import type { AssemblyInput, DecisionRecord, FirstSectionRecord, MasterBundle, OmissionRecord, ProductInput, RenderedArticle, RenderedDoc } from "./types";

/** 설명 대상 — 보통약관 조(템플릿 조 id) · 상품담보의 담보약관 조(특약 조 · 블록 조 · 대치 형태 기본계약 조). */
export type ExplainTarget = { document: "general"; articleId: Id } | { document: "special"; productCoverageId: Id; articleId: Id };

/** 담보약관 글이 템플릿 조 자리를 채운 방식 — 기본계약 대치 · 제1절 판정(위임 · 공통 · 공통항 분리 · 전체항 합침). */
export type FillVia = "replace" | Extract<VerdictKind, "delegate" | "common" | "commonSplit" | "joinAll">;

/** 원본 하나 — 그 조를 그린 모델링 원본과 그 위에 덧칠할 실행 기록. */
export interface ArticleSource {
  /** 템플릿 조 · 상품 조 사본(템플릿 조 자리 — 문서는 템플릿) · 담보약관 조. */
  kind: "template" | "copy" | "coverage";
  /** 원본 문서 id — 템플릿 · 담보약관 문서. */
  documentId: Id;
  articleId: Id;
  productCoverageId?: Id;
  productCoverageName?: string;
  coverageId?: Id;
  /** 담보약관 글이 템플릿 조 자리를 채웠다 — 「보통약관 제3조 자리 ← 「상해사망」 담보약관 제1조」의 재료. */
  fills?: { templateArticleId: Id; via: FillVia };
  /** 절 형태 블록 조의 처리 (기재 · 생략 · 분리 · 통째 — 제1절 판정 결정 6). */
  treatment?: BlockTreatment["kind"];
  /** 조 안(제목 포함)의 결정 노드 — 문서 순. 조립이 이 조를 밟지 않았으면(조건으로 사라짐) 비어 있다. */
  decisions: DecisionRecord[];
  /** 조 자리를 정한 조건 분기 — 이 조를 감싼 조 자리 조건(바깥부터). 가지 안쪽 기록은 싣지 않는다. */
  enclosing?: DecisionRecord[];
}

export interface ArticleExplanation {
  target: ExplainTarget;
  /**
   * 이 상품 결과에서 그 조 — 찍힘 · 생략(특약 조 생략 판정 · 제1절로 올라 블록에서 생략) · 노출 끔 · 결과에 없음(조건으로 사라짐 · 빈 조 ·
   * 그 상품담보 · 조가 없음 · 그 밖).
   */
  status: "shown" | "omitted" | "hidden" | "absent";
  /** 원본 — 대치 · 위임 · 공통 · 합침이면 담보약관 조(블록마다), 아니면 하나. 원본을 찾을 수 없으면(없는 조) 비어 있다. */
  sources: ArticleSource[];
  /** 생략 · 준용 판정 기록 — 조연결된 특약 조. */
  omission?: OmissionRecord;
  /** 제1절 판정 기록 — 보통약관(제1절) 조면 그 조, 블록 조면 조연결한 템플릿 조. */
  firstSection?: FirstSectionRecord;
  /** 조립이 만든 조(최소 준용규정 등 — 시스템 문장) — 모델링 원본이 없어 `sources` 가 비어 있다. */
  system?: true;
}

/** 조 자리(문서 · 관 · 조 자리 조건 가지)의 조 — 조립의 조 자리 순회와 같은 규칙. */
function articlesUnder(nodes: readonly unknown[], out: ArticleNode[] = []): ArticleNode[] {
  for (const n of nodes as BlockNode[]) {
    if (n.kind === "article") out.push(n);
    else if (n.kind === "section") articlesUnder(n.children, out);
    else if (n.kind === "condBlock") for (const b of n.branches) articlesUnder(b.children, out);
  }
  return out;
}

function renderedArticle(doc: RenderedDoc | undefined, id: Id): RenderedArticle | undefined {
  for (const c of doc?.children ?? []) {
    if (c.kind === "article" && c.id === id) return c;
    if (c.kind === "section") for (const a of c.children) if (a.kind === "article" && a.id === id) return a;
  }
  return undefined;
}

/** 담보약관 글이 템플릿 조 자리를 채우는 제1절 판정 — 위임(위임 문구 + 블록 조째) · 공통 · 공통항 분리 · 전체항 합침(블록 글이 오른다). */
const FILLING: ReadonlySet<VerdictKind> = new Set(["delegate", "common", "commonSplit", "joinAll"]);

const ownerKey = (c: Coordinate): string => (c.document === "general" ? "general" : `pc:${c.ownerId ?? ""}`);

/** 조 하나의 출처를 설명 모드로 계산한다 — 결정적 · 순수. 같은 재료면 같은 결과. */
export function explainArticle(master: MasterBundle, product: ProductInput, target: ExplainTarget): ArticleExplanation {
  const input: AssemblyInput = { ...master, ...product };
  const form = planForm(input);
  const T = target.articleId;
  const baseId = form.form === "single" ? input.product.baseContractIds[0] : undefined;
  /** 템플릿 조 자리를 채울 수 있는 상품담보 — 대치 형태의 기본계약 · 절 형태의 블록. */
  const fills = (pcId: Id | undefined) => pcId !== undefined && (form.form === "single" ? pcId === baseId : form.candidates.has(pcId));

  const wants = (a: ArticleNode, c: Coordinate): boolean =>
    target.document === "general"
      ? (c.document === "general" && a.id === T) || (c.document === "special" && a.linkedArticleId === T && fills(c.ownerId))
      : c.document === "special" && c.ownerId === target.productCoverageId && a.id === T;

  // 기록 모음 — 이 호출에서만 (결정성). 같은 문서를 다시 해소하면 그 문서의 앞 기록을 버린다(마지막 해소가 결과)
  const recorded = new Map<string, { article: ArticleNode; decisions: DecisionRecord[] }[]>();
  const enclosing = new Map<string, DecisionRecord[]>();
  const hooks: ExplainHooks = {
    begin: (c) => {
      recorded.delete(ownerKey(c));
      enclosing.delete(ownerKey(c));
    },
    wants,
    wraps: (cond: CondBlockNode, c) => articlesUnder([cond]).some((a) => wants(a, c)),
    article: (c, article, decisions) => recorded.set(ownerKey(c), [...(recorded.get(ownerKey(c)) ?? []), { article, decisions }]),
    enclosing: (c, record) => enclosing.set(ownerKey(c), [...(enclosing.get(ownerKey(c)) ?? []), record]),
  };
  const { booklet, replaced } = runAssembly(master, product, { explain: hooks });

  const enclosingOf = (key: string) => {
    const list = enclosing.get(key);
    return list && list.length > 0 ? { enclosing: list } : {};
  };
  const decisionsOf = (key: string, articleId: Id) => recorded.get(key)?.find((r) => r.article.id === articleId)?.decisions ?? [];

  /** 상품담보의 담보약관 조 원본. */
  const coverageSource = (pcId: Id, articleId: Id, extra: Partial<ArticleSource> = {}): ArticleSource | undefined => {
    const c = input.coverages.find((x) => x.snapshot.id === pcId);
    const doc = c && input.specialDocuments.get(c.snapshot.coverageId);
    if (!c || !doc) return undefined;
    const key = `pc:${pcId}`;
    return { kind: "coverage", documentId: doc.id, articleId, productCoverageId: pcId, productCoverageName: c.snapshot.name, coverageId: c.snapshot.coverageId, ...extra, decisions: decisionsOf(key, articleId), ...enclosingOf(key) };
  };
  /** 그 상품담보의 담보약관에서 템플릿 조 T 에 조연결한 조 — 조립이 밟은 것(기록) 먼저, 없으면 문서에서. */
  const linkedIn = (pcId: Id): Id | undefined => {
    const hit = recorded.get(`pc:${pcId}`)?.find((r) => r.article.linkedArticleId === T);
    if (hit) return hit.article.id;
    const c = input.coverages.find((x) => x.snapshot.id === pcId);
    const doc = c && input.specialDocuments.get(c.snapshot.coverageId);
    return doc ? articlesUnder(doc.children).find((a) => a.linkedArticleId === T)?.id : undefined;
  };

  if (target.document === "general") {
    const templateId = input.product.generalDocumentId;
    const template = templateId === undefined ? undefined : input.generalDocuments.get(templateId);
    if (!template || !articlesUnder(template.children).some((a) => a.id === T)) return { target, status: "absent", sources: [] };
    const firstSection = booklet.firstSection?.find((r) => r.articleId === T);
    const status = input.product.hiddenArticleIds.has(T) ? "hidden" : renderedArticle(booklet.general, T) ? "shown" : "absent";
    const head = { target, status, ...(firstSection ? { firstSection } : {}) } as const;
    // 기본계약 대치 — 템플릿 조 자리 ← 기본계약 담보약관 조
    if (form.form === "single" && replaced.has(T) && baseId !== undefined) {
      const linked = linkedIn(baseId);
      const source = linked === undefined ? undefined : coverageSource(baseId, linked, { fills: { templateArticleId: T, via: "replace" } });
      if (source) return { ...head, sources: [source] };
    }
    // 제1절 위임 · 공통 · 공통항 분리 · 전체항 합침 — 템플릿 조 자리 ← 블록마다 담보약관 조
    if (firstSection && FILLING.has(firstSection.result)) {
      const via = firstSection.result as FillVia;
      const sources = firstSection.linked.flatMap(({ productCoverageId: pcId }) => {
        const linked = linkedIn(pcId);
        const treatment = firstSection.blocks.find((b) => b.productCoverageId === pcId)?.treatment;
        const source = linked === undefined ? undefined : coverageSource(pcId, linked, { fills: { templateArticleId: T, via }, ...(treatment ? { treatment } : {}) });
        return source ? [source] : [];
      });
      if (sources.length > 0) return { ...head, sources };
    }
    // 템플릿 조 — 상품 조 사본이 쓰이면(잠기지 않았으면) 사본
    const copied = input.product.articleCopies?.has(T) === true && !assemblyCopyLocks(input).has(T);
    return { ...head, sources: [{ kind: copied ? "copy" : "template", documentId: template.id, articleId: T, decisions: decisionsOf("general", T), ...enclosingOf("general") }] };
  }

  // 상품담보의 담보약관 조
  const pcId = target.productCoverageId;
  const c = input.coverages.find((x) => x.snapshot.id === pcId);
  const doc = c && input.specialDocuments.get(c.snapshot.coverageId);
  const node = doc ? articlesUnder(doc.children).find((a) => a.id === T) : undefined;
  if (!c || !doc || !node) {
    // 조립이 만든 조(최소 준용규정) — 원본은 없고 결과에는 있다
    const system = [...booklet.specials, ...(booklet.blocks ?? [])].some((g) => g.docs.some((d) => d.ownerId === pcId && renderedArticle(d, T)));
    return system ? { target, status: "shown", sources: [], system: true } : { target, status: "absent", sources: [] };
  }
  const linkedTemplate = node.linkedArticleId;

  // 절 형태의 블록 — 제2절에 찍혔나, 제1절 판정의 블록 조 처리
  if (form.form === "sectioned" && form.candidates.has(pcId)) {
    const firstSection = linkedTemplate === undefined ? undefined : booklet.firstSection?.find((r) => r.articleId === linkedTemplate && r.linked.some((l) => l.productCoverageId === pcId));
    const treatment = firstSection?.blocks.find((b) => b.productCoverageId === pcId)?.treatment;
    const shown = (booklet.blocks ?? []).some((g) => g.docs.some((d) => d.ownerId === pcId && renderedArticle(d, T)));
    const status = shown ? "shown" : treatment === "omitted" ? "omitted" : "absent";
    const fillsVia = firstSection && FILLING.has(firstSection.result) ? { fills: { templateArticleId: firstSection.articleId, via: firstSection.result as FillVia } } : {};
    return { target, status, sources: [coverageSource(pcId, T, { ...fillsVia, ...(treatment ? { treatment } : {}) })!], ...(firstSection ? { firstSection } : {}) };
  }
  // 대치 형태의 기본계약 — 특약으로 찍히지 않고 조연결한 보통약관 조 자리를 채운다
  if (form.form === "single" && pcId === baseId) {
    const fillsT = linkedTemplate !== undefined && replaced.has(linkedTemplate) && renderedArticle(booklet.general, linkedTemplate) !== undefined;
    return { target, status: fillsT ? "shown" : "absent", sources: [coverageSource(pcId, T, fillsT ? { fills: { templateArticleId: linkedTemplate!, via: "replace" } } : {})!] };
  }
  // 특약 — 특약 조 생략 · 준용 판정
  const omission = booklet.omitted.find((o) => o.productCoverageId === pcId && o.articleId === T);
  const shown = [...booklet.specials, ...(booklet.blocks ?? [])].some((g) => g.docs.some((d) => d.document === "special" && d.ownerId === pcId && renderedArticle(d, T)));
  const status = shown ? "shown" : omission?.disposition === "omitted" ? "omitted" : "absent";
  return { target, status, sources: [coverageSource(pcId, T)!], ...(omission ? { omission } : {}) };
}
