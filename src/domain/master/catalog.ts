/**
 * MVP 입력 마스터 **정본** (ADR-0037 §6 · 기능/마스터 §3.3).
 *
 * 여기 있는 것이 전부다 — 시드가 실제로 쓰는 폼만 옮겼다. 폼을 더하는 것은 배포 + 마이그레이션이다.
 *
 * 레벨 배치의 근거:
 * - 공시이율{평균공시이율} · 상품특성{주계약/독립특약 구분 · 갱신형여부 · 태아보장여부 · 단체계약여부 · 고지유형 · 담보명 접사} · 책자{그룹 제목 표시}는 **상품(product)** —
 *   상품 한 권에 하나인 사실이라 세목 축을 타지 않는다. 기본정보 탭의 상품정보에서 상품명과 함께 편집 한 번 · 저장 한 번 (2026-09-28).
 *   고지유형을 상품 레벨 enum 으로 둔 결정(ADR-0006)의 구현이다. 계약은 일반심사 · 간편심사 · 건강고지 중 하나이고,
 *   간편심사 · 건강고지면 담보명 접사(상품담보명 규칙의 「[고지 접사]」 칩)만 받는다 — 세부 고지유형(간편심사구분 · 간편심사유형 ·
 *   건강고지유형)은 2026-10-29 뺐다: 약관만 다루므로 PV 연동용 세부 유형까지 모델링하지 않는다 (마이그레이션 0036 이 값 행을 지운다).
 * - 납입면제 · 무저해지 · 계약전환 · 영위업종적용은 **세목(plan)** — 값을 갖는 것이 세목 선택지라
 *   상품 레벨로 올리면 종 · 형 축이 성립하지 않는다. 필드마다 코드 `defaultValue` 를 두어 새 선택지는 그 값으로 프리필된다
 *   (기능/상품 §3.2 「선택지는 기본값으로 태어난다」 — 저장해야 값이 된다).
 * - **담보(coverage)** 레벨 폼은 없다 — 보험금명(`coverage_basic.claim_name`)은 2026-10-21 뺐다: 담보약관 템플릿은 담보 하나가 한 벌
 *   소유라 조문의 보험금 이름은 그 담보약관에 글자로 쓴다 (ADR-0091 · 마이그레이션 0034). 갱신유형은 담보속성(A0001)이라 마스터에 없다.
 * - 보험금지급{지급률}은 **급부(benefit)** — 선택 필드이고 안 적으면 100% 다 (기능/담보 §3.4 · 동적표가 100 으로 읽는다).
 *   최초1회한(`pay.first_only`)은 2026-09-27 뺐다 — 필요 없는 칸 (기능/마스터 §6.2 · 마이그레이션 0016 이 값 행을 지운다).
 *   면책여부(`pay.exempt`)는 2026-10-21 뺐다 — 면책은 면책 특성(`exemption`)이 붙었는지로만 정한다 (기능/담보 §6.2 · 마이그레이션 0033).
 *
 * enum 코드(E0001 · E0002)는 데이터(열거형변수)를 가리킨다 — 값은 배포 없이 늘어난다 (ADR-0037 §5).
 */
import type { ValueSlot } from "../types";
import type { FormFieldReader, MasterForm } from "./types";

