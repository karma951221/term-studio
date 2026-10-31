/**
 * 견본 표 (순수) — 기능/동적표 §4.2 「견본 표」. 견본 급부 · 인자 값으로 정의를 펼쳐(`expandDynTable` — 조립과 같은 펼침) 칸마다
 * 영역(`regionsOf`)과 글 조각을 돌려준다. 화면은 이 표를 늘 그려 두고 칸 ↔ 템플릿 필드를 잇는다.
 *
 * - 인자 값은 상수 연결로 — 펼침이 `arg.X` 슬롯 · 조건을 리터럴로 바꿔 쓴다. 값을 주지 않은 인자의 슬롯은 「〔이름〕」 값 조각으로 드러난다(막지 않는다).
 * - 남은 인라인(글 · 조건 · 값별 분기 · 조사)은 작은 평가 문맥으로 푼다 — `count(builtin.subCoverage.name)` 은 견본의 세부보장명 개수(서로 다른 이름 수).
 *   그 밖의 참조는 미결로 보고 그 가지를 거짓으로 둔다(사유는 `issues`).
 * - 글 조각: 자리표시자(슬롯)에 들어간 값 = `value`, 조건 · 값별 분기가 고른 글 = `cond`. 같은 표시가 이웃하면 한 조각으로 잇는다.
 *
 * DB·React import 금지 (순수층).
 */
import type { EnumDef } from "../catalog";
import type { ConstFormatter } from "../clause/bind";
import type { Inline } from "../clause/nodes";
import type { Binding, Bindings, ParamDef } from "../clause/params";
import { chooseParticle } from "../document/particles";
import { evaluate, parse, type EvalContext } from "../expression";
import { entered, type Code, type Value } from "../types";
import { expandDynTable } from "./expand";
import { DYN_TABLE_REGIONS, placeholderIds, regionsOf, templateNodeId, type DynTableRegion } from "./regions";
import { DYN_TABLE_SLOT_LABEL, isDynTableSlotRef, type DynBenefit, type DynTable, type NewDynTable } from "./types";

/** 인자 이름 → 견본 값. undefined · 없음 = 연결하지 않음. */
export type DynTableArgValues = Record<string, Value | undefined>;

/** 칸 글의 한 조각 — `value` = 자리표시자에 들어간 값, `cond` = 조건 · 값별 분기가 고른 글. */
export interface SamplePart {
  text: string;
  value?: true;
  cond?: true;
}

export interface SampleCell {
  region: DynTableRegion;
  parts: SamplePart[];
}

export interface DynTableSampleView {
  /** `[구분 칸, 열1 .. 열N]`. */
  header: SampleCell[];
  /** 행마다 `[행 머리(급부명), 셀1 .. 셀N]`. */
  rows: SampleCell[][];
  /** 이 표에 쓰인 영역 — 화면 순서(`DYN_TABLE_REGIONS`). */
  regions: DynTableRegion[];
  /** 펼침 · 평가 문제 — 중복 없이. */
  issues: string[];
}

/** 칸 글 전체. */
export function cellText(cell: SampleCell): string {
  return cell.parts.map((p) => p.text).join("");
}

const REF_ID = "sample";

/** 인자 값 → 상수 연결. 스칼라만(목록값은 상수 연결이 없다 — 그대로 미연결). */
function constBindings(params: readonly ParamDef[], values: DynTableArgValues): Bindings {
  const out: Bindings = {};
  for (const p of params) {
    const v = values[p.name];
    if (v === undefined || Array.isArray(v) || typeof v === "object") continue;
    if (typeof v === "string" && v === "") continue;
    const b: Binding = { kind: "const", value: v };
    out[p.name] = b;
  }
  return out;
}

/** 상수 글 — 열거값은 값 이름, 참거짓은 예 · 아니오, 나머지는 그대로. */
function formatterOf(enums: ReadonlyMap<Code, EnumDef> | undefined): ConstFormatter {
  return (value, param) => {
    if (typeof value === "boolean") return value ? "예" : "아니오";
    if (param.type.kind === "enum" && typeof value === "string") {
      const def = enums?.get(param.type.enumCode);
      return def?.values.find((v) => v.code === value)?.label ?? value;
    }
    return String(value);
  };
}

/** 견본의 담보 문맥 — 세부보장마다 문맥 하나(`builtin.subCoverage.name` 만 안다). */
function sampleContext(benefits: readonly DynBenefit[]): EvalContext {
  const names = [...new Set(benefits.map((b) => b.subCoverageName))];
  const child = (name: string): EvalContext => ({
    lookup: (ref) => (ref.kind === "builtin" && ref.level === "subCoverage" && ref.prop === "name" ? { kind: "slot", slot: entered(name) } : { kind: "undetermined" }),
    attribute: () => ({ kind: "undetermined" }),
    children: () => undefined,
  });
  return {
    lookup: () => ({ kind: "undetermined" }),
    attribute: () => ({ kind: "undetermined" }),
    children: (ref) => (ref.kind === "builtin" && ref.level === "subCoverage" ? names.map(child) : undefined),
  };
}

