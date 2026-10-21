"use client";

/**
 * 출처 패널 자리 (기능/조립산출 §4.1 · §4.2) — 조립 결과를 보이는 화면 다섯 곳이 같은 부품으로 패널을 연다.
 *
 * - 본문 클릭 → 패널 대상(`clickTarget`): 조 안 어디를 눌러도 그 조(값 조각을 눌렀으면 `&node=` — 패널의 같은 자리를 강조). 생략 자리 줄도 그 조.
 *   링크 · 버튼 · 접기 줄(오류 패널 · 평가 대기 목록)과 출처 패널 안은 건드리지 않는다.
 * - URL 상태(`usePanelNav`): 화면 쿼리(`tab` · `art` · `cov` · `pc` …)는 지키고 패널 키만 바꾼다(`mergePanelQuery`). 다른 조를 누르면 내용만 바뀐다(스크롤 유지).
 * - 오른쪽 고정 패널(`PreviewPanelHost` — 책자 미리보기 · 상품담보 미리보기) · 한 겹 덮기(`SourceOverlay` — 보통약관 탭 미리보기 패널 · 문면 편집기 미리보기 탭).
 */
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { SourcePanel, type SourcePanelContent } from "@/app/_components/sourcePanel/SourcePanel";
import { mergePanelQuery, type PanelQueryState } from "@/app/_components/sourcePanel/query";
import { Toggle } from "@/app/_components/Toggle";
import type { ExplainTarget } from "@/domain/assembly";

export type PanelHit = { target: ExplainTarget; node?: string };

/** 화면이 서버에서 받는 패널 — URL 상태 + (열렸으면) 내용. */
export interface ScreenPanel {
  content?: SourcePanelContent;
  state: PanelQueryState & { showOmitted: boolean };
}

/** 누른 자리 → 패널 대상 · 강조 노드. 본문(문서 표지 `data-document` 가 있는 `.ts-doc`) 밖 · 조 밖이면 없다. */
export function clickTarget(el: HTMLElement): PanelHit | undefined {
  if (el.closest("a, button, summary, input, label, select, .ts-src-panel")) return undefined;
  const doc = el.closest<HTMLElement>(".ts-doc[data-document]");
  if (!doc) return undefined;
  const omitted = el.closest<HTMLElement>("[data-omitted-article]");
  const articleId = omitted?.dataset.omittedArticle ?? el.closest<HTMLElement>("[data-article]")?.dataset.article;
  if (!articleId) return undefined;
  const target: ExplainTarget = doc.dataset.document === "special" && doc.dataset.owner ? { document: "special", productCoverageId: doc.dataset.owner, articleId } : { document: "general", articleId };
  const node = omitted ? undefined : el.closest<HTMLElement>("[data-n]")?.dataset.n;
  return { target, ...(node ? { node } : {}) };
}

export interface PanelNavOptions {
  /** 화면도 쓰는 패널 키 — 특별약관 탭의 `pc`(고른 상품담보). 닫아도 남는다. */
  own?: readonly string[];
  /** 패널 상태에 따라 함께 바꿀 화면 쿼리 — 보통약관 탭은 연 조를 `art` 로도. */
  set?: (next: PanelQueryState) => Record<string, string | undefined>;
}

/** 패널 상태를 URL 로 — 지금 주소의 쿼리(목차 · 선택기가 `replaceState` 로 바꾼 것까지)에 합친다. */
export function usePanelNav(opts: PanelNavOptions = {}): (next: PanelQueryState) => void {
  const router = useRouter();
  return (next) => {
    const { pathname, search } = globalThis.window.location;
    router.push(`${pathname}${mergePanelQuery(search, next, { ...(opts.own ? { own: opts.own } : {}), ...(opts.set ? { set: opts.set(next) } : {}) })}`, { scroll: false });
  };
}

/** 본문 클릭 위임 — 키보드 이동은 조 목차 · 오류 패널 링크가 맡는다. */
export function PanelClicks({ onPick, children, className }: { onPick: (hit: PanelHit) => void; children: ReactNode; className?: string }) {
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const hit = clickTarget(e.target as HTMLElement);
    if (hit) onPick(hit);
  };
  return (
    <div className={className ? `ts-src-clicks ${className}` : "ts-src-clicks"} onClick={onClick}>
      {children}
    </div>
  );
}

/** 오른쪽 고정 패널 — 열리면 본문이 좁아진다. 책자 미리보기(저장본 · `rerun`) · 상품담보 미리보기(실시간). */
export function PreviewPanelHost({ content, state, rerun, own, children }: { content?: SourcePanelContent; state: PanelQueryState & { showOmitted: boolean }; rerun?: ReactNode; own?: readonly string[]; children: ReactNode }) {
  const go = usePanelNav(own ? { own } : {});
  const key = panelKey(state);
  return (
    <div className={content ? "ts-preview-layout has-panel" : "ts-preview-layout"}>
      <PanelClicks onPick={(hit) => go({ ...hit, showOmitted: state.showOmitted })}>{children}</PanelClicks>
      {content && <SourcePanel key={key} content={content} focus={state.node} onClose={() => go({ showOmitted: state.showOmitted })} rerun={rerun} />}
    </div>
  );
}

/** 패널 내용의 열쇠 — 다른 조로 바뀌면 블록 탭 · 펼침을 처음부터. */
export function panelKey(state: PanelQueryState): string {
  return state.target ? `${state.target.document === "special" ? state.target.productCoverageId : ""}:${state.target.articleId}` : "none";
}

/**
 * 한 겹 덮기 — 미리보기 패널(탭) 안에서 출처 패널이 미리보기 자리를 덮는다. 미리보기는 숨길 뿐 그대로 두어 ✕ 로 돌아오면 같은 자리다.
 * `content` 가 없으면 닫힘.
 */
export function SourceOverlay({ content, focus, onClose, children }: { content?: SourcePanelContent; focus?: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div hidden={content !== undefined}>{children}</div>
      {content && (
        <div className="ts-src-overlay">
          <SourcePanel content={content} {...(focus ? { focus } : {})} onClose={onClose} />
        </div>
      )}
    </>
  );
}

/** 「생략 자리 보기」 켜기 · 끄기 — 미리보기 머리 (기본 켬). 패널은 그대로 둔다. */
export function OmittedToggle({ state, own }: { state: PanelQueryState & { showOmitted: boolean }; own?: readonly string[] }) {
  const go = usePanelNav(own ? { own } : {});
  return <Toggle name="omitted" label="생략 자리 보기" checked={state.showOmitted} onChange={(on) => go({ ...state, showOmitted: on })} />;
}
