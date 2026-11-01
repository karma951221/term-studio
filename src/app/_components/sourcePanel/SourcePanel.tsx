"use client";

/**
 * 출처 패널 (ADR-0092 · 기능/조립산출 §3.7 · §4.1) — 조 하나의 「덧칠한 원본」. 화면마다 그대로 끼우는 독립 부품이다:
 * 책자 미리보기(오른쪽 고정 패널) · 상품 보통약관 · 특별약관 탭 · 상품담보 미리보기 · 문면 편집기 미리보기 탭(3단계).
 *
 * 입력은 설명 결과(서비스 `explain` · `buildSourceView`) 또는 상태(`stale` 오래된 결과 · `notRun` · `error`), 닫기 콜백.
 * - 머리: 결과 자리 · 원본 종류(템플릿 / 사본 / 담보약관) · 대치 한 줄 · 제1절 판정 배지 · 원본으로 가는 아이콘 버튼 · 상품 구성 · ✕.
 * - 본문: status 별 문구(생략 판정 근거 · 조건으로 빠짐 · 노출 끔 · 조립이 만든 조) + 덧칠한 원본(블록 여럿이면 블록 탭).
 * - 이동은 아이콘 버튼 + tooltip 뿐 — 「← 미리보기로」 류 링크를 두지 않는다(경로 원칙).
 */
import { useMemo, useState, type ReactNode } from "react";

import type { ConditionDecision, OmissionPair, SourceView } from "@/domain/assembly";
import { containedReason } from "@/app/_lib/labels";
import { foldTitle } from "@/domain/document/title";

import { IconButton, IconClose, IconLink, IconPanel } from "../icons";
import { indexDecisions } from "./overlay";
import { links } from "./overlay";
import { Blocks, DecisionList, GoLink, Inlines, rootCtx } from "./OverlayTree";

export type SourcePanelContent = { state: "ok"; view: SourceView } | { state: "stale" } | { state: "notRun" } | { state: "error"; message: string };

export interface SourcePanelProps {
  content: SourcePanelContent;
  /** 강조할 원본 자리(원본 자리 id) — 누른 값 조각 · 막힌 분기. */
  focus?: string;
  onClose: () => void;
  /** 오래된 결과 · 실행 전의 「다시 실행」(화면의 실행 폼). 없으면 문구만. */
  rerun?: ReactNode;
}

const PAIR_KIND: Record<string, string> = { table: "표", box: "박스", bulletList: "글머리 목록", error: "오류" };
const pairLabel = (n: number | null, kind?: string) => (n === null ? "—" : kind ? `${PAIR_KIND[kind] ?? kind} ${n}` : `제${n}항`);

