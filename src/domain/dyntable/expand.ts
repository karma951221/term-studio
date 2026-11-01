/**
 * 동적표 펼침 (순수) — 기능/동적표 §3.2 · §3.4 · §3.6.
 *
 * 급부 열거 → 경계 합집합 → 행 묶기 → 셀 계산 → 머리글 · 셀 템플릿을 바꿔 쓴다(인자 연결 → 함수조항과 같은 자리 `rewriteInlines`, 표 슬롯 → 글).
 * 돌려주는 표는 인라인 노드 그대로다 — 셀 템플릿의 「해당보장의」 조건(`count(builtin.subCoverage.name) >= 2`)처럼 담보 문맥이 필요한 조건은
 * 남겨 두고, 조립(Walker)이 담보 문맥에서 평가해 `RTable` 로 낸다. 표 슬롯(`builtin.table.*`)은 여기서 전부 글로 바꾸므로 뒤쪽이 볼 일이 없다.
 *
 * - 열: 표 모양(`tableShape` — 머리글 구조, §3.2)이 감액 구간형이면 모든 급부의 감액 경계(`end`) 합집합, k 개 → 열 k + 1.
 *   경계는 열거형 「감액기간」 값(`ReductionBoundary`) — 같은 열거값 = 같은 경계, 정렬은 열거 순서, 머리글 `{경계}` · `{앞경계}` 는 값 이름(「90일」 · 「1년」) (2026-10-31).
 *   열거형에서 지워진 값은 열 맨 뒤 · 「없는 값 V09」 + brokenRef(행 좌표).
 *   단일형(첫 · 가운데 · 마지막 머리글이 모두 빔)이거나 합집합이 비면 열 하나(단일 열 템플릿).
 * - 열 j 의 감액비율: 구간 [b(j−1), b(j)) 에서 `end ≥ b(j)`(열거 순서) 인 첫 구간의 `rate`, 없으면 `afterRate`. 마지막 열 = `afterRate`. 감액 없음 = 100.
 *   단일형이면 감액을 보지 않는다(비율 = 지급률 — (갱신) 표).
 * - 셀 비율 = 지급률 × 감액비율 / 100. 정수가 아니면 소수 한 자리까지 자른다(반올림 없음).
 *   지급률 미입력은 100% 로 읽는다 — 지급률은 선택 필드이고 안 적으면 100 이다 (기능/담보 §3.4, 2026-10-21).
 * - 행: 급부명이 같고 열마다 비율이 모두 같으면 한 행(처음 나온 자리). 어느 열이든 다르면 그 급부명은 급부마다 따로(트리 순) + 경고 `dynTableMergeConflict`.
 * - 노드 id: `${refId}/${템플릿 노드 id}@r{행}c{열}` (머리글 행 = h, 구분 칸 = c0). 구분 칸 · 급부명 칸은 글 노드 하나(`rowHeader` · `row`).
 * - 연결 오류(argUnbound 등)는 `issues` 에 모으고 표 구조는 그대로 돌려준다 — 막을지는 호출처(조립 · 미리보기)가 정한다.
 */
import { rewriteInlines, type ConstFormatter } from "../clause/bind";
import type { Inline, InlineBranch, SwitchCase } from "../clause/nodes";
import { effectiveBindings, type Bindings } from "../clause/params";
import { resolveBaseDateChip, type ReductionBoundary } from "../coverage/traits";
import type { Coordinate, Id, Issue } from "../types";
import { headerRegion } from "./regions";
import { tableShape } from "./shape";
import { DYN_TABLE_SLOTS, isDynTableSlotRef, type DynBenefit, type DynTable, type DynTableSlotRef, type ExpandedDynTable, type ExpandedDynTableRow } from "./types";

export interface DynTableInput {
  /** 그 담보의 급부 전부 — 담보 트리 순서(세부보장 순 → 급부 순). */
  benefits: DynBenefit[];
  /** 그 상품담보가 갱신형인가 — 체증 구분 안 칩 「(최초)계약일」을 「최초계약일」 / 「계약일」로 (기능/구분자 §3.7). 없으면 아니오. */
  renewable?: boolean;
}

export interface DynTableDeps {
  /** 상수 연결 → 슬롯 글 (조립의 값 표기 규칙). */
  formatConst: ConstFormatter;
  /** 참조 노드 id — 펼친 노드 id 의 머리. */
  refId: Id;
}

// ───────────────────────────── 셀 비율 ─────────────────────────────

/** 지급률을 안 적은 급부의 지급률(%) — `pay.rate` 는 선택 필드이고 비어 있으면 100 이다 (기능/담보 §3.4). */
export const DEFAULT_PAY_RATE = 100;

