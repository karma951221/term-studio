/**
 * 시스템 견본 (순수) — 기능/동적표 §4.2 「견본」. 동적표 상세가 늘 그려 두는 표의 재료 — 사용자가 고르기만 하고 고치지 않는다.
 *
 * 견본은 표가 펼쳐지는 모양(열 수 · 열 머리글 넷 · 행 묶기 · 「해당보장의」 · 기준일 조건)을 하나씩 드러내도록 골랐다:
 * ① 감액 3구간(첫 · 가운데 · 마지막) ② 감액 1구간(첫 · 마지막) ③ 감액 없음(단일) ④ 급부 여럿 — 경계가 서로 달라 합집합으로 나뉨 ⑤ 갱신형 담보(기준일 최초계약일 — (갱신) 표가 아니다).
 *
 * 설명(`sampleDescription`)은 정의 모양별(2026-10-21): 감액 구간형이면 `description` 그대로, 단일형이면 그 견본에서 실제로 보이는 것
 * (열 하나 · 감액 구간은 안 나옴 · 비율 = 지급률 · 행 수 · 「해당보장의」). 갱신형 담보는 정의에 인자 `갱신형`(참거짓)이 없으면 모양과 무관하게
 * 「감액 3구간과 같은 표」 — 견본 값이 쓰일 자리가 없다.
 *
 * 인자 값(`sampleArgValues`): 견본이 이름으로 정한 값(지금은 `갱신형` 하나) → 그 인자의 상수 기본 연결 → 타입별 견본 값
 * (참거짓 = 아니오 · 열거형 = 첫 값 · 그 밖 = 「〔이름〕」 글). 구분자 기본 연결은 견본 문맥에서 풀 수 없어 타입별 견본 값으로 대신한다.
 *
 * DB·React import 금지 (순수층).
 */
import type { EnumDef } from "../catalog";
import type { ParamDef } from "../clause/params";
import type { Code, Value } from "../types";
import type { DynTableArgValues } from "./sampleView";
import { tableShape } from "./shape";
import type { DynBenefit, NewDynTable } from "./types";

export type DynTableSampleId = "reduction3" | "reduction1" | "noReduction" | "multiBenefit" | "renewal";

export interface DynTableSample {
  id: DynTableSampleId;
  /** 드롭다운 이름. */
  label: string;
  /** 한 줄 설명 — 감액 구간형 정의에서 이 견본이 드러내는 모양. 화면은 `sampleDescription` 으로 모양별 설명을 쓴다. */
  description: string;
  /** 급부 — 담보 트리 순(세부보장 순 → 급부 순). */
  benefits: DynBenefit[];
  /** 인자 이름 → 견본 값. 이름이 맞는 인자에만 쓴다. */
  args: Record<string, Value>;
}

/** 급부 하나 — 세부보장명 = 급부명, 감액 [[끝 개월, 비율] …] · 이후 100. */
function benefit(name: string, payRate: number, periods: [number, number][]): DynBenefit {
  return {
    subCoverageKey: name,
    subCoverageName: name,
    key: name,
    name,
    payRate,
    ...(periods.length > 0 ? { reduction: { periods: periods.map(([end, rate]) => ({ end, rate })), afterRate: 100 } } : {}),
  };
}

const THREE: [number, number][] = [
  [12, 25],
  [24, 50],
];

export const DYN_TABLE_SAMPLES: readonly DynTableSample[] = [
  {
    id: "reduction3",
    label: "감액 3구간 — 1년 25% · 2년 50% · 이후 100%",
    description: "급부 하나, 감액 경계 둘 → 첫 · 가운데 · 마지막 열이 모두 쓰인다.",
    benefits: [benefit("사망보험금", 100, THREE)],
    args: { 갱신형: false },
  },
  {
    id: "reduction1",
    label: "감액 1구간 — 1년 50% · 이후 100%",
    description: "경계 하나 → 가운데 열 없이 첫 · 마지막 열만.",
    benefits: [benefit("암진단비", 100, [[12, 50]])],
    args: { 갱신형: false },
  },
  {
    id: "noReduction",
    label: "감액 없음",
    description: "감액이 없으면 열이 하나 — 단일 열 머리글이 쓰인다.",
    benefits: [benefit("골절진단비", 100, [])],
    args: { 갱신형: false },
  },
  {
    id: "multiBenefit",
    label: "급부 여럿 — 구간이 서로 다름",
    description: "급부마다 경계가 달라도 경계를 합쳐 열을 나눈다(6개월 · 1년). 급부마다 한 행, 세부보장이 둘이라 셀 앞에 「해당보장의」.",
    benefits: [
      benefit("뇌졸중진단비", 100, [[12, 50]]),
      benefit("급성심근경색진단비", 20, [
        [6, 30],
        [12, 60],
      ]),
    ],
    args: { 갱신형: false },
  },
  {
    id: "renewal",
    label: "갱신형 담보 — 기준일 최초계약일",
    description: "(갱신) 표가 아니라 갱신형 담보의 첫 계약 감액 표(감액 3구간) — 인자 갱신형이 켜져 머리글 기준일이 「계약일」에서 「최초계약일」로 바뀐다.",
    benefits: [benefit("사망보험금", 100, THREE)],
    args: { 갱신형: true },
  },
];

