import { AssemblyCheckLine } from "@/app/_components/AssemblyCheckLine";
import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { ErrorBanner } from "@/app/_components/ErrorBanner";
import { IssueList } from "@/app/_components/IssueList";
import { RenderedBlocksView, RenderedDoc, RenderedGroupView } from "@/app/_components/RenderedDoc";
import { bookletForm, FIRST_SECTION_NAME } from "@/domain/assembly";
import { containedReason, ENTITY_LABEL, OMISSION_LABEL } from "@/app/_lib/labels";
import { formatDateTime } from "@/app/_lib/list";
import { currentActor, getServices } from "@/lib/services";
import type { SourcePanelContent } from "@/app/_components/sourcePanel/SourcePanel";
import { panelQuery, parsePanelQuery, pendingPanel } from "@/app/_components/sourcePanel/query";
import type { DocOmission, DocSelection } from "@/app/_components/RenderedDoc";
import type { DocumentNode } from "@/domain/document";

import { runPreviewAction } from "../../actions";
import { articleCount, excludedClauseLabel, omissionCounts, omissionPairLabel, omissionPairVerdict } from "../../lib";
import { omissionSlots } from "./omissionSlots";
import { OmittedToggle, PreviewPanelHost } from "@/app/_components/sourcePanel/PanelHost";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * 조립 미리보기 — **저장된 산출본**을 보여 준다 (기능/조립산출 §3.6). 매 요청 조립하지 않는다.
 *
 * - 저장본 없음: 「실행」 버튼만. 실행하면 지금 입력으로 조립해 저장한다.
 * - 저장본 있음: 생성 시각 · 실행자 + 본문. 생성 이후 입력이 바뀌었으면(`stale`) 「오래된 결과」 배지 —
 *   결과는 지우지 않고 배지가 붙은 채 남긴다(기능/조립산출 §3.6). 「다시 실행」 만이 산출본을 바꾼다.
 * - 머리의 두 줄: 규모(먼저 읽히는 숫자는 전체 규모 — 디자인원칙 §9.6) · 조립 검사/내용 검토(디자인원칙 §9.2).
 * - 「조연결 판정」 절(기능/조립산출 §4.1): 조연결된 조마다 판정 배지 · 미합의 사유, 펼치면 항별 대조 표와 비교 제외 함수조항.
 *   생략된 조는 본문에서 사라지므로 근거는 여기서만 열린다.
 * - 절 형태(주계약 기본계약 2+ · 독립특약 — `bookletForm`)면 본문이 책자 제목 → 「제1절 일반조항」 → 「제2절 보장조항」(그룹 머리 · 블록 머리 · 블록 조)
 *   → (특약 그룹) → 별표다. 형태가 없는 옛 산출본은 대치 형태로 읽는다. 판정 패널 · 배지는 ⑤.
 * - 출처 패널(기능/조립산출 §3.7 · §4.1 · ADR-0092): 조를 누르면 오른쪽 고정 패널 — URL `?article=<조 id>`(특약 · 블록 조면 `&pc=<상품담보 id>`,
 *   값 조각 · 막힌 분기 강조 `&node=`)이 상태라 새로고침해도 같은 패널이다. 패널 재료는 서버가 그 URL 로 설명 모드 조립(`assembly.explain`) —
 *   저장본이 오래됐으면 패널 대신 「입력이 바뀌어 출처를 볼 수 없습니다 — 다시 실행」.
 * - 생략 자리: 생략된 특약 조 · 제1절에서 생략 · 분리된 블록 조를 원래 자리에 회색 한 줄로 끼운다(책자는 그대로). 「생략 자리 보기」(`&omitted=off` 끔).
 * - 조립 검사 한 줄의 「평가 대기 c」 — 막힌 분기 목록(「미리보기에서 보기」 = 그 조 패널 + 그 분기 강조 · 「고치러 가기」).
 */