/** `contained` — 포함 생략의 대조: 보통약관에만 있는 항(`special: null`)은 불일치가 아니라 중립 「보통약관에만」 (ADR-0093). */
function PairsTable({ pairs, contained }: { pairs: readonly OmissionPair[]; contained?: boolean }) {
  if (pairs.length === 0) return <p className="ts-muted">항 대조 없음.</p>;
  return (
    <table className="ts-table ts-src-pairs">
      <thead>
        <tr>
          <th>담보 항</th>
          <th>보통약관 항</th>
          <th>대조</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((p, i) => (
          <tr key={i}>
            <td>{pairLabel(p.special, p.specialKind)}</td>
            <td>{pairLabel(p.general, p.generalKind)}</td>
            <td>{p.matched ? "일치" : contained && p.special === null ? <span className="ts-badge">보통약관에만</span> : <span className="ts-badge warning">불일치</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 준용예외 판정 근거 (ADR-0098 결정 7) — 구분자 하나의 조마다 넣음 / 안 넣음 · 갈래 · 사유. */
function ExclusionTable({ exclusion }: { exclusion: NonNullable<SourceView["exclusions"]>[number] }) {
  return (
    <section className="ts-src-note" aria-label={`${exclusion.label} 판정`}>
      <p className="ts-src-label">
        {exclusion.label} 판정 — {exclusion.context === "block" ? "블록(후보만)" : "특약"}
      </p>
      {exclusion.rows.length === 0 ? (
        <p className="ts-muted">판정할 조 없음 — 이 상품 보통약관에 후보 조가 없습니다.</p>
      ) : (
        <table className="ts-table ts-src-pairs">
          <thead>
            <tr>
              <th>보통약관 조</th>
              <th>결과</th>
              <th>갈래 · 사유</th>
            </tr>
          </thead>
          <tbody>
            {exclusion.rows.map((r) => (
              <tr key={r.articleId}>
                <td>{r.label}</td>
                <td>{r.included ? <span className="ts-badge">넣음</span> : <span className="ts-muted">안 넣음</span>}</td>
                <td>{r.reason ? `${r.branch} · ${r.reason}` : r.branch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function SourcePanel({ content, focus, onClose, rerun }: SourcePanelProps) {
  const close = <IconButton label="출처 패널 닫기" icon={<IconClose />} onClick={onClose} className="ts-src-close" />;
  if (content.state !== "ok") {
    const text =
      content.state === "stale" ? "입력이 바뀌어 출처를 볼 수 없습니다 — 다시 실행" : content.state === "notRun" ? "아직 실행하지 않았습니다 — 실행하면 출처를 볼 수 있습니다" : content.message;
    return (
      <aside className="ts-src-panel" aria-label="출처">
        <div className="ts-src-head">
          <span className="ts-src-place">출처</span>
          {close}
        </div>
        <p className={content.state === "error" ? "ts-error-banner" : "ts-src-blocked"} role="status">
          {text}
        </p>
        {content.state !== "error" && rerun}
      </aside>
    );
  }
  return <Loaded view={content.view} focus={focus} close={close} />;
}

function Loaded({ view, focus, close }: { view: SourceView; focus?: string; close: ReactNode }) {
  const e = view.explanation;
  const [tab, setTab] = useState(0);
  const source = e.sources[tab];
  const sv = view.sources[tab];
  const index = useMemo(() => indexDecisions([...(source?.enclosing ?? []), ...(source?.decisions ?? [])]), [source]);
  const ctx = rootCtx(view, index, focus, sv?.nodeLabels ? { nodeLabels: sv.nodeLabels } : undefined);
  const title = sv?.article ? foldTitle(sv.article.title) : "";
  // 포함 생략 (ADR-0093 결정 6) — 옛 기록(사유 없음)은 「와 같음」 그대로
  const contained = e.omission?.disposition === "omitted" && e.omission.basis === "contained";

  return (
    <aside className="ts-src-panel" aria-label="출처">
      <div className="ts-src-head">
        <span className="ts-src-place">{view.place || "출처"}</span>
        {sv && <span className="ts-badge">{sv.kindLabel}</span>}
        {view.verdict && (
          <span className="ts-badge ts-verdict-badge" title="이 상품 제1절 판정">
            {view.verdict}
          </span>
        )}
        <span className="ts-src-head-tools">
          {source && <GoLink href={links.source(view, tab)} label={`원본 조 열기 · ${sv?.documentTitle ?? ""} 「${title}」`} icon={<IconLink />} />}
          {source?.productCoverageId && <GoLink href={links.productCoverage(view, source.productCoverageId)} label={`상품 구성 열기 · ${source.productCoverageName ?? ""}`} icon={<IconPanel />} />}
          {source?.fills?.via === "replace" && <GoLink href={links.baseContract(view)} label="상품 구성 열기 · 기본계약" icon={<IconPanel />} />}
          {close}
        </span>
      </div>
      {sv?.fillLine && <p className="ts-src-fill">{sv.fillLine}</p>}
      {view.sources.length > 1 && (
        <div className="ts-src-tabs" role="tablist" aria-label="블록">
          {view.sources.map((s, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === tab} className={i === tab ? "ts-src-tab is-active" : "ts-src-tab"} onClick={() => setTab(i)}>
              {s.tabLabel}
            </button>
          ))}
        </div>
      )}

      {e.system && <p className="ts-src-note">조립이 만든 조 — 모델링 원본이 없습니다 (준용규정 최소형 등 시스템 문장).</p>}
      {e.status === "hidden" && <p className="ts-src-note">이 상품에서 노출을 끈 조 — 결과에 찍지 않습니다.</p>}
      {e.status === "omitted" && (
        <section className="ts-src-note">
          <p>
            이 상품 결과에서 생략 — {view.linkedLabel ? `${e.firstSection ? "제1절" : "보통약관"} ${view.linkedLabel}${contained ? "에 포함됨" : "와 같음"}` : contained ? "보통약관 조에 포함됨" : "보통약관 조와 같음"}
            {source?.treatment && source.treatment !== "listed" && <> (블록 조 {source.treatment === "omitted" ? "생략" : source.treatment === "split" ? "분리" : "통째"})</>}
          </p>
          {e.omission && (
            <>
              {contained && e.omission.omitRule && <p className="ts-muted">{containedReason(e.omission.omitRule.source)}</p>}
              <PairsTable pairs={e.omission.pairs ?? []} contained={contained} />
              {e.omission.reason && <p className="ts-muted">{e.omission.reason}</p>}
            </>
          )}
        </section>
      )}
      {e.status === "absent" && !e.system && (
        <section className="ts-src-note">
          <p>{source?.enclosing && source.enclosing.length > 0 ? "이 상품에서는 조건으로 빠짐" : "이 상품 결과에 없음"}</p>
        </section>
      )}
      {source?.enclosing && source.enclosing.length > 0 && (
        <section className="ts-src-enclosing" aria-label="조 자리 조건">
          <p className="ts-src-label">조 자리 조건</p>
          <DecisionList decisions={source.enclosing as ConditionDecision[]} ctx={ctx} />
        </section>
      )}
      {e.omission?.disposition === "applied" && e.status === "shown" && <p className="ts-src-note">준용 — 보통약관 {view.linkedLabel ?? "조"}를 준용하는 문구로 남았습니다.</p>}
      {view.exclusions?.map((x) => <ExclusionTable key={x.code} exclusion={x} />)}

      {sv?.article ? (
        <div className="ts-src-body ts-doc">
          <h3 className="ts-src-title">
            <Inlines nodes={sv.article.title} ctx={ctx} />
          </h3>
          <Blocks nodes={sv.article.children} ctx={ctx} />
        </div>
      ) : (
        !e.system && e.sources.length === 0 && <p className="ts-muted">원본을 찾을 수 없습니다.</p>
      )}
    </aside>
  );
}
