/**
 * 정액형 표 펼침 (순수) — 기능/동적표 §3.7 (통합치료비). 감액 표 펼침(`expand.ts`)과 같은 결로 템플릿을 바꿔 쓰되, 행 · 정액은 담보의 급부 「정액표」 특성에서 읽는다.
 *
 * 전개: for 급부(정액표 있는 것, 트리 순서) → [급부 머리글(정액표 급부가 둘 이상일 때)] → for 가입금액(상품담보 운영 가입금액, 오름차순) → 캡션 → 표.
 * - 표 = 정액표의 글자 열들 + 지급금액 열(그 급부 **하나**의 감액 경계로 나눈다 — 표 모양 규칙 §3.2 그대로 · 단일형이면 열 하나).
 * - 셀 = 정액 × 감액비율 / 100 — 원 단위로 반올림하지 않는다. 지급률(`pay.rate`)은 곱하지 않는다(정액이 이미 지급금액이다). 표기는 `formatWon`.
 * - 세로 병합: 첫 글자 열에서 위아래로 연속한 같은 값만(`spans` — 0 = 위 셀에 병합).
 * - 검사: 운영 가입금액이 정액표에 없으면 `notEntered`(그 급부 행 좌표 — 셀은 비운다), 정액표 급부가 하나도 없으면 `structure`, 운영 가입금액이 없으면 `notEntered`(담보 가입금액).
 * - 노드 id: 캡션 · 급부 머리글 `${refId}/${템플릿 노드 id}@k{블록}`, 표 칸 `…@k{블록}r{행}c{열}`(머리글 행 = h). 글자 칸은 글 노드 하나(`col` · `txt`).
 */
import { rewriteInlines } from "../clause/bind";
import type { Inline } from "../clause/nodes";
import { effectiveBindings, type Bindings } from "../clause/params";
import type { Coordinate, Id, Issue } from "../types";
import { formatWon } from "./amount";
import { boundaryUnion, instantiate, reductionRateAt, type DynTableDeps } from "./expand";
import { headerRegion } from "./regions";
import { tableShape } from "./shape";
import { DYN_TABLE_SLOTS, type DynBenefit, type DynTable, type DynTableSlotRef } from "./types";

export interface FixedDynTableInput {
  /** 그 담보의 급부 전부 — 담보 트리 순서. 정액표(`fixedGrid`)가 있는 것만 표에 나온다. */
  benefits: DynBenefit[];
  /** 운영 가입금액(원) — 상품담보의 담보 「가입금액」. 순서는 묻지 않는다(오름차순으로 찍는다). */
  insuredAmounts: readonly number[];
}

export type FixedBlock =
  | { kind: "benefitHeader"; benefitKey: string; inlines: Inline[] }
  | { kind: "caption"; benefitKey: string; amount: number; inlines: Inline[] }
  | {
      kind: "table";
      benefitKey: string;
      amount: number;
      /** `[글자 열 머리 …, 지급금액 열 머리글 …]`. */
      header: Inline[][];
      /** 행마다 `[글자 칸 …, 지급금액 칸 …]` · 첫 글자 열의 세로 병합 `spans`. */
      rows: { cells: Inline[][]; spans?: number[] }[];
    };

export interface ExpandedFixedDynTable {
  blocks: FixedBlock[];
  issues: Issue[];
}

