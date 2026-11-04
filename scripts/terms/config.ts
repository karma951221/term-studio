/**
 * 실물 변환 설정 — 상품 두 벌(알파Plus · 메리츠)의 별표 · 보통약관 · 담보약관 원문 파일과 오버레이, 두 상품이 함께 쓰는 함수조항.
 *
 * 별표 코드는 시스템 채번값(`AX000001`…)과 같아야 한다 — 시드 적재가 채번 순서를 대조한다 (기능/별표 §3.1).
 * 별표 마스터는 **이름이 같으면 한 건**이다 — 상품마다 원문 번호가 달라(알파Plus 별표2 = 메리츠 별표14 = 장해분류표)
 * 상품 설정의 `appendixNumbers`(원문 번호 → 코드)가 잇는다. 책자 번호는 어차피 등장 순 계산값이다 (ADR-0063).
 * 알파Plus 별표 이름은 원문 본문의 참조 표기에서 얻었다(별표 5 · 6 · 9 · 16 ~ 19 는 2607 특약이 참조해 알았다 — 2604 · 2607 번호가 같다).
 * 이름을 모르는 번호는 「(미확인 별표 N)」 자리표시로 두고 실물 별표 목록을 확인하면 이름만 고친다 (코드는 불변).
 */

import { CLAIM_SLOT } from "./claim";
import type { ConvertedClauseMode } from "./clauses";
import { BASIS_DATE, BASIS_DATE_COVERAGE_PRESET } from "./renewal";

export interface AppendixSpec {
  /** 알파Plus 원문 번호 — 알파Plus 원문에 없는 별표(메리츠에서 처음 나온 것)는 없다. */
  number?: number;
  code: string;
  name: string;
}

export const APPENDICES: AppendixSpec[] = [
  { number: 1, code: "AX000001", name: "보험금을 지급할 때의 적립이율 계산" },
  { number: 2, code: "AX000002", name: "장해분류표" },
  { number: 3, code: "AX000003", name: "1-7종 수술분류표" },
  { number: 4, code: "AX000004", name: "악성신생물(암) 분류표" },
  { number: 5, code: "AX000005", name: "제자리신생물 분류표" },
  { number: 6, code: "AX000006", name: "행동양식 불명 또는 미상의 신생물 분류표" },
  { number: 7, code: "AX000007", name: "뇌졸중대상질병 분류표" },
  { number: 8, code: "AX000008", name: "급성심근경색증대상질병 분류표" },
  { number: 9, code: "AX000009", name: "5대고액치료비암분류표" },
  { number: 10, code: "AX000010", name: "말기폐질환" },
  { number: 11, code: "AX000011", name: "말기간경화" },
  { number: 12, code: "AX000012", name: "만성당뇨합병증 분류표" },
  { number: 13, code: "AX000013", name: "화상 분류표" },
  { number: 14, code: "AX000014", name: "골절(치아파절 제외)분류표 Ⅱ" },
  { number: 15, code: "AX000015", name: "중대한 특정상해 분류표" },
  { number: 16, code: "AX000016", name: "유방절제수술 분류표" },
  { number: 17, code: "AX000017", name: "충수염(맹장염) 분류표" },
  { number: 18, code: "AX000018", name: "특정전염병 분류표" },
  { number: 19, code: "AX000019", name: "호흡기관련질병 분류표" },
  { number: 20, code: "AX000020", name: "양성 뇌종양(경계성종양제외) 대상질병 분류표" },
  { number: 21, code: "AX000021", name: "골절분류표 Ⅱ" },
  // 알파Plus2607 자동 탑재 특약이 처음 참조한 별표 — 코드는 더한 순서(앞 코드는 밀지 않는다), 이름은 본문 참조 표기
  { number: 26, code: "AX000022", name: "5대골절분류표" },
  { number: 47, code: "AX000023", name: "신골절치료비(치아파절포함) 보험금 지급률표" },
  { number: 67, code: "AX000024", name: "상해특정급여시술치료 분류표" },
  { number: 76, code: "AX000025", name: "1-5종 수술분류표Ⅱ" },
  { number: 77, code: "AX000026", name: "특정시술치료(급여) 분류표" },
  { number: 92, code: "AX000027", name: "중증화상환자 산정특례대상 분류표" },
  { number: 93, code: "AX000028", name: "중증외상환자 산정특례대상 분류표" },
  { number: 22, code: "AX000029", name: "특정심장질환 분류표" },
  { number: 24, code: "AX000030", name: "갑상선기능항진증대상질병 분류표" },
  { number: 25, code: "AX000031", name: "대장 양성종양및특정용종 분류표" },
  { number: 27, code: "AX000032", name: "희귀난치성 7대질환 분류표" },
  { number: 28, code: "AX000033", name: "뇌출혈 분류표" },
  { number: 29, code: "AX000034", name: "요실금 분류표" },
  { number: 30, code: "AX000035", name: "요로결석 분류표" },
  { number: 31, code: "AX000036", name: "당뇨병대상질병Ⅱ 분류표" },
  { number: 32, code: "AX000037", name: "남성특정비뇨기계질환 분류표" },
  { number: 33, code: "AX000038", name: "간질환 분류표" },
  { number: 34, code: "AX000039", name: "특정희귀난치성질환 분류표" },
  { number: 35, code: "AX000040", name: "대상포진대상질병 분류표" },
  { number: 36, code: "AX000041", name: "16대특정암 분류표" },
  { number: 41, code: "AX000042", name: "대상포진눈병대상질병 분류표" },
  { number: 42, code: "AX000043", name: "5대질환 분류표" },
  { number: 43, code: "AX000044", name: "간경변증대상질병 분류표" },
  { number: 44, code: "AX000045", name: "통풍대상질병 분류표" },
  { number: 45, code: "AX000046", name: "결핵분류표" },
  { number: 46, code: "AX000047", name: "약제내성결핵(슈퍼결핵포함)분류표" },
  { number: 48, code: "AX000048", name: "뇌혈관질환 분류표" },
  { number: 49, code: "AX000049", name: "위,십이지장,소화계통 양성종양및특정용종 분류표" },
  { number: 50, code: "AX000050", name: "32대질병 분류표" },
  { number: 51, code: "AX000051", name: "요실금수술 분류표" },
  { number: 52, code: "AX000052", name: "중이,호흡계통,흉곽내기관 양성종양 분류표" },
  { number: 53, code: "AX000053", name: "골,관절연골 양성종양 분류표" },
  { number: 54, code: "AX000054", name: "급여 항암방사선치료 분류표" },
  { number: 55, code: "AX000055", name: "급여 항암약물 분류표" },
  { number: 56, code: "AX000056", name: "통합암(유사암제외) 분류표" },
  { number: 57, code: "AX000057", name: "이상지질혈증(고지혈증포함) 분류표" },
  { number: 58, code: "AX000058", name: "고혈압(원발성) 분류표" },
  { number: 59, code: "AX000059", name: "급성간염(A,B,C형) 분류표" },
  { number: 60, code: "AX000060", name: "허혈성심장질환 분류표" },
  { number: 61, code: "AX000061", name: "신경차단·파괴치료(급여) 대상 수가코드" },
  { number: 63, code: "AX000062", name: "특정순환계질환 분류표" },
  { number: 64, code: "AX000063", name: "질병특정시술치료(급여) 분류표" },
  { number: 65, code: "AX000064", name: "심근병증 분류표" },
  { number: 66, code: "AX000065", name: "심장질환 분류표" },
  { number: 68, code: "AX000066", name: "질병특정급여시술치료 분류표" },
  { number: 69, code: "AX000067", name: "갑상선기능저하증대상질병 분류표" },
  { number: 70, code: "AX000068", name: "특정항암호르몬치료제 해당 의약품명 및 성분명" },
  { number: 71, code: "AX000069", name: "표적항암제 해당 의약품명 및 성분명" },
  { number: 72, code: "AX000070", name: "특정면역항암제 해당 의약품명 및 성분명" },
  { number: 74, code: "AX000071", name: "갑상선 호르몬치료제 해당 의약품명 및 성분명" },
  { number: 75, code: "AX000072", name: "암종별(13종)통합암(전이포함)(유사암제외) 분류표" },
  { number: 78, code: "AX000073", name: "특정31대질병 분류표" },
  { number: 79, code: "AX000074", name: "다빈도62대질병 분류표" },
  { number: 80, code: "AX000075", name: "유방의장애 분류표" },
  { number: 81, code: "AX000076", name: "편도염 분류표" },
  { number: 82, code: "AX000077", name: "특정다빈도29대질병 분류표" },
  { number: 83, code: "AX000078", name: "후각특정질환 분류표" },
  { number: 84, code: "AX000079", name: "관절염,생식기질환 분류표" },
  { number: 85, code: "AX000080", name: "치핵 분류표" },
  { number: 86, code: "AX000081", name: "백내장 분류표" },
  { number: 87, code: "AX000082", name: "산정특례대상 분류표" },
  { number: 91, code: "AX000083", name: "암전후관련 특정질환 및 양성신생물 분류표" },
  { number: 62, code: "AX000084", name: "아나필락시스 분류표" },
  { number: 88, code: "AX000085", name: "중증질환자(뇌혈관질환) 산정특례대상 분류표" },
  { number: 89, code: "AX000086", name: "중증질환자(심장질환) 산정특례대상 분류표" },
  { number: 90, code: "AX000087", name: "특정순환계질환(주요손상및질환) 분류표" },
  { number: 94, code: "AX000088", name: "희귀질환자 산정특례대상 분류표" },
  { number: 95, code: "AX000089", name: "중증난치질환자(중증치매제외) 산정특례대상 분류표" },
  { number: 37, code: "AX000090", name: "소송목적의 값에 따른 변호사비용" },
  { number: 38, code: "AX000091", name: "민사소송 등 인지법에 정한 인지액" },
  { number: 39, code: "AX000092", name: "송달료 규칙에 정한 송달료(민사소송)" },
  { number: 40, code: "AX000093", name: "송달료 규칙에 정한 송달료(행정소송)" },
  // 알파Plus2610 이 처음 참조한 별표 — 번호는 2607 과 같은 체계(2610 목차 대조 2026-11-03), 이름은 본문 참조 표기
  { number: 96, code: "AX000094", name: "전이암 분류표" },
  { number: 98, code: "AX000095", name: "중증도별 상해분류표" },
  { number: 99, code: "AX000096", name: "근골 주요처치및수술(급여) 분류표" },
  // 상해안심2610 이 처음 참조한 별표 — 번호는 상해안심 원문(SA2610.appendixNumbers)
  { code: "AX000097", name: "통합상해분류표Ⅱ" },
  { code: "AX000098", name: "신골절치료비(치아파절제외) 보험금 지급률표" },
  { code: "AX000099", name: "자동차사고 부상 등급표" },
  { code: "AX000100", name: "특정급여시술치료 분류표" },
  // 뇌심2610 이 처음 참조한 별표 — 번호는 뇌심 원문(BRAIN2610.appendixNumbers)
  { code: "AX000101", name: "뇌경색증 분류표" },
  { code: "AX000102", name: "2대질환 중증치료 분류표" },
];

/** 원문 텍스트의 첫 등장을 값 슬롯으로 바꾼다 (담보 레벨 `담보명` 등). */
export interface SlotOverlay {
  /** 원문 조 번호. */
  article: string;
  find: string;
  ref: string;
  /**
   * `find` 를 바꾸지 않고 그 앞에 슬롯 + 공백 하나를 넣는다 — 범위 낱말 슬롯(`builtin.output.scope`, ADR-0089 결정 3)처럼 낱말 앞자리.
   * 대치(빈 글)면 조립이 공백 하나를 접어 원문 그대로다.
   */
  before?: true;
}

/**
 * 담보속성 조건 오버레이 ① 문장 중간 어구 분기 — 지정 조에서 `find` 첫 등장을 `inlineCond` 로 바꾼다
 * (항·호·목 본문과 표 셀). 원문 **한 벌**에서 탑재분별로 갈리는 여러 벌을 낸다 (ADR-0003 「조 단위 on/off + 인라인 조건」).
 *
 * 식(`when`)은 데이터로 두고 변환기는 노드만 만든다. 담보속성 참조는 **가드를 붙여** 쓴다 —
 * `exist(attr.A0001) and attr.A0001 = '2'`. 가드 없는 `attr.X = '값'` 은 그 속성을 쓰지 않는
 * 탑재분에서 `unusedAttribute` 조립오류가 된다 (식언어 §6 · `assembly/scenarios.test.ts` S3).
 */
export interface InlineCondOverlay {
  /** 원문 조 번호. */
  article: string;
  /** 바꿀 평문. 조를 렌더 순서로 훑어 **처음 나오는 곳** 하나만 바꾼다 (바뀐 자리는 다음 오버레이가 다시 찾지 않는다). */
  find: string;
  when: string;
  /** `when` 이 참일 때 / 거짓일 때의 평문. 참조 평문(제N조 · 별표)은 가지 안에서도 참조 슬롯이 된다. `else` 가 없으면 IF 만(거짓이면 어구가 빠진다). */
  then: string;
  else?: string;
}

/** 조건 오버레이 ③ 박스 자리 on/off — 지정 조 직속 박스 중 제목 · 줄에 `find` 가 든 것을 `condBlock` 으로 감싼다 (참일 때만 실린다). */
export interface BoxCondOverlay {
  article: string;
  find: string;
  when: string;
}

/**
 * 문구 함수조항 오버레이 — 지정 조에서 `find` 첫 등장을 문구 함수조항 참조로 바꾼다 (조건 오버레이 ① 과 같은 찾기 규약).
 * 상품 · 담보 속성이 가르는 낱말을 함수조항 하나(「기준일 문구」 — ADR-0086 결정 6)로 둘 때. `clause` 는 함수조항 key, `preset` 은 그 함수조항의 프리셋 코드.
 */
export interface InlineClauseOverlay {
  article: string;
  find: string;
  clause: string;
  preset?: string;
}

/** 담보속성 조건 오버레이 ② 조 자리 on/off — 지정 조를 `condBlock` 으로 감싼다 (참일 때만 실린다. 뒤 조 번호는 자동으로 당겨진다). */
export interface ArticleCondOverlay {
  /** 원문 조 번호. */
  article: string;
  when: string;
}

/**
 * 함수조항 정의 — 여러 문서가 되풀이하는 **조 · 여러 항 단위** (기능/함수조항 §3.1 · §6.2). 코드는 시스템 채번(`C0001`…) — 변환기가 적재 순서로 매긴다(`CLAUSES`).
 * 본문은 원문 한 자리(`from`, 조건 오버레이가 얹힌 뒤)에서 딴다 — 항 수를 안 주면 그 항부터 조 끝까지(조째). 평문(`text`)도 된다.
 * 원문 자리의 자기 조 참조는 딴 항 안이면 「이 함수조항」, 밖이면 「사용처」 위치가 된다 (§3.5).
 */
export interface ClauseSpec {
  /** 설정 안의 이름 — 쓰임(`ClauseUse.clause`)이 이것으로 가리킨다. 코드(`C0001`…)는 변환기가 적재 순서로 매긴다(시스템 채번과 같게). */
  key: string;
  label: string;
  mode: ConvertedClauseMode;
  description: string;
  /** 평문 본문 · 선택지 문구의 참조를 풀 상품(그 상품의 별표 번호 · 보통약관 색인) — 기본 알파Plus. */
  product?: string;
  text?: string;
  /** 원문 자리 — 문서 코드(보통약관 코드 포함) · 조 · 첫 항(기본 1) · 잇닿은 항 수(기본 = 조 끝까지). 호 · 목도 함께 딴다. */
  from?: { spec: string; article: string; paragraph?: number; paragraphs?: number };
  /** 옵션 — 선택지 문구는 평문 (§3.2). 코드는 O01 · V01 … 순. */
  options?: { label: string; values: { label: string; text: string }[] }[];
  /** 원문 자리의 글에서 옵션 자리로 바꿀 낱말 — `within` 문맥(기본 = 낱말)이 나오는 모든 자리. 원문 자리 문서가 고른 선택지 문구와 같아야 한다. */
  place?: { option: string; text: string; within?: string }[];
}

/**
 * 함수조항 쓰임 — 원문 조 번호 · 첫 항 번호 자리부터 함수조항의 항 수만큼을 참조 하나로 바꾼다(「항」).
 * 「문구」는 항 안 첫 등장 구간 — 제품 기능으로 남아 있지만 실물 데이터는 쓰지 않는다(2026-09-28).
 * `options` 는 옵션 코드 → 선택지 코드 (사용처 소유 선택, §3.2).
 */
export interface ClauseUse {
  article: string;
  paragraph: number;
  /** 호 자리 — 「문구」를 항 문장이 아니라 그 항의 제N호 문장에서 찾는다. */
  item?: number;
  /** 함수조항 key (`ClauseSpec.key`). */
  clause: string;
  options?: Record<string, string>;
}

export interface GeneralSpec {
  code: string;
  file: string;
  idPrefix: string;
  /**
   * 그 판에 없어도 조 노출을 끄지 않는 템플릿 조 id — 다른 상품군 담보를 그대로 탑재하면 그 담보약관이 가리키는 조(알파 납입면제 세 조)가
   * 상품에 있어야 한다(노출 끈 조를 가리키면 저장 거부). 납입면제 세 조는 「납입면제 있음」 조건이라 납입면제 없는 상품에서는 조립이 뺀다.
   */
  keepShown?: string[];
  /** 함수조항 쓰임 — 두 보통약관이 조째 같은 조. */
  clauses?: ClauseUse[];
  /**
   * 기본계약이 대치하는 조를 마스터에서 비울지. 비우지 않는다 — 마스터의 다른 조가 그 조의 항을 가리키므로
   * (실물 제8조 → 제4조 제4항) 편집기가 고를 id 가 있어야 하고, 조립은 순번 별칭으로 기본계약 항에 잇는다.
   */
  emptyArticles: string[];
  /**
   * 생략 기준 「포함하면 생략」인 조 — 원문 조 번호 (ADR-0093 결정 8). 변환기가 그 조 노드에 `omitMode: "contained"` 를 단다.
   * 나머지 조는 기본(「같을 때만」 = 속성 없음).
   */
  omitContained?: string[];
  /** 상품 범위 조건 오버레이 — 참조 변환 전에 얹는다 (형 축 문장 · 어구, 최종 결정 24). */
  inlineConds?: InlineCondOverlay[];
  /** 상품 범위 조건 오버레이 — 박스 자리 on/off (박스 마스터를 만들기 전). */
  boxConds?: BoxCondOverlay[];
}