/** 견본 펼침의 공통 재료 — 참조 id · 상수 연결 · 상수 글 · 이슈 모으기. 정액형 견본(`fixedSample.ts`)도 쓴다. */
export const SAMPLE_REF_ID = REF_ID;

export function sampleDeps(def: NewDynTable | DynTable, argValues: DynTableArgValues, enums: ReadonlyMap<Code, EnumDef> | undefined) {
  const issues: string[] = [];
  const note = (m: string) => {
    if (!issues.includes(m)) issues.push(m);
  };
  const table: DynTable = { id: REF_ID, code: REF_ID, ...def };
  const noteIssue = (message: string) => note(message.replace(`동적표 ${REF_ID} — `, "").replace(`동적표 ${REF_ID} 의 `, ""));
  return { table, bindings: constBindings(def.params, argValues), deps: { formatConst: formatterOf(enums), refId: REF_ID }, issues, note, noteIssue };
}

export function renderDynTableSample(def: NewDynTable | DynTable, benefits: readonly DynBenefit[], argValues: DynTableArgValues, enums?: ReadonlyMap<Code, EnumDef>): DynTableSampleView {
  const { table, bindings, deps, issues, note, noteIssue } = sampleDeps(def, argValues, enums);
  const expanded = expandDynTable(table, { benefits: [...benefits] }, bindings, deps);
  for (const i of expanded.issues) noteIssue(i.message);
  const render = partsRenderer(def, benefits, note);

  const regions = regionsOf(expanded);
  const header = expanded.header.map((cell, j): SampleCell => ({ region: regions.header[j], parts: render(cell) }));
  const rows = expanded.rows.map((row, i) => row.cells.map((cell, j): SampleCell => ({ region: regions.rows[i][j], parts: render(cell) })));
  const used = new Set<DynTableRegion>([...regions.header, ...regions.rows.flat()]);
  return { header, rows, regions: DYN_TABLE_REGIONS.filter((r) => used.has(r)), issues };
}

/** 펼친 인라인 → 글 조각 — 남은 조건 · 값별 분기 · 조사를 견본 문맥으로 풀고, 자리표시자 값에 `value` 를 단다. */
export function partsRenderer(def: Pick<NewDynTable, "headers" | "cell" | "fixed">, benefits: readonly DynBenefit[], note: (m: string) => void): (list: readonly Inline[]) => SamplePart[] {
  const placeholders = placeholderIds(def);

  const ctx = sampleContext(benefits);
  const evalSrc = (src: string): Value | undefined => {
    const parsed = parse(src);
    if (!parsed.ok) {
      note(`식을 읽을 수 없습니다: ${src}`);
      return undefined;
    }
    const r = evaluate(parsed.value, ctx);
    if (r.kind === "value") return r.value;
    if (r.kind === "error") note(r.issue.message);
    else note(`${r.reason} 을(를) 견본 문맥에서 정할 수 없다 — 그 조건은 거짓으로 본다`);
    return undefined;
  };

  const render = (list: readonly Inline[]): SamplePart[] => {
    const parts: SamplePart[] = [];
    const push = (text: string, flags: { value?: boolean; cond?: boolean }) => {
      if (text === "") return;
      const last = parts.at(-1);
      if (last && !!last.value === !!flags.value && !!last.cond === !!flags.cond) {
        last.text += text;
        return;
      }
      parts.push({ text, ...(flags.value ? { value: true } : {}), ...(flags.cond ? { cond: true } : {}) });
    };
    const before = () => parts.map((p) => p.text).join("");
    const walk = (nodes: readonly Inline[], cond: boolean) => {
      for (const n of nodes) {
        switch (n.kind) {
          case "text": {
            const tid = templateNodeId(n.id, REF_ID);
            push(n.text, { cond, value: tid !== undefined && placeholders.has(tid) });
            break;
          }
          case "slot": {
            // 펼침이 표 슬롯은 글로, 상수로 연결한 인자는 글로 바꿨다 — 남은 것은 값이 없는 자리
            const label = isDynTableSlotRef(n.ref) ? DYN_TABLE_SLOT_LABEL[n.ref] : n.ref.startsWith("arg.") ? n.ref.slice("arg.".length) : n.ref;
            push(`〔${label}〕`, { cond, value: true });
            break;
          }
          case "inlineCond": {
            const hit = n.branches.find((br) => br.when === undefined || evalSrc(br.when) === true);
            if (hit) walk(hit.children, true);
            break;
          }
          case "inlineSwitch": {
            const v = evalSrc(n.on);
            if (typeof v !== "string") break;
            const hit = n.cases.find((k) => k.values?.includes(v));
            if (!hit) note(`값별 분기에 칸이 없는 값: ${v}`);
            else if (!hit.empty) walk(hit.children, true);
            break;
          }
          case "particle": {
            const { text, resolved } = chooseParticle(n.preset, before());
            if (!resolved) note(`조사 — 앞 글자로 받침을 판정할 수 없어 「${text}」로 병기했습니다`);
            push(text, { cond });
            break;
          }
          default:
            break;
        }
      }
    };
    walk(list, false);
    return parts;
  };
  return render;
}
