/**
 * 정액형 견본 (순수) — 기능/동적표 §4.2 · §3.7. 정액형 정의의 상세 화면이 늘 그려 두는 통합치료비 꼴 견본 하나:
 * 급부 「상해로 인한 경우」(감액 없음) · 「상해 이외의 사유로 인한 경우」(1년 50%), 글자 열 분류 · 치료항목 · 지급횟수, 가입금액 3,000만 · 5,000만.
 * 펼침은 조립과 같은 `expandFixedDynTable` 이고, 칸마다 영역(급부 머리글 · 캡션 · 글자 열 머리 · 글자 칸 · 열 머리글 넷 · 셀)이 붙는다.
 *
 * DB·React import 금지 (순수층).
 */
import type { EnumDef } from "../catalog";
import { reductionBoundary, reductionPeriodEnumSeed } from "../coverage/traits";
import type { Code } from "../types";
import { expandFixedDynTable } from "./expandFixed";
import { DYN_TABLE_REGIONS, headerRegion, type DynTableRegion } from "./regions";
import { partsRenderer, sampleDeps, type DynTableArgValues, type SampleCell } from "./sampleView";
import type { DynBenefit, DynTable, NewDynTable } from "./types";

const 감액기간 = reductionPeriodEnumSeed();

export const DYN_TABLE_FIXED_SAMPLE: { label: string; description: string; benefits: DynBenefit[]; insuredAmounts: number[]; args: Record<string, boolean> } = {
  label: "통합치료비 — 급부 둘 · 가입금액 둘",
  description: "정액표 급부가 둘이라 급부 머리글이 서고, 가입금액(3,000만 · 5,000만)마다 캡션 + 표. 「상해 이외」만 1년 50% 감액이라 그 급부의 표만 지급금액 열이 둘.",
  benefits: [
    {
      subCoverageKey: "01",
      subCoverageName: "통합치료비",
      key: "1",
      name: "상해로 인한 경우",
      payRate: 100,
      fixedGrid: { columns: ["분류", "치료항목", "지급횟수"], rows: [{ cells: ["상해", "입원", "1일당"], amounts: { "30000000": 50_000, "50000000": 80_000 } }] },
    },
    {
      subCoverageKey: "01",
      subCoverageName: "통합치료비",
      key: "2",
      name: "상해 이외의 사유로 인한 경우",
      payRate: 100,
      reduction: { periods: [{ end: reductionBoundary(감액기간, "V03"), rate: 50 }], afterRate: 100 },
      fixedGrid: {
        columns: ["분류", "치료항목", "지급횟수"],
        rows: [
          { cells: ["질병", "입원", "1일당"], amounts: { "30000000": 50_000, "50000000": 80_000 } },
          { cells: ["질병", "통원", "1회당"], amounts: { "30000000": 25_000, "50000000": 40_000 } },
        ],
      },
    },
  ],
  insuredAmounts: [30_000_000, 50_000_000],
  args: { 갱신형: false },
};

export type FixedSampleBlock =
  | { kind: "benefitHeader" | "caption"; cell: SampleCell }
  | { kind: "table"; header: SampleCell[]; rows: { cells: SampleCell[]; spans?: number[] }[] };

export interface DynTableFixedSampleView {
  blocks: FixedSampleBlock[];
  /** 이 견본에 쓰인 영역 — 화면 순서. */
  regions: DynTableRegion[];
  issues: string[];
}

/** 정액형 정의를 견본으로 펼친다 — 블록(급부 머리글 · 캡션 · 표)마다 칸 + 영역. */
export function renderDynTableFixedSample(def: NewDynTable | DynTable, argValues: DynTableArgValues, enums?: ReadonlyMap<Code, EnumDef>): DynTableFixedSampleView {
  const sample = DYN_TABLE_FIXED_SAMPLE;
  const { table, bindings, deps, issues, note, noteIssue } = sampleDeps(def, argValues, enums);
  const expanded = expandFixedDynTable(table, { benefits: sample.benefits, insuredAmounts: sample.insuredAmounts }, bindings, deps);
  for (const i of expanded.issues) noteIssue(i.message);
  const render = partsRenderer(def, sample.benefits, note);
  const used = new Set<DynTableRegion>();
  const cell = (region: DynTableRegion, inlines: Parameters<typeof render>[0]): SampleCell => {
    used.add(region);
    return { region, parts: render(inlines) };
  };
  const blocks: FixedSampleBlock[] = expanded.blocks.map((b) => {
    if (b.kind === "benefitHeader") return { kind: "benefitHeader", cell: cell("benefitHeader", b.inlines) };
    if (b.kind === "caption") return { kind: "caption", cell: cell("caption", b.inlines) };
    const tc = textColumnsOf(b);
    const amountCols = b.header.length - tc;
    return {
      kind: "table",
      header: b.header.map((h, j) => cell(j < tc ? "textHeader" : headerRegion(j - tc, amountCols), h)),
      rows: b.rows.map((r) => ({ cells: r.cells.map((c, j) => cell(j < tc ? "textCell" : "cell", c)), ...(r.spans ? { spans: r.spans } : {}) })),
    };
  });
  return { blocks, regions: DYN_TABLE_REGIONS.filter((r) => used.has(r)), issues };
}

/** 표 블록의 글자 열 수 — 머리글 노드 id 가 `col` 템플릿인 열(펼침이 글자 열 머리를 `col` 로 찍는다). */
function textColumnsOf(b: Extract<ReturnType<typeof expandFixedDynTable>["blocks"][number], { kind: "table" }>): number {
  return b.header.filter((h) => h.length === 1 && h[0].kind === "text" && /\/col@/.test(h[0].id)).length;
}
