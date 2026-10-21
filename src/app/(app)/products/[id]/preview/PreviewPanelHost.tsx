"use client";

/**
 * 책자 미리보기의 출처 패널 자리 (기능/조립산출 §4.1) — 본문 클릭을 받아 URL(`?article=` …)을 바꾸고, 서버가 그 URL 로 만든 패널을 오른쪽에 고정한다.
 *
 * - 조 안 어디를 눌러도 그 조의 패널(값 조각을 눌렀으면 `&node=` — 패널의 같은 자리를 강조). 생략 자리 줄을 눌러도 그 조의 패널.
 * - 다른 조를 누르면 내용만 바뀐다(같은 자리 · 스크롤 유지). ✕ 는 쿼리에서 패널만 뺀다.
 * - 링크 · 버튼 · 접기 줄(오류 패널 · 평가 대기 목록)을 누른 것은 건드리지 않는다.
 */
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { SourcePanel, type SourcePanelContent } from "@/app/_components/sourcePanel/SourcePanel";
import { panelQuery, type PanelQueryState } from "@/app/_components/sourcePanel/query";
import { Toggle } from "@/app/_components/Toggle";
import type { ExplainTarget } from "@/domain/assembly";

/** 누른 자리 → 패널 대상 · 강조 노드. 본문 밖 · 조 밖이면 없다. */
export function clickTarget(el: HTMLElement): { target: ExplainTarget; node?: string } | undefined {
  if (el.closest("a, button, summary, input, label")) return undefined;
  const doc = el.closest<HTMLElement>("article.ts-doc");
  if (!doc) return undefined;
  const omitted = el.closest<HTMLElement>("[data-omitted-article]");
  const articleId = omitted?.dataset.omittedArticle ?? el.closest<HTMLElement>("[data-article]")?.dataset.article;
  if (!articleId) return undefined;
  const target: ExplainTarget = doc.dataset.document === "special" && doc.dataset.owner ? { document: "special", productCoverageId: doc.dataset.owner, articleId } : { document: "general", articleId };
  const node = omitted ? undefined : el.closest<HTMLElement>("[data-n]")?.dataset.n;
  return { target, ...(node ? { node } : {}) };
}

export function PreviewPanelHost({ content, state, rerun, children }: { content?: SourcePanelContent; state: PanelQueryState & { showOmitted: boolean }; rerun?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (next: PanelQueryState) => router.push(`${pathname}${panelQuery(next)}`, { scroll: false });
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const hit = clickTarget(e.target as HTMLElement);
    if (hit) go({ ...hit, showOmitted: state.showOmitted });
  };
  const key = state.target ? `${state.target.document === "special" ? state.target.productCoverageId : ""}:${state.target.articleId}` : "none";
  return (
    <div className={content ? "ts-preview-layout has-panel" : "ts-preview-layout"}>
      {/* 본문 클릭 위임 — 키보드 이동은 조 목차 · 오류 패널 링크가 맡는다 */}
      <div onClick={onClick}>{children}</div>
      {content && <SourcePanel key={key} content={content} focus={state.node} onClose={() => go({ showOmitted: state.showOmitted })} rerun={rerun} />}
    </div>
  );
}

/** 「생략 자리 보기」 켜기 · 끄기 — 미리보기 머리 (기본 켬). 패널은 그대로 둔다. */
export function OmittedToggle({ state }: { state: PanelQueryState & { showOmitted: boolean } }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Toggle
      name="omitted"
      label="생략 자리 보기"
      checked={state.showOmitted}
      onChange={(on) => router.push(`${pathname}${panelQuery({ ...state, showOmitted: on })}`, { scroll: false })}
    />
  );
}
