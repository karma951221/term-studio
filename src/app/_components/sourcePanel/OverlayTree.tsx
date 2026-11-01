"use client";

/**
 * 덧칠한 원본 (ADR-0092 결정 1 · 기능/조립산출 §3.7) — 모델링 원본(문면 노드 트리)을 그 모양대로 그리고 실행 결과를 덧칠한다.
 *
 * - 조건 분기: 가지마다 머리 줄(IF · ELIF · 그 밖 — 조건식) + 표식(탐 · 거짓 · 평가 안 함 · 막힘) + 그 식이 읽은 「구분자 = 유효값」. 탄 가지만 진하게.
 * - 값별 분기: 판단 값 + 칸(값 이름), 고른 칸만 진하게. 칸 없는 값 · 막힘도 표시.
 * - 값 자리(슬롯): 〔슬롯〕 옆에 결과에 들어간 값.
 * - 함수조항: 접힌 호출 줄(인자 ← 구분자 = 값 · 고른 옵션 · 상품 옵션) → 펼치면 본문을 같은 방식으로(안의 호출도 한 단계씩).
 * - 반복 · 동적표: 원소(행 · 정액형은 표) 탭 — 결과에서 누른 원소 · 칸이 처음부터 골라진다. 원소 0개는 회색 문구 + 「비었을 때」 칸.
 * 회색(`is-dim`)은 안 탄 가지 · 평가하지 않은 자리의 안쪽 전부다. 원본 자리 id 는 `overlay.ts` 규칙(§3.4 와 같은 체계).
 */
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { findTableDiscriminator } from "@/domain/dyntable/system";
import type { ClauseDecision, ConditionDecision, DecisionRecord, DynTableDecision, RepeatDecision, SourceView, SwitchDecision } from "@/domain/assembly";
import { optionCodeOf, repeatLabel, type BlockNode, type InlineNode } from "@/domain/document";
import { particlePreset } from "@/domain/document/particles";

import { IconFx, IconLink } from "../icons";
import { argText, BRANCH_OUTCOME_LABEL, clauseScope, dynRowForNode, elementForNode, elementScope, exprText, keyOf, links, readsText, ROOT_SCOPE, slotText, type ExprAt, type Scope } from "./overlay";
import { Button } from "@/components/ui/button";

export interface OverlayCtx {
  view: SourceView;
  index: ReadonlyMap<string, DecisionRecord>;
  /** 강조할 원본 자리 — 누른 값 조각 · 막힌 분기. */
  focus?: string;
  scope: Scope;
  /** 안 탄 가지 · 평가하지 않은 자리의 안쪽. */
  dim: boolean;
  /** 식이 놓인 자리 — 조건식 한국어 표기의 재료(펼친 함수조항 · 원본 담보의 노드 머리). */
  at?: ExprAt;
}

export function rootCtx(view: SourceView, index: ReadonlyMap<string, DecisionRecord>, focus?: string, at?: ExprAt): OverlayCtx {
  return { view, index, ...(focus ? { focus } : {}), scope: ROOT_SCOPE, dim: false, ...(at ? { at } : {}) };
}

/** 조건식 — 한국어 표기, 원문 식은 툴팁 (기능/조립산출 §3.7). */
export function ExprView({ source, ctx }: { source: string; ctx: Pick<OverlayCtx, "view" | "at"> }) {
  return (
    <span className="ts-src-expr" title={`원문 — ${source}`}>
      {exprText(source, ctx.view, ctx.at)}
    </span>
  );
}

/** 원본 자리 하나 — 강조 대상이면 표시하고 스크롤해 보인다. */
function Spot({ ctx, id, className, title, children, as = "span" }: { ctx: OverlayCtx; id: string; className?: string; title?: string; children: ReactNode; as?: "span" | "div" }) {
  const key = keyOf(ctx.scope, id);
  const focused = ctx.focus === key;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [focused]);
  const Tag = as;
  return (
    <Tag ref={ref as never} data-node={key} title={title} className={[className, focused ? "is-focus" : null].filter(Boolean).join(" ") || undefined}>
      {children}
    </Tag>
  );
}