export interface SpecialSpec {
  code: string;
  ownerCoverage: string;
  idPrefix: string;
  title?: string;
  /** 자기 원문 파일. */
  file?: string;
  /**
   * 원문 폴더 바꾸기 — 상품의 `fixtureDir` 대신 이 폴더의 원문을 읽는다. 같은 담보의 새 판 원문이 개정됐을 때 앞 판 담보 템플릿을
   * 새 판 글로 바꾼다(2026-11-03 사용자 결정 — 담보명은 전역 유일이라 같은 이름 새 담보를 두지 않는다. 앞 판 상품은 알려진 차이).
   */
  fixtureDir?: string;
  /** 보통약관 원문에서 조를 뽑아 만드는 문서 (기본계약). `linkTo` 는 조연결할 보통약관 조 번호. */
  extractFrom?: { file: string; articles: string[]; linkTo: string[] };
  slots: SlotOverlay[];
  /** 담보속성 조건 오버레이 — 참조 변환 전에 얹는다 (가지 안의 참조도 슬롯이 된다). */
  inlineConds?: InlineCondOverlay[];
  /** 문구 함수조항 오버레이 — 조건 오버레이 ① 과 같은 때(참조 변환 전)에 얹는다. */
  inlineClauses?: InlineClauseOverlay[];
  /** 담보속성 조건 오버레이 — 조 자리 on/off. */
  articleConds?: ArticleCondOverlay[];
  /**
   * 다른 원문(`tests/fixtures/terms` 아래 `file`)의 조 하나를 이 문면의 `before` 조 앞에 넣는다 — 같은 담보의 갱신형 원문에만 있는 조(보험기간).
   * 넣은 조의 원문 번호는 `x<원문 번호>` 다(조 자리 조건 오버레이가 그 번호로 감싼다).
   */
  extraArticles?: { file: string; article: string; before: string }[];
  /** 함수조항 쓰임 — 슬롯 오버레이 뒤에 얹는다. */
  clauses?: ClauseUse[];
  /**
   * 자동 탑재 특약 — 함수조항 쓰임 · 보험금명 슬롯을 변환기가 찾는다(`auto.ts` · convert.ts). `renewal` 은 같은 담보의 갱신형 원문 —
   * 두 벌을 템플릿 하나로 합친다(갱신유형 조건 블록). 담보 · 탑재 시드도 변환기가 쓴다(`coverages.json` · `products.json` 의 자동 탑재분).
   */
  auto?: {
    category: CoverageCategory;
    group?: string;
    renewal?: string;
    /** 기본계약으로 탑재(섹션 base) — 절형 보통약관 제2절의 보장조항 문서(ADR-0100). */
    base?: boolean;
    /** 다른 상품의 갱신형 짝을 함께 쓸 때 이 상품이 싣는 쪽만 — 상해안심은 갱신형만 판다. */
    mountOnly?: "renewal" | "base";
  };
}

/**
 * 담보분류 — 열거형 「담보분류」(E0009) 값 코드: V01 상해 · V02 질병 · V03 비용손해 · V04 배상책임 · V05 재물손해 (ADR-0090).
 * 원문 파일(특별약관 Ⅰ ~ Ⅴ)이 곧 책자의 그룹이다 — 담보분류의 기본 그룹(「상해 관련 특별약관」 …)과 맞지 않는 파일(「상해 및 질병 관련」 · 「기타」)은
 * 그 상품의 사용자 그룹(`group` = 그룹 이름)으로 묶는다. 그룹 목록 순서는 원문 파일 순서(설정의 특약 순서)다.
 */
export type CoverageCategory = "V01" | "V02" | "V03" | "V04" | "V05";

/**
 * 함수조항 — 두 상품(알파Plus · 메리츠)의 원문이 되풀이하는 조 (모델명세 §4 · 메리츠_모델명세 §4 · 기능/함수조항 §6.2).
 * 규칙 (2026-09-28 — 「불필요하게 너무 많은 함수조항」 유저 피드백으로 재편):
 * - 함수조항은 **조째**(그 조의 항 전부) 또는 **잇닿은 여러 항**이고, **두 곳 이상**에서 쓴다. 항 하나 · 문장 조각(문구)은 따지 않는다 —
 *   원문 글 그대로 문면에 남는다. 조 제목은 사용처 소유다.
 * - 낱말만 다르면 옵션(선택지 문구는 평문), 항 구성이 다르면 함수조항을 따로 둔다(한 곳에서만 쓰일 변형은 문면에 남긴다).
 *   띄어쓰기만 다른 곳은 옵션으로 두지 않는다 — 두 상품의 같은 조가 띄어쓰기만 다르면 공유하지 않는다.
 * - 조 안의 자기 참조는 「이 함수조항」(제1항에 따라) · 「사용처」 위치(제1조(보험금의 지급사유)에서 정한)로 딴다 (§3.5).
 *   보통약관 조 참조는 보통약관이 두 벌이라 상품마다 대상이 다르다(준용규정은 상품마다 한 벌).
 * - 사이에 표가 낀 조는 조째 딸 수 없다. 박스는 잎이라 함수조항 본문에 품는다(2026-09-30 재저작, 최종 결정 6) — 항 사이 · 호 목록의
 *   박스 참조까지 같아야 한 함수조항이다(보험금을 지급하지 않는 사유 · 제1회 보험료 및 회사의 보장개시). 약관의 해석은 ① 뒤 박스가
 *   상품마다 다른 박스라 여전히 ②③ 만 딴다. 조 끝(마지막 항 뒤)의 박스는 사용처가 둔다.
 *
 * 코드는 적재 순서다. **보통약관이 쓰는 함수조항이 맨 앞**(C0001~) — 시드 · 화면 E2E 바탕은 보통약관을 가져오기 전에 이것들을 만든다.
 * 보통약관 조를 가리키는 함수조항(준용규정 두 벌)은 맨 뒤 — 보통약관이 있어야 정의 검사 ① 을 통과한다. 변환기가 매기고 검사한다.
 * 박스는 여기 적지 않는다 — 원문의 박스는 모두 정적 마스터 박스가 된다(`boxes.ts`, 한 곳만 써도 — 기능/박스).
 *
 * 「특별약관의 소멸」은 담보 구조별로 조째 함수조항이 갈린다 (§3.1):
 *   사망            : ① 사망 시 소멸 (항 하나 — 조째)
 *   지급사유         : ① 제1조 지급사유 발생 시 소멸 ② 제1항에 따라 해약환급금 미지급 ③ 사망 시 소멸
 *   사망보험금       : ③ 이 「제1항 이외의 사유로」 사망 — 사망이 곧 지급사유인 담보
 *   생활자금         : ① 이 「제1조 제1항에서 정한 … 생활자금」 (보험금명이 제1조와 띄어쓰기가 달라 보험금명 자리가 아니다)
 *   중증화상및부식    : ① 사망 시 소멸 ②③ 세부보장 하나의 소멸 · 해약환급금 미지급
 */
type ClauseDraft = ClauseSpec;

/** 보통약관끼리 조째 같은 조 — 「항」 함수조항 한 건 = 그 조의 항 전부(또는 첫 항부터 잇닿은 항). 본문은 메리츠 원문 자리에서 딴다 (두 원문이 같다). */
const generalArticle = (key: string, label: string, meritz: string, paragraph = 1): ClauseDraft => ({
  key,
  label,
  mode: "block",
  description: `보통약관 「${label.replace(/ [①-⑳]+$/, "")}」 — 두 상품 보통약관이 같은 글이다`,
  from: { spec: "meritz-general", article: meritz, paragraph },
});

/** 담보약관의 조째 함수조항 — 본문은 `spec` 원문 자리의 조 전부. */
const specialArticle = (key: string, label: string, spec: string, article: string, description: string, extra: Partial<ClauseDraft> = {}): ClauseDraft => ({
  key,
  label,
  mode: "block",
  description,
  from: { spec, article },
  ...extra,
});

/** 옵션 선택지 — [이름, 문구]. */
const values = (...pairs: [string, string][]) => pairs.map(([label, text]) => ({ label, text }));

const CLAUSE_DRAFTS: ClauseDraft[] = [
  // ── 보통약관 (두 벌 공통) — 조째 같은 조
  generalArticle("g-purpose", "목적", "1"),
  generalArticle("g-claim", "보험금 등의 청구", "7"),
  generalArticle("g-address", "주소변경통지", "12"),
  generalArticle("g-beneficiary", "보험수익자의 지정", "13"),
  generalArticle("g-representative", "대표자의 지정", "14"),
  generalArticle("g-disclosure", "계약 전 알릴 의무", "15"),
  generalArticle("g-fraud", "사기에 의한 계약", "18"),
  generalArticle("g-second-premium", "제2회 이후 보험료의 납입", "28"),
  generalArticle("g-dividend", "배당금의 지급", "42"),
  generalArticle("g-dispute", "분쟁의 조정", "44"),
  generalArticle("g-court", "관할법원", "45"),
  generalArticle("g-prescription", "소멸시효", "46"),
  // ① 과 ② 사이에 박스(신의성실의 원칙)가 있어 조째가 아니라 ②③ 두 항
  generalArticle("g-interpretation", "약관의 해석 ②③", "47", 2),
  generalArticle("g-explanation", "설명서 교부 및 보험안내자료 등의 효력", "48"),
  generalArticle("g-law-change", "법령 등의 개정에 따른 계약내용의 변경", "49"),
  generalArticle("g-liability", "회사의 손해배상책임", "50"),
  generalArticle("g-privacy", "개인정보보호", "51"),
  generalArticle("g-governing-law", "준거법", "52"),
  generalArticle("g-deposit-insurance", "예금보험에 의한 지급보장", "53"),
  // 박스가 낀 조째 같은 조 (2026-09-30 재저작 — 박스는 잎이라 함수조항 본문에 선다, 최종 결정 6). 뒤에 둬 앞 코드(C0001~C0019)를 지킨다
  generalArticle("g-exclusion", "보험금을 지급하지 않는 사유", "5"),
  generalArticle("g-first-premium", "제1회 보험료 및 회사의 보장개시", "27"),
  // ── 담보약관 — 같은 담보의 두 상품 조
  specialArticle("burn-scope", "보장의 범위(신화상치료비)", "burn-doc", "1", "신화상치료비의 세 보장 — 두 상품이 같은 글이다(뒤 박스는 사용처 소유)"),
  specialArticle("fracture-cause", "보험금의 지급사유(골절진단비)", "fracture-doc", "1", "골절(치아파절 제외)진단비의 지급사유 — 두 상품이 같은 글이다. 보험금명은 사용처가 상수로 연결한다"),
  specialArticle("fracture-surgery-cause", "보험금의 지급사유(골절수술비)", "fracture-surgery-doc", "1", "골절수술비의 지급사유 — 두 상품이 같은 글이다. 보험금명은 사용처가 상수로 연결한다"),
  specialArticle("fracture-detail", "보험금 지급에 관한 세부규정(골절진단비)", "fracture-doc", "2", "골절 여럿이면 1회 · 제3자 판정 — 두 상품이 같은 글이다. 「제1조」는 사용처 위치"),
  specialArticle("fracture-surgery-detail", "보험금 지급에 관한 세부규정(골절수술비)", "fracture-surgery-doc", "2", "골절 수술 여럿이면 하나 · 제3자 판정 — 두 상품이 같은 글이다. 「제1조」는 사용처 위치"),
  specialArticle("living-detail", "보험금 지급에 관한 세부규정(생활자금)", "living80-doc", "2", "알파Plus 후유장해 생활자금 두 담보의 장해지급률 · 합산 · 가중 규정 — 분류표 외 후유장해로 정하는 것(지급액 · 장해지급률)만 다르다", {
    options: [{ label: "결정 대상", values: values(["지급액", "지급액"], ["장해지급률", "장해지급률"]) }],
    place: [{ option: "O01", text: "지급액", within: "구분에 준하여 지급액을" }],
  }),
  specialArticle("disability-detail", "보험금 지급에 관한 세부규정(후유장해)", "m-disability80-doc", "2", "메리츠 80%이상후유장해 두 담보(상해 · 질병)의 장해지급률 · 합산 · 가중 규정 — 기산일 · 원인 · 분류표 외 결정 대상이 다르다", {
    product: "meritz",
    options: [
      { label: "기산일", values: values(["상해 발생일", "상해 발생일"], ["질병 진단확정일", "질병의 진단확정일"]) },
      { label: "원인", values: values(["상해", "상해로"], ["질병", "질병으로"]) },
      { label: "결정 대상", values: values(["지급액", "지급액"], ["장해지급률", "장해지급률"]) },
    ],
    place: [
      { option: "O01", text: "상해 발생일" },
      { option: "O02", text: "상해로", within: "같은 상해로" },
      { option: "O02", text: "상해로", within: "다른 상해로" },
      { option: "O03", text: "장해지급률", within: "구분에 준하여 장해지급률을" },
    ],
  }),
  specialArticle("burn-definition", "중증화상및부식진단의 정의 및 진단확정", "burn-doc", "6", "중증화상및부식의 정의 · 진단확정 — 두 상품이 조사 두 곳만 다르다", {
    options: [
      { label: "정의 조사", values: values(["에서", "에서"], ["에 있어", "에 있어"]) },
      { label: "의료기관 근거", values: values(["규정한", "에 규정한"], ["정한", "에서 정한"]) },
    ],
    place: [
      { option: "O01", text: "에서", within: "이 특별약관에서「중증화상" },
      { option: "O02", text: "에 규정한", within: "의료법 제3조에 규정한" },
    ],
  }),
  // ── 담보약관 — 특별약관의 소멸 (담보 구조별)
  specialArticle("lapse-death", "특별약관의 소멸(사망)", "fracture-doc", "4", "소멸 급부가 없는 담보 — 피보험자 사망으로 소멸하고 계약자적립액 · 미경과보험료를 지급한다"),
  specialArticle("lapse-claim", "특별약관의 소멸(지급사유 발생)", "major-injury-surgery-doc", "4", "소멸 급부가 담보 전체 — 제1조의 지급사유가 생기면 소멸 · 해약환급금 미지급 · 사망 시 소멸. 보험금명은 사용처가 상수로 연결한다, 「그 때부터」 유무가 상품마다 다르다", {
    options: [{ label: "소멸 표현", values: values(["그 때부터 소멸", "그 때부터 소멸됩니다"], ["소멸", "소멸됩니다"]) }],
    place: [{ option: "O01", text: "그 때부터 소멸됩니다" }],
  }),
  specialArticle("lapse-claim-death", "특별약관의 소멸(사망보험금)", "death-doc", "3", "사망이 곧 지급사유인 담보 — 「지급사유 발생」 조에서 ③ 이 「제1항 이외의 사유로」 사망한 경우", {
    options: [
      { label: "소멸 표현", values: values(["그 때부터 소멸", "그 때부터 소멸됩니다"], ["소멸", "소멸됩니다"]) },
      { label: "해약환급금 미지급 표현", values: values(["소멸되는", "소멸되는"], ["소멸된", "소멸된"]) },
    ],
    place: [
      { option: "O01", text: "그 때부터 소멸됩니다" },
      { option: "O02", text: "소멸되는" },
    ],
  }),
  specialArticle("lapse-living", "특별약관의 소멸(생활자금)", "living80-doc", "3", "알파Plus 후유장해 생활자금 두 담보 — 제1조 제1항의 생활자금 지급사유가 생기면 소멸. 장해율(80% · 50%)만 다르다", {
    options: [{ label: "장해율", values: values(["80%", "80%"], ["50%", "50%"]) }],
    place: [{ option: "O01", text: "80%" }],
  }),
  specialArticle("lapse-burn", "특별약관의 소멸(중증화상및부식)", "burn-doc", "7", "세부보장 하나(중증화상및부식진단비)가 소멸 급부 — ① 사망 시 소멸 ②③ 그 세부보장의 소멸 · 해약환급금 미지급"),
  // ── 보통약관 조를 가리키는 함수조항 — 상품마다 한 벌 (맨 뒤)
  {
    key: "alpha-application",
    label: "준용규정(알파Plus)",
    mode: "block",
    description: "특별약관에서 정하지 않은 사항은 보통약관을 따른다 — 알파Plus 보통약관 조를 가리킨다. 제외 조 목록은 갱신형(담보속성 A0001 = 2)이면 다섯 조 무조건, 아니면 세 조 + 1종 가입 시 두 조",
    from: { spec: "surgery17-doc", article: "8" },
  },
  {
    key: "meritz-application",
    label: "준용규정(통합간편)",
    mode: "block",
    description: "특별약관에서 정하지 않은 사항은 보통약관을 따른다 — 메리츠 보통약관 조를 가리킨다(적립이율 · 만기환급금 · 중도인출 제외, 1종이면 납입면제 두 조도 제외). 질병사망은 제5조까지 빼는 다른 글이라 쓰지 않는다",
    from: { spec: "m-fracture-doc", article: "5" },
  },
];

/**
 * 뒤에 더한 상품(알파Plus2607)이 처음 쓰는 함수조항 — **맨 뒤 코드**다(앞 상품의 코드를 밀지 않는다 — 화면 E2E · 명세가 코드를 쓴다).
 * 담보약관만 쓰는 것이라 적재 순서 제약(보통약관이 쓰는 것이 앞)과 부딪히지 않는다. 더 넓힐 때(주계약 특약 전체)도 여기 뒤에 붙인다.
 */
