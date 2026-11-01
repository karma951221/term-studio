/**
 * 표 구분자 (순수) — 기능/구분자 §3.7 · §4.5, ADR-0099.
 *
 * 지급금액 표는 **시스템이 정의하는 구분자**다 — 결과 타입 「표」, 유효값 = 그 상품담보 문맥의 폼 값(감액 · 지급률 · 체증 · 단서문구 ·
 * 정액표 · 가입금액)으로 계산한 표. 계산 종류와 문구(머리글 · 셀 · 캡션)를 시스템이 정하고 사용자는 고치지 않는다.
 * 정의 하나 = 구분자 두 개(일반표 · 갱신표) — 같은 입력에서 계산하고 모양만 다르다(일반표 = 감액 구간 열, 갱신표 = 열 하나).
 *
 * - 코드는 옛 동적표 코드(`DT000001` …)를 그대로 쓴다 — 시스템이 정해 둔 고정 코드라 구분자 순번(`D0001`)과 섞이지 않고, DB 에 두지 않는다.
 * - 문구 안의 갈림은 시스템 연결(`tableDiscriminatorBindings`)이 댄다 — 사용자 인자 · 인자 연결은 없다:
 *   `갱신형`(기준일 낱말 「최초계약일」 / 「계약일」 — 그 상품담보의 갱신형 값) · `단서있음` · `단서`(담보 특성 「단서문구」 — 감액 열 머리글 꼬리).
 * - 펼침 · 금액 표기 · 견본은 이 폴더의 계산(`expandDynTable` · `expandFixedDynTable` · `formatWon` · `renderDynTableSample`)을 그대로 쓴다.
 *
 * DB·React import 금지 (순수층).
 */
import type { Inline } from "../clause/nodes";
import type { Bindings } from "../clause/params";
import { ESCALATION_STEPS, FIXED_GRID, INSURED_AMOUNTS, PROVISO_TEXT, REDUCTION_PERIODS } from "../coverage/traits";
import type { SlotPath } from "../catalog";
import type { Code } from "../types";
import { isTableDiscriminatorCode } from "./codes";
import { dynTableFixtureA, dynTableFixtureF, dynTableFixtureFR, dynTableFixtureR } from "./fixture";
import { DYN_TABLE_SLOT_LABEL, isDynTableSlotRef, type DynTable, type NewDynTable } from "./types";

export type TableDiscriminatorKind = "reduction" | "fixed";
export type TableDiscriminatorVariant = "general" | "renewal";

export interface TableDiscriminator {
  /** 시스템 고정 코드 (`DT000001` …). 문면의 표 구분자 자리(`tableRef`)가 이 코드를 가리킨다. */
  code: Code;
  /** 구분자명 — 시스템이 정한다. */
  label: string;
  /** 정의 이름 — 한 쌍이 함께 쓰는 이름(「감액 지급금액 표」 · 「통합치료비 표」). */
  definition: string;
  kind: TableDiscriminatorKind;
  variant: TableDiscriminatorVariant;
  /** 짝 구분자 코드 — 일반표 ↔ 갱신표. */
  pair: Code;
  /** 부착 레벨 — 늘 담보(상품담보 문맥). */
  level: "coverage";
  /** 읽는 폼 값 자리 — 상세 화면의 「읽는 폼」. */
  reads: SlotPath[];
  /** 계산 · 문구 — 펼침이 쓰는 표 정의. 사용자가 고치지 않는다. */
  table: DynTable;
}

/** 그 상품담보가 갱신형인가 — 담보속성 갱신유형(A0001)이 갱신형('2') (시드 구분자 「갱신형 담보」와 같은 식, ADR-0086 결정 6). */
export const RENEWABLE_CONDITION = "exist(attr.A0001) and attr.A0001 = '2'";

/** 시스템 인자 — 표 구분자의 문구가 읽는 갈림. 사용자가 연결하지 않고 조립이 문맥에서 댄다. */
export const TABLE_ARGS = { renewable: "갱신형", hasProviso: "단서있음", proviso: "단서" } as const;

const text = (id: string, t: string): Inline => ({ id, kind: "text", text: t });