/** 이동 아이콘 링크 — tooltip 의무(디자인원칙 §1.6). */
export function GoLink({ href, label, icon }: { href: string | undefined; label: string; icon?: ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} className="ts-src-go" title={label} aria-label={label}>
      {icon ?? <IconLink />}
    </a>
  );
}

// ───────────────────────────── 인라인 ─────────────────────────────

export function Inlines({ nodes, ctx }: { nodes: readonly InlineNode[]; ctx: OverlayCtx }) {
  return (
    <>
      {nodes.map((n, i) => (
        <Inline key={`${n.id}-${i}`} node={n} ctx={ctx} />
      ))}
    </>
  );
}

function slotLabel(ref: string, view: SourceView, at?: ExprAt): string {
  // 참조 한 마디(구분자 · 노드 한정 · 인자 · 범위 낱말)는 조건식과 같은 표시명
  const text = exprText(ref, view, at);
  if (text !== ref) return text;
  const code = ref.match(/\bD\d{4}\b/)?.[0];
  return code && view.discriminators[code] ? `${view.discriminators[code].label}${ref !== code ? ` · ${ref}` : ""}` : ref;
}

function Inline({ node, ctx }: { node: InlineNode; ctx: OverlayCtx }) {
  switch (node.kind) {
    case "text":
      return <>{node.text}</>;
    case "slot": {
      const value = ctx.dim ? undefined : ctx.view.values[keyOf(ctx.scope, node.id)];
      const code = node.ref.match(/\bD\d{4}\b/)?.[0];
      return (
        <Spot ctx={ctx} id={node.id} className="ts-src-slot" title={`원문 — ${node.ref}`}>
          〔{slotLabel(node.ref, ctx.view, ctx.at)}〕{value !== undefined && <b className="ts-src-value"> = {value}</b>}
          {code && <GoLink href={links.discriminator(code)} label={`구분자 열기 · ${slotLabel(node.ref, ctx.view, ctx.at)}`} />}
        </Spot>
      );
    }
    case "inlineCond":
      return <CondView node={node} ctx={ctx} inline />;
    case "inlineFor":
      return <RepeatView node={node} ctx={ctx} inline />;
    case "clauseInlineRef": {
      const option = optionCodeOf(node);
      if (option) return <span className="ts-src-chip">〔옵션 {option}〕</span>;
      return <ClauseCall node={node} ctx={ctx} inline />;
    }
    case "articleRef":
      return <span className="ts-src-chip">〔{node.scope === "general" ? "보통약관 " : ""}조 참조〕</span>;
    case "blockRef":
      return <span className="ts-src-chip">〔블록 참조〕</span>;
    case "appendixRef":
      return <span className="ts-src-chip">〔별표 {node.appendixCode}〕</span>;
    case "structKey":
      return <span className="ts-src-chip">〔구조 표기〕</span>;
    case "particle":
      return <>{particlePreset(node.preset)?.label ?? ""}</>;
  }
}

// ───────────────────────────── 블록 ─────────────────────────────

export function Blocks({ nodes, ctx }: { nodes: readonly BlockNode[]; ctx: OverlayCtx }) {
  return (
    <>
      {nodes.map((n, i) => (
        <Block key={`${n.id}-${i}`} node={n} ctx={ctx} />
      ))}
    </>
  );
}

