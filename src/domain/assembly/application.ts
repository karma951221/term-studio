/**
 * 담보 문면에 준용규정 조가 없으면 조립 결과 끝에 MVP 최소형을 붙인다. 관 안의 조도 센다 (2026-09-08 리뷰 5).
 * 문장은 출력 위치의 위치 호칭이다 — 특약 「보통약관」 · 기본계약 2+ 의 특약 「보통약관 제1절 일반조항」 · 블록 「제1절 일반조항」(`position.ts`, 기능/조립산출 §3.5).
 */
import { applicationSentence, type RefPosition } from "./position";
import type { SubstitutedDoc } from "./types";
import { articlesOf } from "./walk";

export function ensureApplicationArticle(doc: SubstitutedDoc, position: Exclude<RefPosition, "general"> = "special"): SubstitutedDoc {
  if (articlesOf(doc).some((article) => article.title === "준용규정")) return doc;
  return {
    ...doc,
    children: [
      ...doc.children,
      {
        kind: "article",
        id: `${doc.id}::application-article`,
        title: "준용규정",
        children: [
          {
            kind: "paragraph",
            id: `${doc.id}::application-paragraph`,
            children: [{ kind: "text", id: `${doc.id}::application-text`, text: applicationSentence(position) }],
          },
        ],
      },
    ],
  };
}