/** 열 j (0 부터, 마지막 열 = boundaries.length) 의 감액비율 (§3.4) — 「≥」는 열거 순서로 견준다. */
export function reductionRateAt(reduction: DynBenefit["reduction"], boundaries: readonly ReductionBoundary[], j: number): number {
  if (!reduction) return 100;
  if (j >= boundaries.length) return reduction.afterRate;
  const end = boundaries[j];
  const period = reduction.periods.find((p) => p.end.order >= end.order);
  return period ? period.rate : reduction.afterRate;
}

/** 경계 합집합 — 같은 열거값(코드)은 하나, 열거 순서로 정렬(지워진 값은 맨 뒤 · 코드 순). */
export function boundaryUnion(benefits: readonly DynBenefit[]): ReductionBoundary[] {
  const byCode = new Map<string, ReductionBoundary>();
  for (const b of benefits) for (const p of b.reduction?.periods ?? []) if (!byCode.has(p.end.code)) byCode.set(p.end.code, p.end);
  return [...byCode.values()].sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
}

/** 셀 비율 글 — 정수면 그대로, 아니면 소수 한 자리까지 자른다(반올림 없음). */
export function formatRatio(payRate: number, reductionRate: number): string {
  // 체증 비율(1.15 …)을 곱한 지급률은 부동소수 오차(34.49999…)를 품는다 — 백만분의 일에서 한 번 맞춘 뒤 버린다
  const scaled = Math.floor(Math.round(payRate * reductionRate / 100 * 10 * 1e6) / 1e6 + 1e-9);
  const whole = Math.trunc(scaled / 10);
  const tenth = scaled % 10;
  return tenth === 0 ? String(whole) : `${whole}.${tenth}`;
}

// ───────────────────────────── 노드 복제 ─────────────────────────────

/** 템플릿을 자리마다 복제한다 — id 를 유일화하고 표 슬롯을 글로 바꾼다. 나머지(조건 · 값별 분기 · 조사)는 그대로. 정액형 펼침(`expandFixed.ts`)도 쓴다. */
export function instantiate(template: readonly Inline[], tag: (id: Id) => Id, slotText: (ref: DynTableSlotRef) => string): Inline[] {
  const node = (n: Inline): Inline => {
    switch (n.kind) {
      case "slot":
        return isDynTableSlotRef(n.ref) ? { id: tag(n.id), kind: "text", text: slotText(n.ref) } : { ...n, id: tag(n.id) };
      case "inlineCond":
        return { ...n, id: tag(n.id), branches: n.branches.map((br): InlineBranch => ({ ...br, id: tag(br.id), children: br.children.map(node) })) };
      case "inlineSwitch":
        return { ...n, id: tag(n.id), cases: n.cases.map((k): SwitchCase<Inline> => ({ ...k, id: tag(k.id), children: k.children.map(node) })) };
      default:
        return { ...n, id: tag(n.id) };
    }
  };
  return template.map(node);
}

// ───────────────────────────── 펼침 ─────────────────────────────

interface Computed {
  benefit: DynBenefit;
  /** 행 머리 — 급부명, 체증 행이면 「급부명(구분)」(칩은 기준일 낱말로 바꾼 뒤). 묶기의 열쇠다. */
  name: string;
  /** 열마다 셀 비율 글. */
  ratios: string[];
}

