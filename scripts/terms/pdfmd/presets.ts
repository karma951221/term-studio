/**
 * 생성 범위 묶음 — `npm run terms:pdfmd -- --preset <이름>` 이 다시 만드는 fixture 목록.
 *
 * 원문(`src`)은 `docs/_자료/`(gitignore, 메인 체크아웃에만 있음)이고 산출물(`out`)은 커밋한다.
 * 탑재 범위를 넓히려면 `only` 에 이름을 더하거나 `only: "all"` 로 둔다(주계약 특별약관 파일 하나 전체).
 */
export interface PresetJob {
  /** 원문 파일 — 리포 뿌리 기준. */
  src: string;
  /** 특약 이름(원문 `## N. 이름` 의 이름 · 「특별약관」 뺀 이름 · fixture 파일명 중 하나) 또는 전체. */
  only: string[] | "all";
}

export interface Preset {
  out: string;
  jobs: PresetJob[];
}

const ALPHA2607 = "docs/_자료/알파Plus보장보험2607/00_주계약";
const ALPHA2610 = "docs/_자료/알파Plus보장보험2610/00_주계약";
const SA2610 = "docs/_자료/메리츠 상해안심보험2610/00_주계약";
const CAREFREE2610 = "docs/_자료/메리츠 케어프리보험 M-Basket2610/00_주계약";
const GOODALPHA2610 = "docs/_자료/메리츠 The좋은 알파Plus보장보험2610/00_주계약";
const GOODCAREFREE2610 = "docs/_자료/메리츠 The좋은 케어프리보험 M-Basket2610/00_주계약";
const BRAIN2610 = "docs/_자료/올케어 꽉 채운 뇌심보험(세만기형)2610(일반심사형)/00_주계약";