const APPENDED_DRAFTS: ClauseDraft[] = [
  // 질병 진단비 특약의 제2조 — 제3자 합의 한 항(조째). 「제1조(보험금의 지급사유)」는 조 참조 인자
  specialArticle("third-party", "보험금 지급에 관한 세부규정(제3자 합의)", "a7-kidney-doc", "2", "지급사유 합의가 안 되면 제3자 판정 — 알파Plus2607 질병 진단비 특약이 같은 글이다. 「제1조」는 사용처 위치", { product: "alpha2607" }),
  // 질병 특약의 준용규정 — 상해 특약 준용규정(알파Plus)의 비갱신 글에 「제5조(보험금을 지급하지 않는 사유)」가 제외 목록에 더 있다.
  // 다른 것이 조 참조의 대상이라 평문 옵션으로 가를 수 없다(선택지 문구는 평문 — 기능/함수조항 §3.2) — 함수조항을 따로 둔다
  {
    key: "alpha-application-disease",
    label: "준용규정(알파Plus 질병)",
    mode: "block",
    description: "질병 특약 — 특별약관에서 정하지 않은 사항은 알파Plus 보통약관을 따른다. 제외 조는 제5조(상해 면책) · 적립이율 · 만기환급금 · 중도인출, 납입면제가 있으면 1종 가입 시 납입면제 두 조도",
    product: "alpha2607",
    from: { spec: "a7-kidney-doc", article: "5" },
  },
];

/**
 * 조 · 여러 항 함수조항 — 코드는 변환기가 적재 순서로 매긴다: 보통약관이 쓰는 것 → 담보약관만 쓰는 것 →
 * 보통약관 조를 가리키는 것(준용규정) — 각각 이 배열 순. 그 뒤에 뒤에 더한 상품의 것(`APPENDED_CLAUSE_KEYS`, 배열 순).
 */
export const CLAUSES: readonly ClauseSpec[] = [...CLAUSE_DRAFTS, ...APPENDED_DRAFTS];
export const APPENDED_CLAUSE_KEYS: ReadonlySet<string> = new Set(APPENDED_DRAFTS.map((c) => c.key));

/** 쓰임 줄임말 — 원문 조 · 첫 항 → 함수조항 key (옵션 선택은 `{ O01: "V02" }` 또는 O01 하나면 선택지 코드 문자열). */
const at = (article: string, paragraph: number, clause: string, options?: string | Record<string, string>): ClauseUse => ({
  article,
  paragraph,
  clause,
  ...(options ? { options: typeof options === "string" ? { O01: options } : options } : {}),
});

/** 조째 함수조항의 쓰임 — 원문 조 첫 항부터. */
const whole = (article: string, clause: string, options?: string | Record<string, string>) => at(article, 1, clause, options);

/** 조째 같은 보통약관 조의 쓰임 — [key, 알파Plus 조, 메리츠 조, 첫 항]. */
const GENERAL_ARTICLES: [string, string, string, number][] = [
  ["g-purpose", "1", "1", 1],
  ["g-claim", "7", "7", 1],
  ["g-address", "12", "12", 1],
  ["g-beneficiary", "13", "13", 1],
  ["g-representative", "14", "14", 1],
  ["g-disclosure", "15", "15", 1],
  ["g-fraud", "18", "18", 1],
  ["g-second-premium", "27", "28", 1],
  ["g-dividend", "37", "42", 1],
  ["g-dispute", "39", "44", 1],
  ["g-court", "40", "45", 1],
  ["g-prescription", "41", "46", 1],
  ["g-interpretation", "42", "47", 2],
  ["g-explanation", "43", "48", 1],
  ["g-law-change", "44", "49", 1],
  ["g-liability", "45", "50", 1],
  ["g-privacy", "46", "51", 1],
  ["g-governing-law", "47", "52", 1],
  ["g-deposit-insurance", "48", "53", 1],
  ["g-exclusion", "5", "5", 1],
  ["g-first-premium", "26", "27", 1],
];

/** 갱신형 탑재분인가 — 담보속성 A0001(갱신유형) = V02. `exist` 가드는 속성을 쓰지 않는 탑재분을 위해 (식언어 §6). */
export const RENEWAL = "exist(attr.A0001) and attr.A0001 = '2'";

/** 상품 한 벌의 원문 — 픽스처 폴더 · 별표 번호 표 · 보통약관 · 담보약관. */
export interface ProductTerms {
  code: string;
  /** 시드 상품(`products.json`)의 code — 없으면 `code`. */
  seedCode?: string;
  /**
   * 상품군 — 납입면제 템플릿 · 준용규정 함수조항이 상품군 것이다(ADR-0086 결정 7). 같은 상품군의 판(2604 · 2607)은
   * 보통약관 조 id 체계(`general.idPrefix`)를 같이 써서 담보약관 · 준용규정 · 납입면제 함수조항을 함께 쓴다.
   */
  line: "alpha" | "meritz";
  /** `tests/fixtures/terms` 아래 폴더 (알파Plus 는 뿌리). */
  fixtureDir: string;
  /** 원문 별표 번호 → 별표 코드. */
  appendixNumbers: Map<number, string>;
  general: GeneralSpec;
  /** 이 상품이 만드는 담보약관(문면 · 템플릿 · 자동 탑재 담보). */
  specials: SpecialSpec[];
  /**
   * 자동 탑재 순서 — 원문 목록 순. 다른 상품의 자동 탑재 특약(그 상품 `specials` 의 것)을 넣으면 그 담보 · 템플릿을 **그대로 탑재**한다
   * (원문이 같은 특약 — 공통화, 매뉴얼 §6.1). 없으면 `specials` 의 자동 탑재 특약 전부.
   */
  autoMounts?: SpecialSpec[];
}

/**
 * 「해약환급금 미지급형 있음」(D0007 — 상품 레벨 `not all(D0003)`). 형이 해약환급금 지급형뿐이면(1형만) 2형을 말하는 문장 · 박스와
 * 「1형(해약환급금 지급형)에 한하여 적용합니다」 문장이 빠진다 (QA/인수기준 보통약관 형 축 · 최종 결정 24 「상품 범위 조건」 — 1형 적립 중지 항 D0004 와 같은 꼴).
 */
const SURRENDER_UNPAID = "D0007";

/** 형 축 문장 — 적립이율 · 만기환급금 · 중도인출 ① 첫 문장(원문 조 번호), 2형 단서(조 번호 · 원문 글), 2형 박스가 있는 해약환급금 조. */
function formAxisConds(only: { savings: string; maturity: string; withdrawal: string }, provisos: [string, string][], surrender: string): Pick<GeneralSpec, "inlineConds" | "boxConds"> {
  const firstSentence = (article: string, subject: string): InlineCondOverlay => {
    const text = `이 계약에서 ${subject} 1형(해약환급금 지급형)에 한하여 적용합니다. `;
    return { article, find: text, when: SURRENDER_UNPAID, then: text };
  };
  return {
    inlineConds: [
      firstSentence(only.savings, "적립부분 적립이율은"),
      firstSentence(only.maturity, "만기환급금의 지급은"),
      firstSentence(only.withdrawal, "중도인출은"),
      ...provisos.map(([article, text]): InlineCondOverlay => ({ article, find: text, when: SURRENDER_UNPAID, then: text })),
    ],
    boxConds: [{ article: surrender, find: "2형(", when: SURRENDER_UNPAID }],
  };
}

const ALPHA_GENERAL: GeneralSpec = {
  code: "alpha-general",
  file: "보통약관.md",
  idPrefix: "g",
  emptyArticles: [],
  // 제22조(계약의 무효) — 특약 무효 조가 보통약관 무효 사유에 포함되면 생략 (ADR-0093 결정 8)
  omitContained: ["22"],
  clauses: GENERAL_ARTICLES.map(([key, article, , paragraph]) => at(article, paragraph, key)),
  ...formAxisConds(
    { savings: "9", maturity: "10", withdrawal: "38" },
    [["23", " 다만, 2형(해약환급금 미지급형(납입후50%))의 경우 보험기간, 보험료 납입기간, 피보험자의 변경 및 보험가입금액의 증액은 신청할 수 없습니다."]],
    "35",
  ),
};

/** 범위 낱말 슬롯 (ADR-0089 결정 3) — 대치 빈 글 · 특약 「이 특별약관의」 · 블록 「이 보장의」. */
const SCOPE_WORD = "builtin.output.scope";
/** 알파Plus 기본계약 제4조 ③ 단서 — 특약판(메리츠 특약 80%)에 없는 문장. */
const FLOOR_PROVISO = " 다만, 【별표2(장해분류표)】의 각 장해분류별 최저 지급률 장해정도에 이르지 않는 후유장해에 대하여는 후유장해보험금을 지급하지 않습니다.";

const ALPHA_SPECIALS: SpecialSpec[] = [
  {
    code: "base-disability80-doc",
    ownerCoverage: "base-disability80",
    idPrefix: "b",
    title: "일반상해80%이상후유장해 기본계약 문면",
    extractFrom: { file: "보통약관.md", articles: ["3", "4"], linkTo: ["3", "4"] },
    // 담보약관 문면 한 벌 (ADR-0089 결정 2 · 3 · 4) — 같은 담보를 특약 · 블록으로 실어도 맞는 글: 범위 낱말 슬롯(대치 빈 글 · 특약 「이 특별약관의」 · 블록 「이 보장의」)
    slots: [
      { article: "3", find: "보험기간 중에", ref: SCOPE_WORD, before: true },
      { article: "3", find: "보험가입금액을", ref: SCOPE_WORD, before: true },
    ],
    // 제4조 ③ 단서 「다만, … 최저 지급률 … 지급하지 않습니다」는 특약판에 없다(메리츠 특약 80% ③) — 대치 · 블록(내Mom 1-1 ③)에만
    inlineConds: [{ article: "4", find: FLOOR_PROVISO, when: "builtin.output ≠ 'special'", then: FLOOR_PROVISO }],
  },
  {
    code: "death-doc",
    ownerCoverage: "death",
    idPrefix: "s1",
    file: "일반상해사망보장.md",
    // 제3조 ①의 보험금명은 보험금명 자리(사망보험금 — claim.ts) — 소멸 급부가 곧 사망이라 ③ 앞에 「제1항 이외의 사유로 」(T2 사망형)
    slots: [{ article: "3", find: "사망보험금", ref: CLAIM_SLOT }],
    // 갱신형 탑재분(알파Plus2607 「갱신형 일반상해사망보장」)은 소멸 앞에 보험기간 조가 선다 — 2607 갱신형 원문의 조를 갱신형 조건으로 넣는다
    extraArticles: [{ file: "알파2607/갱신형_일반상해사망보장.md", article: "3", before: "3" }],
    articleConds: [{ article: "x3", when: RENEWAL }],
    clauses: [whole("3", "lapse-claim-death", { O01: "V01", O02: "V01" }), whole("4", "alpha-application")],
  },
  {
    code: "living80-doc",
    ownerCoverage: "living80",
    idPrefix: "s2",
    file: "일반상해80%이상후유장해_생활자금보장.md",
    slots: [{ article: "1", find: "일반상해80%이상후유장해 생활자금", ref: CLAIM_SLOT }],
    // 제3조 ①의 보험금명은 원문이 「일반상해 80%…」로 띄어 써 제1조와 달라 평문으로 둔다
    clauses: [whole("2", "living-detail", "V01"), whole("3", "lapse-living", "V01"), whole("4", "alpha-application")],
  },
  {
    code: "fracture-doc",
    ownerCoverage: "fracture",
    idPrefix: "s3",
    file: "골절(치아파절_제외)진단비Ⅱ보장.md",
    slots: [{ article: "1", find: "골절(치아파절 제외)진단비", ref: CLAIM_SLOT }],
    // 갱신형 탑재분(알파Plus2607 「갱신형 골절(치아파절 제외)진단비Ⅱ보장」)은 소멸 앞에 보험기간 조가 선다
    extraArticles: [{ file: "알파2607/갱신형_골절(치아파절_제외)진단비Ⅱ보장.md", article: "4", before: "4" }],
    articleConds: [{ article: "x4", when: RENEWAL }],
    clauses: [whole("1", "fracture-cause"), whole("2", "fracture-detail"), whole("4", "lapse-death"), whole("5", "alpha-application")],
  },
  {
    code: "living50-doc",
    ownerCoverage: "living50",
    idPrefix: "s4",
    file: "일반상해50%이상후유장해_생활자금보장.md",
    slots: [{ article: "1", find: "일반상해50%이상후유장해 생활자금", ref: CLAIM_SLOT }],
    clauses: [whole("2", "living-detail", "V02"), whole("3", "lapse-living", "V02"), whole("4", "alpha-application")],
  },
  {
    code: "fracture-surgery-doc",
    ownerCoverage: "fracture-surgery",
    idPrefix: "s5",
    file: "골절수술비Ⅱ보장.md",
    slots: [{ article: "1", find: "골절수술비", ref: CLAIM_SLOT }],
    clauses: [whole("1", "fracture-surgery-cause"), whole("2", "fracture-surgery-detail"), whole("5", "lapse-death"), whole("6", "alpha-application")],
  },
  {
    code: "major-injury-surgery-doc",
    ownerCoverage: "major-injury-surgery",
    idPrefix: "s6",
    file: "중대한특정상해수술비보장.md",
    slots: [
      { article: "1", find: "중대한특정상해수술비", ref: CLAIM_SLOT },
      { article: "4", find: "중대한특정상해수술비", ref: CLAIM_SLOT },
    ],
    clauses: [whole("4", "lapse-claim", "V01"), whole("5", "alpha-application")],
  },
  {
    // 비갱신형 · 갱신형 **두 벌을 내는 한 벌**이다 (ADR-0003 실증) — 원문은 갱신형 쪽(조 8개, 상위집합)을 싣고
    // 담보속성 A0001(갱신유형) 조건으로 비갱신형을 깎는다. 제목은 작명 템플릿 `[A0001] [담보명] [A0002]` 이 낸다.
    // 원문 두 벌의 차이는 제목을 빼면 다섯 자리뿐이다 (보고서 rr2-report-FG.md §4.1). 그중 기준일 낱말 세 자리는 「기준일 문구」 함수조항이 가른다.
    code: "surgery17-doc",
    ownerCoverage: "surgery17",
    idPrefix: "s7",
    title: "수술비(1-7종, 연간3회한)[상해]보장 특별약관",
    file: "갱신형_수술비(1-7종,_연간3회한)[상해]보장.md",
    slots: [{ article: "1", find: "수술비", ref: CLAIM_SLOT }],
    // ① 제1조 제2항 · ②③ 예시표 (1)(2) 의 행 머리 — 「최초계약일」 ↔ 「계약일」은 문구 함수조항 「기준일 문구」 프리셋 ‘담보’(갱신 ← 갱신형 담보, ADR-0086 결정 6)
    inlineClauses: [1, 2, 3].map(() => ({ article: "1", find: "최초계약일", clause: BASIS_DATE, preset: BASIS_DATE_COVERAGE_PRESET })),
    inlineConds: [
      // ④ 준용규정의 제외 목록 — 갱신형은 다섯 조 무조건 제외, 비갱신형은 세 조 + 「1종으로 가입한 경우」 두 조
      {
        article: "8",
        find: "보통약관 제9조(적립부분 적립이율에 관한 사항), 제10조(만기환급금의 지급), 제27조의1(보험료의 납입면제), 제27조의2(납입면제에 관한 세부규정) 및 제38조(중도인출)은 제외합니다.",
        when: RENEWAL,
        then: "보통약관 제9조(적립부분 적립이율에 관한 사항), 제10조(만기환급금의 지급), 제27조의1(보험료의 납입면제), 제27조의2(납입면제에 관한 세부규정) 및 제38조(중도인출)은 제외합니다.",
        else: "보통약관 제9조(적립부분 적립이율에 관한 사항), 제10조(만기환급금의 지급) 및 제38조(중도인출)은 제외하며, 보통약관 1종(보험료 납입면제 미적용형)으로 가입한 경우 보통약관 제27조의1(보험료의 납입면제) 및 제27조의2(납입면제에 관한 세부규정)도 제외합니다.",
      },
    ],
    // ⑤ 제6조(보험기간) 은 갱신형에만 있다 — 꺼지면 뒤 조 번호가 당겨져 비갱신형 원문의 7조 구성이 된다
    articleConds: [{ article: "6", when: RENEWAL }],
    // 준용규정(④)은 함수조항 「준용규정(알파Plus)」의 본문이 된다 — 조건은 함수조항 안으로 옮겨 가고 이 자리는 참조
    clauses: [whole("7", "lapse-death"), whole("8", "alpha-application")],
  },
  {
    code: "burn-doc",
    ownerCoverage: "burn",
    idPrefix: "s9",
    file: "신화상치료비보장.md",
    // 3보장 중 화상진단비 급부의 지급명만 담보 레벨 값이 된다 — 두 번 등장하므로 오버레이도 두 벌.
    // 나머지 두 지급명(화상수술비 · 중증화상및부식진단비)은 급부 레벨 지급명 자리가 없어 문면에 굳어 있다.
    slots: [
      { article: "2", find: "화상진단비", ref: CLAIM_SLOT },
      { article: "2", find: "화상진단비", ref: CLAIM_SLOT },
    ],
    // 소멸 — 세부보장 셋 중 중증화상및부식진단비만 소멸 급부(①사망 · ②③ 그 세부보장)
    clauses: [whole("1", "burn-scope"), whole("6", "burn-definition", { O01: "V01", O02: "V01" }), whole("7", "lapse-burn"), whole("8", "alpha-application")],
  },
];

export const ALPHA: ProductTerms = {
  code: "alpha",
  seedCode: "alpha-plus",
  line: "alpha",
  fixtureDir: "tests/fixtures/terms",
  appendixNumbers: new Map(APPENDICES.filter((a) => a.number !== undefined).map((a) => [a.number!, a.code])),
  general: ALPHA_GENERAL,
  specials: ALPHA_SPECIALS,
};

/**
 * 메리츠 통합간편건강보험(연만기형) — 보통약관 + 기본계약(일반상해사망) + 특약 표본 8 (모델명세: QA/실물재현/메리츠_모델명세).
 * 특약은 모두 갱신형이다(탑재 담보속성 A0001 = 2). 별표는 알파Plus 마스터를 이름으로 다시 쓴다 — 번호만 다르다.
 */
