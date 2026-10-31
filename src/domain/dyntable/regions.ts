/**
 * 동적표 칸의 영역 (순수) — 기능/동적표 §4.2 「칸 ↔ 필드」.
 *
 * 펼친 표(`expandDynTable`)의 칸마다 그 칸을 만든 템플릿 영역을 붙인다 — 상세 화면이 칸을 누르면 오른쪽 필드를, 필드에 들어가면 표의 칸을 칠한다.
 * - 영역: 구분 칸 머리글(`corner`) · 열 머리글 넷(`first` · `middle` · `last` · `single`) · 셀(`cell`) · 행 머리(`row`, 급부명 — 시스템).
 * - 열 머리글의 영역 규칙(`headerRegion`)은 펼침이 템플릿을 고르는 규칙 그 자체다 — 펼침도 이 함수로 고른다.
 * - 자리표시자: 템플릿의 슬롯 노드(표 슬롯 · 인자 슬롯). 펼침이 같은 노드 id(「참조 id / 템플릿 노드 id @ 행 · 열」)의 글로 바꾸므로
 *   펼친 글 노드의 템플릿 id 가 슬롯 id 면 그 글은 자리표시자에 들어간 값이다.
 *
 * - 인자 쓰임(`paramUsage`): 인자마다 그 인자를 읽는 템플릿 영역 — 상세 화면 인자 표의 「쓰이는 곳」.
 *
 * DB·React import 금지 (순수층).
 */
import type { Inline } from "../clause/nodes";
import { extractRefs, parse } from "../expression";
import type { DynTable, DynTableTemplateKey, ExpandedDynTable } from "./types";

export type DynTableColumnRegion = "first" | "middle" | "last" | "single";
/** 정액형(§3.7) 영역 — 급부 머리글 · 캡션 · 글자 열 머리(정액표가 정한다, 시스템) · 글자 칸(시스템). */
export type DynTableFixedRegion = "benefitHeader" | "caption" | "textHeader" | "textCell";
export type DynTableRegion = "corner" | DynTableColumnRegion | "cell" | "row" | DynTableFixedRegion;

/** 화면 순서 — 행 머리 · 구분 칸 · 첫 · 가운데 · 마지막 · 단일 · 셀 · (정액형) 급부 머리글 · 캡션 · 글자 열 머리 · 글자 칸. */
export const DYN_TABLE_REGIONS: readonly DynTableRegion[] = ["row", "corner", "first", "middle", "last", "single", "cell", "benefitHeader", "caption", "textHeader", "textCell"];

/** 열 j(0 부터, 데이터 열) 의 머리글 템플릿 — 열 하나 = 단일, 둘 = 첫 + 마지막, 셋 이상 = 첫 + 가운데(열마다) + 마지막 (§3.3). */
export function headerRegion(j: number, columns: number): DynTableColumnRegion {
  if (columns === 1) return "single";
  if (j === 0) return "first";
  if (j === columns - 1) return "last";
  return "middle";
}

export interface DynTableRegions {
  /** `[구분 칸, 열1 .. 열N]` 의 영역. */
  header: DynTableRegion[];
  /** 행마다 `[행 머리, 셀1 .. 셀N]` 의 영역. */
  rows: DynTableRegion[][];
}

export function regionsOf(expanded: ExpandedDynTable): DynTableRegions {
  const columns = expanded.header.length - 1;
  return {
    header: ["corner", ...Array.from({ length: columns }, (_, j) => headerRegion(j, columns))],
    rows: expanded.rows.map((r) => ["row", ...r.cells.slice(1).map((): DynTableRegion => "cell")]),
  };
}

/** 펼친 노드 id(「참조 id / 템플릿 노드 id @ 행 · 열」)의 템플릿 노드 id. 참조 id 가 다르거나 모양이 아니면 undefined. */
export function templateNodeId(expandedId: string, refId: string): string | undefined {
  const head = `${refId}/`;
  if (!expandedId.startsWith(head)) return undefined;
  const rest = expandedId.slice(head.length);
  const at = rest.lastIndexOf("@");
  return at < 0 ? undefined : rest.slice(0, at);
}

/** 템플릿(머리글 네 벌 + 셀 + 정액형 캡션 · 급부 머리글)의 슬롯 노드 id 전부 — 조건 가지 · 값별 분기 칸 안까지. */
export function placeholderIds(def: Pick<DynTable, "headers" | "cell" | "fixed">): Set<string> {
  const out = new Set<string>();
  const walk = (list: readonly Inline[]) => {
    for (const n of list) {
      if (n.kind === "slot") out.add(n.id);
      else if (n.kind === "inlineCond") for (const br of n.branches) walk(br.children);
      else if (n.kind === "inlineSwitch") for (const k of n.cases) walk(k.children);
    }
  };
  for (const t of [def.headers.first, def.headers.middle, def.headers.last, def.headers.single, def.cell, def.fixed?.caption ?? [], def.fixed?.benefitHeader ?? []]) walk(t);
  return out;
}

const TEMPLATE_ORDER: readonly DynTableTemplateKey[] = ["first", "middle", "last", "single", "cell", "caption", "benefitHeader"];

/** 템플릿 키 → 그 템플릿. 정액형 칸이 없는 정의의 캡션 · 급부 머리글은 빈 템플릿. */
export function templateOf(def: Pick<DynTable, "headers" | "cell" | "fixed">, key: DynTableTemplateKey): readonly Inline[] {
  if (key === "cell") return def.cell;
  if (key === "caption") return def.fixed?.caption ?? [];
  if (key === "benefitHeader") return def.fixed?.benefitHeader ?? [];
  return def.headers[key];
}

/** 식이 읽는 인자 이름 — 파싱이 안 되면 없음(저장 검사가 잡는다). */
function paramNamesOf(src: string): string[] {
  const parsed = parse(src);
  if (!parsed.ok) return [];
  return extractRefs(parsed.value).flatMap(({ ref }) => (ref.kind === "param" ? [ref.name] : []));
}

/** 인자마다 읽는 템플릿 영역(첫 · 가운데 · 마지막 · 단일 · 셀 · 캡션 · 급부 머리글 순) — 슬롯 · 조건 · 값별 분기 대상, 조건 가지 · 분기 칸 안까지. 선언 순서대로 키를 둔다. */
export function paramUsage(def: Pick<DynTable, "params" | "headers" | "cell" | "fixed">): Record<string, DynTableTemplateKey[]> {
  const out: Record<string, DynTableTemplateKey[]> = {};
  for (const p of def.params) out[p.name] = [];
  for (const key of TEMPLATE_ORDER) {
    const reads = new Set<string>();
    const walk = (list: readonly Inline[]) => {
      for (const n of list) {
        if (n.kind === "slot") paramNamesOf(n.ref).forEach((x) => reads.add(x));
        else if (n.kind === "inlineCond")
          for (const br of n.branches) {
            if (br.when !== undefined) paramNamesOf(br.when).forEach((x) => reads.add(x));
            walk(br.children);
          }
        else if (n.kind === "inlineSwitch") {
          paramNamesOf(n.on).forEach((x) => reads.add(x));
          for (const k of n.cases) walk(k.children);
        }
      }
    };
    walk(templateOf(def, key));
    for (const name of reads) if (out[name]) out[name].push(key);
  }
  return out;
}