export function expandDynTable(def: DynTable, input: DynTableInput, bindings: Bindings | undefined, deps: DynTableDeps, at: Coordinate = {}): ExpandedDynTable {
  const issues: Issue[] = [];
  const owner = def.label; // 오류 좌표 「<구분자명> › 행 <급부명>」 (기능/구분자 §3.7)
  const here = (refPath: string): Coordinate => ({ ...at, refPath });

  // 1. 인자 연결 — 템플릿마다 한 번 바꿔 쓴다(자리마다 같은 결과라 복제 전에). 오류는 모으고 바꿀 수 있는 데까지 바꾼 템플릿을 쓴다
  const bound = effectiveBindings(def, bindings);
  const rewrite = (inlines: readonly Inline[]): Inline[] => {
    const r = rewriteInlines(inlines, def.params, bound, deps.formatConst, at, owner);
    for (const i of r.issues) if (!issues.some((x) => x.kind === i.kind && x.at.refPath === i.at.refPath)) issues.push(i);
    return r.inlines;
  };
  const tmpl = {
    first: rewrite(def.headers.first),
    middle: rewrite(def.headers.middle),
    last: rewrite(def.headers.last),
    single: rewrite(def.headers.single),
    cell: rewrite(def.cell),
  };

  // 2. 경계 합집합 → 열. 열거형에서 지워진 경계는 brokenRef(그 급부의 행 좌표) — 표는 「없는 값」 글자로 그대로 찍는다
  const split = tableShape(def.headers) === "split";
  const boundaries = split ? boundaryUnion(input.benefits) : [];
  const columns = boundaries.length + 1;
  if (split) {
    for (const b of input.benefits) {
      const gone = (b.reduction?.periods ?? []).filter((p) => p.end.missing).map((p) => p.end.code);
      if (gone.length === 0) continue;
      issues.push({
        kind: "brokenRef",
        message: `${owner} — 급부 「${b.name}」 의 감액 경계 ${gone.join(", ")} 은(는) 열거형 「감액기간」에서 지워진 값입니다 — 급부의 감액 구간에서 다른 값을 고른다`,
        at: here(`${owner} › 행 ${b.name}`),
      });
    }
  }

  // 3. 머리글 — 열 하나 = 단일, 둘 = 첫 + 마지막, 셋 이상 = 첫 + 가운데(열마다) + 마지막
  const tagOf = (row: string, col: number) => (id: Id) => `${deps.refId}/${id}@r${row}c${col}`;
  const headerText = (j: number) => (ref: DynTableSlotRef): string => {
    switch (ref) {
      case DYN_TABLE_SLOTS.boundary:
        return boundaries[Math.min(j, boundaries.length - 1)].label;
      case DYN_TABLE_SLOTS.prevBoundary:
        return boundaries[j - 1].label;
      default:
        return "";
    }
  };
  const headerTemplate = (j: number): Inline[] => tmpl[headerRegion(j, columns)];
  const header: Inline[][] = [[{ id: tagOf("h", 0)("rowHeader"), kind: "text", text: def.rowHeader }]];
  for (let j = 0; j < columns; j++) header.push(instantiate(headerTemplate(j), tagOf("h", j + 1), headerText(j)));

  // 4. 셀 비율 — 급부마다 열마다. 체증 급부는 구분마다 한 행(행 머리 「급부명(구분)」 · 지급률 × 체증 비율) — 기능/구분자 §3.7
  const computed: Computed[] = input.benefits.flatMap((benefit) => {
    const payRate = benefit.payRate ?? DEFAULT_PAY_RATE;
    const reduction = split ? benefit.reduction : undefined;
    const ratios = (rate: number) => Array.from({ length: columns }, (_, j) => formatRatio(rate, reductionRateAt(reduction, boundaries, j)));
    const steps = benefit.escalation ?? [];
    if (steps.length === 0) return [{ benefit, name: benefit.name, ratios: ratios(payRate) }];
    return steps.map((s) => ({ benefit, name: `${benefit.name}(${resolveBaseDateChip(s.label, input.renewable === true)})`, ratios: ratios(payRate * s.ratio) }));
  });

  // 5. 행 묶기 — 행 머리(급부명 · 체증 구분)가 같은 급부는 열마다 비율이 모두 같을 때만 한 행. 어느 열이든 다르면 그 행 머리는 전부 따로(트리 순) + 경고
  const byName = new Map<string, Computed[]>();
  for (const c of computed) byName.set(c.name, [...(byName.get(c.name) ?? []), c]);
  const conflicted = new Set<string>();
  for (const [name, group] of byName) {
    const head = group[0];
    const other = group.find((g) => g.ratios.some((r, j) => r !== head.ratios[j]));
    if (!other) continue;
    const j = other.ratios.findIndex((r, idx) => r !== head.ratios[idx]);
    conflicted.add(name);
    issues.push({
      kind: "dynTableMergeConflict",
      severity: "warning",
      message: `${owner} — 급부명 「${name}」 이(가) 같은 급부들의 열 ${j + 1} 셀 비율이 다릅니다(${head.ratios[j]}% · ${other.ratios[j]}%) — 한 행으로 묶지 않고 급부마다 따로 찍습니다. 따로 보이려면 급부명을 다르게, 묶으려면 값을 같게 적는다`,
      at: here(`${owner} › 행 ${name}`),
    });
  }
  const rows: ExpandedDynTableRow[] = [];
  const rowOf = new Map<string, ExpandedDynTableRow>();
  for (const c of computed) {
    const name = c.name;
    const merged = conflicted.has(name) ? undefined : rowOf.get(name);
    if (merged) {
      merged.benefitKeys.push(c.benefit.key);
      continue;
    }
    const i = rows.length + 1;
    const cells: Inline[][] = [[{ id: tagOf(String(i), 0)("row"), kind: "text", text: name }]];
    for (let j = 0; j < columns; j++) cells.push(instantiate(tmpl.cell, tagOf(String(i), j + 1), () => c.ratios[j]));
    const row: ExpandedDynTableRow = { name, benefitKeys: [c.benefit.key], cells };
    rows.push(row);
    if (!conflicted.has(name)) rowOf.set(name, row);
  }

  return { header, rows, issues };
}
