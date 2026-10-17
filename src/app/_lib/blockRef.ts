/**
 * 블록 지정 참조의 화면 표기 (ADR-0082 결정 12 · 기능/상품 §4.6) — 상품 조 사본 편집기 · 모델링 패널이 같이 쓴다. 순수.
 * 조립 표기(「제2절 보장조항 {블록 머리} {제목}」 · 「… 제N조(제목)」)와 같은 꼴, 고르기 재료는 저장된 조립의 제2절 블록이다.
 */
import type { Id } from "@/domain/types";

/** 블록 지정 참조의 고르기 줄 — 블록 하나(「{블록 머리} {제목}」)와 그 블록 조들(「제N조(제목)」). */
export interface BlockRefChoice {
  productCoverageId: Id;
  label: string;
  articles: readonly { id: Id; label: string }[];
}

/** 고르기 값 — 블록 전체 `상품담보id`, 블록 조 `상품담보id|블록조id`. */
export function blockRefValue(productCoverageId: Id, articleId?: Id): string {
  return articleId === undefined ? productCoverageId : `${productCoverageId}|${articleId}`;
}

export function parseBlockRefValue(value: string): { productCoverageId: Id; articleId?: Id } | undefined {
  if (value === "") return undefined;
  const [productCoverageId, articleId] = value.split("|");
  return articleId ? { productCoverageId, articleId } : { productCoverageId };
}

/** 칩 글 — 「제2절 보장조항 1. 상해사망 제1조(…)」. 고르기 재료에 없는 대상은 「블록 지정 참조(대상 없음)」 — 조립은 articleGone. */
export function blockRefChipText(choices: readonly BlockRefChoice[] | undefined, node: { productCoverageId: Id; articleId?: Id }): string {
  const block = choices?.find((c) => c.productCoverageId === node.productCoverageId);
  if (!block) return choices ? "블록 지정 참조(대상 블록 없음)" : "〔블록 지정 참조〕";
  if (node.articleId === undefined) return `제2절 보장조항 ${block.label}`;
  const article = block.articles.find((a) => a.id === node.articleId);
  return article ? `제2절 보장조항 ${block.label} ${article.label}` : `제2절 보장조항 ${block.label} (대상 조 없음)`;
}
