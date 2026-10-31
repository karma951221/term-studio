/**
 * 출처 패널의 덧칠 규칙 (순수 — ADR-0092 결정 1 · 기능/조립산출 §3.7) — 원본 자리 id 짓기 · 결정 노드 찾기 · 값 표기 · 이동 주소.
 *
 * - 원본 자리 id 는 오류 좌표 키와 같은 체계다(§3.4): 반복 원소 안이면 `@원소` 접미사(바깥 → 안쪽), 펼친 함수조항 안이면 `참조id(접미사 포함)/안쪽id`.
 *   결정 노드 기록(`DecisionRecord.nodeId`) · 결과 글 조각(슬롯 값)의 id 가 이 규칙이라, 원본을 걸으며 지은 id 로 바로 찾는다.
 * - 이동 주소는 「고치러 가기」 표(§3.4)와 같은 목적지다.
 */
import type { ArgRecord, ConditionEval, DecisionRecord, DynTableDecision, ReadRecord, RepeatDecision, SourceView } from "@/domain/assembly";
import { koreanExpr, OUTPUT_DISPLAY, refPath, SCOPE_WORD_CHIP, type Expr, type KoreanLabels, type Ref } from "@/domain/expression";
import type { Code, Id, Value, ValueSlot } from "@/domain/types";

// ───────────────────────────── 결정 노드 색인 ─────────────────────────────

/** 기록을 평평하게 — 노드 id → 기록. 가지 · 값별 분기 칸 · 함수조항 본문 · 반복 원소 · 동적표 행 안까지. */
export function indexDecisions(decisions: readonly DecisionRecord[], out = new Map<Id, DecisionRecord>()): Map<Id, DecisionRecord> {
  for (const d of decisions) {
    out.set(d.nodeId, d);
    switch (d.kind) {
      case "condition":
        for (const b of d.branches) indexDecisions(b.decisions, out);
        break;
      case "switch":
      case "clause":
        indexDecisions(d.decisions, out);
        break;
      case "repeat":
        for (const e of d.elements) indexDecisions(e.decisions, out);
        indexDecisions(d.fallback ?? [], out);
        indexDecisions(d.header ?? [], out);
        break;
      case "dynTable":
        indexDecisions(d.header, out);
        for (const r of d.rows) indexDecisions(r.decisions, out);
        break;
    }
  }
  return out;
}

// ───────────────────────────── 원본 자리 id ─────────────────────────────

export interface Scope {
  prefix: string;
  suffix: string;
}

export const ROOT_SCOPE: Scope = { prefix: "", suffix: "" };

export const keyOf = (s: Scope, id: Id): string => `${s.prefix}${id}${s.suffix}`;

/** 반복 원소 하나 안 — 접미사 `@원소`. */
export const elementScope = (s: Scope, elementId: string): Scope => ({ prefix: s.prefix, suffix: `${s.suffix}@${elementId}` });

/** 펼친 함수조항 안 — 참조 id(그 자리 접미사 포함) 뒤 `/`, 안쪽 노드는 접미사를 받지 않는다. */
export const clauseScope = (s: Scope, refId: Id): Scope => ({ prefix: `${keyOf(s, refId)}/`, suffix: "" });

/** 반복 원소 탭의 처음 고름 — 누른 노드 id 에 그 원소 접미사가 있으면 그 원소, 아니면 첫 원소. */
export function elementForNode(rec: RepeatDecision, node: string | undefined): string | undefined {
  if (node) {
    const parts = node.split("/")[0]!.split("@").slice(1);
    const hit = rec.elements.find((e) => parts.includes(e.id));
    if (hit) return hit.id;
  }
  return rec.elements[0]?.id;
}

/**
 * 동적표 탭의 처음 고름 — 누른 노드 id 가 그 표의 칸이면 그 행(감액 표 `@r{행}`, 1부터) · 표 블록(정액형 `@k{블록}`)의 탭, 아니면 첫 탭.
 * 노드 id 규칙은 `dyntable/expand.ts` · `expandFixed.ts` 머리 주석.
 */