function Block({ node, ctx }: { node: BlockNode; ctx: OverlayCtx }) {
  switch (node.kind) {
    case "paragraph":
      return (
        <Spot ctx={ctx} id={node.id} as="div" className="ts-src-p">
          <Inlines nodes={node.children} ctx={ctx} />
          {node.items && node.items.length > 0 && (
            <div className="ts-src-items">
              <Blocks nodes={node.items as BlockNode[]} ctx={ctx} />
            </div>
          )}
        </Spot>
      );
    case "item":
      return (
        <Spot ctx={ctx} id={node.id} as="div" className="ts-src-item">
          <Inlines nodes={node.children} ctx={ctx} />
          {node.subitems && node.subitems.length > 0 && (
            <div className="ts-src-items">
              <Blocks nodes={node.subitems as BlockNode[]} ctx={ctx} />
            </div>
          )}
        </Spot>
      );
    case "subitem":
    case "bullet":
      return (
        <Spot ctx={ctx} id={node.id} as="div" className="ts-src-item">
          {node.kind === "bullet" ? "- " : null}
          <Inlines nodes={node.children} ctx={ctx} />
        </Spot>
      );
    case "bulletList":
      return <Blocks nodes={node.children as BlockNode[]} ctx={ctx} />;
    case "table":
      return node.repeat ? (
        <RepeatView node={node} ctx={ctx} />
      ) : (
        <TableView node={node} ctx={ctx} />
      );
    case "box":
      return (
        <div className="ts-src-box">
          【{node.title}】 {node.lines.join(" / ")}
        </div>
      );
    case "boxRef":
      return <div className="ts-src-chip">〔박스 {node.boxCode}〕</div>;
    case "condBlock":
      return <CondView node={node} ctx={ctx} />;
    case "forBlock":
      return <RepeatView node={node} ctx={ctx} />;
    case "clauseBlockRef":
      return <ClauseCall node={node} ctx={ctx} />;
    case "tableRef":
      return <DynTableView node={node} ctx={ctx} />;
    case "article":
    case "section":
      return null;
  }
}