/** 고지유형 E0005 값 코드 — 상품특성 조건부 칸의 조건. */
export const NOTICE_KIND = { general: "V01", review: "V02", health: "V03" } as const;
/** 계약형태 E0007 값 코드 — 독립특약이면 기본계약을 두지 않는다 (기능/상품 §3.1 · 2026-10-01). */
export const CONTRACT_KIND = { main: "V01", standalone: "V02" } as const;
/** 계약형태 값 자리 경로 — 기본계약 규칙(기능/상품 §3.5)이 읽는다. */
export const CONTRACT_KIND_PATH = "feature.contract_kind";
/** 독립특약인가 — 미입력은 기본값(주계약)으로 본다. */
export function isStandaloneContract(slot: ValueSlot | undefined): boolean {
  return slot?.entered === true && slot.value === CONTRACT_KIND.standalone;
}
/** 「그룹 제목 표시」 값 자리 — 상품 레벨 책자 폼, 절 형태의 제2절 블록 번호 머리를 정한다 (ADR-0090 결정 8 · 기능/상품 §4.4). */
export const GROUP_TITLES_PATH = "booklet.group_titles";
/** 그룹 제목 표시를 켰나 — 미입력은 기본값(끔)으로 본다. */
export function showsGroupTitles(slot: ValueSlot | undefined): boolean {
  return slot?.entered === true && slot.value === true;
}
/** 해약환급금유형 E0002 값 코드 — 무저해지 유형의 기본값은 표준형(해약환급금지급형, 기능/상품 §3.2). */
export const NO_SURRENDER_TYPE = { standard: "V01" } as const;
/** 고지유형 · 담보명 접사 값 자리 — 상품담보명 규칙의 「[고지 접사]」 칩 재료 (기능/상품 §3.1 · 2026-10-29). */
export const NOTICE_KIND_PATH = "feature.notice_kind";
export const NOTICE_AFFIX_PATH = "feature.notice_affix";
/** 상품의 담보명 접사 — 간편심사 · 건강고지일 때만, 앞뒤 공백 없이. 일반심사 · 미입력이면 빈 글자. */
export function noticeAffixOf(slots: ReadonlyMap<string, ValueSlot>): string {
  const kind = slots.get(NOTICE_KIND_PATH);
  if (kind?.entered !== true || kind.value === NOTICE_KIND.general) return "";
  const affix = slots.get(NOTICE_AFFIX_PATH);
  return affix?.entered === true && typeof affix.value === "string" ? affix.value.trim() : "";
}

/** 비울 수 없는 칸 — 미입력이면 그 칸에 오류 (갱신형여부 · 고지유형, 2026-10-29 사용자 결정). */
const required = (key: string, label: string) => ({
  description: `${label}는 비울 수 없다`,
  check: (read: FormFieldReader) => (read(key)?.entered ? undefined : { field: key, message: `${label}를 고르세요` }),
});

