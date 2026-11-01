"use client";

/**
 * 우측 패널 「미리보기」 탭 — 가운데 조 하나를 **고른 상품의 조립 문맥**으로 조립한 모양 (기능/문면 §3.9, 2026-10-10).
 *
 * - 상품 목록은 서버가 넘긴다 — 담보약관: 이 담보를 특약으로 탑재한 상품담보마다, 보통약관: 이 템플릿을 쓰는 상품. 처음은 첫 줄.
 * - 상품 재료(공유 마스터 · 상품 고유분)는 상품을 고를 때 서버 함수로 한 번 받아 상품마다 기억한다.
 * - 조립은 브라우저에서 순수 `previewArticle` — 편집 중이면 편집본이 바뀔 때마다 다시 계산한다(서버 왕복 없음).
 * - 산출물 꼴로 그린다 — 작업용 글자색 · 칩 · 조건 상자 없음(조립 결과 렌더 `RenderedArticleView`).
 * - 출처 패널 (기능/문면 §3.9 · 조립산출 §4.2): 조를 누르면 탭 안에서 한 겹 덮어 그 조의 출처(`previewSourceView` — 편집 중이면 편집본으로), ✕ 로 돌아옴.
 *   패널 상태는 화면 상태다(주소에 남기지 않는다) — 고른 상품 · 편집본이 주소에 없어 새로고침하면 어차피 다른 계산이다.
 *   가운데 조 · 고른 상품이 바뀌면 덮개를 걷는다. 「원본 조 열기」가 이 문서면 떠나지 않고 가운데 그 노드로(`openNode`).
 */
import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";

import { RenderedArticleView } from "@/app/_components/RenderedDoc";
import { PanelClicks, SourceOverlay, type PanelHit } from "@/app/_components/sourcePanel/PanelHost";
import type { SourcePanelContent } from "@/app/_components/sourcePanel/SourcePanel";
import { previewArticle, previewSourceView, type ArticlePreview, type ArticlePreviewTarget } from "@/domain/assembly";
import type { DocumentNode } from "@/domain/document";
import type { Id } from "@/domain/types";
import type { PreviewProduct } from "@/services/assembly";

import { previewKeyOf as keyOf, type PreviewSelection } from "./previewSelection";
import { NativeSelect } from "@/components/ui/native-select";

export interface PreviewTabProps {
  docKind: "special" | "general";
  /** 고른 상품 · 재료 — 「구분자」 탭과 함께 쓴다 (`usePreviewSelection`). */
  selection: PreviewSelection;
  /** 조립할 트리 — 편집 중이면 편집본. */
  tree: DocumentNode;
  /** 가운데에 연 조. 없으면(조 없는 문서) 안내. */
  articleId?: Id;
  editing: boolean;
  /** 출처 패널의 「원본 조 열기」가 이 문서일 때 — 가운데에서 그 노드를 연다(편집기 `go`). */
  openNode?: (nodeId: Id) => void;
}

/** 한 상품을 여러 상품담보로 탑재했으면 「상품 — 상품담보」, 아니면 상품 이름. */
function labelOf(p: PreviewProduct, all: readonly PreviewProduct[]): string {
  const twice = all.filter((x) => x.productId === p.productId).length > 1;
  return twice && p.productCoverageName ? `${p.productName} — ${p.productCoverageName}` : p.productName;
}

const DROPPED_WHY = {
  hidden: "이 상품이 이 조의 노출을 껐다 — 상품 보통약관 탭에서 바꾼다.",
  notEmitted: "조건으로 빠졌거나 조건을 푼 뒤 남는 내용이 없다.",
} as const;