/** 감액 열 머리글 꼬리 — 단서문구가 있으면 한 칸 띄우고 그 글(기능/구분자 §3.7 「감액 열 머리글」). */
function provisoTail(prefix: string): Inline {
  return {
    id: `${prefix}-proviso`,
    kind: "inlineCond",
    branches: [{ id: `${prefix}-proviso-b1`, when: `arg.${TABLE_ARGS.hasProviso}`, children: [text(`${prefix}-proviso-sp`, " "), { id: `${prefix}-proviso-v`, kind: "slot", ref: `arg.${TABLE_ARGS.proviso}` }] }],
  };
}

/** 보험금 지급금액표(일반) — 표본 정의 A + 감액 열 머리글(첫 · 가운데 · 마지막) 끝에 단서문구 꼬리. */
function reductionGeneral(): NewDynTable {
  const a = dynTableFixtureA();
  return {
    ...a,
    params: [...a.params, { name: TABLE_ARGS.hasProviso, type: { kind: "boolean" } }, { name: TABLE_ARGS.proviso, type: { kind: "string" } }],
    headers: {
      ...a.headers,
      first: [...a.headers.first, provisoTail("first")],
      middle: [...a.headers.middle, provisoTail("middle")],
      last: [...a.headers.last, provisoTail("last")],
    },
  };
}

function entry(code: Code, label: string, definition: string, kind: TableDiscriminatorKind, variant: TableDiscriminatorVariant, pair: Code, make: () => NewDynTable): TableDiscriminator {
  const reads: SlotPath[] = kind === "reduction" ? [REDUCTION_PERIODS, "pay.rate", ESCALATION_STEPS, PROVISO_TEXT] : [REDUCTION_PERIODS, FIXED_GRID, INSURED_AMOUNTS];
  return { code, label, definition, kind, variant, pair, level: "coverage", reads, table: { id: `system-${code}`, code, ...make(), label } };
}

/** 시스템 표 구분자 — 정의 둘 × 일반 · 갱신. 순서 = 목록 순서. */
export const TABLE_DISCRIMINATORS: readonly TableDiscriminator[] = [
  entry("DT000001", "보험금 지급금액표", "감액 지급금액 표", "reduction", "general", "DT000002", reductionGeneral),
  entry("DT000002", "갱신 보험금 지급금액표", "감액 지급금액 표", "reduction", "renewal", "DT000001", dynTableFixtureR),
  entry("DT000003", "통합치료비 지급금액표", "통합치료비 표", "fixed", "general", "DT000004", dynTableFixtureF),
  entry("DT000004", "갱신 통합치료비 지급금액표", "통합치료비 표", "fixed", "renewal", "DT000003", dynTableFixtureFR),
];

const BY_CODE = new Map(TABLE_DISCRIMINATORS.map((t) => [t.code, t]));

export function findTableDiscriminator(code: Code): TableDiscriminator | undefined {
  return BY_CODE.get(code);
}

export { isTableDiscriminatorCode };

/** 시스템 연결 — 문맥에서 읽은 갱신형 · 단서문구를 표 문구의 인자로. 정의에 없는 인자 연결은 펼침이 쓰지 않는다. */
export function tableDiscriminatorBindings(input: { renewable: boolean; proviso?: string }): Bindings {
  return {
    [TABLE_ARGS.renewable]: { kind: "const", value: input.renewable },
    [TABLE_ARGS.hasProviso]: { kind: "const", value: input.proviso !== undefined },
    [TABLE_ARGS.proviso]: { kind: "const", value: input.proviso ?? "" },
  };
}

/**
 * 문구 템플릿의 읽기 표기 — 표 구분자 상세(기능/구분자 §4.5)가 보이는 한 줄. 표 슬롯은 `{경계}`, 시스템 인자 단서문구는 `{단서문구}`,
 * 기준일 조건은 `〔(최초)계약일〕`, 그 밖의 조건은 첫 가지를 `〔…〕` 로 감싼다.
 */
export function templateText(inlines: readonly Inline[]): string {
  return inlines
    .map((n): string => {
      switch (n.kind) {
        case "text":
          return n.text;
        case "slot":
          if (isDynTableSlotRef(n.ref)) return `{${DYN_TABLE_SLOT_LABEL[n.ref]}}`;
          return n.ref === `arg.${TABLE_ARGS.proviso}` ? "{단서문구}" : `{${n.ref}}`;
        case "inlineCond": {
          const first = n.branches[0];
          if (first?.when === `arg.${TABLE_ARGS.renewable}`) return "〔(최초)계약일〕";
          return first ? `〔${templateText(first.children)}〕` : "";
        }
        default:
          return "";
      }
    })
    .join("");
}
