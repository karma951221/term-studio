import Link from "next/link";
import { AssemblyCheckLine } from "@/app/_components/AssemblyCheckLine";
import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { IssueList } from "@/app/_components/IssueList";
import { RenderedDoc, type DocSelection } from "@/app/_components/RenderedDoc";
import { OmittedToggle, PreviewPanelHost } from "@/app/_components/sourcePanel/PanelHost";
import type { SourcePanelContent } from "@/app/_components/sourcePanel/SourcePanel";
import { panelQuery, parsePanelQuery, pendingPanel } from "@/app/_components/sourcePanel/query";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { specialAsBooklet } from "@/domain/assembly";
import type { DocumentNode } from "@/domain/document";
import { buildForm, type SnapshotContext } from "@/forms";
import { currentActor, getServices } from "@/lib/services";

import type { SnapshotOwner } from "@/services/product";

import { productDetailPath, type ProductTab } from "../../../lib";
import { ProductEditProvider } from "../../_components/ProductEdit";
import { omissionSlots } from "../../preview/omissionSlots";

import type { SnapshotOwnerModel } from "./lib";
import { PcValues, type PcTree } from "./PcValues";

export const dynamic = "force-dynamic";

/**
 * 상품담보 값 화면 + 상품담보 미리보기(실시간 — 저장하지 않음).
 *
 * 값 (기능/상품 §4.8, M12 재작성): 읽기로 시작 · `편집` → `[취소] [저장]` — 저장 하나가 모든 노드의 값 · 특성을 한 트랜잭션으로(`PcValues`).
 * 서버는 노드마다 저장값 + 지금 마스터 값으로 폼 모델을 지어 넘긴다 — 가져오기 아이콘 · 「마스터에는 면책 있음」이 그것을 본다.
 *
 * 출처 패널 (기능/조립산출 §4.2 · ADR-0092): 미리보기의 조를 누르면 미리보기 오른쪽 고정 패널 — URL `?article=<조 id>&pc=<상품담보 id>[&node=]`
 * (책자 미리보기와 같은 쿼리). 본문과 같은 지금 입력으로 설명하므로 오래된 결과 차단이 없다(`assembly.explainLive`).
 * 생략된 조는 원래 자리에 회색 한 줄(「생략 자리 보기」 `&omitted=off` 로 끔), 「평가 대기」 목록의 「미리보기에서 보기」는 그 조 패널 + 분기 강조.
 */