const MERITZ_GENERAL: GeneralSpec = {
  code: "meritz-general",
  file: "보통약관.md",
  idPrefix: "m",
  emptyArticles: [],
  // 제22조(계약의 무효) — 특약 무효 조가 보통약관 무효 사유에 포함되면 생략 (ADR-0093 결정 8)
  omitContained: ["22"],
  clauses: GENERAL_ARTICLES.map(([key, , article, paragraph]) => at(article, paragraph, key)),
  // 메리츠는 2형 단서가 셋 — 제2조 표 해약환급금 정의 · 제23조 ① · 제40조(해약환급금) ①
  ...formAxisConds(
    { savings: "9", maturity: "10", withdrawal: "43" },
    [
      ["2", " 다만, 2형(해약환급금미지급형)은 보험료 납입기간 중 계약이 해지될 경우 해약환급금을 지급하지 않습니다."],
      ["23", " 다만, 2형(해약환급금미지급형)의 경우 보험기간, 보험료 납입기간, 피보험자의 변경 및 보험가입금액의 증액은 신청할 수 없습니다."],
      ["40", " 단, 2형(해약환급금미지급형)을 가입한 경우에는 해약환급금을 지급하지 않습니다."],
    ],
    "40",
  ),
};

const MERITZ_SPECIALS: SpecialSpec[] = [
  {
    code: "m-base-death-doc",
    ownerCoverage: "m-base-death",
    idPrefix: "mb",
    title: "일반상해사망 기본계약 문면",
    extractFrom: { file: "보통약관.md", articles: ["3", "4"], linkTo: ["3", "4"] },
    // 담보약관 문면 한 벌 (ADR-0089) — 범위 낱말 슬롯 둘 · 「일반상해사망 보험가입금액」의 담보명 낱말은 대치에만(특약 · 블록은 「이 특별약관의 보험가입금액」 · 「보험가입금액」)
    inlineConds: [{ article: "3", find: "일반상해사망 ", when: "builtin.output = 'replace'", then: "일반상해사망 " }],
    slots: [
      { article: "3", find: "보험기간 중에", ref: SCOPE_WORD, before: true },
      { article: "3", find: "보험가입금액 전액을", ref: SCOPE_WORD, before: true },
    ],
  },
  {
    code: "m-disability80-doc",
    ownerCoverage: "m-disability80",
    idPrefix: "m1",
    file: "갱신형_일반상해80%이상후유장해(통합간편가입)보장.md",
    title: "일반상해80%이상후유장해(통합간편가입)보장 특별약관",
    slots: [
      { article: "1", find: "일반상해80%이상후유장해보험금", ref: CLAIM_SLOT },
      { article: "3", find: "일반상해80%이상후유장해보험금", ref: CLAIM_SLOT },
    ],
    clauses: [whole("2", "disability-detail", { O01: "V01", O02: "V01", O03: "V02" }), whole("3", "lapse-claim", "V02"), whole("4", "meritz-application")],
  },
  {
    code: "m-surgery17-doc",
    ownerCoverage: "m-surgery17",
    idPrefix: "m2",
    file: "갱신형_수술비(1-7종,_연간3회한)[상해](통합간편가입)보장.md",
    title: "수술비(1-7종, 연간3회한)[상해](통합간편가입)보장 특별약관",
    slots: [{ article: "1", find: "수술비", ref: CLAIM_SLOT }],
    clauses: [whole("6", "lapse-death"), whole("7", "meritz-application")],
  },
  {
    code: "m-fracture-doc",
    ownerCoverage: "m-fracture",
    idPrefix: "m3",
    file: "갱신형_골절(치아파절_제외)진단비Ⅱ(통합간편가입)보장.md",
    title: "골절(치아파절 제외)진단비Ⅱ(통합간편가입)보장 특별약관",
    slots: [{ article: "1", find: "골절(치아파절 제외)진단비", ref: CLAIM_SLOT }],
    clauses: [whole("1", "fracture-cause"), whole("2", "fracture-detail"), whole("4", "lapse-death"), whole("5", "meritz-application")],
  },
  {
    code: "m-burn-doc",
    ownerCoverage: "m-burn",
    idPrefix: "m4",
    file: "갱신형_신화상치료비(통합간편가입)보장.md",
    title: "신화상치료비(통합간편가입)보장 특별약관",
    slots: [
      { article: "2", find: "화상진단비", ref: CLAIM_SLOT },
      { article: "2", find: "화상진단비", ref: CLAIM_SLOT },
    ],
    // 알파Plus 신화상과 같은 조 셋(보장의 범위 · 소멸 · 중증화상 정의 — 정의는 조사 두 곳이 다르다)
    clauses: [whole("1", "burn-scope"), whole("6", "burn-definition", { O01: "V02", O02: "V02" }), whole("7", "lapse-burn"), whole("8", "meritz-application")],
  },
  {
    code: "m-fracture-surgery-doc",
    ownerCoverage: "m-fracture-surgery",
    idPrefix: "m5",
    file: "갱신형_골절수술비Ⅱ(통합간편가입)보장.md",
    title: "골절수술비Ⅱ(통합간편가입)보장 특별약관",
    slots: [{ article: "1", find: "골절수술비", ref: CLAIM_SLOT }],
    clauses: [whole("1", "fracture-surgery-cause"), whole("2", "fracture-surgery-detail"), whole("5", "lapse-death"), whole("6", "meritz-application")],
  },
  {
    code: "m-disease-death-doc",
    ownerCoverage: "m-disease-death",
    idPrefix: "m6",
    file: "갱신형_질병사망(통합간편가입)보장.md",
    title: "질병사망(통합간편가입)보장 특별약관",
    slots: [
      { article: "1", find: "질병사망보험금", ref: CLAIM_SLOT },
      { article: "3", find: "질병사망보험금", ref: CLAIM_SLOT },
    ],
    // 소멸은 사망보험금형(③ 「제1항 이외의 사유로」). 준용규정은 제5조까지 빼는 다른 글이라 담보약관에 직접 둔다
    clauses: [whole("3", "lapse-claim-death", { O01: "V02", O02: "V02" })],
  },
  {
    code: "m-disease-disability80-doc",
    ownerCoverage: "m-disease-disability80",
    idPrefix: "m7",
    file: "갱신형_질병80%이상후유장해(통합간편가입)보장.md",
    title: "질병80%이상후유장해(통합간편가입)보장 특별약관",
    slots: [
      { article: "1", find: "질병80%이상후유장해보험금", ref: CLAIM_SLOT },
      { article: "3", find: "질병80%이상후유장해보험금", ref: CLAIM_SLOT },
    ],
    clauses: [whole("2", "disability-detail", { O01: "V02", O02: "V02", O03: "V01" }), whole("3", "lapse-claim", "V02"), whole("4", "meritz-application")],
  },
  {
    code: "m-disease-surgery17-doc",
    ownerCoverage: "m-disease-surgery17",
    idPrefix: "m8",
    file: "갱신형_수술비(1-7종,_연간3회한)[질병](통합간편가입)보장.md",
    title: "수술비(1-7종, 연간3회한)[질병](통합간편가입)보장 특별약관",
    slots: [{ article: "1", find: "수술비", ref: CLAIM_SLOT }],
    clauses: [whole("6", "lapse-death"), whole("7", "meritz-application")],
  },
];

export const MERITZ: ProductTerms = {
  code: "meritz",
  line: "meritz",
  fixtureDir: "tests/fixtures/terms/메리츠",
  // 메리츠 원문 번호 → 알파Plus 마스터 (이름이 같은 별표). 1 적립이율 · 3 암 · 7 급성심근경색 · 14 장해 · 16 뇌졸중 · 26 골절(치아파절 제외)Ⅱ · 27 골절Ⅱ · 28 화상 · 29 1-7종 수술
  appendixNumbers: new Map([
    [1, "AX000001"],
    [3, "AX000004"],
    [7, "AX000008"],
    [14, "AX000002"],
    [16, "AX000007"],
    [26, "AX000014"],
    [27, "AX000021"],
    [28, "AX000013"],
    [29, "AX000003"],
  ]),
  general: MERITZ_GENERAL,
  specials: MERITZ_SPECIALS,
};

/**
 * 무배당 알파Plus보장보험2607 — 세 번째 실물 재현 상품 (QA/실물재현/알파플러스2607_모델명세). 2604 와 같은 상품군 · 같은 보통약관 구성이라 **공통화**한다:
 * - 보통약관은 2607 원문 한 벌이되 조 id 체계(`g`)를 2604 와 같이 쓴다 — 2604 담보약관 · 준용규정 · 납입면제 함수조항이 그대로 풀린다.
 *   보통약관 함수조항 쓰임은 2604 와 같은 표(`GENERAL_ARTICLES`), 납입면제 템플릿 · 함수조항도 2604 것(convert.ts).
 * - 상해 특약 10 은 2604 담보 · 템플릿을 그대로 탑재한다(products.json) — 원문이 띄어쓰기 · 예시 표기만 다르다(인수기준 알려진 차이).
 * - 여기 담보약관 목록은 2604 에 없는 특약만 — 질병 대표 5. 특약을 넓힐 때는 이 목록에 한 줄씩 더한다(`disease` 줄임말).
 * 별표 번호는 2604 와 같다(장해 2 · 수술 3 · 암 4 · 5대고액치료비암 9 · 만성당뇨합병증 12 · 양성뇌종양 20 …).
 */
// 2607 은 제23조 단서의 「해약환급금미지급형」이 붙여 쓰였다(2604 는 띄어 씀) — 형 축 문장은 제 원문 글로
const ALPHA2607_GENERAL: GeneralSpec = {
  ...ALPHA_GENERAL,
  code: "alpha2607-general",
  ...formAxisConds(
    { savings: "9", maturity: "10", withdrawal: "38" },
    [["23", " 다만, 2형(해약환급금미지급형(납입후50%))의 경우 보험기간, 보험료 납입기간, 피보험자의 변경 및 보험가입금액의 증액은 신청할 수 없습니다."]],
    "35",
  ),
};

/**
 * 질병 진단비 특약 한 벌 — 제1조 보험금명 자리(슬롯 `slotCount` 번) · 제3자 합의 세부규정 · 소멸(지급사유 발생) · 준용규정(알파Plus 질병).
 * `articles` 는 원문 조 번호 [세부규정, 소멸, 준용규정] (5대고액치료비암은 무효 · 부활 조가 끼어 뒤로 밀린다).
 */
const disease = (key: string, file: string, claim: string, slotCount: number, articles: [string, string, string] = ["2", "4", "5"]): SpecialSpec => ({
  code: `a7-${key}-doc`,
  ownerCoverage: `a7-${key}`,
  idPrefix: `a7${key}`,
  file,
  // 보험금명 자리(claim.ts) — 제1조의 자리마다, 소멸 조 ① 은 함수조항 「특별약관의 소멸(지급사유 발생)」 본문의 슬롯과 맞춘다
  slots: [...Array.from({ length: slotCount }, () => ({ article: "1", find: claim, ref: CLAIM_SLOT })), { article: articles[1], find: claim, ref: CLAIM_SLOT }],
  clauses: [whole(articles[0], "third-party"), whole(articles[1], "lapse-claim", "V01"), whole(articles[2], "alpha-application-disease")],
});

/**
 * 자동 탑재 특약 한 줄 — 원문 목록 번호(`npm run terms:pdfmd -- <원문> --list` 의 #N) · fixture · (있으면) 같은 담보의 갱신형 fixture.
 * 담보 key 는 `<접두>-<그룹 글자><번호>`(2607 `a7` · 2610 `a10`). 갱신형만 있는 특약은 갱신형 fixture 를 `file` 에 둔다(제목에서 갱신형을 읽는다).
 */
export const autoSpecialOf =
  (prefix: string) =>
  (letter: string, category: CoverageCategory, group?: string) =>
  (no: number, file: string, renewal?: string): SpecialSpec => ({
    code: `${prefix}-${letter}${no}-doc`,
    ownerCoverage: `${prefix}-${letter}${no}`,
    idPrefix: `${prefix}${letter}${no}`,
    file,
    slots: [],
    auto: { category, ...(group ? { group } : {}), ...(renewal ? { renewal } : {}) },
  });
/** 알파Plus2607 자동 탑재 — 담보 key `a7-<글자><번호>`. */
export const autoSpecial = autoSpecialOf("a7");
const injury = autoSpecial("i", "V01");
// 「기타 특별약관」(자동갱신 · 피보험자추가) · 「상해 및 질병 관련 특별약관」은 기본 그룹이 없다 — 담보분류는 질병, 묶음은 사용자 그룹 (ADR-0090)
const etc = autoSpecial("e", "V02", "기타 특별약관");
const cost = autoSpecial("c", "V03");
const both = autoSpecial("b", "V02", "상해 및 질병 관련 특별약관");
const illness = autoSpecial("d", "V02");