export const MASTER: readonly MasterForm[] = [
  {
    key: "disclosure",
    label: "공시이율",
    level: "product",
    fields: [{ key: "avg_rate", label: "평균공시이율", type: { kind: "number" }, unit: "%", description: "% — 이 계약 체결 시점의 평균공시이율 (예: 2.5 = 2.50%)" }],
  },
  {
    key: "feature",
    label: "상품특성",
    level: "product",
    fields: [
      { key: "contract_kind", label: "주계약/독립특약 구분", type: { kind: "enum", enumCode: "E0007" }, defaultValue: CONTRACT_KIND.main, display: "radio" },
      { key: "renewable", label: "갱신형여부", type: { kind: "boolean" } },
      // 일반 상품은 아니오 · 일반심사 — 기본값이면 감추고 기본정보 탭 「상품특성 +」로 꺼낸다 (2026-10-29 사용자 결정)
      { key: "fetal", label: "태아보장여부", type: { kind: "boolean" }, defaultValue: false, hiddenByDefault: true },
      { key: "group_contract", label: "단체계약여부", type: { kind: "boolean" }, defaultValue: false, hiddenByDefault: true },
      { key: "notice_kind", label: "고지유형", type: { kind: "enum", enumCode: "E0005" }, defaultValue: NOTICE_KIND.general, hiddenByDefault: true },
      {
        key: "notice_affix",
        label: "담보명 접사",
        type: { kind: "string" },
        description: "상품담보명 규칙의 [고지 접사] 칩 자리에 붙는다 — 예) (통합간편심사형). 비워도 된다",
        visibleWhen: { field: "notice_kind", notEquals: NOTICE_KIND.general },
      },
    ],
    rules: [required("renewable", "갱신형여부"), required("notice_kind", "고지유형")],
  },
  {
    // 책자 모양 — 절 형태(독립특약 · 기본계약 2+)의 제2절에만 작용한다. 켜면 그룹 제목 줄 + 「Ⅰ-1.」, 끄면 「1.」 (ADR-0090 결정 8)
    key: "booklet",
    label: "책자",
    level: "product",
    fields: [{ key: "group_titles", label: "그룹 제목 표시", type: { kind: "boolean" }, defaultValue: false, infoTip: true, description: "절 형태의 제2절 블록에 그룹 제목 줄 · 「Ⅰ-1.」 번호 — 끄면 「1.」 「2.」. 주계약의 특약 그룹과는 무관하다" }],
  },
  {
    key: "waiver",
    label: "납입면제",
    level: "plan",
    description: "납입면제 사유에 해당하면 이후 보험료를 받지 않는다",
    fields: [
      { key: "applies", label: "적용여부", type: { kind: "boolean" }, defaultValue: false },
      { key: "reasons", label: "납입면제사유", type: { kind: "list<enum>", enumCode: "E0001" } },
      // 실물의 15세 단서는 사유마다가 아니라 암보장개시일 정의 문장에 붙는다 — 종 하나에 하나 (기능/상품 §3.9).
      // 보통약관 납입면제 부가항의 15세 단서가 읽는다(구분자 「15세 이상 적용 종」) — 적용 종의 미입력은 조립 오류
      { key: "age15", label: "15세 이상 적용", type: { kind: "boolean" }, defaultValue: false },
    ],
    rules: [
      {
        // 납입면제종 = 적용여부 = 예 인 선택지 — 사유 없는 종은 펼칠 항이 없다 (결정 16 · 기능/상품 §3.9)
        description: "적용여부 = 예면 납입면제사유를 1개 이상 고른다",
        check: (read) => {
          const applies = read("applies");
          if (!applies?.entered || applies.value !== true) return undefined;
          const reasons = read("reasons");
          const count = reasons?.entered && Array.isArray(reasons.value) ? reasons.value.length : 0;
          return count > 0 ? undefined : { field: "reasons", message: "적용여부가 「예」면 납입면제사유를 1개 이상 고르세요" };
        },
      },
    ],
  },
  {
    key: "no_surrender",
    label: "무저해지",
    level: "plan",
    fields: [{ key: "type", label: "유형", type: { kind: "enum", enumCode: "E0002" }, defaultValue: NO_SURRENDER_TYPE.standard }],
  },
  {
    key: "conversion",
    label: "계약전환",
    level: "plan",
    fields: [{ key: "converts", label: "전환여부", type: { kind: "boolean" }, defaultValue: false }],
  },
  {
    key: "business_type",
    label: "영위업종적용",
    level: "plan",
    fields: [{ key: "applies", label: "적용여부", type: { kind: "boolean" }, defaultValue: false }],
  },
  {
    key: "pay",
    label: "보험금지급",
    level: "benefit",
    description: "급부 하나의 지급 조건 — 담보 레벨 구분자가 집계로 읽는 자리",
    fields: [
      // 선택 필드 — 필요한 급부만 급부 이름 줄의 「지급률 ⊕」로 더한다. 안 적으면 100% (2026-10-21)
      { key: "rate", label: "지급률", type: { kind: "number" }, unit: "%", optional: true },
    ],
  },
  {
    key: "reduction",
    label: "감액",
    level: "benefit",
    optional: true,
    system: true,
    description: "급부의 감액 구간 — 보장개시 후 n개월 미만은 지급률을 낮춘다. 폼을 열지 않으면 감액 없음",
    fields: [
      {
        key: "periods",
        label: "구간",
        system: true,
        type: {
          kind: "table",
          columns: [
            { key: "end", label: "기간", type: "period" },
            { key: "rate", label: "지급률", type: "percent" },
          ],
        },
        description: "행 = 「직전 경계 ~ 이 경계 미만」. 기간은 3M · 1Y, 지급률은 % 정수. 엄격 오름차순",
      },
      {
        key: "after_rate",
        label: "이후 지급률",
        system: true,
        type: { kind: "number" },
        defaultValue: 100,
        hiddenByDefault: true,
        description: "마지막 구간 이후의 지급률(%). 보통 100 — 100 이면 입력 화면에서 숨긴다",
      },
      { key: "new_only", label: "신규계약만 적용", system: true, type: { kind: "boolean" }, defaultValue: true },
    ],
  },
  {
    key: "exemption",
    label: "면책",
    level: "benefit",
    optional: true,
    system: true,
    description: "급부의 면책 기간 — 보장개시 후 n개월은 지급하지 않는다. 폼을 열지 않으면 면책 없음",
    fields: [
      { key: "months", label: "기간", system: true, type: { kind: "number" }, description: "개월 수. 화면은 3M · 1Y 로 받는다" },
      { key: "age15_only", label: "15세 이상만 적용", system: true, type: { kind: "boolean" }, defaultValue: false },
      { key: "new_only", label: "신규계약만 적용", system: true, type: { kind: "boolean" }, defaultValue: true },
    ],
  },
];

/** 지급률 값 자리 — 급부 카드 머리 줄의 「지급률 ⊕」 (기능/담보 §3.6). 안 적으면 100% (동적표 `DEFAULT_PAY_RATE`). */
export const PAY_RATE_PATH = "pay.rate";
export const REDUCTION_FORM = "reduction";
export const EXEMPTION_FORM = "exemption";