function Result({ preview, docKind, owner }: { preview: ArticlePreview; docKind: "special" | "general"; owner: string }) {
  if (preview.kind === "unavailable") return <p className="ts-error-banner">미리보기를 만들지 못했다 — {preview.message}</p>;
  if (preview.kind === "dropped") {
    return (
      <div className="ts-empty" data-preview="dropped">
        <p className="ts-empty-what">이 상품에서는 이 조가 생략된다.</p>
        <p className="ts-empty-example">{preview.reason === "omitted"
            ? preview.contained
              ? `대응 보통약관 ${preview.linkedArticleTitle} 에 포함돼 생략 판정됐다(조연결 · 생략 기준 「포함하면 생략」).`
              : `대응 보통약관 ${preview.linkedArticleTitle} 과 같아 생략 판정됐다(조연결).`
            : DROPPED_WHY[preview.reason]}</p>
      </div>
    );
  }
  const hidden = preview.issues.filter((i) => (i.severity ?? "error") === "error").length;
  return (
    <>
      {preview.replacedByBase !== undefined && <p className="ts-muted">이 상품에서는 기본계약 「{preview.replacedByBase}」의 조로 대치된다 — 대치된 본문이다.</p>}
      {preview.articleCopy && <p className="ts-muted">이 상품은 이 조의 사본을 쓴다 — 사본 본문이다.</p>}
      <div className="ts-doc ts-preview-article" data-preview="shown" data-document={docKind} data-owner={owner}>
        <RenderedArticleView node={preview.article} />
      </div>
      {preview.issues.length > 0 && (
        <>
          <p className="ts-muted">
            이 조의 조립 오류 {hidden}건 · 경고 {preview.issues.length - hidden}건
          </p>
          <ul className="ts-issues">
            {preview.issues.map((i, n) => (
              <li key={n} className={(i.severity ?? "error") === "warning" ? "ts-issue-warning" : undefined}>
                [{i.kind}] {i.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** 「원본 조 열기」 등이 이 문서의 노드를 가리키면 화면을 떠나지 않고 가운데에서 연다 — 다른 화면 링크는 그대로(편집 중이면 「저장하지 않은 변경 사항」 확인). */
function sameDocumentNode(e: MouseEvent, openNode: ((nodeId: Id) => void) | undefined): void {
  const anchor = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || !openNode) return;
  const url = new URL(anchor.href, window.location.href);
  const node = url.searchParams.get("node");
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !node) return;
  e.preventDefault();
  openNode(node);
}

export function PreviewTab({ docKind, selection, tree, articleId, editing, openNode }: PreviewTabProps) {
  const { products, selected, outcome } = selection;
  const productKey = selected ? keyOf(selected) : "";
  const target = useMemo((): ArticlePreviewTarget => (docKind === "special" ? { document: "special", productCoverageId: selected?.productCoverageId ?? "", tree } : { document: "general", tree }), [docKind, selected, tree]);

  const preview = useMemo((): ArticlePreview | undefined => {
    if (!selected || !articleId || !outcome?.ok) return undefined;
    const { master, product } = outcome.material;
    try {
      return previewArticle(master, product, target, articleId);
    } catch (e) {
      return { kind: "unavailable", message: e instanceof Error ? e.message : String(e) };
    }
  }, [selected, articleId, outcome, target]);

  // 출처 덮개 — 연 조 · 상품이 지금 것과 같을 때만 (가운데 조 · 상품을 바꾸면 걷힌다)
  const [src, setSrc] = useState<{ key: string; articleId: Id; node?: string }>();
  const open = src && src.key === productKey && src.articleId === articleId ? src : undefined;
  const openArticle = open?.articleId;
  const source = useMemo((): SourcePanelContent | undefined => {
    if (!openArticle || !outcome?.ok) return undefined;
    try {
      const r = previewSourceView(outcome.material.master, outcome.material.product, target, openArticle);
      return r.kind === "ok" ? { state: "ok", view: r.view } : { state: "error", message: `출처를 계산하지 못했다 — ${r.message}` };
    } catch (e) {
      return { state: "error", message: `출처를 계산하지 못했다 — ${e instanceof Error ? e.message : String(e)}` };
    }
  }, [openArticle, outcome, target]);
  const pick = (hit: PanelHit) => setSrc({ key: productKey, articleId: hit.target.articleId, ...(hit.node ? { node: hit.node } : {}) });

  if (products.length === 0) {
    return (
      <div className="ts-empty" data-preview="no-product">
        <p className="ts-empty-what">{docKind === "special" ? "이 담보를 특약으로 탑재한 상품이 없다." : "이 템플릿을 보통약관으로 쓰는 상품이 없다."}</p>
        <p className="ts-empty-example">
          {docKind === "special"
            ? "미리보기는 고른 상품의 조립 문맥으로 이 조를 조립한다. 기본계약으로만 탑재한 상품은 보통약관 조를 대치하므로 여기 서지 않는다."
            : "미리보기는 고른 상품의 기본계약 문맥으로 이 조를 조립한다. 상품 기본정보에서 이 템플릿을 보통약관으로 고르면 여기 선다."}
        </p>
        <p className="ts-empty-action">
          <Link href="/products">상품 목록으로 →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="ts-preview-tab">
      <div className="ts-form-row">
        <label htmlFor="ts-preview-product">상품</label>
        <NativeSelect id="ts-preview-product" value={selected ? keyOf(selected) : ""} onChange={(e) => selection.pick(e.target.value)}>
          {products.map((p) => (
            <option key={keyOf(p)} value={keyOf(p)}>
              {labelOf(p, products)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <p className="ts-muted">{editing ? "편집본" : "저장본"}을 이 상품의 조립 문맥으로 — 조립 결과와 같은 본문 · 번호.</p>
      {!articleId ? (
        <p className="ts-muted">미리 볼 조가 없다.</p>
      ) : !outcome ? (
        <p className="ts-muted" aria-busy="true">
          상품 재료를 받는 중…
        </p>
      ) : !outcome.ok ? (
        <p className="ts-error-banner">상품 재료를 받지 못했다 — {outcome.message}</p>
      ) : preview ? (
        // 출처 패널 안의 같은 문서 링크는 편집기의 「떠나기」 확인을 거치지 않는다(data-src-inpage) — 가운데에서 연다
        <div data-src-inpage onClick={(e) => sameDocumentNode(e, openNode)}>
          <SourceOverlay {...(source ? { content: source } : {})} {...(open?.node ? { focus: open.node } : {})} onClose={() => setSrc(undefined)}>
            <PanelClicks onPick={pick}>
              <Result preview={preview} docKind={docKind} owner={selected?.productCoverageId ?? ""} />
            </PanelClicks>
          </SourceOverlay>
        </div>
      ) : null}
    </div>
  );
}