export default async function ProductCoverageDetailPage({ params, searchParams }: { params: Promise<{ id: string; pcId: string }>; searchParams?: Promise<{ article?: string; pc?: string; node?: string; omitted?: string }> }) {
  const { id, pcId } = await params;
  const panel = parsePanelQuery((await searchParams) ?? {});
  const services = getServices();
  await currentActor();

  const snap = await services.product.getSnapshot(pcId);
  if (!snap.ok) {
    return (
      <div>
        <Breadcrumb items={[{ label: ENTITY_LABEL.product, href: "/products" }, { label: id, href: productDetailPath(id) }, { label: pcId }]} />
        <p className="ts-error-banner">찾을 수 없습니다.</p>
      </div>
    );
  }
  const pc = snap.value;
  const [product, values, enumsList, preview, completeness, masterValues] = await Promise.all([
    services.product.getProduct(id),
    services.product.getSnapshotValues(pcId),
    services.catalog.listEnums(),
    services.assembly.previewSpecial(id, pcId),
    services.product.coverageCompleteness(pcId),
    services.product.getSnapshotMasterValues(pcId),
  ]);
  // 출처 패널 — 지금 입력으로 설명 (본문도 지금 계산이라 오래된 결과가 없다)
  let content: SourcePanelContent | undefined;
  if (panel.target) {
    const r = await services.assembly.explainLive(id, panel.target);
    content = r.ok ? { state: "ok", view: r.value } : { state: "error", message: r.rejection.reason === "notFound" ? "찾을 수 없습니다 — 상품" : "출처를 계산하지 못했습니다" };
  }
  const selection: DocSelection | undefined = panel.target?.document === "special" ? { document: "special", ownerId: panel.target.productCoverageId, articleId: panel.target.articleId } : undefined;
  // 생략 자리 — 특약 조 생략 · 제1절 생략/분리 블록 조를 담보약관 모델 순서로 끼운다 (책자 미리보기와 같은 재료)
  let omissions: ReturnType<typeof omissionSlots> | undefined;
  if (panel.showOmitted && preview.ok) {
    const doc = await services.document.findByCoverage(pc.coverageId);
    omissions = doc ? omissionSlots(specialAsBooklet(preview.value), new Map<string, DocumentNode>([[pc.coverageId, doc.tree]]), new Map([[pcId, pc.coverageId]])) : undefined;
  }
  /** 돌아갈 탭 — 기본계약이든 특약이든 상품담보 탭이다 (기능/상품 §3.8 · 2026-09-28). */
  const backTab: ProductTab = "coverages";
  const enumLookup = (code: string) => enumsList.find((e) => e.code === code);
  /** 노드 하나의 값 폼 모델 — 저장값 + 지금 마스터 값(가져오기 · 「마스터에는 면책 있음」의 재료, 기능/상품 §3.4). */
  const ownerModel = (level: "coverage" | "subCoverage" | "benefit", kind: SnapshotOwner["kind"], ownerId: string, masterLabel: string): SnapshotOwnerModel => {
    const master = masterValues.get(ownerId);
    const snapshot: SnapshotContext | undefined = master ? { masterLabel, masterValues: master } : undefined;
    return { owner: { kind, id: ownerId }, model: buildForm(level, enumLookup, values.get(ownerId) ?? new Map(), snapshot) };
  };
  const owners: SnapshotOwnerModel[] = [
    ownerModel("coverage", "productCoverage", pc.id, `${pc.coverageName} (마스터)`),
    ...pc.subCoverages.flatMap((s) => [
      ownerModel("subCoverage", "productSubCoverage", s.id, `${s.name} (마스터)`),
      ...s.benefits.map((b) => ownerModel("benefit", "productBenefit", b.id, `${b.name} (마스터)`)),
    ]),
  ];
  const tree: PcTree = {
    id: pc.id,
    name: pc.name,
    subCoverages: pc.subCoverages.map((s) => ({ id: s.id, key: s.key, name: s.name, benefits: s.benefits.map((b) => ({ id: b.id, key: b.key, name: b.name })) })),
  };
  // 저장값 · 마스터 값 · 구조가 바뀌면(저장 뒤 refresh) 초안을 새 진실로 다시 세운다
  const signature = JSON.stringify([tree, owners.map((o) => o.model.fields.map((f) => [f.path, f.state, f.value ?? null, f.masterValue ?? null]))]);

  /** 값 자리 하나로 가는 앵커 — 미입력 목록의 「고치러 가기」. */
  const slotAnchor = (ownerId: string) => `#own-${ownerId}-values`;

  return (
    <ProductEditProvider canEdit>
      <PcValues
        key={signature}
        productId={id}
        productName={product?.name ?? id}
        productHref={productDetailPath(id, backTab)}
        coverageId={pc.coverageId}
        coverageName={pc.coverageName}
        tree={tree}
        owners={owners}
        missing={
          completeness.missing.length > 0 && (
            <section className="ts-section">
              <h2 className="ts-section-title">미입력</h2>
              <ul>
                {completeness.missing.map((m, i) => (
                  <li key={i}>
                    {m.ownerName} › {m.path} · <Link href={slotAnchor(m.owner.id)}>고치러 가기</Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        }
      />

      <section className="ts-section">
        <h2 className="ts-section-title">
          상품담보 미리보기
          {preview.ok && <span className="ts-count">조 {preview.value.doc.children.flatMap((n) => (n.kind === "section" ? n.children : [n])).filter((n) => n.kind === "article").length}</span>}
        </h2>
        {/* 상품 미리보기(저장본)와 달리 이 절은 매 요청 실시간 계산이다 — 저장하지 않는다 (기능/조립산출 §3.6). */}
        <p className="ts-muted">지금 계산한 결과 (저장하지 않음)</p>
        {preview.ok ? (
          <>
            {/* 평가 대기 목록의 「미리보기에서 보기」 — 그 조의 출처 패널 + 그 분기 강조, 미리보기의 그 조로 내려간다 */}
            <AssemblyCheckLine
              issues={preview.value.issues}
              pending={preview.value.pending}
              viewHref={(p) => {
                const q = pendingPanel(p);
                return q?.target ? `${panelQuery({ ...q, showOmitted: panel.showOmitted })}#node-${q.target.articleId}` : undefined;
              }}
            />
            {!preview.value.complete && <p className="ts-error-banner">완성본 아님 — 아래 오류를 확인하세요.</p>}
            <IssueList issues={preview.value.issues} />
            <div className="ts-count" style={{ margin: "0 0 8px" }}>
              <OmittedToggle state={panel} />
            </div>
            <PreviewPanelHost content={content} state={panel}>
              <RenderedDoc doc={preview.value.doc} selection={selection} omissions={omissions?.get(pcId)} />
            </PreviewPanelHost>
          </>
        ) : (
          <p className="ts-error-banner">{preview.rejection.reason}</p>
        )}
      </section>
    </ProductEditProvider>
  );
}