/** 알파Plus2607 자동 탑재 — 원문 「특별약관 Ⅰ ~ Ⅴ」 의 특약 중 손으로 설정한 것(2604 담보 탑재 · 질병 대표 5)을 뺀 전부. */
export const ALPHA2607_AUTO: SpecialSpec[] = [
  // ── Ⅰ 상해 관련 (#1 ~ #10 은 2604 담보 탑재, #22 · #33 갱신형은 2604 담보의 갱신형 탑재)
  injury(11, "상해흉터복원수술비보장.md"),
  injury(12, "상해수술비보장.md", "갱신형_상해수술비보장.md"),
  injury(13, "상해_통합치료비(실속형)보장.md"),
  injury(14, "일반상해입원일당(1일이상)보장.md", "갱신형_일반상해입원일당(1일이상)보장.md"),
  injury(16, "일반상해중환자실입원일당(1일이상)보장.md", "갱신형_일반상해중환자실입원일당(1일이상)보장.md"),
  injury(17, "강력범죄피해(일상생활중)보장.md"),
  injury(18, "안전사고피해치료비보장(폭력치료비,_유괴･인신매매피해치료비).md"),
  injury(19, "일반상해수술입원일당(1일이상_20일한도)보장.md"),
  injury(20, "5대골절진단비보장.md"),
  injury(21, "5대골절수술비보장.md"),
  injury(23, "골절(치아파절제외)수술비Ⅱ보장.md"),
  injury(24, "일반상해50%이상후유장해보장.md"),
  injury(25, "대중교통이용중_교통상해후유장해(3-100%)보장.md"),
  injury(26, "일반상해후유장해(20-100%)보장.md"),
  injury(28, "일반상해후유장해(3-100%)보장.md"),
  injury(29, "종합병원_일반상해입원일당(1일이상)보장.md"),
  injury(30, "신골절치료비(치아파절포함)보장.md", "갱신형_신골절치료비(치아파절포함)보장.md"),
  injury(31, "상급종합병원_일반상해입원일당(1일이상)보장.md"),
  injury(36, "골절진단비Ⅱ보장.md", "갱신형_골절진단비Ⅱ보장.md"),
  injury(38, "상급병실(1인실)_상급종합병원_일반상해입원일당(1일이상_10일한도)보장.md"),
  injury(39, "상급병실(1인실)_종합병원_일반상해입원일당(1일이상_30일한도)보장.md"),
  injury(40, "상급병실(1인실)_종합병원_일반상해수술입원일당(1일이상_10일한도)보장.md"),
  injury(41, "종합병원_상해수술비보장.md", "갱신형_종합병원_상해수술비보장.md"),
  injury(42, "상급종합병원_상해수술비보장.md", "갱신형_상급종합병원_상해수술비보장.md"),
  injury(45, "일반상해입원일당(181일이상)(요양,정신,한방병원제외)보장.md"),
  injury(46, "간병인사용_일반상해입원일당(plus)(181일이상)(요양,정신,한방병원제외)보장.md"),
  injury(47, "간호·간병통합서비스_사용_일반상해입원일당(181일이상)(요양,정신,한방병원제외)보장.md"),
  injury(48, "간병인사용_일반상해입원일당(plus)(1일이상_180일한도)(요양병원제외)보장.md"),
  injury(49, "간병인사용_일반상해입원일당(1일이상_180일한도)(요양병원)보장.md"),
  injury(50, "간호·간병통합서비스_사용_일반상해입원일당(1일이상_180일한도)보장.md"),
  injury(51, "간병인사용_일반상해입원일당(plus)(1일이상_180일한도)(요양병원제외)(체증형)보장.md"),
  injury(52, "간병인사용_일반상해입원일당(1일이상_180일한도)(요양병원)(체증형)보장.md"),
  injury(53, "일반상해입원_간병인비용지원(간병인비용_200만원_이상)(요양병원제외)보장.md"),
  injury(54, "일반상해입원_간병인비용지원(간병인비용_500만원_이상)(요양병원제외)보장.md"),
  injury(55, "일반상해입원_간병인비용지원(간병인비용_1,000만원_이상)(요양병원제외)보장.md"),
  injury(56, "일반상해입원_간병인비용지원(간병인비용_2,000만원_이상)(요양병원제외)보장.md"),
  injury(57, "2-3인실_상급종합병원일반상해입원일당(1일이상_30일한도)보장.md"),
  injury(58, "2-3인실_종합병원_일반상해입원일당(1일이상_30일한도)보장.md"),
  injury(59, "상해특정급여시술치료비보장.md"),
  injury(60, "상해수술비(치아파절및치아탈구제외)보장.md", "갱신형_상해수술비(치아파절및치아탈구제외)보장.md"),
  injury(61, "상해_통합생활지원비(월간한도)보장.md"),
  injury(62, "상해_1-5종수술비(plus)(연간2회이상)보장.md"),
  injury(63, "통합외상치료비(권역외상센터)보장.md"),
  // ── Ⅱ 질병 관련 (5대고액치료비암 · 양성뇌종양Ⅱ · 말기신부전증 · 만성당뇨합병증 · 중대한재생불량성빈혈 진단비는 손 설정 — 질병 대표 5)
  illness(1, "질병사망보장.md", "갱신형_질병사망보장.md"),
  illness(2, "질병사망보장_추가.md"),
  illness(6, "말기폐질환진단비보장.md"),
  illness(7, "말기간경화진단비보장.md"),
  illness(9, "질병입원일당(1일이상)보장.md", "갱신형_질병입원일당(1일이상)보장.md"),
  illness(10, "수술비(1-7종,_연간3회한)[질병]보장.md", "갱신형_수술비(1-7종,_연간3회한)[질병]보장.md"),
  illness(11, "충수염수술비보장.md"),
  illness(12, "특정전염병진단비보장.md"),
  illness(13, "조혈모세포이식수술비보장.md"),
  illness(14, "호흡기관련질병수술비보장.md"),
  illness(15, "질병중환자실입원일당(1일이상)보장.md", "갱신형_질병중환자실입원일당(1일이상)보장.md"),
  illness(16, "유사암수술비보장.md", "갱신형_유사암수술비보장.md"),
  illness(17, "암수술비(유사암제외)보장.md", "갱신형_암수술비(유사암제외)보장.md"),
  illness(18, "항암방사선약물치료비보장.md", "갱신형_항암방사선약물치료비보장.md"),
  illness(19, "질병수술입원일당(1일이상_20일한도)보장.md"),
  illness(20, "희귀난치성_7대질환진단비보장.md"),
  illness(21, "뇌출혈진단비보장.md"),
  illness(22, "질병80%이상후유장해보장.md"),
  illness(24, "남성특정비뇨기계질환수술비보장.md"),
  illness(25, "4대양성종양진단비보장.md", "갱신형_4대양성종양진단비보장.md"),
  illness(26, "간질환수술비보장.md"),
  illness(28, "특정희귀난치성질환수술비보장.md"),
  illness(29, "갑상선기능항진증치료비보장.md"),
  illness(30, "16대특정암진단비보장.md"),
  illness(35, "암직접치료입원일당(Ⅱ)(요양병원제외,_1일이상)보장.md", "갱신형_암직접치료입원일당(Ⅱ)(요양병원제외,_1일이상)보장.md"),
  illness(38, "결핵진단비보장.md"),
  illness(39, "약제내성결핵(슈퍼결핵포함)진단비보장.md"),
  illness(40, "재진단암진단비(1년_대기형)보장.md", "갱신형_재진단암진단비(1년_대기형)보장.md"),
  illness(41, "다발경화증진단비보장.md"),
  illness(43, "질병후유장해(3-100%)보장.md", "갱신형_질병후유장해(3-100%)보장.md"),
  illness(44, "32대질병관혈수술비(연간1회한)보장.md", "갱신형_32대질병관혈수술비(연간1회한)보장.md"),
  illness(45, "5대질환(심장,뇌혈관,신부전,간,폐_질환)수술비(연간1회한)보장.md"),
  illness(46, "요실금수술비(급여)(연간1회한)보장.md"),
  illness(47, "암요양병원입원일당(Ⅱ)(1일이상_90일한도)보장.md", "갱신형_암요양병원입원일당(Ⅱ)(1일이상_90일한도)보장.md"),
  illness(50, "혈전용해치료비Ⅱ(연간1회한)보장.md"),
  illness(52, "갱신형_5대질환_(심장,뇌혈관,신부전,간,폐_질환)수술비_(연간1회한)보장.md"),
  illness(53, "당뇨병진단비Ⅱ보장.md"),
  illness(58, "대상포진진단비보장.md", "갱신형_대상포진진단비보장.md"),
  illness(59, "대상포진눈병진단비보장.md", "갱신형_대상포진눈병진단비보장.md"),
  illness(60, "통풍진단비보장.md", "갱신형_통풍진단비보장.md"),
  illness(61, "간경변증진단비보장.md", "갱신형_간경변증진단비보장.md"),
  illness(62, "갑상선암(초기제외)진단비보장.md"),
  illness(63, "상급종합병원_질병입원일당(1일이상)보장.md"),
  illness(64, "질병입원일당(1일이상_30일한도)보장.md"),
  illness(66, "종합병원_질병입원일당(1일이상)보장.md"),
  illness(67, "갑상선암_및_기타피부암의_전이암(림프절_등_전이제외)진단비보장.md"),
  illness(68, "요로결석진단비보장.md", "갱신형_요로결석진단비보장.md"),
  illness(70, "기계적혈전제거술(카테터법)치료비Ⅱ(급여,_연간1회한)보장.md"),
  illness(72, "상급병실(1인실)_상급종합병원_질병입원일당(1일이상_10일한도)보장.md"),
  illness(73, "계속받는_항암방사선약물치료비(급여)(연간1회한)보장.md", "갱신형_계속받는_항암방사선약물치료비(급여)(연간1회한)보장.md"),
  illness(75, "암직접치료통원일당(상급종합병원)보장.md", "갱신형_암직접치료통원일당(상급종합병원)보장.md"),
  illness(77, "급성간염(A,B,C형)진단비보장.md"),
  illness(78, "암특정재활치료비(급여,_1일1회한,_연간20회한)보장.md"),
  illness(79, "암특정통증완화치료비(급여,_연간1회한)보장.md"),
  illness(80, "질병수술비(특정5대질병_제외)보장.md", "갱신형_질병수술비(특정5대질병_제외)보장.md"),
  illness(81, "심근병증진단비보장.md"),
  illness(82, "갑상선기능저하증진단비보장.md"),
  illness(83, "보험료납입지원(유사암진단)보장.md"),
  illness(84, "암수술비(유사암제외)(25%체증형)보장.md", "갱신형_암수술비(유사암제외)(25%체증형)보장.md"),
  illness(86, "유사암수술비(25%체증형)보장.md", "갱신형_유사암수술비(25%체증형)보장.md"),
  illness(88, "혈전용해치료비Ⅱ보장.md"),
  illness(89, "상급병실(1인실)_종합병원_질병입원일당(1일이상_30일한도)보장.md"),
  illness(90, "상급병실(1인실)_종합병원_질병수술입원일당(1일이상_10일한도)보장.md"),
  illness(92, "질병입원일당(181일이상)(요양,정신,한방병원제외)보장.md"),
  illness(93, "간병인사용_질병입원일당(plus)(181일이상)(요양,정신,한방병원제외)보장.md"),
  illness(94, "간호·간병통합서비스_사용_질병입원일당(181일이상)(요양,정신,한방병원제외)보장.md"),
  illness(95, "간병인사용_질병입원일당(plus)(1일이상_180일한도)(요양병원제외)보장.md"),
  illness(96, "간병인사용_질병입원일당(1일이상_180일한도)(요양병원)보장.md"),
  illness(97, "간호·간병통합서비스_사용_질병입원일당(1일이상_180일한도)보장.md"),
  illness(98, "간병인사용_질병입원일당(plus)(1일이상_180일한도)(요양병원제외)(체증형)보장.md"),
  illness(99, "간병인사용_질병입원일당(1일이상_180일한도)(요양병원)(체증형)보장.md"),
  illness(100, "질병입원_간병인비용지원(간병인비용_200만원_이상)(요양병원제외)보장.md"),
  illness(101, "질병입원_간병인비용지원(간병인비용_500만원_이상)(요양병원제외)보장.md"),
  illness(102, "질병입원_간병인비용지원(간병인비용_1,000만원_이상)(요양병원제외)보장.md"),
  illness(103, "질병입원_간병인비용지원(간병인비용_2,000만원_이상)(요양병원제외)보장.md"),
  illness(104, "2-3인실_상급종합병원_질병입원일당(1일이상_30일한도)보장.md"),
  illness(105, "2-3인실_종합병원_질병입원일당(1일이상_30일한도)보장.md"),
  illness(106, "고혈압(원발성)대상질병진단비보장.md"),
  illness(107, "이상지질혈증(고지혈증포함)대상질병진단비보장.md"),
  illness(108, "특정순환계질환진단비보장.md", "갱신형_특정순환계질환진단비보장.md"),
  illness(110, "뇌혈관질환통원일당(연간30회한)보장.md", "갱신형_뇌혈관질환통원일당(연간30회한)보장.md"),
  illness(111, "뇌혈관질환통원일당(종합병원,_연간30회한)보장.md", "갱신형_뇌혈관질환통원일당(종합병원,_연간30회한)보장.md"),
  illness(112, "뇌혈관질환통원일당(상급종합병원,_연간30회한)보장.md", "갱신형_뇌혈관질환통원일당(상급종합병원,_연간30회한)보장.md"),
  illness(113, "허혈성심장질환통원일당(연간30회한)보장.md", "갱신형_허혈성심장질환통원일당(연간30회한)보장.md"),
  illness(114, "허혈성심장질환통원일당(종합병원,_연간30회한)보장.md", "갱신형_허혈성심장질환통원일당(종합병원,_연간30회한)보장.md"),
  illness(115, "허혈성심장질환통원일당(상급종합병원,_연간30회한)보장.md", "갱신형_허혈성심장질환통원일당(상급종합병원,_연간30회한)보장.md"),
  illness(122, "최대두배받는2대질환치료비(포인트적립형)보장.md", "갱신형_최대두배받는2대질환치료비(포인트적립형)보장.md"),
  illness(124, "질병수술비보장.md", "갱신형_질병수술비보장.md"),
  illness(125, "암_주요치료비(연간1회한,_10년간)보장.md"),
  illness(126, "2대질환_주요치료비(연간1회한,_10년간)보장.md", "갱신형_2대질환_주요치료비(연간1회한,_10년간)보장.md"),
  illness(128, "상급종합병원,국립암센터_암_주요치료비(연간1회한,_10년간)보장.md"),
  illness(129, "상급종합병원,국립암센터_암_주요치료비(연간1회한,_10년간)(체증형)보장.md"),
  illness(130, "상급종합병원_2대질환_주요치료비(연간1회한,_10년간)보장.md", "갱신형_상급종합병원_2대질환_주요치료비(연간1회한,_10년간)보장.md"),
  illness(132, "상급종합병원_2대질환_주요치료비(연간1회한,_10년간)(체증형)보장.md", "갱신형_상급종합병원_2대질환_주요치료비(연간1회한,_10년간)(체증형)보장.md"),
  illness(134, "질병특정급여시술치료비보장.md"),
  illness(135, "암_주요치료비(연간1회한,_10년간)(체증형)보장.md"),
  illness(136, "통합암_주요치료비(연간1회한,_10년간)보장.md"),
  illness(137, "통합암_주요치료비(체증형)(연간1회한,_10년간)보장.md"),
  illness(138, "상급종합병원,국립암센터_통합암_주요치료비(연간1회한,_10년간)보장.md"),
  illness(139, "상급종합병원,국립암센터_통합암_주요치료비(체증형)(연간1회한,_10년간)보장.md"),
  illness(140, "비급여_암_주요치료비(전액본인부담_포함,_연간1회한,_10년간)보장.md"),
  illness(141, "비급여_항암약물치료비(전액본인부담_포함,_연간1회한,_10년간)보장.md"),
  illness(143, "특정순환계질환_통합치료비보장.md"),
  illness(144, "상급종합병원,권역심뇌혈관질환센터_특정순환계질환_통합치료비보장.md"),
  illness(145, "항암중입자방사선치료비보장.md"),
  illness(146, "암_통합생활지원비(월간한도)보장.md"),
  illness(147, "암전후관련_특정질환_및_양성신생물_통합치료비보장.md"),
  illness(148, "암_통합치료비(기본형)보장.md"),
  illness(149, "암_통합치료비(기본형)(암중점치료기관(상급종합병원_포함))보장.md"),
  illness(150, "암_통합치료비(실속형)보장.md"),
  illness(151, "암_통합치료비(실속형)(암중점치료기관(상급종합병원_포함))보장.md"),
  illness(152, "통합암진단비(전이포함)(유사암제외)보장.md", "갱신형_통합암진단비(전이포함)(유사암제외)보장.md"),
  illness(154, "특정호르몬약물허가치료비보장.md"),
  illness(155, "계속받는_특정항암호르몬약물허가치료비(연간1회한)보장.md"),
  illness(156, "암_통합치료비Ⅱ(비급여(전액본인부담_포함))보장.md"),
  illness(157, "암_통합치료비Ⅱ(비급여(전액본인부담_포함),_암중점치료기관(상급종합병원_포함))보장.md"),
  illness(158, "암_통합치료비(주요치료)(비급여(전액본인부담_포함))보장.md"),
  illness(159, "암_통합치료비(주요치료)(비급여(전액본인부담_포함),_암중점치료기관(상급종합병원_포함))보장.md"),
  illness(160, "26종_항암방사선및약물치료비(전이포함)(유사암제외)보장.md"),
  illness(161, "기타피부암_및_갑상선암_항암방사선약물치료비보장.md"),
  illness(162, "암_통합치료_생활비(연간_통합치료_2회이상)보장.md"),
  illness(163, "131대질병수술비보장.md", "갱신형_131대질병수술비보장.md"),
  illness(165, "종합병원_질병수술비(특정5대질병_제외)보장.md", "갱신형_종합병원_질병수술비(특정5대질병_제외)보장.md"),
  illness(166, "상급종합병원_질병수술비(특정5대질병_제외)보장.md", "갱신형_상급종합병원_질병수술비(특정5대질병_제외)보장.md"),
  illness(167, "종합병원_질병수술비보장.md", "갱신형_종합병원_질병수술비보장.md"),
  illness(168, "상급종합병원_질병수술비보장.md", "갱신형_상급종합병원_질병수술비보장.md"),
  illness(173, "질병수술비(특정2대질병제외)보장.md", "갱신형_질병수술비(특정2대질병제외)보장.md"),
  illness(175, "질병수술비(특정6대질병제외)보장.md", "갱신형_질병수술비(특정6대질병제외)보장.md"),
  illness(177, "질병_통합치료비보장.md"),
  illness(178, "특정순환계질환_통합치료_생활비보장.md"),
  illness(179, "질병_1-5종수술비(plus)(연간2회이상)보장.md"),
  // ── Ⅲ 상해 및 질병 관련
  both(1, "5대장기이식수술비보장.md"),
  both(2, "유방절제수술복원치료비(부분절제제외)보장.md"),
  both(3, "인공관절수술비보장.md"),
  both(4, "각막이식수술비보장.md"),
  both(5, "깁스치료비보장.md"),
  both(6, "장기요양급여금(1-4등급)보장.md"),
  both(7, "장기요양급여금(1-2등급)보장.md"),
  both(8, "장기요양급여금(1등급)보장.md"),
  both(9, "중증치매간병비보장.md"),
  both(10, "응급실내원비(응급)보장.md"),
  both(11, "경증이상_치매간병비보장.md"),
  both(12, "신깁스치료비보장.md", "갱신형_신깁스치료비보장.md"),
  both(13, "중등도이상_치매간병비보장.md"),
  both(15, "아나필락시스진단비(응급,_연간1회한)보장.md"),
  both(16, "7대장기이식대기등록보장.md"),
  both(17, "종합병원_전신마취치료비(급여)보장.md"),
  both(18, "종합병원_전신마취치료비(급여,_4시간이상)보장.md"),
  both(19, "종합병원_전신마취치료비(급여,_6시간이상)보장.md"),
  both(20, "2대질환_통합생활지원비(월간한도)보장.md"),
  both(21, "특정순환계질환(주요손상및질환)_통합치료비보장.md"),
  both(22, "질병_통합생활지원비(특정상해산정특례_포함)(월간한도)보장.md"),
  // ── Ⅳ 비용손해 관련
  cost(1, "의료사고법률비용보장.md"),
  cost(2, "화재벌금보장.md"),
  cost(3, "민사소송법률비용보장.md"),
  cost(4, "임대차보증금_법률비용보장.md"),
  cost(5, "부동산소유권_법률비용보장.md"),
  cost(6, "행정소송법률비용보장.md"),
  // ── Ⅴ 기타 — 자동갱신 · 피보험자추가(급부가 없는 제도성 특약이지만 원문이 주계약 특별약관으로 묶어 탑재한다)
  etc(1, "자동갱신.md"),
  etc(2, "피보험자추가.md"),
];


// ───────────────────────────── 알파Plus2610 ─────────────────────────────

/** 알파Plus2610 원문 폴더 — 개정된 2607 담보의 원문도 여기서 읽는다(`SpecialSpec.fixtureDir`). */
const ALPHA2610_DIR = "tests/fixtures/terms/알파2610";

/**
 * 2610 에서 글이 개정된 2607 담보 — 담보 템플릿을 2610 원문으로 바꾼다(2026-11-03 사용자 결정: 담보명은 전역 유일이라 같은 이름의 새 담보를 두지 않는다).
 * 2607 상품은 이 담보들이 2610 글로 찍힌다 — 알려진 차이(판 대조, `knownDifferences.ts`). 대조 근거: `tests/fixtures/terms/알파2610/_2607대조.json` 의 diff.
 * 2604 담보(생활자금 80 · 50 · 수술비 짝 · 갱신형 사망)는 2604 상품도 써서 바꾸지 않는다 — 2610 쪽 알려진 차이.
 */
export const REVISED_IN_2610: ReadonlySet<string> = new Set([
  "a7-b17", "a7-b18", "a7-b19", "a7-b20", "a7-b21", "a7-b22", "a7-c3", "a7-c4", "a7-c5", "a7-c6", "a7-d10", "a7-d122", "a7-d125", "a7-d126", "a7-d128", "a7-d129", "a7-d130", "a7-d132", "a7-d134", "a7-d135", "a7-d136", "a7-d137", "a7-d138", "a7-d139", "a7-d140", "a7-d141", "a7-d143", "a7-d144", "a7-d145", "a7-d146", "a7-d147", "a7-d148", "a7-d149", "a7-d150", "a7-d151", "a7-d154", "a7-d156", "a7-d157", "a7-d158", "a7-d159", "a7-d16", "a7-d160", "a7-d161", "a7-d162", "a7-d17", "a7-d177", "a7-d18", "a7-d22", "a7-d25", "a7-d35", "a7-d40", "a7-d43", "a7-d46", "a7-d47", "a7-d53", "a7-d62", "a7-d70", "a7-d73", "a7-d75", "a7-d78", "a7-d84", "a7-d86", "a7-d95", "a7-d96", "a7-d99", "a7-e1", "a7-e2", "a7-i11", "a7-i13", "a7-i49", "a7-i52", "a7-i59", "a7-i61", "a7-anemia",
]);
const revisedIn2610 = (s: SpecialSpec): SpecialSpec => (REVISED_IN_2610.has(s.ownerCoverage) ? { ...s, fixtureDir: ALPHA2610_DIR } : s);