function TableView({ node, ctx }: { node: Extract<BlockNode, { kind: "table" }>; ctx: OverlayCtx }) {
  return (
    <table className="ts-src-table">
      <tbody>
        {node.rows.map((row, r) => (
          <tr key={r}>
            {row.cells.map((cell, c) => (
              <td key={c}>
                <Inlines nodes={cell} ctx={ctx} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ───────────────────────────── 조건 · 값별 분기 ─────────────────────────────

type CondNode = Extract<BlockNode, { kind: "condBlock" }> | Extract<InlineNode, { kind: "inlineCond" }>;

function caseLabel(values: readonly string[] | undefined, empty: boolean | undefined, rec: SwitchDecision | undefined, ctx: OverlayCtx): string {
  if (empty) return "문구 없음";
  const code = rec?.on.discriminators[0]?.code;
  const e = code ? ctx.view.enums[ctx.view.discriminators[code]?.enumCode ?? ""] : undefined;
  return (values ?? []).map((v) => (e?.values[v] ? `${e.values[v]} (${v})` : v)).join(" · ") || "값 없음";
}

export function CondView({ node, ctx, inline = false }: { node: CondNode; ctx: OverlayCtx; inline?: boolean }) {
  const rec = ctx.dim ? undefined : ctx.index.get(keyOf(ctx.scope, node.id));
  const Tag = inline ? "span" : "div";
  if (node.switchOn !== undefined) {
    const sw = rec?.kind === "switch" ? rec : undefined;
    return (
      <Spot ctx={ctx} id={node.id} as={inline ? "span" : "div"} className={inline ? "ts-src-cond is-inline" : "ts-src-cond"}>
        <Tag className="ts-src-branch-head">
          값별 분기 — <ExprView source={node.switchOn} ctx={ctx} />
          {sw && sw.outcome !== "blocked" && sw.value !== undefined && <b> = {caseLabel([sw.value], undefined, sw, ctx)}</b>}
          {sw?.outcome === "unassigned" && <span className="ts-src-mark"> 칸 없음</span>}
          {sw?.outcome === "blocked" && <span className="ts-src-mark is-blocked"> {BRANCH_OUTCOME_LABEL.blocked}{sw.on.issue ? ` — ${sw.on.issue.message}` : ""}</span>}
        </Tag>
        {node.branches.map((b, i) => {
          const chosen = sw?.outcome === "taken" && sw.caseId === keyOf(ctx.scope, b.id);
          const inner = { ...ctx, dim: ctx.dim || !chosen };
          return (
            <Tag key={`${b.id}-${i}`} className={chosen ? "ts-src-branch is-taken" : "ts-src-branch is-dim"} data-outcome={chosen ? "taken" : "other"}>
              <Tag className="ts-src-branch-head">
                칸 {caseLabel(b.values, b.empty, sw, ctx)}
                {chosen && <span className="ts-src-mark is-taken"> 고름</span>}
              </Tag>
              {inline ? <Inlines nodes={b.children as InlineNode[]} ctx={inner} /> : <Blocks nodes={b.children as BlockNode[]} ctx={inner} />}
            </Tag>
          );
        })}
      </Spot>
    );
  }
  const cond = rec?.kind === "condition" ? (rec as ConditionDecision) : undefined;
  return (
    <Spot ctx={ctx} id={node.id} as={inline ? "span" : "div"} className={inline ? "ts-src-cond is-inline" : "ts-src-cond"}>
      {node.branches.map((b, i) => {
        const br = cond?.branches.find((x) => x.id === keyOf(ctx.scope, b.id)) ?? cond?.branches[i];
        const outcome = br?.outcome;
        const inner = { ...ctx, dim: ctx.dim || outcome !== "taken" };
        const word = b.when === undefined ? "그 밖의 경우" : i === 0 ? "IF" : "ELIF";
        const reads = br?.condition ? readsText(br.condition, ctx.view) : [];
        return (
          <Tag key={`${b.id}-${i}`} className={outcome === "taken" ? "ts-src-branch is-taken" : "ts-src-branch is-dim"} data-outcome={outcome ?? "none"}>
            <Tag className="ts-src-branch-head">
              {word}
              {b.when !== undefined && (
                <>
                  {" "}
                  <ExprView source={b.when} ctx={ctx} />
                </>
              )}
              {outcome && <span className={`ts-src-mark is-${outcome}`}> {BRANCH_OUTCOME_LABEL[outcome]}</span>}
              {reads.length > 0 && <span className="ts-src-reads"> · {reads.join(" · ")}</span>}
              {br?.condition?.discriminators.map((d) => (
                <GoLink key={d.code} href={links.discriminator(d.code)} label={`구분자 열기 · ${ctx.view.discriminators[d.code]?.label ?? d.code}`} />
              ))}
              {br?.condition?.reads.slice(0, 3).map((r, j) => (
                <GoLink key={j} href={links.read(ctx.view, r)} label={`값 열기 · ${r.path} = ${slotText(r.slot)}`} />
              ))}
              {outcome === "blocked" && br?.condition?.issue && <span className="ts-src-reads"> — {br.condition.issue.message}</span>}
            </Tag>
            {inline ? <Inlines nodes={b.children as InlineNode[]} ctx={inner} /> : <Blocks nodes={b.children as BlockNode[]} ctx={inner} />}
          </Tag>
        );
      })}
    </Spot>
  );
}

// ───────────────────────────── 반복 ─────────────────────────────

type RepeatNode = Extract<BlockNode, { kind: "forBlock" }> | Extract<InlineNode, { kind: "inlineFor" }> | Extract<BlockNode, { kind: "table" }>;

/** 원본 탭 한 칸 — 고른 칸은 마크색 테두리 · 굵은 글자. */
export function SrcTab({ selected, ...props }: { selected: boolean } & Omit<ComponentProps<typeof Button>, "variant" | "size" | "role">) {
  return <Button type="button" role="tab" aria-selected={selected} size="xs" className="h-6 px-2 text-xs text-ink-2 aria-selected:border-mark aria-selected:font-bold aria-selected:text-mark" {...props} />;
}

function Tabs({ items, selected, onSelect, label }: { items: { id: string; label: string }[]; selected: string | undefined; onSelect: (id: string) => void; label: string }) {
  return (
    <span className="ts-src-tabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <SrcTab key={it.id} selected={it.id === selected} onClick={() => onSelect(it.id)}>
          {it.label}
        </SrcTab>
      ))}
    </span>
  );
}

export function RepeatView({ node, ctx, inline = false }: { node: RepeatNode; ctx: OverlayCtx; inline?: boolean }) {
  const rec = ctx.dim ? undefined : ctx.index.get(keyOf(ctx.scope, node.id));
  const repeat = rec?.kind === "repeat" ? (rec as RepeatDecision) : undefined;
  const [selected, setSelected] = useState(() => (repeat ? elementForNode(repeat, ctx.focus) : undefined));
  const Tag = inline ? "span" : "div";
  const name = node.kind === "table" ? "행 반복 표" : `반복 — ${node.alias ?? repeatLabel(node.source)}`;
  const body = (c: OverlayCtx) =>
    node.kind === "table" ? <TableView node={node} ctx={c} /> : inline ? <Inlines nodes={(node as Extract<InlineNode, { kind: "inlineFor" }>).children} ctx={c} /> : <Blocks nodes={(node as Extract<BlockNode, { kind: "forBlock" }>).children} ctx={c} />;
  if (!repeat) {
    return (
      <Spot ctx={ctx} id={node.id} as={inline ? "span" : "div"} className={inline ? "ts-src-repeat is-inline is-dim" : "ts-src-repeat is-dim"}>
        <Tag className="ts-src-branch-head">{name}</Tag>
        {body({ ...ctx, dim: true })}
      </Spot>
    );
  }
  const fallback = node.kind === "table" ? undefined : node.fallback;
  return (
    <Spot ctx={ctx} id={node.id} as={inline ? "span" : "div"} className={inline ? "ts-src-repeat is-inline" : "ts-src-repeat"}>
      <Tag className="ts-src-branch-head">
        {name}
        {repeat.elements.length > 0 && <Tabs label={`${name} 원소`} items={repeat.elements.map((e) => ({ id: e.id, label: e.label }))} selected={selected} onSelect={setSelected} />}
      </Tag>
      {repeat.elements.length === 0 ? (
        <>
          <Tag className="ts-src-empty">반복 원소 없음 — 원천: {node.kind === "table" ? "행" : repeatLabel(node.source)} (0개)</Tag>
          {fallback && fallback.length > 0 && (inline ? <Inlines nodes={fallback as InlineNode[]} ctx={ctx} /> : <Blocks nodes={fallback as BlockNode[]} ctx={ctx} />)}
        </>
      ) : (
        selected !== undefined && body({ ...ctx, scope: elementScope(ctx.scope, selected) })
      )}
    </Spot>
  );
}

// ───────────────────────────── 함수조항 ─────────────────────────────

type CallNode = Extract<BlockNode, { kind: "clauseBlockRef" }> | Extract<InlineNode, { kind: "clauseInlineRef" }>;

export function ClauseCall({ node, ctx, inline = false }: { node: CallNode; ctx: OverlayCtx; inline?: boolean }) {
  const key = keyOf(ctx.scope, node.id);
  const rec = ctx.dim ? undefined : ctx.index.get(key);
  const call = rec?.kind === "clause" ? (rec as ClauseDecision) : undefined;
  const def = ctx.view.clauses[node.clauseCode];
  const [open, setOpen] = useState(() => ctx.focus?.startsWith(`${key}/`) === true);
  const Tag = inline ? "span" : "div";
  const article = def?.tree.children[0];
  const body = article && article.kind === "article" ? article.children : [];
  const options = call ? Object.entries(call.options) : Object.entries(node.options);
  return (
    <Spot ctx={ctx} id={node.id} as={inline ? "span" : "div"} className={inline ? "ts-src-call is-inline" : "ts-src-call"}>
      <Tag className="ts-src-call-line">
        <Button type="button" variant="ghost" size="icon-sm" className="align-middle text-ink-2" aria-expanded={open} onClick={() => setOpen((v) => !v)} title={`${open ? "접기" : "펼치기"} · 함수조항 ${def?.label ?? node.clauseCode}`} aria-label={`${open ? "접기" : "펼치기"} · 함수조항 ${def?.label ?? node.clauseCode}`}>
          <IconFx />
        </Button>
        <b>{def?.label ?? node.clauseCode}</b> <span className="ts-muted">{node.clauseCode}</span>
        <GoLink href={links.clause(node.clauseCode)} label={`함수조항 정의 열기 · ${def?.label ?? node.clauseCode}`} />
        {call?.preset && <span className="ts-src-reads"> · 프리셋 {call.preset}</span>}
        {call?.args.map((a) => (
          <span key={a.name} className="ts-src-reads">
            {" "}
            · {argText(a, ctx.view, node.clauseCode)}
          </span>
        ))}
        {options.map(([o, v]) => (
          <span key={o} className="ts-src-reads">
            {" "}
            · {call?.overridden.includes(o) ? "상품 옵션" : "옵션"}: {o} = {v}
          </span>
        ))}
        {call?.issue && <span className="ts-src-mark is-blocked"> {call.issue.message}</span>}
      </Tag>
      {open && (
        <Tag className="ts-src-call-body">
          {!def ? <span className="ts-muted">정의 없음</span> : <Blocks nodes={body} ctx={{ ...ctx, scope: clauseScope(ctx.scope, node.id), at: { ...ctx.at, clause: node.clauseCode } }} />}
        </Tag>
      )}
    </Spot>
  );
}

// ───────────────────────────── 표 구분자 (기능/구분자 §3.7) ─────────────────────────────

function DynTableView({ node, ctx }: { node: Extract<BlockNode, { kind: "tableRef" }>; ctx: OverlayCtx }) {
  const rec = ctx.dim ? undefined : ctx.index.get(keyOf(ctx.scope, node.id));
  const table = rec?.kind === "dynTable" ? (rec as DynTableDecision) : undefined;
  const [selected, setSelected] = useState(() => (table ? dynRowForNode(table, ctx.focus) : 0));
  const row = table?.rows[selected];
  const unit = table?.fixed ? "표" : "행";
  return (
    <Spot ctx={ctx} id={node.id} as="div" className={table ? "ts-src-repeat" : "ts-src-repeat is-dim"}>
      <div className="ts-src-branch-head">
        {findTableDiscriminator(node.code)?.label ?? `표 구분자 ${node.code}`}
        {table && table.rows.length > 0 && <Tabs label={`표 구분자 ${node.code} ${unit}`} items={table.rows.map((r, i) => ({ id: String(i), label: r.name }))} selected={String(selected)} onSelect={(id) => setSelected(Number(id))} />}
        {table?.issue && <span className="ts-src-mark is-blocked"> {table.issue.message}</span>}
      </div>
      {table && table.rows.length === 0 && <div className="ts-src-empty">{table.fixed ? "표 없음 — 통합치료비 급부 또는 운영 가입금액 0개" : "행 없음 — 원천 급부 0개"}</div>}
      {row && <DecisionList decisions={row.decisions} ctx={ctx} />}
    </Spot>
  );
}

/** 모델 자리가 없는 기록(표 구분자 셀 · 조 자리 조건)을 줄로 — 조건은 가지 표식 · 근거, 값별 분기는 판단 값. */
export function DecisionList({ decisions, ctx }: { decisions: readonly DecisionRecord[]; ctx: OverlayCtx }) {
  if (decisions.length === 0) return null;
  return (
    <ul className="ts-src-list">
      {decisions.map((d, i) => (
        <li key={i} data-node={d.nodeId} className={ctx.focus === d.nodeId ? "is-focus" : undefined}>
          {d.kind === "condition" &&
            d.branches.map((b, j) => (
              <div key={j} className={b.outcome === "taken" ? "ts-src-branch is-taken" : "ts-src-branch is-dim"} data-outcome={b.outcome}>
                {b.when === undefined ? "그 밖의 경우" : j === 0 ? "IF" : "ELIF"}
                {b.when !== undefined && (
                  <>
                    {" "}
                    <ExprView source={b.when} ctx={ctx} />
                  </>
                )}
                <span className={`ts-src-mark is-${b.outcome}`}> {BRANCH_OUTCOME_LABEL[b.outcome]}</span>
                {b.condition && readsText(b.condition, ctx.view).length > 0 && <span className="ts-src-reads"> · {readsText(b.condition, ctx.view).join(" · ")}</span>}
              </div>
            ))}
          {d.kind === "switch" && (
            <span>
              값별 분기 <ExprView source={d.on.expression} ctx={ctx} /> = {d.value ?? "—"} ({d.outcome === "taken" ? "고름" : d.outcome === "unassigned" ? "칸 없음" : BRANCH_OUTCOME_LABEL.blocked})
            </span>
          )}
          {d.kind === "clause" && <span>함수조항 {ctx.view.clauses[d.clauseCode]?.label ?? d.clauseCode}</span>}
          {d.kind === "repeat" && <span>반복 — 원소 {d.elements.length}개</span>}
          {d.kind === "dynTable" && <span>{findTableDiscriminator(d.tableCode)?.label ?? `표 구분자 ${d.tableCode}`} — {d.fixed ? "표" : "행"} {d.rows.length}</span>}
        </li>
      ))}
    </ul>
  );
}
