/**
 * 담보 문면에 준용규정 조가 없으면 조립 결과 끝에 MVP 최소형을 붙인다. 관 안의 조도 센다 (2026-09-08 리뷰 5).
 * 문장은 출력 위치의 위치 호칭이다 — 특약 「보통약관」 · 기본계약 2+ 의 특약 「보통약관 제1절 일반조항」 · 블록 「제1절 일반조항」(`position.ts`, 기능/조립산출 §3.5).
 * 최소형은 후보가 없으므로 준용예외 판정표의 ② 위임 조만 싣는다(`delegated` — 기본계약 2+ 의 특약, ADR-0098 결정 6):
 * 「… 따릅니다. 다만, 보통약관 제1절 일반조항 제N조(…)은 제외합니다.」 — 조사는 원문처럼 「은」으로 굳힌다(허용 차이).
 */
import { applicationSentence, type RefPosition } from "./position";
import type { Id } from "../types";
import type { SInline, SubstitutedDoc } from "./types";
import { articlesOf } from "./walk";

export function ensureApplicationArticle(doc: SubstitutedDoc, position: Exclude<RefPosition, "general"> = "special", delegated: readonly Id[] = []): SubstitutedDoc {
  if (articlesOf(doc).some((article) => article.title === "준용규정")) return doc;
  const exclusion: SInline[] =
    delegated.length === 0
      ? []
      : [
          { kind: "text", id: `${doc.id}::application-exclusion-1`, text: " 다만, " },
          { kind: "articleRef", id: `${doc.id}::application-exclusion`, targets: delegated.map((articleId) => ({ articleId })), ...(delegated.length > 1 ? { connector: "및" as const } : {}), scope: "general", at: {} },
          { kind: "text", id: `${doc.id}::application-exclusion-2`, text: "은 제외합니다." },
        ];
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
            children: [{ kind: "text", id: `${doc.id}::application-text`, text: applicationSentence(position) }, ...exclusion],
          },
        ],
      },
    ],
  };
}
