/**
 * 위치 호칭 (2026-10-17 확정 · 기능/조립산출 §3.10) — 참조 표기는 출력 위치가 정하고 **호칭만 렌더 상수**다(문구 분기 없음).
 *
 * | 출력 위치 | 문서 전체 참조 | 보통약관(제1절) 조 참조 접두 | 같은 항 안 반복 |
 * |---|---|---|---|
 * | 대치 형태의 특약 | 「보통약관」 | 「보통약관 」 | 덩어리마다 반복(현행) |
 * | 기본계약 2+ 의 특약 | 「보통약관 제1절 일반조항」 | 「보통약관 제1절 일반조항 」(기본안 — §5) | 덩어리마다 반복 |
 * | 블록(블록 하나 포함) | 「제1절 일반조항」 | 「제1절 일반조항 」 | 같은 항에서 앞서 밝혔으면 생략 |
 *
 * 모든 호칭이 받침으로 끝나 뒤 조사가 바뀌지 않는다(「보통약관을」 · 「제1절 일반조항을」).
 * 블록 사이 참조는 없다 — 담보약관 문면은 자기 문서(`self`)와 대응 보통약관(`general`)만 가리키고, 블록을 가리키는 `blockRef` 는
 * 상품 조 사본 전용이라 담보약관 저장 검사가 거부한다(document/nodes `blockRef`).
 */
import { FIRST_SECTION_NAME } from "./section";

/** 참조가 찍히는 문서의 출력 위치 — 보통약관(대치 형태 · 제1절) · 특약(대치 형태 · 기본계약 2+) · 블록. */
export type RefPosition = "general" | "special" | "sectionedSpecial" | "block";

const GENERAL_NAME = "보통약관";

/** 문서 전체 참조(조 참조 슬롯 · 대상 없음) — 출력 위치의 호칭. 보통약관 문서 안에서는 「보통약관」. */
export const DOCUMENT_NAME: Record<RefPosition, string> = {
  general: GENERAL_NAME,
  special: GENERAL_NAME,
  sectionedSpecial: `${GENERAL_NAME} ${FIRST_SECTION_NAME}`,
  block: FIRST_SECTION_NAME,
};

/** 같은 항에서 앞서 밝힌 호칭이면 조 참조 접두를 생략하는가 — 블록만. 특약은 덩어리마다 반복(현행). */
export function omitsStatedPrefix(position: RefPosition): boolean {
  return position === "block";
}

/** 준용규정 최소형의 주어 — 특약 「이 특별약관」 · 블록 「이 보장조항」(내Mom 제2절 원문). */
const SELF_NAME: Record<Exclude<RefPosition, "general">, string> = {
  special: "이 특별약관",
  sectionedSpecial: "이 특별약관",
  block: "이 보장조항",
};

/** 준용규정 최소형 한 문장 (ADR-0021 결정 5 · ADR-0098) — 「이 특별약관에서 정하지 않은 사항은 보통약관을 따릅니다.」 · 블록 「이 보장조항에서 … 제1절 일반조항을 따릅니다.」. */
export function applicationSentence(position: Exclude<RefPosition, "general">): string {
  return `${SELF_NAME[position]}에서 정하지 않은 사항은 ${DOCUMENT_NAME[position]}을 따릅니다.`;
}