export function dynRowForNode(rec: DynTableDecision, node: string | undefined): number {
  const local = node?.startsWith(`${rec.nodeId}/`) ? node.slice(rec.nodeId.length + 1) : node;
  if (!local) return 0;
  if (rec.fixed) {
    const k = /@k(\d+)/.exec(local);
    const hit = k ? rec.rows.findIndex((r) => r.blocks?.includes(Number(k[1]))) : -1;
    return hit < 0 ? 0 : hit;
  }
  const r = /@r(\d+)c/.exec(local);
  const i = r ? Number(r[1]) - 1 : -1;
  return i >= 0 && i < rec.rows.length ? i : 0;
}

// ───────────────────────────── 값 표기 ─────────────────────────────

export const BRANCH_OUTCOME_LABEL = { taken: "탐", false: "거짓", skipped: "앞 가지에서 결정 — 평가 안 함", blocked: "막힘" } as const;

type EnumLabels = { values: Record<Code, string> } | undefined;

export function valueText(value: Value, labels?: EnumLabels): string {
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return labels?.values[value] ? `${labels.values[value]} (${value})` : value;
  if (!Array.isArray(value)) return `정액표 ${value.rows.length}행`;
  if (value.length === 0) return "(빈 목록)";
  if (typeof value[0] === "object") return `표 ${value.length}행`;
  return (value as string[]).map((v) => valueText(v, labels)).join(" · ");
}

export function slotText(slot: ValueSlot | "missing" | "undetermined" | "invalid", labels?: EnumLabels): string {
  if (slot === "missing") return "자리 없음";
  if (slot === "undetermined") return "미결";
  if (slot === "invalid") return "없는 값";
  return slot.entered ? valueText(slot.value, labels) : "미입력";
}

const discriminatorLabel = (view: Pick<SourceView, "discriminators">, code: Code) => view.discriminators[code]?.label ?? code;
const enumOf = (view: Pick<SourceView, "discriminators" | "enums">, code: Code) => {
  const e = view.discriminators[code]?.enumCode;
  return e ? view.enums[e] : undefined;
};

/** 조건 근거 — 그 식이 곧바로 읽은 구분자 · 담보속성마다 「이름 = 유효값」. */
export function readsText(ev: ConditionEval, view: Pick<SourceView, "discriminators" | "enums" | "attributes">): string[] {
  return [
    ...ev.discriminators.map((d) => `${discriminatorLabel(view, d.code)} = ${slotText(d.slot, enumOf(view, d.code))}`),
    ...ev.attributes.map((a) => {
      const k = view.attributes[a.code];
      return `${k?.label ?? a.code} = ${a.value === "unused" ? "사용 안 함" : (k?.values[a.value] ?? a.value)}`;
    }),
  ];
}

/** 함수조항 인자 한 줄 — 「면책기간 ← 감액기간 = 1년」. `clause` 를 주면 열거 인자의 상수 · 현재 원소 값도 값 이름으로. */
export function argText(arg: ArgRecord, view: Pick<SourceView, "discriminators" | "enums"> & Partial<Pick<SourceView, "clauses">>, clause?: Code): string {
  const b = arg.binding;
  const paramEnum = clause ? view.clauses?.[clause]?.paramEnums?.[arg.name] : undefined;
  const labels = b?.kind === "discriminator" ? enumOf(view, b.code) : paramEnum ? view.enums[paramEnum] : undefined;
  const value = arg.issue ? `오류 — ${arg.issue.message}` : arg.value === undefined ? undefined : valueText(arg.value, labels);
  if (!b) return value === undefined ? `${arg.name} — 연결 없음` : `${arg.name} = ${value}`;
  switch (b.kind) {
    case "discriminator":
      return `${arg.name} ← ${discriminatorLabel(view, b.code)}${value !== undefined ? ` = ${value}` : ""}`;
    case "const":
      return `${arg.name} = ${value ?? valueText(b.value)} (상수)`;
    case "current":
      return `${arg.name} ← 반복의 현재 원소${value !== undefined ? ` = ${value}` : ""}`;
    case "source":
      return `${arg.name} ← 세목 선택지`;
    case "articleRef":
      return `${arg.name} ← 조 참조`;
  }
}

// ───────────────────────────── 조건식 표기 ─────────────────────────────

/** 식이 놓인 자리 — 펼친 함수조항 본문이면 그 조항(인자 선언), 담보약관 원본이면 그 담보의 노드 머리 표기. */
export interface ExprAt {
  clause?: Code;
  nodeLabels?: Record<string, string>;
}