export function expandFixedDynTable(def: DynTable, input: FixedDynTableInput, bindings: Bindings | undefined, deps: DynTableDeps, at: Coordinate = {}): ExpandedFixedDynTable {
  const issues: Issue[] = [];
  const owner = def.label; // 오류 좌표 「<구분자명> › 행 <급부명>」 (기능/구분자 §3.7)
  const here = (refPath: string): Coordinate => ({ ...at, refPath });
  const fixed = def.fixed ?? { caption: [], benefitHeader: [] };

  // 1. 인자 연결 — 템플릿마다 한 번
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
    caption: rewrite(fixed.caption),
    benefitHeader: rewrite(fixed.benefitHeader),
  };

  // 2. 재료 — 정액표 급부 · 운영 가입금액
  const withGrid = input.benefits.filter((b) => b.fixedGrid !== undefined);
  const amounts = [...new Set(input.insuredAmounts)].sort((a, b) => a - b);
  if (withGrid.length === 0) {
    issues.push({ kind: "structure", message: `${owner} — 정액형 표인데 정액표가 있는 급부가 하나도 없습니다 — 급부에 정액표 특성을 붙인다`, at: here(owner) });
    return { blocks: [], issues };
  }
  if (amounts.length === 0) {
    issues.push({ kind: "notEntered", message: `${owner} — 운영 가입금액이 없습니다 — 담보(상품담보)의 가입금액을 적는다`, at: here(owner) });
    return { blocks: [], issues };
  }

  const split = tableShape(def.headers) === "split";
  const blocks: FixedBlock[] = [];
  let k = 0;
  const tagOf = (block: number, row?: string, col?: number) => (id: Id) => `${deps.refId}/${id}@k${block}${row !== undefined ? `r${row}c${col}` : ""}`;

  withGrid.forEach((benefit, index) => {
    const grid = benefit.fixedGrid!;
    const rowAt = here(`${owner} › 행 ${benefit.name}`);
    if (withGrid.length >= 2) {
      const bk = k++;
      const slotText = (ref: DynTableSlotRef) => (ref === DYN_TABLE_SLOTS.benefitNo ? String(index + 1) : ref === DYN_TABLE_SLOTS.benefitName ? benefit.name : "");
      blocks.push({ kind: "benefitHeader", benefitKey: benefit.key, inlines: instantiate(tmpl.benefitHeader, tagOf(bk), slotText) });
    }
    // 지급금액 열 — 그 급부 하나의 감액 경계
    const boundaries = split ? boundaryUnion([benefit]) : [];
    const columns = boundaries.length + 1;
    const reduction = split ? benefit.reduction : undefined;
    const headerText = (j: number) => (ref: DynTableSlotRef): string => {
      if (ref === DYN_TABLE_SLOTS.boundary) return boundaries[Math.min(j, boundaries.length - 1)].label;
      if (ref === DYN_TABLE_SLOTS.prevBoundary) return boundaries[j - 1].label;
      return "";
    };
    for (const amount of amounts) {
      const ck = k++;
      blocks.push({ kind: "caption", benefitKey: benefit.key, amount, inlines: instantiate(tmpl.caption, tagOf(ck), (ref) => (ref === DYN_TABLE_SLOTS.insuredAmount ? formatWon(amount) : "")) });
      const tk = k++;
      const key = String(amount);
      const missing = grid.rows.some((r) => r.amounts[key] === undefined);
      if (missing) {
        issues.push({
          kind: "notEntered",
          message: `${owner} — 급부 「${benefit.name}」 의 정액표에 가입금액 ${formatWon(amount)} 의 정액이 없습니다 — 정액표에 그 가입금액 열을 채우거나 상품담보의 운영 가입금액에서 뺀다`,
          at: rowAt,
        });
      }
      const header: Inline[][] = grid.columns.map((label, c) => [{ id: tagOf(tk, "h", c + 1)("col"), kind: "text", text: label }]);
      for (let j = 0; j < columns; j++) header.push(instantiate(tmpl[headerRegion(j, columns)], tagOf(tk, "h", grid.columns.length + j + 1), headerText(j)));
      const rows = grid.rows.map((row, i) => {
        const cells: Inline[][] = row.cells.map((text, c) => [{ id: tagOf(tk, String(i + 1), c + 1)("txt"), kind: "text", text }]);
        const base = row.amounts[key];
        for (let j = 0; j < columns; j++) {
          const value = base === undefined ? undefined : (base * reductionRateAt(reduction, boundaries, j)) / 100;
          cells.push(instantiate(tmpl.cell, tagOf(tk, String(i + 1), row.cells.length + j + 1), (ref) => (ref === DYN_TABLE_SLOTS.amount && value !== undefined ? formatWon(value) : "")));
        }
        return { cells };
      });
      const spans = mergeFirstColumn(grid.rows.map((r) => r.cells[0] ?? ""), grid.columns.length + columns);
      blocks.push({ kind: "table", benefitKey: benefit.key, amount, header, rows: rows.map((r, i) => (spans[i] ? { ...r, spans: spans[i] } : r)) });
    }
  });
  return { blocks, issues };
}

/** 첫 글자 열의 세로 병합 — 위아래로 연속한 같은 값만 합친다. 병합이 없는 행은 undefined. */
function mergeFirstColumn(first: readonly string[], width: number): (number[] | undefined)[] {
  const out: (number[] | undefined)[] = first.map(() => undefined);
  let i = 0;
  while (i < first.length) {
    let j = i + 1;
    while (j < first.length && first[j] === first[i] && first[i] !== "") j++;
    if (j - i > 1) {
      out[i] = [j - i, ...Array.from({ length: width - 1 }, () => 1)];
      for (let r = i + 1; r < j; r++) out[r] = [0, ...Array.from({ length: width - 1 }, () => 1)];
    }
    i = j;
  }
  return out;
}