export default async function ProductPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; article?: string; pc?: string; node?: string; omitted?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { error } = sp;
  const panel = parsePanelQuery(sp);
  const services = getServices();
  await currentActor();
  const [product, record] = await Promise.all([services.product.getProduct(id), services.assembly.latest(id)]);

  if (!product) {
    return (
      <div>
        <Breadcrumb items={[{ label: ENTITY_LABEL.product, href: "/products" }, { label: id, href: `/products/${id}` }, { label: "미리보기" }]} />
        <p className="ts-error-banner">찾을 수 없습니다 — 상품</p>
      </div>
    );
  }

  const head = (
    <div className="ts-page-head">
      <Breadcrumb items={[{ label: ENTITY_LABEL.product, href: "/products" }, { label: product.name, href: `/products/${id}` }, { label: "미리보기" }]} />
    </div>
  );
  // 다시 실행 뒤에도 같은 패널 · 생략 자리 설정으로 돌아온다
  const panelAfterRun = { ...(panel.target ? { target: panel.target } : {}), ...(panel.node ? { node: panel.node } : {}), showOmitted: panel.showOmitted };
  const runForm = (label: string, primary: boolean) => (
    <form action={runPreviewAction.bind(null, id, panelAfterRun)} style={{ display: "inline" }}>
      <Button type="submit" className={primary ? "primary" : undefined}>
        {label}
      </Button>
    </form>
  );

  if (!record) {
    return (
      <div>
        {head}
        <ErrorBanner message={error} />
        <p className="ts-muted">아직 실행하지 않았습니다 — 실행하면 지금 입력으로 조립해 저장합니다.</p>
        <div>{runForm("실행", true)}</div>
      </div>
    );
  }

  const booklet = record.booklet;
  const users = await services.auth.listUsers();
  const runner = (record.generatedBy && users.find((u) => u.id === record.generatedBy)?.name) ?? "—";

  const specialDocs = booklet.specials.flatMap((g) => g.docs);
  const generalArticles = articleCount(booklet.general);
  const sectioned = bookletForm(booklet) === "sectioned";
  const blockCount = (booklet.blocks ?? []).reduce((n, g) => n + g.docs.length, 0);
  // 조연결 판정 절(기능/조립산출 §4.1)이 생기기 전에 저장된 산출본의 판정 기록에는 pairs · excludedClauseNodeIds 가 없다 — 입력이 안 바뀌면 stale 도 아니라서
  // 「다시 실행」 전까지는 근거 없는 행으로 그린다 (화면이 죽지 않게).
  const records = booklet.omitted.map((o) => ({ ...o, pairs: o.pairs ?? [], excludedClauseNodeIds: o.excludedClauseNodeIds ?? [] }));
  const counts = omissionCounts(records);
  // 비교 제외 함수조항의 이름 — 보통약관 템플릿 트리 + 함수조항 라벨 (판정 절에 그 노드가 있을 때만 읽는다)
  const needsClauseNames = records.some((o) => o.excludedClauseNodeIds.length > 0);
  const [generalTemplate, clauses] = needsClauseNames
    ? await Promise.all([product.generalDocumentId ? services.document.get(product.generalDocumentId) : undefined, services.clause.list()])
    : [undefined, []];
  const clauseLabelOf = (code: string) => clauses.find((c) => c.code === code)?.label;

  // 출처 패널 — URL 이 가리키는 조를 저장본 기준으로 설명한다 (오래됐으면 stale)
  let content: SourcePanelContent | undefined;
  if (panel.target) {
    const r = await services.assembly.explain(id, panel.target);
    content = r.ok ? r.value : { state: "error", message: r.rejection.reason === "notFound" ? "찾을 수 없습니다 — 상품" : "출처를 계산하지 못했습니다" };
  }
  const selection: DocSelection | undefined = panel.target ? (panel.target.document === "general" ? { document: "general", articleId: panel.target.articleId } : { document: "special", ownerId: panel.target.productCoverageId, articleId: panel.target.articleId }) : undefined;

  // 생략 자리 — 생략 · 제1절 생략/분리 블록 조가 있는 상품담보의 담보약관 모델만 읽는다
  let omissions: Map<string, DocOmission[]> | undefined;
  if (panel.showOmitted) {
    const coverageOf = new Map(booklet.trace.map((t) => [t.productCoverageId, t.coverageId] as const));
    const pcs = new Set([
      ...records.filter((o) => o.disposition === "omitted").map((o) => o.productCoverageId),
      ...(booklet.firstSection ?? []).flatMap((f) => f.blocks.filter((b) => b.treatment === "omitted" || b.treatment === "split").map((b) => b.productCoverageId)),
    ]);
    const coverageIds = [...new Set([...pcs].flatMap((pc) => (coverageOf.has(pc) ? [coverageOf.get(pc)!] : [])))];
    const docs = new Map<string, DocumentNode>();
    for (const doc of await Promise.all(coverageIds.map((c) => services.document.findByCoverage(c)))) if (doc?.ownerId) docs.set(doc.ownerId, doc.tree);
    omissions = omissionSlots({ ...booklet, omitted: records }, docs, coverageOf);
  }
  const rerun = runForm("다시 실행", true);

  return (
    <div>
      <p className="ts-count">
        규모: {sectioned ? <>제1절 {generalArticles}조 · 블록 {blockCount}</> : <>보통약관 {generalArticles}조</>} · 특약 {specialDocs.length}건 · 별표 {booklet.appendices.length}
        {records.length > 0 && <> · 생략 {counts.omitted}조</>}
      </p>
      <AssemblyCheckLine
        issues={booklet.issues}
        pending={booklet.pending}
        viewHref={(p) => {
          const q = pendingPanel(p);
          return q ? panelQuery({ ...q, showOmitted: panel.showOmitted }) : undefined;
        }}
      />
      {head}
      <ErrorBanner message={error} />
      {/* <form> 은 <p> 안에 못 선다 — div 로 (hydration 오류) */}
      <div className="ts-count" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 8px" }}>
        <span>
          {formatDateTime(record.generatedAt)} 기준 · {runner}
        </span>
        {record.stale && <span className="ts-badge warning">오래된 결과 — 생성 이후 입력이 바뀌었습니다</span>}
        {runForm("다시 실행", record.stale)}
        <OmittedToggle state={panel} />
      </div>
      {!booklet.complete && <p className="ts-error-banner">「완성본 아님」 — 아래 조립 검사 결과를 확인하세요.</p>}

      <PreviewPanelHost content={content} state={panel} rerun={rerun}>
      <section className="ts-section">
        <h2 className="ts-section-title">조립 검사 결과</h2>
        {booklet.issues.length === 0 ? <p className="ts-ok">오류 없음.</p> : <IssueList issues={booklet.issues} />}
      </section>

      {records.length > 0 && (
        <section className="ts-section">
          <h2 className="ts-section-title">
            조연결 판정{" "}
            <span className="ts-count">
              {records.length}건 · 생략 {counts.omitted} · 준용 {counts.applied} · 통째 {counts.full}
            </span>
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {records.map((o, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <details>
                  <summary style={{ cursor: "pointer" }}>
                    {o.productCoverageName} › {o.articleTitle}{" "}
                    <span className={o.reason ? "ts-badge warning" : "ts-badge"}>{OMISSION_LABEL[o.disposition]}</span>
                    {o.reason && <span className="ts-muted"> · {o.reason}</span>}
                    {o.delegated && <span className="ts-muted"> · 제1절에서 위임된 조 — 판정하지 않음</span>}
                    {o.disposition === "omitted" && o.basis === "contained" && o.omitRule && <span className="ts-muted"> · {containedReason(o.omitRule.source)}</span>}
                  </summary>
                  <div style={{ margin: "6px 0 4px 16px" }}>
                    {o.pairs.length === 0 ? (
                      <p className="ts-muted">{o.delegated ? "항 대조 없음 — 연결한 템플릿 조가 제1절에서 위임되어(제2절 보장조항에서 정함) 견줄 마스터가 없습니다." : "항 대조 없음 — 보통약관 조가 없거나 오류 마커가 있어 비교하지 않았습니다."}</p>
                    ) : (
                      <table className="ts-table">
                        <thead>
                          <tr>
                            <th>담보 항</th>
                            <th>보통약관 항</th>
                            <th>대조</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.pairs.map((pair, j) => (
                            <tr key={j}>
                              <td>{pair.special === null ? <span className="ts-muted">— (담보 항 없음)</span> : omissionPairLabel(pair.special, pair.specialKind)}</td>
                              <td>{pair.general === null ? <span className="ts-muted">— (보통약관에 없는 항)</span> : omissionPairLabel(pair.general, pair.generalKind)}</td>
                              <td>
                                <PairVerdict verdict={omissionPairVerdict(pair, o)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {o.excludedClauseNodeIds.length > 0 && (
                      <p className="ts-count">비교 제외: {o.excludedClauseNodeIds.map((nodeId) => excludedClauseLabel(generalTemplate?.tree, nodeId, clauseLabelOf)).join(" · ")}</p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sectioned ? (
        <>
          <h2 className="ts-h2">
            {booklet.title} <span className="ts-count">제1절 {generalArticles}조 · 블록 {blockCount}</span>
          </h2>
          {booklet.general ? <RenderedDoc doc={booklet.general} heading={FIRST_SECTION_NAME} selection={selection} /> : <p className="ts-muted">보통약관 템플릿이 없습니다.</p>}
          <RenderedBlocksView groups={booklet.blocks ?? []} selection={selection} omissions={omissions} />
        </>
      ) : (
        <>
          <h2 className="ts-h2">
            보통약관 <span className="ts-count">{generalArticles}조</span>
          </h2>
          {booklet.general ? <RenderedDoc doc={booklet.general} selection={selection} /> : <p className="ts-muted">보통약관 템플릿이 없습니다.</p>}
        </>
      )}

      {/* 독립특약은 탑재 상품담보가 모두 블록이라 특약 그룹이 없다 */}
      {(!sectioned || specialDocs.length > 0) && (
        <>
          <h2 className="ts-h2">
            특약 그룹 <span className="ts-count">{specialDocs.length}건</span>
          </h2>
          {booklet.specials.map((g) => (
            <RenderedGroupView key={g.id} group={g} selection={selection} omissions={omissions} />
          ))}
        </>
      )}

      <h2 className="ts-h2">
        별표 <span className="ts-count">{booklet.appendices.length}건</span>
      </h2>
      <ul>
        {booklet.appendices.map((a) => (
          <li key={a.code}>
            【별표{a.number}({a.name})】
          </li>
        ))}
      </ul>
      </PreviewPanelHost>
    </div>
  );
}

/** 항 대조 판정 칸 — 불일치는 경고 배지, 포함 생략의 「보통약관에만」은 중립 배지 (ADR-0093). */
function PairVerdict({ verdict }: { verdict: ReturnType<typeof omissionPairVerdict> }) {
  if (verdict === "일치") return <>일치</>;
  return <span className={verdict === "불일치" ? "ts-badge warning" : "ts-badge"}>{verdict}</span>;
}