const injury10 = autoSpecialOf("a10")("i", "V01");
const illness10 = autoSpecialOf("a10")("d", "V02");
const both10 = autoSpecialOf("a10")("b", "V02", "상해 및 질병 관련 특별약관");
// 비용손해 · 기타 묶음에는 2610 이 처음 실은 특약이 없다(2607 담보 그대로)

/** 알파Plus2610 이 처음 실은 특약(2607 에 없는 이름) — 자동 탑재 한 줄씩(원문 목록 번호 · fixture · 갱신형 fixture). */
export const ALPHA2610_AUTO: SpecialSpec[] = [
  injury10(64, "상해진단및치료비보장.md"),
  illness10(180, "암진단비(유사암제외)보장.md", "갱신형_암진단비(유사암제외)보장.md"),
  illness10(182, "유사암진단비보장.md", "갱신형_유사암진단비보장.md"),
  illness10(184, "유사암진단비Ⅱ보장.md", "갱신형_유사암진단비Ⅱ보장.md"),
  illness10(186, "암진단비(유사암_및_소액암_제외)보장.md", "갱신형_암진단비(유사암_및_소액암_제외)보장.md"),
  illness10(188, "뇌졸중진단비보장.md", "갱신형_뇌졸중진단비보장.md"),
  illness10(190, "뇌졸중진단비Ⅱ보장.md", "갱신형_뇌졸중진단비Ⅱ보장.md"),
  illness10(192, "뇌혈관질환진단비보장.md", "갱신형_뇌혈관질환진단비보장.md"),
  illness10(194, "뇌혈관질환진단비Ⅱ보장.md", "갱신형_뇌혈관질환진단비Ⅱ보장.md"),
  illness10(196, "급성심근경색증진단비보장.md", "갱신형_급성심근경색증진단비보장.md"),
  illness10(198, "급성심근경색증진단비Ⅱ보장.md", "갱신형_급성심근경색증진단비Ⅱ보장.md"),
  illness10(200, "허혈성심장질환진단비보장.md", "갱신형_허혈성심장질환진단비보장.md"),
  illness10(202, "허혈성심장질환진단비Ⅱ보장.md", "갱신형_허혈성심장질환진단비Ⅱ보장.md"),
  illness10(204, "중증갑상선암진단비보장.md", "갱신형_중증갑상선암진단비보장.md"),
  illness10(206, "통합암진단비(유사암제외)보장.md", "갱신형_통합암진단비(유사암제외)보장.md"),
  illness10(208, "전이암진단비보장.md", "갱신형_전이암진단비보장.md"),
  illness10(210, "원격전이포함_4기_통합암진단비(유사암제외)보장.md"),
  illness10(211, "원격전이포함_4기_기타피부암_및_갑상선암진단비보장.md"),
  illness10(212, "암진단및치료비Ⅱ보장.md"),
  illness10(213, "뇌혈관질환진단및치료비보장.md"),
  illness10(214, "허혈성심장질환진단및치료비보장.md"),
  illness10(215, "뇌혈관질환진단및치료비Ⅱ보장.md"),
  illness10(216, "허혈성심장질환진단및치료비Ⅱ보장.md"),
  illness10(217, "암후유장해및진단비보장.md"),
  illness10(218, "암치료,후유장해및진단비보장.md"),
  illness10(219, "암후유장해(3-100%)보장.md"),
  illness10(220, "암80%이상후유장해보장.md"),
  illness10(221, "뇌혈관질환수술비보장.md", "갱신형_뇌혈관질환수술비보장.md"),
  illness10(222, "허혈성심장질환수술비보장.md", "갱신형_허혈성심장질환수술비보장.md"),
  illness10(225, "뇌혈관질환수술비(25%체증형)보장.md", "갱신형_뇌혈관질환수술비(25%체증형)보장.md"),
  illness10(226, "허혈성심장질환수술비(25%체증형)보장.md", "갱신형_허혈성심장질환수술비(25%체증형)보장.md"),
  illness10(229, "암_통합입통원일당(직접치료,요양병원입원포함)보장.md"),
  illness10(230, "암_통합입통원일당(직접치료)(암중점치료기관(상급종합병원_포함))보장.md"),
  illness10(231, "특정순환계질환_통합치료비Ⅱ보장.md"),
  both10(20, "수술비Ⅱ(1-5종)보장.md", "갱신형_수술비Ⅱ(1-5종)보장.md"),
  both10(22, "수술비Ⅱ(1-5종)(체증형)_보장.md"),
];

/**
 * 알파Plus2610 자동 탑재 순서 — 원문 「특별약관 Ⅰ ~ Ⅴ」 목록 순. `a7-*` 는 2607 담보를 그대로(원문이 같거나 2610 글로 바꾼 것), `a10-*` 는 2610 이 처음 실은 것.
 * 손으로 설정한 담보(2604 상해 · 2607 질병 대표)는 `products.json` 의 손 탑재다.
 */
const ALPHA2610_ORDER = [
  "a7-i11", "a7-i12", "a7-i13", "a7-i14", "a7-i16", "a7-i17",
  "a7-i18", "a7-i19", "a7-i20", "a7-i21", "a7-i23", "a7-i24",
  "a7-i25", "a7-i26", "a7-i28", "a7-i29", "a7-i30", "a7-i31",
  "a7-i36", "a7-i38", "a7-i39", "a7-i40", "a7-i41", "a7-i42",
  "a7-i45", "a7-i46", "a7-i47", "a7-i48", "a7-i49", "a7-i50",
  "a7-i51", "a7-i52", "a7-i53", "a7-i54", "a7-i55", "a7-i56",
  "a7-i57", "a7-i58", "a7-i59", "a7-i60", "a7-i61", "a7-i62",
  "a7-i63", "a10-i64", "a7-d1", "a7-d2", "a7-d6", "a7-d7",
  "a7-d9", "a7-d10", "a7-d11", "a7-d12", "a7-d13", "a7-d14",
  "a7-d15", "a7-d16", "a7-d17", "a7-d18", "a7-d19", "a7-d20",
  "a7-d21", "a7-d22", "a7-d24", "a7-d25", "a7-d26", "a7-d28",
  "a7-d29", "a7-d30", "a7-d35", "a7-d38", "a7-d39", "a7-d40",
  "a7-d41", "a7-d43", "a7-d44", "a7-d45", "a7-d46", "a7-d47",
  "a7-d50", "a7-d52", "a7-d53", "a7-d58", "a7-d59", "a7-d60",
  "a7-d61", "a7-d62", "a7-d63", "a7-d64", "a7-d66", "a7-d67",
  "a7-d68", "a7-d70", "a7-d72", "a7-d73", "a7-d75", "a7-d77",
  "a7-d78", "a7-d79", "a7-d80", "a7-d81", "a7-d82", "a7-d83",
  "a7-d84", "a7-d86", "a7-d88", "a7-d89", "a7-d90", "a7-d92",
  "a7-d93", "a7-d94", "a7-d95", "a7-d96", "a7-d97", "a7-d98",
  "a7-d99", "a7-d100", "a7-d101", "a7-d102", "a7-d103", "a7-d104",
  "a7-d105", "a7-d106", "a7-d107", "a7-d108", "a7-d110", "a7-d111",
  "a7-d112", "a7-d113", "a7-d114", "a7-d115", "a7-d122", "a7-d124",
  "a7-d125", "a7-d126", "a7-d128", "a7-d129", "a7-d130", "a7-d132",
  "a7-d134", "a7-d135", "a7-d136", "a7-d137", "a7-d138", "a7-d139",
  "a7-d140", "a7-d141", "a7-d143", "a7-d144", "a7-d145", "a7-d146",
  "a7-d147", "a7-d148", "a7-d149", "a7-d150", "a7-d151", "a7-d152",
  "a7-d154", "a7-d155", "a7-d156", "a7-d157", "a7-d158", "a7-d159",
  "a7-d160", "a7-d161", "a7-d162", "a7-d163", "a7-d165", "a7-d166",
  "a7-d167", "a7-d168", "a7-d173", "a7-d175", "a7-d177", "a7-d178",
  "a7-d179", "a10-d180", "a10-d182", "a10-d184", "a10-d186", "a10-d188",
  "a10-d190", "a10-d192", "a10-d194", "a10-d196", "a10-d198", "a10-d200",
  "a10-d202", "a10-d204", "a10-d206", "a10-d208", "a10-d210", "a10-d211",
  "a10-d212", "a10-d213", "a10-d214", "a10-d215", "a10-d216", "a10-d217",
  "a10-d218", "a10-d219", "a10-d220", "a10-d221", "a10-d222", "a10-d225",
  "a10-d226", "a10-d229", "a10-d230", "a10-d231", "a7-b1", "a7-b2",
  "a7-b3", "a7-b4", "a7-b5", "a7-b9", "a7-b10", "a7-b11",
  "a7-b12", "a7-b13", "a7-b15", "a7-b16", "a7-b17", "a7-b18",
  "a7-b19", "a7-b20", "a7-b21", "a7-b22", "a10-b20", "a10-b22",
  "a7-c1", "a7-c2", "a7-c3", "a7-c4", "a7-c5", "a7-c6",
  "a7-e1", "a7-e2",
];

const ALPHA2607_SPECIALS: SpecialSpec[] = [
  disease("cancer5", "5대고액치료비암진단비보장.md", "5대고액치료비암진단비", 3, ["2", "5", "7"]),
  disease("tumor", "양성뇌종양진단비Ⅱ보장.md", "양성뇌종양진단비", 3),
  disease("diabetes", "만성당뇨합병증진단비보장.md", "만성당뇨합병증진단비", 3),
  disease("anemia", "중대한재생불량성빈혈진단비보장.md", "중대한재생불량성빈혈진단비", 3),
  disease("kidney", "말기신부전증진단비보장.md", "말기신부전증진단비", 3),
  ...ALPHA2607_AUTO,
].map((spec) => revisedIn2610(spec));

export const ALPHA2607: ProductTerms = {
  code: "alpha2607",
  line: "alpha",
  fixtureDir: "tests/fixtures/terms/알파2607",
  appendixNumbers: ALPHA.appendixNumbers,
  general: ALPHA2607_GENERAL,
  specials: ALPHA2607_SPECIALS,
};

/**
 * 무배당 알파Plus보장보험2610 — 네 번째 실물 재현 상품(2607 과 같은 상품군 · 같은 보통약관 구성 — 매뉴얼 §6 · 2610_작업인계).
 * 보통약관은 2607 판과 「영업일」 정의(근로자의 날 → 노동절) · 납입면제 조사 하나만 다르다 — 용어의 정의는 조 사본, 납입면제는 2604 함수조항(알려진 차이).
 * 특약: 2607 과 원문이 같은 것은 2607 담보 그대로, 개정된 것은 2607 담보 템플릿을 2610 글로(`REVISED_IN_2610`), 처음 실은 것은 `a10-*` 자동 탑재.
 */
const ALPHA2610_GENERAL: GeneralSpec = { ...ALPHA2607_GENERAL, code: "alpha2610-general" };
const byCoverage = new Map([...ALPHA2607_SPECIALS, ...ALPHA2610_AUTO].map((s) => [s.ownerCoverage, s]));
export const ALPHA2610: ProductTerms = {
  code: "alpha2610",
  line: "alpha",
  fixtureDir: ALPHA2610_DIR,
  appendixNumbers: ALPHA.appendixNumbers,
  general: ALPHA2610_GENERAL,
  specials: ALPHA2610_AUTO,
  autoMounts: ALPHA2610_ORDER.map((key) => {
    const spec = byCoverage.get(key);
    if (!spec) throw new Error(`알파Plus2610 자동 탑재 순서: ${key} 설정 없음`);
    return spec;
  }),
};


// ───────────────────────────── 메리츠 상해안심보험2610 ─────────────────────────────

const injurySa = autoSpecialOf("sa")("i", "V01");
const bothSa = autoSpecialOf("sa")("b", "V02", "상해 및 질병 관련 특별약관");
const costSa = autoSpecialOf("sa")("c", "V03");

/** 상해안심2610 이 처음 실은 특약 — 자동 탑재 한 줄씩. 기본계약(제2절 보장조항 「갱신형 통합상해진단비Ⅱ보장」)은 첫 줄 — 섹션 base. */
export const SA2610_AUTO: SpecialSpec[] = [
  { ...autoSpecialOf("sa")("base", "V01")(0, "갱신형_통합상해진단비Ⅱ보장.md"), auto: { category: "V01", base: true } },
  injurySa(2, "갱신형_일반상해80%이상후유장해보장.md"),
  injurySa(8, "보행자_자동차사고부상치료비보장.md"),
  injurySa(12, "갱신형_상해재활치료비_(급여,1일1회한,연간15회한)보장.md"),
  injurySa(13, "갱신형_종합병원_상해재활치료비(급여,1일1회한,연간15회한).md"),
  injurySa(14, "갱신형_상급종합병원_상해재활치료비(급여,1일1회한,연간15회한).md"),
  injurySa(15, "갱신형_상해MRI_CT검사비_(급여,연간1회한)보장.md"),
  injurySa(16, "갱신형_상해_응급실내원비(응급)보장.md"),
  injurySa(17, "갱신형_골절(치아파절제외)진단비Ⅱ보장.md"),
  injurySa(22, "갱신형_신골절치료비(치아파절제외)보장.md"),
  injurySa(23, "갱신형_한방치료비[골절(치아파절_제외)Ⅱ]보장.md"),
  injurySa(24, "갱신형_한방치료비[상해수술]보장.md"),
  injurySa(25, "한방치료비[운전자용_자동차사고부상(1-11급)]보장.md"),
  injurySa(26, "한방치료비[비운전자용_자동차사고부상(1-11급)]보장.md"),
  injurySa(27, "운전자용_교통상해사망보장.md"),
  injurySa(28, "비운전자용_교통상해사망보장.md"),
  injurySa(29, "운전자용_교통상해80%이상후유장해보장.md"),
  injurySa(30, "비운전자용_교통상해80%이상후유장해보장.md"),
  injurySa(31, "운전자용_교통상해후유장해(3-100%)보장.md"),
  injurySa(32, "비운전자용_교통상해후유장해(3-100%)보장.md"),
  injurySa(33, "운전자용_교통상해입원일당(1일이상)보장.md"),
  injurySa(34, "비운전자용_교통상해입원일당(1일이상)보장.md"),
  injurySa(35, "운전자용_자동차사고부상치료비(1-5급)보장.md"),
  injurySa(36, "비운전자용_자동차사고부상치료비(1-5급)보장.md"),
  injurySa(37, "운전자용_자동차사고부상치료비(1-14급)보장.md"),
  injurySa(38, "비운전자용_자동차사고부상치료비(1-14급)보장.md"),
  bothSa(3, "갱신형_응급실내원비(1-3등급)보장.md"),
  costSa(2, "갱신형_전기통신금융사기(피싱,파밍,스미싱,메모리해킹)(피해환급금제외)손해보장.md"),
  costSa(3, "운전자용_벌금(Ⅳ)(비탑승중포함)보장.md"),
  costSa(4, "운전자용_벌금(대물)보장.md"),
  costSa(5, "심급별_자동차사고_변호사선임비용Ⅱ보장.md"),
  costSa(6, "교통사고_처리지원금(Ⅸ)(비탑승중포함)보장.md"),
  costSa(7, "교통사고_처리지원금(Ⅲ)(중대법규위반,6주미만)보장.md"),
  costSa(8, "영업용운전자용_면허정지보장.md"),
  costSa(9, "영업용운전자용_면허취소보장.md"),
  costSa(10, "자동차사고_변호사선임비용(Ⅲ)(변호사선임_현물급부_선택가능)보장.md"),
];

/**
 * 상해안심2610 자동 탑재 순서 — 원문 Ⅰ ~ Ⅲ 목록 순. `a7-*` 는 알파Plus 담보 그대로(이름이 같은 담보 — 2026-11-04 사용자 결정: 담보명은 전역 유일,
 * 원문 글은 다르다 — 파일 판 대조), `mountOnly` 는 갱신형 짝 중 상해안심이 파는 쪽. 2604 담보(사망 · 수술비 · 골절수술 · 중대한특정상해)는 products.json 손 탑재.
 */
const SA2610_ORDER: [string, ("renewal" | "base")?][] = [
  ["sa-base0"],
  ["sa-i2"],
  ["a7-i14", "renewal"],
  ["a7-i16", "renewal"],
  ["a7-i12", "renewal"],
  ["a7-i60", "renewal"],
  ["a7-i42", "renewal"],
  ["sa-i8"],
  ["a7-i59", "renewal"],
  ["sa-i12"],
  ["sa-i13"],
  ["sa-i14"],
  ["sa-i15"],
  ["sa-i16"],
  ["sa-i17"],
  ["a7-i36", "renewal"],
  ["a7-i23", "renewal"],
  ["a7-i30", "renewal"],
  ["sa-i22"],
  ["sa-i23"],
  ["sa-i24"],
  ["sa-i25"],
  ["sa-i26"],
  ["sa-i27"],
  ["sa-i28"],
  ["sa-i29"],
  ["sa-i30"],
  ["sa-i31"],
  ["sa-i32"],
  ["sa-i33"],
  ["sa-i34"],
  ["sa-i35"],
  ["sa-i36"],
  ["sa-i37"],
  ["sa-i38"],
  ["a7-i13", "renewal"],
  ["a7-b5", "renewal"],
  ["a7-b10", "renewal"],
  ["sa-b3"],
  ["a7-c3", "renewal"],
  ["sa-c2"],
  ["sa-c3"],
  ["sa-c4"],
  ["sa-c5"],
  ["sa-c6"],
  ["sa-c7"],
  ["sa-c8"],
  ["sa-c9"],
  ["sa-c10"],
];