/** 견본 하나 — 모르는 id 면 첫 견본. */
export function dynTableSample(id: string): DynTableSample {
  return DYN_TABLE_SAMPLES.find((s) => s.id === id) ?? DYN_TABLE_SAMPLES[0];
}

/** 개월 → 「6개월」 · 「1년」. */
function months(m: number): string {
  return m % 12 === 0 ? `${m / 12}년` : `${m}개월`;
}

/** 이 정의가 견본의 인자 `갱신형`을 받는가 — 참거짓 인자일 때만 견본 값이 들어간다(`sampleArgValues`). */
function readsRenewal(params: readonly ParamDef[]): boolean {
  return params.some((p) => p.name === "갱신형" && p.type.kind === "boolean");
}

/** 견본 설명 — 정의 모양별(감액 구간형 = `description`, 단일형 = 이 견본에서 실제로 보이는 것). */
export function sampleDescription(sample: DynTableSample, def: Pick<NewDynTable, "headers" | "params">): string {
  if (sample.id === "renewal" && !readsRenewal(def.params)) return "이 정의는 갱신형 인자를 읽지 않는다 — 감액 3구간과 같은 표.";
  if (tableShape(def.headers) === "split") return sample.description;
  const rates = sample.benefits.map((b) => `${b.payRate}%`).join(" · ");
  switch (sample.id) {
    case "reduction3":
    case "reduction1": {
      const periods = (sample.benefits[0].reduction?.periods ?? []).map((p) => `${months(p.end)} ${p.rate}%`).join(" · ");
      return `이 정의는 감액이 있어도 열 하나 — 감액 구간(${periods})은 표에 나오지 않고 비율은 지급률(${rates}).`;
    }
    case "noReduction":
      return "감액이 없다 — 이 정의는 늘 열 하나라 감액 견본과 모양이 같다(급부 하나 · 열 하나).";
    case "multiBenefit":
      return `급부마다 한 행, 열은 하나 — 경계가 달라도 열을 나누지 않고 비율은 급부별 지급률(${rates}). 세부보장이 둘이라 셀 앞에 「해당보장의」.`;
    case "renewal":
      return "인자 갱신형이 켜진다 — 이 정의는 열 하나라 감액 구간은 나오지 않고, 갱신형을 읽는 자리만 감액 3구간과 달라진다.";
  }
}

/** 견본이 인자를 채운다 — 견본 값 → 상수 기본 연결 → 타입별 견본 값. */
export function sampleArgValues(params: readonly ParamDef[], sample: DynTableSample, enums?: ReadonlyMap<Code, EnumDef>): DynTableArgValues {
  const out: DynTableArgValues = {};
  for (const p of params) {
    const own = sample.args[p.name];
    if (own !== undefined && (p.type.kind !== "boolean" || typeof own === "boolean")) {
      out[p.name] = own;
      continue;
    }
    if (p.default?.kind === "const") {
      out[p.name] = p.default.value;
      continue;
    }
    switch (p.type.kind) {
      case "boolean":
        out[p.name] = false;
        break;
      case "enum": {
        const first = enums?.get(p.type.enumCode)?.values[0]?.code;
        if (first !== undefined) out[p.name] = first;
        break;
      }
      case "articleRef":
        break;
      default:
        out[p.name] = `〔${p.name}〕`;
    }
  }
  return out;
}
