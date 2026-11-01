/**
 * 준용예외 판정 (순수) — 준용규정의 「다만, … 은 제외합니다」에 들어갈 보통약관 조 목록 (기능/조립산출 §3.5 · ADR-0098 결정 3 · 4 · 6).
 *
 * 준용예외 구분자(결과 타입 「조 참조 목록」)의 값이다 — 정의 = 후보(작성자가 고른 템플릿 조), 값 = 아래 판정표를 특약 · 블록 문맥마다 돌린 결과.
 *
 * | 그 템플릿 조의 상태 (이 상품) | 특약에 있음 | 특약에 없음 |
 * |---|---|---|
 * | 대치 형태 — 보통약관에 생김 (`single`, 후보만) | 넣지 않음 | 넣음 |
 * | 절 형태 ① 제1절에 내용이 찍힘 (`content`, 후보만) | 넣지 않음 | 넣음 |
 * | 절 형태 ② 위임 (`delegated`) — 후보 여부와 무관 | 넣음 | 넣음 |
 * | ③ 최종 트리에 없음 (`absent`) | 넣지 않음 | 넣지 않음 |
 *
 * - 「특약에 있음」 = 그 템플릿 조로 조연결된 조가 특약 문면에 있다(`linked`) — 조연결이 정본이다.
 * - 블록(제2절)은 후보 판정만 — 위임 자동 포함은 하지 않는다(위임이면 블록이 자기 조를 갖는다, 결정 4).
 * - 후보는 이 상품 템플릿의 조만 본다(`order` 에 없는 후보는 다른 템플릿 조 — 기록도 없다). 값은 이 상품 보통약관의 조 순서다.
 * - 최소형(결정 6)은 후보 없이 부른다 — ② 위임 조만 남는다.
 *
 * DB · React import 금지.
 */
import type { Id } from "../types";

/** 이 상품에서 그 템플릿 조의 상태 — 대치 형태에 생김 · 제1절에 내용이 찍힘(①) · 위임(②) · 최종 트리에 없음(③). */
export type ArticleState = "single" | "content" | "delegated" | "absent";

/** 안 넣은 사유 — 특약(블록)에 그 조가 있음 · 최종 트리에 없음 · 블록의 위임 조(블록이 자기 조를 갖는다). 후보 아님은 기록하지 않는다. */
export type ExclusionReason = "hasArticle" | "notInTree" | "blockDelegated";

/** 조 하나의 판정 기록 (결정 7) — 출처 패널이 근거를 보인다. */
export interface ExclusionJudgment {
  articleId: Id;
  included: boolean;
  branch: ArticleState;
  reason?: ExclusionReason;
}

export interface ExclusionInput {
  /** 구분자의 후보 — 여러 템플릿의 조일 수 있다. */
  candidates: readonly Id[];
  /** 이 상품 보통약관(템플릿 + 사본) 조의 순서 — 값의 순서이자 이 템플릿의 조 집합. */
  order: readonly Id[];
  state: (articleId: Id) => ArticleState;
  /** 특약 · 블록 문면이 조연결한 템플릿 조. */
  linked: ReadonlySet<Id>;
  context: "special" | "block";
}

export function judgeExclusions(input: ExclusionInput): { value: Id[]; judgments: ExclusionJudgment[] } {
  const candidates = new Set(input.candidates);
  const value: Id[] = [];
  const judgments: ExclusionJudgment[] = [];
  for (const articleId of input.order) {
    const branch = input.state(articleId);
    const candidate = candidates.has(articleId);
    const judge = (included: boolean, reason?: ExclusionReason) => {
      judgments.push({ articleId, included, branch, ...(reason ? { reason } : {}) });
      if (included) value.push(articleId);
    };
    if (branch === "delegated") {
      if (input.context === "special") judge(true);
      else if (candidate) judge(false, "blockDelegated");
      continue;
    }
    if (!candidate) continue;
    if (branch === "absent") judge(false, "notInTree");
    else if (input.linked.has(articleId)) judge(false, "hasArticle");
    else judge(true);
  }
  return { value, judgments };
}