/**
 * 메리츠 상해안심보험2610 — 다섯 번째 실물 재현 상품(2610 판 절형 보통약관 첫 상품, 매뉴얼 §7.1 · §7.4).
 * - 상품군은 메리츠(line meritz) — 납입면제가 없고 보통약관이 자동갱신형(계약의 자동갱신 · 갱신계약 해제)이라 통합간편과 같은 무리다.
 *   상품군 꼬리표는 납입면제 · 준용규정 함수조항 무리를 고르는 것뿐이라 새 상품군을 두지 않는다(결정 메모 — 매뉴얼 §7.4).
 * - 보통약관은 제1절 일반조항. 제2절 보장 하나(갱신형 통합상해진단비Ⅱ)는 기본계약 담보약관 — 조연결이 없어 절 형태(ADR-0100).
 * - 특약 52: 알파Plus 와 이름이 같은 17 은 알파 담보 그대로(2026-11-04 사용자 결정), 나머지 35 는 `sa-*` 자동 탑재.
 */
const SA2610_GENERAL: GeneralSpec = {
  code: "sa2610-general",
  file: "보통약관.md",
  idPrefix: "sa",
  emptyArticles: [],
  omitContained: ["22"],
  clauses: [],
  // 알파 담보를 그대로 탑재하므로(준용규정이 납입면제 조를 가리킨다) 알파 납입면제 세 조는 노출 — 납입면제 미적용형이라 조립이 뺀다
  keepShown: ["g-a27_1", "g-a27_2", "g-a27_3"],
};
const bySa = new Map([...ALPHA2607_SPECIALS, ...SA2610_AUTO].map((s) => [s.ownerCoverage, s]));
export const SA2610: ProductTerms = {
  code: "sa2610",
  line: "meritz",
  fixtureDir: "tests/fixtures/terms/상해안심2610",
  // 원문 별표 번호 → 마스터 (이름이 같은 별표). 3 · 12 · 13 · 14 는 이 상품이 처음 참조했다
  appendixNumbers: new Map([
    [1, "AX000001"], [2, "AX000002"], [3, "AX000097"], [4, "AX000014"], [5, "AX000021"], [6, "AX000015"], [7, "AX000090"], [8, "AX000091"],
    [9, "AX000092"], [10, "AX000023"], [11, "AX000003"], [12, "AX000098"], [13, "AX000099"], [14, "AX000100"], [15, "AX000025"], [16, "AX000026"],
  ]),
  general: SA2610_GENERAL,
  specials: SA2610_AUTO,
  autoMounts: SA2610_ORDER.map(([key, only]) => {
    const spec = bySa.get(key);
    if (!spec) throw new Error(`상해안심2610 자동 탑재 순서: ${key} 설정 없음`);
    return only ? { ...spec, auto: { ...spec.auto!, mountOnly: only } } : spec;
  }),
};


// ───────────────────────────── 무배당 올케어 꽉 채운 뇌심보험(세만기형)2610(일반심사형) ─────────────────────────────

const illnessBr = autoSpecialOf("br")("d", "V02");
/** 뇌심2610 이 처음 실은 담보 — 기본계약 보장조항 셋(제2절 2-1 ~ 2-3, 섹션 base) + 특약. */
export const BRAIN2610_AUTO: SpecialSpec[] = [
  { ...autoSpecialOf("br")("base", "V02")(21, "뇌혈관질환관혈수술비(연간1회한)보장.md"), auto: { category: "V02", base: true } },
  { ...autoSpecialOf("br")("base", "V02")(22, "심장관련질환관혈수술비(연간1회한)보장.md"), auto: { category: "V02", base: true } },
  { ...autoSpecialOf("br")("base", "V02")(23, "2대질환_중증치료비(급여,연간1회한)보장.md"), auto: { category: "V02", base: true } },
  illnessBr(1, "뇌경색증진단비보장.md"),
  illnessBr(2, "중증뇌경색증진단비보장.md"),
  illnessBr(8, "뇌출혈진단_응급환자_응급실내원비(연간1회한)보장.md"),
  illnessBr(9, "뇌경색증진단_응급환자_응급실내원비(연간1회한)보장.md"),
  illnessBr(10, "급성심근경색증진단_응급환자_응급실내원비(연간1회한)보장.md"),
  illnessBr(13, "혈전용해치료비Ⅲ_(연간1회한)보장.md"),
  illnessBr(14, "기계적혈전제거술(카테터법)_치료비Ⅲ(급여,_연간1회한)보장.md"),
  illnessBr(23, "중증허혈성심장질환진단비보장.md"),
  illnessBr(24, "중등증이상허혈성심장질환진단비보장.md"),
];

/** 뇌심2610 자동 탑재 순서 — 원문 순(보장조항 → 특약). 알파와 이름이 같은 특약 17 은 알파 담보 그대로(2026-11-04 사용자 결정). */
const BRAIN2610_ORDER: [string, ("renewal" | "base")?][] = [
  ["br-base21"],
  ["br-base22"],
  ["br-base23"],
  ["br-d1"],
  ["br-d2"],
  ["a7-d21"],
  ["a10-d188", "base"],
  ["a10-d192", "base"],
  ["a10-d196", "base"],
  ["a10-d200", "base"],
  ["br-d8"],
  ["br-d9"],
  ["br-d10"],
  ["a7-d126", "base"],
  ["a7-d130", "base"],
  ["br-d13"],
  ["br-d14"],
  ["a10-d221", "base"],
  ["a10-d222", "base"],
  ["a7-d110", "base"],
  ["a7-d111", "base"],
  ["a7-d112", "base"],
  ["a7-d113", "base"],
  ["a7-d114", "base"],
  ["a7-d115", "base"],
  ["br-d23"],
  ["br-d24"],
  ["a10-d213"],
  ["a10-d214"],
];

/**
 * 무배당 올케어 꽉 채운 뇌심보험(세만기형)2610(일반심사형) — 여섯 번째 실물 재현 상품(절형 보통약관 · 기본계약 셋 · 특약 대분류 없음 — 매뉴얼 §7.2).
 * - 상품군 meritz(매뉴얼 §7.4) — 납입면제 세 조는 이 판 원문 글 그대로 조 사본(사유 둘 — 뇌졸중 · 급성심근경색증). 알파 납입면제 함수조항 모양
 *   (사유 열하나 · 반복 템플릿)을 옮기지 않는다 — 공통화할 같은 글이 없다.
 * - 기본계약 보장조항 셋은 절 형태 블록(기본계약 2+ — ADR-0021 결정 1). 특약 26: 알파와 이름이 같은 17 은 알파 담보 그대로(2026-11-04 사용자 결정).
 */
const BRAIN2610_GENERAL: GeneralSpec = { code: "br2610-general", file: "보통약관.md", idPrefix: "br", emptyArticles: [], omitContained: ["19"], clauses: [] };
const byBrain = new Map([...ALPHA2607_SPECIALS, ...ALPHA2610_AUTO, ...BRAIN2610_AUTO].map((s) => [s.ownerCoverage, s]));
export const BRAIN2610: ProductTerms = {
  code: "br2610",
  line: "meritz",
  fixtureDir: "tests/fixtures/terms/뇌심2610",
  // 원문 별표 번호 → 마스터. 6 · 10 은 이 상품이 처음 참조했다
  appendixNumbers: new Map([
    [1, "AX000001"], [2, "AX000007"], [3, "AX000008"], [4, "AX000048"], [5, "AX000065"], [6, "AX000101"], [7, "AX000033"], [8, "AX000060"], [9, "AX000029"], [10, "AX000102"],
  ]),
  general: BRAIN2610_GENERAL,
  specials: BRAIN2610_AUTO,
  autoMounts: BRAIN2610_ORDER.map(([key, only]) => {
    const spec = byBrain.get(key);
    if (!spec) throw new Error(`뇌심2610 자동 탑재 순서: ${key} 설정 없음`);
    return only ? { ...spec, auto: { ...spec.auto!, mountOnly: only } } : spec;
  }),
};

/**
 * 메리츠 케어프리보험 M-Basket2610 — 알파Plus2610 과 같은 구성(특약 325 가 글까지 같다 — 자동갱신 특약 본문의 상품명만 다르다).
 * 담보 · 템플릿을 새로 만들지 않고 알파Plus2610 의 탑재 순서를 그대로 쓴다(2026-11-04 — 알파 형제).
 */
const CAREFREE2610_GENERAL: GeneralSpec = { ...ALPHA2607_GENERAL, code: "cf2610-general" };
export const CAREFREE2610: ProductTerms = {
  code: "cf2610",
  line: "alpha",
  fixtureDir: "tests/fixtures/terms/케어프리2610",
  appendixNumbers: ALPHA.appendixNumbers,
  general: CAREFREE2610_GENERAL,
  specials: [],
  autoMounts: ALPHA2610.autoMounts,
};


// ───────────────────────────── 메리츠 The좋은 알파Plus보장보험2610 · The좋은 케어프리보험 M-Basket2610 ─────────────────────────────

const injuryGa = autoSpecialOf("ga")("i", "V01");
const illnessGa = autoSpecialOf("ga")("d", "V02");
const bothGa = autoSpecialOf("ga")("b", "V02", "상해 및 질병 관련 특별약관");
/** The좋은 알파Plus2610 이 처음 실은 특약 — 자동 탑재 한 줄씩. */
export const GOODALPHA2610_AUTO: SpecialSpec[] = [
  injuryGa(35, "갱신형_간호·간병통합서비스_사용_일반상해입원일당(181일이상)_(요양,정신,한방병원제외)보장.md"),
  illnessGa(31, "갱신형_특정간담췌질환진단비보장.md"),
  illnessGa(46, "갱신형_편마비진단비보장.md"),
  illnessGa(53, "갱신형_특정소화계질환진단비보장.md"),
  illnessGa(58, "갱신형_암특정재활치료비(급여,1일1회한,연간20회한)보장.md"),
  illnessGa(69, "갱신형_6대심장질환진단비보장.md"),
  illnessGa(70, "갱신형_6대심장질환진단비Ⅱ보장.md"),
  illnessGa(71, "갱신형_부정맥질환특정수술비(급여,연간1회한)보장.md"),
  illnessGa(72, "갱신형_특정뇌동맥질환_뇌동맥류수술비(급여,_연간1회한)보장.md"),
  illnessGa(73, "갱신형_수면무호흡진단비보장.md"),
  bothGa(20, "갱신형_수술비Ⅱ(1-5종)(체증형)보장.md"),
];

/**
 * The좋은 알파Plus2610 자동 탑재 순서 — 원문 Ⅰ ~ Ⅳ 목록 순. 알파 담보와 이름이 같은 특약은 알파 담보 그대로(대부분 갱신형으로 — 2026-11-04 사용자 결정),
 * 손으로 설정한 알파 담보(2604 상해 · 2607 질병 대표)는 products.json 손 탑재.
 */
const GOODALPHA2610_ORDER: [string, ("renewal" | "base")?][] = [
  ["a7-i28", "renewal"],
  ["sa-i2"],
  ["a7-i11", "renewal"],
  ["a7-i12", "renewal"],
  ["a7-i14", "renewal"],
  ["a7-i16", "renewal"],
  ["a7-i20", "renewal"],
  ["a7-i21", "renewal"],
  ["a7-i29", "renewal"],
  ["a7-i38", "renewal"],
  ["a7-i17", "renewal"],
  ["a7-i36", "renewal"],
  ["a7-i26", "renewal"],
  ["a7-i30", "renewal"],
  ["a7-i31", "renewal"],
  ["a7-i39", "renewal"],
  ["a7-i40", "renewal"],
  ["a7-i42", "renewal"],
  ["a7-i41", "renewal"],
  ["a7-i48", "renewal"],
  ["a7-i49", "renewal"],
  ["a7-i50", "renewal"],
  ["a7-i53", "renewal"],
  ["a7-i54", "renewal"],
  ["a7-i55", "renewal"],
  ["a7-i56", "renewal"],
  ["a7-i45", "renewal"],
  ["a7-i46", "renewal"],
  ["ga-i35"],
  ["a7-i57", "renewal"],
  ["a7-i58", "renewal"],
  ["a7-i13", "renewal"],
  ["a7-i59", "renewal"],
  ["a7-i60", "renewal"],
  ["a7-i23", "renewal"],
  ["a7-i61", "renewal"],
  ["a7-i63", "renewal"],
  ["a7-i62", "renewal"],
  ["a10-i64", "renewal"],
  ["a7-d1", "renewal"],
  ["a7-d22", "renewal"],
  ["a7-d30", "renewal"],
  ["a7-d21", "renewal"],
  ["a7-d6", "renewal"],
  ["a7-d7", "renewal"],
  ["a7-d20", "renewal"],
  ["a7-d18", "renewal"],
  ["a7-d9", "renewal"],
  ["a7-d15", "renewal"],
  ["a7-d35", "renewal"],
  ["a7-d177", "renewal"],
  ["a7-d124", "renewal"],
  ["a7-d17", "renewal"],
  ["a7-d16", "renewal"],
  ["a7-d40", "renewal"],
  ["a7-d80", "renewal"],
  ["a7-d29", "renewal"],
  ["a7-d67", "renewal"],
  ["a7-d13", "renewal"],
  ["a7-d11", "renewal"],
  ["a7-d24", "renewal"],
  ["a7-d38", "renewal"],
  ["a7-d39", "renewal"],
  ["a7-d41", "renewal"],
  ["a7-d12", "renewal"],
  ["ga-d31"],
  ["a7-d26", "renewal"],
  ["a7-d14", "renewal"],
  ["a7-d25", "renewal"],
  ["a7-d28", "renewal"],
  ["a7-d66", "renewal"],
  ["a7-d43", "renewal"],
  ["a7-d163", "renewal"],
  ["a7-d44", "renewal"],
  ["a7-d45", "renewal"],
  ["a7-d46", "renewal"],
  ["a7-d47", "renewal"],
  ["a7-d62", "renewal"],
  ["a7-d63", "renewal"],
  ["a7-d64", "renewal"],
  ["ga-d46"],
  ["a7-d53", "renewal"],
  ["a7-d58", "renewal"],
  ["a7-d59", "renewal"],
  ["a7-d60", "renewal"],
  ["a7-d61", "renewal"],
  ["a7-d68", "renewal"],
  ["ga-d53"],
  ["a7-d72", "renewal"],
  ["a7-d75", "renewal"],
  ["a7-d73", "renewal"],
  ["ga-d58"],
  ["a7-d79", "renewal"],
  ["a7-d10", "renewal"],
  ["a7-d77", "renewal"],
  ["a7-d82", "renewal"],
  ["a7-d83", "renewal"],
  ["a7-d84", "renewal"],
  ["a7-d86", "renewal"],
  ["a7-d88", "renewal"],
  ["a7-d50", "renewal"],
  ["a7-d70", "renewal"],
  ["ga-d69"],
  ["ga-d70"],
  ["ga-d71"],
  ["ga-d72"],
  ["ga-d73"],
  ["a7-d89", "renewal"],
  ["a7-d90", "renewal"],
  ["a7-d168", "renewal"],
  ["a7-d167", "renewal"],
  ["a7-d166", "renewal"],
  ["a7-d165", "renewal"],
  ["a7-d95", "renewal"],
  ["a7-d96", "renewal"],
  ["a7-d97", "renewal"],
  ["a7-d100", "renewal"],
  ["a7-d101", "renewal"],
  ["a7-d102", "renewal"],
  ["a7-d103", "renewal"],
  ["a7-d92", "renewal"],
  ["a7-d93", "renewal"],
  ["a7-d94", "renewal"],
  ["a7-d106", "renewal"],
  ["a7-d107", "renewal"],
  ["a7-d104", "renewal"],
  ["a7-d105", "renewal"],
  ["a7-d162", "renewal"],
  ["a7-d125", "renewal"],
  ["a7-d126", "renewal"],
  ["a7-d108", "renewal"],
  ["a7-d110", "renewal"],
  ["a7-d111", "renewal"],
  ["a7-d112", "renewal"],
  ["a7-d113", "renewal"],
  ["a7-d114", "renewal"],
  ["a7-d115", "renewal"],
  ["a7-d122", "renewal"],
  ["a7-d160", "renewal"],
  ["a7-d134", "renewal"],
  ["a7-d173", "renewal"],
  ["a7-d175", "renewal"],
  ["a7-d128", "renewal"],
  ["a7-d129", "renewal"],
  ["a7-d130", "renewal"],
  ["a7-d132", "renewal"],
  ["a7-d135", "renewal"],
  ["a7-d136", "renewal"],
  ["a7-d137", "renewal"],
  ["a7-d138", "renewal"],
  ["a7-d139", "renewal"],
  ["a7-d140", "renewal"],
  ["a7-d141", "renewal"],
  ["a7-d161", "renewal"],
  ["a7-d145", "renewal"],
  ["a7-d143", "renewal"],
  ["a7-d144", "renewal"],
  ["a7-d146", "renewal"],
  ["a7-d147", "renewal"],
  ["a7-d156", "renewal"],
  ["a7-d157", "renewal"],
  ["a7-d158", "renewal"],
  ["a7-d159", "renewal"],
  ["a7-d148", "renewal"],
  ["a7-d149", "renewal"],
  ["a7-d150", "renewal"],
  ["a7-d151", "renewal"],
  ["a7-d154", "renewal"],
  ["a7-d155", "renewal"],
  ["a7-d178", "renewal"],
  ["a7-d179", "renewal"],
  ["a10-d180", "renewal"],
  ["a10-d182", "renewal"],
  ["a10-d184", "renewal"],
  ["a10-d186", "renewal"],
  ["a10-d188", "renewal"],
  ["a10-d190", "renewal"],
  ["a10-d192", "renewal"],
  ["a10-d194", "renewal"],
  ["a10-d196", "renewal"],
  ["a10-d198", "renewal"],
  ["a10-d200", "renewal"],
  ["a10-d202", "renewal"],
  ["a10-d204", "renewal"],
  ["a10-d206", "renewal"],
  ["a10-d208", "renewal"],
  ["a7-d152", "renewal"],
  ["a10-d210", "renewal"],
  ["a10-d211", "renewal"],
  ["a10-d213", "renewal"],
  ["a10-d214", "renewal"],
  ["a10-d215", "renewal"],
  ["a10-d216", "renewal"],
  ["a10-d217", "renewal"],
  ["a10-d218", "renewal"],
  ["a10-d212", "renewal"],
  ["a10-d219", "renewal"],
  ["a10-d220", "renewal"],
  ["a10-d221", "renewal"],
  ["a10-d222", "renewal"],
  ["a10-d225", "renewal"],
  ["a10-d226", "renewal"],
  ["a10-d229", "renewal"],
  ["a10-d230", "renewal"],
  ["a10-d231", "renewal"],
  ["a7-b16", "renewal"],
  ["a7-b2", "renewal"],
  ["a7-b5", "renewal"],
  ["a7-b10", "renewal"],
  ["a10-b20", "renewal"],
  ["a7-b1", "renewal"],
  ["a7-b4", "renewal"],
  ["a7-b3", "renewal"],
  ["a7-b9", "renewal"],
  ["a7-b12", "renewal"],
  ["a7-b11", "renewal"],
  ["a7-b13", "renewal"],
  ["a7-b15", "renewal"],
  ["a7-b17", "renewal"],
  ["a7-b18", "renewal"],
  ["a7-b19", "renewal"],
  ["a7-b20", "renewal"],
  ["a7-b21", "renewal"],
  ["a7-b22", "renewal"],
  ["ga-b20"],
  ["a7-c1", "renewal"],
  ["a7-c3", "renewal"],
];