type ExprView = Pick<SourceView, "discriminators" | "enums" | "attributes"> & Partial<Pick<SourceView, "clauses">>;

/** 출처 패널의 이름표로 짓는 표기 훅 — 참조 표시명 · 열거 값 이름 · 필드 이름. */
export function exprLabels(view: ExprView, at: ExprAt = {}): KoreanLabels {
  const paramEnum = (name: string) => (at.clause ? view.clauses?.[at.clause]?.paramEnums?.[name] : undefined);
  const name = (ref: Ref): string => {
    switch (ref.kind) {
      case "discriminator": {
        const label = discriminatorLabel(view, ref.code);
        return ref.node ? `${at.nodeLabels?.[ref.node.path] ?? `노드 ${ref.node.path}`} › ${label}` : label;
      }
      case "attr":
        return view.attributes[ref.code]?.label ?? ref.code;
      case "output":
        return ref.prop === "scope" ? SCOPE_WORD_CHIP : OUTPUT_DISPLAY;
      case "param":
      case "local":
        return ref.name;
      default:
        return refPath(ref);
    }
  };
  const enumOfExpr = (e: Expr): { values: Record<Code, string>; fields?: Record<Code, string> } | undefined => {
    if (e.kind !== "ref") return undefined;
    if (e.ref.kind === "discriminator") return enumOf(view, e.ref.code);
    if (e.ref.kind === "attr") return view.attributes[e.ref.code];
    if (e.ref.kind === "param") {
      const code = paramEnum(e.ref.name);
      return code ? view.enums[code] : undefined;
    }
    return undefined;
  };
  return {
    name,
    value: (against, code) => enumOfExpr(against)?.values[code],
    member: (target, field) => {
      const label = enumOfExpr(target)?.fields?.[field];
      return label && target.kind === "ref" ? `${name(target.ref)}.${label}` : undefined;
    },
  };
}

/** 소스 식 → 한국어 표기 (「작성위치 = 대치」 · 「납입형태 있음 그리고 …」). 파싱 실패면 원문 — 원문은 화면이 툴팁으로 남긴다. */
export function exprText(source: string, view: ExprView, at?: ExprAt): string {
  return koreanExpr(source, exprLabels(view, at));
}

// ───────────────────────────── 이동 주소 ─────────────────────────────

export const links = {
  /** 원본 조 — 문면 편집기의 그 조, 상품 조 사본이면 상품 보통약관 탭의 그 조. */
  source(view: Pick<SourceView, "productId" | "explanation" | "sources">, index: number): string | undefined {
    const s = view.explanation.sources[index]!;
    if (s.kind === "copy") return `/products/${view.productId}?tab=general&art=${encodeURIComponent(s.articleId)}`;
    const record = view.sources[index]?.documentRecordId;
    // 문서를 모르면 담보 상세(거기서 「담보약관 열기」) — 고치러 가기 표(§3.4)와 같다
    if (!record) return s.coverageId ? `/coverages/${s.coverageId}` : undefined;
    return `/documents/${record}?node=${encodeURIComponent(s.articleId)}`;
  },
  clause: (code: Code) => `/functions/${code}`,
  discriminator: (code: Code) => `/catalog/${code}`,
  enumValue: (enumCode: Code, value?: Code) => `/enums/${enumCode}${value ? `?value=${encodeURIComponent(value)}` : ""}`,
  /** 상품 구성 — 상품담보 값 화면 · 기본계약 블록. */
  productCoverage: (view: Pick<SourceView, "productId">, pcId: Id) => `/products/${view.productId}/coverages/${pcId}`,
  baseContract: (view: Pick<SourceView, "productId">) => `/products/${view.productId}?tab=coverages#base-contract`,
  /** 읽은 값 — 상품 값 · 세목 선택지 값은 기본정보, 상품담보 스냅샷 값은 그 상품담보. */
  read(view: Pick<SourceView, "productId" | "readOwners">, r: ReadRecord): string | undefined {
    if (r.owner.kind === "product" || r.owner.kind === "plan") return `/products/${view.productId}?tab=basic`;
    const pc = view.readOwners[r.owner.id];
    return pc ? `/products/${view.productId}/coverages/${pc}` : undefined;
  },
};