export const PRESETS: Record<string, Preset> = {
  /**
   * 알파Plus보장보험2607 — 보통약관 + 주계약 특별약관 Ⅰ ~ Ⅴ 전부(09 기타 제도성 특별약관은 담보 모델 밖이라 뺀다 — 모델명세). 손으로 설정하지 않은 특약은 자동 탑재(config `ALPHA2607_AUTO`).
   * 질병 대표는 보통약관 제27조의1 납입면제 사유(암 · 양성뇌종양 · 말기신부전증 · 만성당뇨합병증 · 중대한재생불량성빈혈)와
   * 같은 병을 보장하는 진단비 — 납입면제 재모델링(ADR-0086)과 맞물리고, 구조는 진단비의 정형(지급사유 · 정의 · 소멸 · 준용)이다.
   */
  알파2607: {
    out: "tests/fixtures/terms/알파2607",
    jobs: [
      { src: `${ALPHA2607}/01_보통약관.md`, only: "all" },
      // Ⅰ 상해 — 전부(2604 와 같은 10 · 2604 담보의 갱신형 둘 · 자동 탑재 특약)
      { src: `${ALPHA2607}/02_특별약관_Ⅰ_상해관련.md`, only: "all" },
      // Ⅱ 질병 — 전부(질병 대표 5 · 자동 탑재 특약)
      { src: `${ALPHA2607}/03_특별약관_Ⅱ_질병관련.md`, only: "all" },
      { src: `${ALPHA2607}/04_특별약관_Ⅲ_상해및질병관련.md`, only: "all" },
      { src: `${ALPHA2607}/05_특별약관_Ⅳ_비용손해관련.md`, only: "all" },
      { src: `${ALPHA2607}/06_특별약관_Ⅴ_기타.md`, only: "all" },
    ],
  },
  /**
   * 알파Plus보장보험2610 — 보통약관 + 주계약 특별약관 Ⅰ ~ Ⅴ 전부(09 기타 제도성은 뺀다). 추출은 PyMuPDF 1.26(매뉴얼 §3.1).
   * 특약 앞 「＊ 이 특별약관은 1형(…) 가입시에 한하여 가입가능합니다」 줄은 가입 조건 안내라 옮기지 않는다(조 밖 줄 경고 — 매뉴얼 §7.6).
   */
  알파2610: {
    out: "tests/fixtures/terms/알파2610",
    jobs: [
      { src: `${ALPHA2610}/01_보통약관.md`, only: "all" },
      { src: `${ALPHA2610}/02_특별약관_Ⅰ_상해관련.md`, only: "all" },
      { src: `${ALPHA2610}/03_특별약관_Ⅱ_질병관련.md`, only: "all" },
      { src: `${ALPHA2610}/04_특별약관_Ⅲ_상해및질병관련.md`, only: "all" },
      { src: `${ALPHA2610}/05_특별약관_Ⅳ_비용손해관련.md`, only: "all" },
      { src: `${ALPHA2610}/06_특별약관_Ⅴ_기타.md`, only: "all" },
    ],
  },
  /**
   * 메리츠 상해안심보험2610 — 절형 보통약관(제1절 = 보통약관 · 제2절 보장 하나 = 기본계약 담보약관 「갱신형 통합상해진단비Ⅱ보장」) + 주계약 특별약관 Ⅰ ~ Ⅲ 전부.
   */
  상해안심2610: {
    out: "tests/fixtures/terms/상해안심2610",
    jobs: [
      { src: `${SA2610}/01_보통약관.md`, only: "all" },
      { src: `${SA2610}/02_특별약관_Ⅰ_상해관련.md`, only: "all" },
      { src: `${SA2610}/03_특별약관_Ⅱ_상해및질병관련.md`, only: "all" },
      { src: `${SA2610}/04_특별약관_Ⅲ_비용손해관련.md`, only: "all" },
    ],
  },
  /**
   * 무배당 올케어 꽉 채운 뇌심보험(세만기형)2610(일반심사형) — 절형 보통약관(제1절 = 보통약관 · 제2절 보장 셋 2-1 ~ 2-3 = 기본계약 담보약관)
   * + 특약 26(대분류 없이 보통약관 파일 안 `### N.` — 매뉴얼 §7.2).
   */
  뇌심2610: {
    out: "tests/fixtures/terms/뇌심2610",
    jobs: [{ src: `${BRAIN2610}/01_보통약관.md`, only: "all" }],
  },
  /** 메리츠 케어프리보험 M-Basket2610 — 알파Plus2610 과 같은 구성(목차 인자 같음). 보통약관 + 주계약 특별약관 Ⅰ ~ Ⅴ. */
  케어프리2610: {
    out: "tests/fixtures/terms/케어프리2610",
    jobs: [
      { src: `${CAREFREE2610}/01_보통약관.md`, only: "all" },
      { src: `${CAREFREE2610}/02_특별약관_Ⅰ_상해관련.md`, only: "all" },
      { src: `${CAREFREE2610}/03_특별약관_Ⅱ_질병관련.md`, only: "all" },
      { src: `${CAREFREE2610}/04_특별약관_Ⅲ_상해및질병관련.md`, only: "all" },
      { src: `${CAREFREE2610}/05_특별약관_Ⅳ_비용손해관련.md`, only: "all" },
      { src: `${CAREFREE2610}/06_특별약관_Ⅴ_기타.md`, only: "all" },
    ],
  },
  /** 메리츠 The좋은 알파Plus보장보험2610 — 보통약관 + 주계약 특별약관 Ⅰ ~ Ⅳ. */
  The좋은알파2610: {
    out: "tests/fixtures/terms/The좋은알파2610",
    jobs: [
      { src: `${GOODALPHA2610}/01_보통약관.md`, only: "all" },
      { src: `${GOODALPHA2610}/02_특별약관_Ⅰ_상해관련.md`, only: "all" },
      { src: `${GOODALPHA2610}/03_특별약관_Ⅱ_질병관련.md`, only: "all" },
      { src: `${GOODALPHA2610}/04_특별약관_Ⅲ_상해및질병관련.md`, only: "all" },
      { src: `${GOODALPHA2610}/05_특별약관_Ⅳ_비용손해관련.md`, only: "all" },
    ],
  },
  /** 메리츠 The좋은 케어프리보험 M-Basket2610 — 보통약관 + 주계약 특별약관 Ⅰ ~ Ⅳ. */
  The좋은케어프리2610: {
    out: "tests/fixtures/terms/The좋은케어프리2610",
    jobs: [
      { src: `${GOODCAREFREE2610}/01_보통약관.md`, only: "all" },
      { src: `${GOODCAREFREE2610}/02_특별약관_Ⅰ_상해관련.md`, only: "all" },
      { src: `${GOODCAREFREE2610}/03_특별약관_Ⅱ_질병관련.md`, only: "all" },
      { src: `${GOODCAREFREE2610}/04_특별약관_Ⅲ_상해및질병관련.md`, only: "all" },
      { src: `${GOODCAREFREE2610}/05_특별약관_Ⅳ_비용손해관련.md`, only: "all" },
    ],
  },
  /** 올케어 꽉 채운 뇌심(세만기형) 맞춤간편심사형2610 — 뇌심2610 과 같은 꼴(절형 · 기본계약 셋 · 특약 대분류 없음). */
  뇌심세만기간편2610: {
    out: "tests/fixtures/terms/뇌심세만기간편2610",
    jobs: [{ src: "docs/_자료/올케어 꽉 채운 뇌심보험(세만기형)2610(맞춤간편심사형)/00_주계약/01_보통약관.md", only: "all" }],
  },
  /** 올케어 꽉 채운 뇌심(연만기형) 일반심사형2610 — 뇌심2610 과 같은 꼴(절형 · 기본계약 셋 · 특약 대분류 없음). */
  뇌심연만기2610: {
    out: "tests/fixtures/terms/뇌심연만기2610",
    jobs: [{ src: "docs/_자료/올케어 꽉 채운 뇌심보험(연만기형)2610(일반심사형)/00_주계약/01_보통약관.md", only: "all" }],
  },
  /** 올케어 꽉 채운 뇌심(연만기형) 맞춤간편심사형2610 — 뇌심2610 과 같은 꼴(절형 · 기본계약 셋 · 특약 대분류 없음). */
  뇌심연만기간편2610: {
    out: "tests/fixtures/terms/뇌심연만기간편2610",
    jobs: [{ src: "docs/_자료/올케어 꽉 채운 뇌심보험(연만기형)2610(맞춤간편심사형)/00_주계약/01_보통약관.md", only: "all" }],
  },
};