/**
 * 메리츠 The좋은 알파Plus보장보험2610 — 알파 담보를 갱신형으로 싣는 자동갱신형 상품(보통약관 계약의 자동갱신 · 납입면제 3종 · 형 2).
 * 상품군 meritz(매뉴얼 §7.4 — 자동갱신형). 납입면제 세 조는 이 판 글 그대로 조 사본(2026-11-04 사용자 결정 — 3종 · 새 사유 「희귀난치성 7대질환」을 열거형에 더하지 않는다).
 */
const GOODALPHA2610_GENERAL: GeneralSpec = { code: "ga2610-general", file: "보통약관.md", idPrefix: "ga", emptyArticles: [], omitContained: ["22"], clauses: [] };
const byGood = new Map([...ALPHA2607_SPECIALS, ...ALPHA2610_AUTO, ...SA2610_AUTO, ...BRAIN2610_AUTO, ...GOODALPHA2610_AUTO].map((s) => [s.ownerCoverage, s]));
export const GOODALPHA2610: ProductTerms = {
  code: "ga2610",
  line: "meritz",
  fixtureDir: "tests/fixtures/terms/The좋은알파2610",
  appendixNumbers: ALPHA.appendixNumbers,
  general: GOODALPHA2610_GENERAL,
  specials: GOODALPHA2610_AUTO,
  autoMounts: GOODALPHA2610_ORDER.map(([key, only]) => {
    const spec = byGood.get(key);
    if (!spec) throw new Error(`The좋은 알파Plus2610 자동 탑재 순서: ${key} 설정 없음`);
    return only ? { ...spec, auto: { ...spec.auto!, mountOnly: only } } : spec;
  }),
};


/** 메리츠 The좋은 케어프리보험 M-Basket2610 — The좋은 알파Plus2610 과 같은 구성(원문이 같다 — 보통약관 제목만). 설정을 그대로 쓴다. */
const GOODCAREFREE2610_GENERAL: GeneralSpec = { ...GOODALPHA2610_GENERAL, code: "gc2610-general" };
export const GOODCAREFREE2610: ProductTerms = { ...GOODALPHA2610, code: "gc2610", fixtureDir: "tests/fixtures/terms/The좋은케어프리2610", general: GOODCAREFREE2610_GENERAL, specials: [] };

/**
 * 무배당 올케어 꽉 채운 뇌심보험(연만기형)2610(일반심사형) — 뇌심2610 의 담보를 갱신형으로 싣는 형제(보장조항 셋 · 특약 26 모두 같은 이름).
 * 담보 · 템플릿을 새로 만들지 않는다 — 템플릿은 비갱신 글이라 갱신형 원문과의 차이는 알려진 차이. 보통약관은 연만기라 계약의 자동갱신 · 갱신계약 해제가 더 있다.
 */
const BRAINRENEW2610_GENERAL: GeneralSpec = { ...BRAIN2610_GENERAL, code: "brl2610-general" };
const BRAINRENEW2610_ORDER: [string, ("renewal" | "base")?][] = [
  ["br-base21", "renewal"],
  ["br-base22", "renewal"],
  ["br-base23", "renewal"],
  ["br-d1", "renewal"],
  ["br-d2", "renewal"],
  ["a7-d21", "renewal"],
  ["a10-d188", "renewal"],
  ["a10-d192", "renewal"],
  ["a10-d196", "renewal"],
  ["a10-d200", "renewal"],
  ["br-d8", "renewal"],
  ["br-d9", "renewal"],
  ["br-d10", "renewal"],
  ["a7-d126", "renewal"],
  ["a7-d130", "renewal"],
  ["br-d13", "renewal"],
  ["br-d14", "renewal"],
  ["a10-d221", "renewal"],
  ["a10-d222", "renewal"],
  ["a7-d110", "renewal"],
  ["a7-d111", "renewal"],
  ["a7-d112", "renewal"],
  ["a7-d113", "renewal"],
  ["a7-d114", "renewal"],
  ["a7-d115", "renewal"],
  ["br-d23", "renewal"],
  ["br-d24", "renewal"],
  ["a10-d213", "renewal"],
  ["a10-d214", "renewal"],
];
export const BRAINRENEW2610: ProductTerms = {
  ...BRAIN2610,
  code: "brl2610",
  fixtureDir: "tests/fixtures/terms/뇌심연만기2610",
  general: BRAINRENEW2610_GENERAL,
  specials: [],
  autoMounts: BRAINRENEW2610_ORDER.map(([key, only]) => {
    const spec = byBrain.get(key);
    if (!spec) throw new Error(`뇌심(연만기)2610 자동 탑재 순서: ${key} 설정 없음`);
    return only ? { ...spec, auto: { ...spec.auto!, mountOnly: only } } : spec;
  }),
};

export const PRODUCTS: ProductTerms[] = [ALPHA, MERITZ, ALPHA2607, ALPHA2610, SA2610, BRAIN2610, CAREFREE2610, GOODALPHA2610, GOODCAREFREE2610, BRAINRENEW2610];
export const SEED_DIR = "src/db/seed/data";

/**
 * 보통약관 템플릿은 하나 — 「보통약관(일반)」 (2026-10-28 사용자 결정, 변환 `merge.ts`). 상품마다 원문 보통약관을 따로 변환한 뒤 합친다.
 * 바탕은 알파Plus2607 판(가장 새 판 · 함께 쓰는 담보약관이 가장 많다). 다른 판은 판마다 고른 조만 상품 조 사본으로 제 글을 지키고,
 * 나머지 조는 템플릿 글로 찍힌다 — 판 표기 차이(박스 나눔 · 띄어쓰기 · 원문 오탈자)는 실물 재현의 알려진 차이다.
 * 사본으로 고르는 조 = 상품의 사실이 글에 박힌 조: 기본계약(메리츠 일반상해사망)을 말하는 소멸 · 형 이름(「해약환급금미지급형」)의 2형 단서 ·
 * 메리츠 납입면제 무효 함수조항을 쓰는 무효 조 · 가리키는 자리가 그 판의 것인 조(아래).
 * 납입면제 세 조 · 기본계약이 대치하는 두 조는 상품군 · 기본계약마다 모양이 다른 템플릿이라(ADR-0086 결정 7 — 상품군 함수조항이 그 판의 항 · 호를 가리킨다) 사본이 아니라
 * 변형(`variants`)이다 — 두 상품군의 세 조를 다 템플릿에 두고 조 노출로 고른다.
 */
export const GENERAL_TEMPLATE = {
  code: "general",
  title: "보통약관(일반)",
  base: ALPHA2607_GENERAL.code,
  copies: {
    [ALPHA_GENERAL.code]: [] as string[],
    // 글이 같아도 가리키는 자리가 그 판의 것인 조 — 부지급 사유(메리츠 지급사유 조) · 통지(메리츠 납입면제 조) · 지급절차(메리츠 세부규정의 항) ·
    // 보험나이(메리츠 무효 조의 호) · 위법계약의 해지(메리츠 해약환급금의 항). 변환기가 찾아 알린다(merge.ts `refMismatches`).
    // 상해안심2610 — 가리키는 자리가 그 판의 것인 조(변환기 refMismatches) · 제2절 보장조항에 지급사유를 맡기는 제3 · 4조 · 노출 끈 조를 가리키는 조
    [SA2610_GENERAL.code]: ["용어의 정의", "보험금의 지급사유", "보험금의 청구", "보험금 지급에 관한 세부규정", "보험금 지급사유 등의 통지", "보험금의 지급절차", "보험금 받는 방법의 변경", "주소변경통지", "사기에 의한 계약", "약관교부 및 설명의무 등", "계약의 무효", "보험나이 등", "계약의 소멸", "제1회 보험료 및 회사의 보장개시", "법령 등의 개정에 따른 계약내용의 변경", "회사의 손해배상책임",
      // 상품의 사실이 글에 박힌 조 — 중도인출 한도 80% · 납입면제 문구 없음 · 보험종목 변경 없음
      "만기환급금의 지급", "상해보험계약 후 알릴 의무", "알릴 의무 위반의 효과", "계약내용의 변경 등", "회사의 파산선고와 해지", "중도인출"],
    // 뇌심2610 — 제2절에 지급사유를 맡기는 제3 · 4조 · 이 판 글의 납입면제 세 조(사유 둘)
    [BRAIN2610_GENERAL.code]: [
      "보험금의 지급사유", "보험금 지급에 관한 세부규정", "보험료의 납입면제", "뇌졸중, 급성심근경색증의 정의 및 진단확정", "납입면제에 관한 세부규정",
      // 가리키는 자리가 이 판의 것인 조(변환기 refMismatches)
      "용어의 정의", "보험금을 지급하지 않는 사유", "보험금 등의 청구", "보험금의 지급절차", "보험금 받는 방법의 변경", "주소변경통지", "알릴 의무 위반의 효과", "사기에 의한 계약",
      "계약내용의 변경 등", "계약의 소멸", "제1회 보험료 및 회사의 보장개시", "법령 등의 개정에 따른 계약내용의 변경", "회사의 손해배상책임",
      // 상품의 사실이 글에 박힌 조 — 질병 보험의 목적 · 알릴 의무 · 보험나이 · 납입최고 · 부활(납입면제 사유 둘)
      "목적", "계약 전 알릴 의무", "약관교부 및 설명의무 등", "계약의 무효", "보험나이 등", "보험료의 납입이 연체되는 경우 납입최고(독촉)와 계약의 해지", "보험료의 납입을 연체하여 해지된 계약의 부활(효력회복)",
    ],
    [BRAINRENEW2610_GENERAL.code]: [
      "보험금의 지급사유", "보험금 지급에 관한 세부규정", "보험료의 납입면제", "뇌졸중, 급성심근경색증의 정의 및 진단확정", "납입면제에 관한 세부규정",
      // 가리키는 자리가 이 판의 것인 조(변환기 refMismatches)
      "용어의 정의", "보험금을 지급하지 않는 사유", "보험금 등의 청구", "보험금의 지급절차", "보험금 받는 방법의 변경", "주소변경통지", "알릴 의무 위반의 효과", "사기에 의한 계약",
      "계약내용의 변경 등", "계약의 소멸", "제1회 보험료 및 회사의 보장개시", "법령 등의 개정에 따른 계약내용의 변경", "회사의 손해배상책임",
      // 상품의 사실이 글에 박힌 조 — 질병 보험의 목적 · 알릴 의무 · 보험나이 · 납입최고 · 부활(납입면제 사유 둘)
      "목적", "계약 전 알릴 의무", "약관교부 및 설명의무 등", "계약의 무효", "보험나이 등", "보험료의 납입이 연체되는 경우 납입최고(독촉)와 계약의 해지", "보험료의 납입을 연체하여 해지된 계약의 부활(효력회복)",
    ],
    // 2610 — 용어의 정의 표 「영업일」의 「노동절」(2607 판 「근로자의 날」)
    [ALPHA2610_GENERAL.code]: ["용어의 정의"],
    [CAREFREE2610_GENERAL.code]: ["용어의 정의"],
    // The좋은 알파Plus2610 — 제3 · 4조는 알파 기본계약 대치 조 · 이 판 글의 납입면제 세 조(3종)
    [GOODALPHA2610_GENERAL.code]: [
      // 가리키는 자리가 이 판의 것인 조(변환기 refMismatches)
      "용어의 정의", "보험금을 지급하지 않는 사유", "보험금 지급사유 등의 통지", "보험금 등의 청구", "보험금의 지급절차", "만기환급금의 지급", "주소변경통지", "사기에 의한 계약", "계약의 소멸",
      "제1회 보험료 및 회사의 보장개시", "회사의 손해배상책임",
    ],
    [GOODCAREFREE2610_GENERAL.code]: [
      // 가리키는 자리가 이 판의 것인 조(변환기 refMismatches)
      "용어의 정의", "보험금을 지급하지 않는 사유", "보험금 지급사유 등의 통지", "보험금 등의 청구", "보험금의 지급절차", "만기환급금의 지급", "주소변경통지", "사기에 의한 계약", "계약의 소멸",
      "제1회 보험료 및 회사의 보장개시", "회사의 손해배상책임",
    ],
    [MERITZ_GENERAL.code]: ["용어의 정의", "보험금을 지급하지 않는 사유", "보험금 지급사유 등의 통지", "보험금의 지급절차", "계약의 무효", "계약내용의 변경 등", "보험나이 등", "계약의 소멸", "위법계약의 해지", "해약환급금"],
  } as Record<string, string[]>,
  // 기본계약이 대치하는 두 조도 변형이다 — 기본계약(일반상해사망 · 일반상해80%이상후유장해)마다 항 구성이 달라 조립이 다른 조의 「제4조 제N항」을
  // 기본계약 항에 잇지 못하고(booklet `positionAliases` — 템플릿 조와 기본계약 조의 항 수가 같아야 한다), 조연결된 조의 사본은 잠긴다(ADR-0082 결정 10)
  // 사본으로 두지 못해 템플릿 글로 찍는 조(그 판 글과 가리키는 자리가 달라도 받아들인다 — 알려진 차이).
  // The좋은 알파Plus2610 납입면제 세 조: 그대로 탑재한 알파 담보(보험료납입지원(유사암진단))가 알파 납입면제 조의 항을 가리켜 사본으로 바꾸면 깨진다
  // (시드 저장 거부) — 알파 납입면제 함수조항이 이 상품 종 · 사유 값으로 찍힌다(이 판 3종 · 희귀난치성 7대질환 글과 다르다)
  templateKept: {
    [GOODALPHA2610_GENERAL.code]: ["보험료의 납입면제", "납입면제에 관한 세부규정", "보험료 납입면제 사유의 정의 및 진단확정", "법령 등의 개정에 따른 계약내용의 변경"],
    [GOODCAREFREE2610_GENERAL.code]: ["보험료의 납입면제", "납입면제에 관한 세부규정", "보험료 납입면제 사유의 정의 및 진단확정", "법령 등의 개정에 따른 계약내용의 변경"],
  } as Record<string, string[]>,
  // 앞 판 변형을 함께 쓰는 판 — The좋은 알파Plus2610 의 일반상해사망 기본계약(통합간편 m-base-death)이 통합간편 변형 지급사유 · 세부규정에 조연결한다
  variantsFrom: {
    [GOODALPHA2610_GENERAL.code]: { from: MERITZ_GENERAL.code, titles: ["보험금의 지급사유", "보험금 지급에 관한 세부규정"] },
    [GOODCAREFREE2610_GENERAL.code]: { from: MERITZ_GENERAL.code, titles: ["보험금의 지급사유", "보험금 지급에 관한 세부규정"] },
  } as Record<string, { from: string; titles: string[] }>,
  // 조 이름 별칭 — 그 판이 바탕 조를 다른 이름으로 쓴다(사본으로 제 이름 · 글을 지킨다)
  aliases: {
    [SA2610_GENERAL.code]: { "보험금의 청구": "보험금 등의 청구" },
    // 뇌심 정의 조는 사유 둘만 나열한 이름 — 템플릿 정의 조(일반 고정 제목, ADR-0088 결정 7)와 같은 자리
    [BRAIN2610_GENERAL.code]: { "뇌졸중, 급성심근경색증의 정의 및 진단확정": "보험료 납입면제 사유의 정의 및 진단확정" },
    [BRAINRENEW2610_GENERAL.code]: { "뇌졸중, 급성심근경색증의 정의 및 진단확정": "보험료 납입면제 사유의 정의 및 진단확정" },
    [GOODALPHA2610_GENERAL.code]: { "암(유사암제외), 뇌졸중, 급성심근경색증, 희귀난치성 7대질환, 만성당뇨합병증, 양성뇌종양의 정의 및 진단확정": "보험료 납입면제 사유의 정의 및 진단확정" },
    [GOODCAREFREE2610_GENERAL.code]: { "암(유사암제외), 뇌졸중, 급성심근경색증, 희귀난치성 7대질환, 만성당뇨합병증, 양성뇌종양의 정의 및 진단확정": "보험료 납입면제 사유의 정의 및 진단확정" },
  } as Record<string, Record<string, string>>,
  variants: {
    [MERITZ_GENERAL.code]: ["보험금의 지급사유", "보험금 지급에 관한 세부규정", "보험료의 납입면제", "보험료 납입면제 사유의 정의 및 진단확정", "납입면제에 관한 세부규정"],
  } as Record<string, string[]>,
};
