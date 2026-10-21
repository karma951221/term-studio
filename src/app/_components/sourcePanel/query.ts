import type { ExplainTarget, PendingBranch } from "@/domain/assembly";

/**
 * 출처 패널의 URL 상태 (기능/조립산출 §4.1) — 새로고침 · 공유해도 같은 패널이 열린다.
 *
 *   ?article=<조 id>            보통약관(절 형태면 제1절) 조 — 템플릿 조 id
 *   ?article=<조 id>&pc=<상품담보 id>   그 상품담보의 담보약관 조(특약 · 블록 · 대치 형태 기본계약 조)
 *   &node=<노드 id>             패널에서 강조할 원본 자리 — 누른 값 조각(슬롯) · 「평가 대기」의 막힌 분기
 *   &omitted=off                「생략 자리 보기」 끔 (기본 켬 — 키가 없다)
 */
export interface PanelQueryState {
  target?: ExplainTarget;
  node?: string;
  showOmitted?: boolean;
}

type Raw = string | string[] | undefined;

/** 한 값 — 배열이면 첫 값, 빈 문자열 · 제어 문자 · 지나치게 긴 값은 버린다. */
function one(v: Raw): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === undefined || s === "" || s.length > 300) return undefined;
  return /[\u0000-\u001f\u007f]/.test(s) ? undefined : s;
}

export function parsePanelQuery(sp: Record<string, Raw>): PanelQueryState & { showOmitted: boolean } {
  const article = one(sp.article);
  const pc = one(sp.pc);
  const node = one(sp.node);
  const showOmitted = one(sp.omitted) !== "off";
  if (!article) return { showOmitted };
  const target: ExplainTarget = pc ? { document: "special", productCoverageId: pc, articleId: article } : { document: "general", articleId: article };
  return { target, ...(node ? { node } : {}), showOmitted };
}

/** 상태 → 쿼리 문자열(`?…`, 없으면 빈 문자열). 생략 자리 켬은 기본이라 싣지 않는다. */
export function panelQuery(state: PanelQueryState): string {
  const q = new URLSearchParams();
  if (state.target) {
    q.set("article", state.target.articleId);
    if (state.target.document === "special") q.set("pc", state.target.productCoverageId);
    if (state.node) q.set("node", state.node);
  }
  if (state.showOmitted === false) q.set("omitted", "off");
  const s = q.toString();
  return s === "" ? "" : `?${s}`;
}

/** 막힌 분기 한 줄 → 그 조의 패널 + 그 분기 강조 (기능/조립산출 §4.1 「평가 대기」). 결과 좌표에 조가 없으면 없다. */
export function pendingPanel(p: PendingBranch): PanelQueryState | undefined {
  const { at } = p;
  if (!at.articleId) return undefined;
  if (at.document === "general") return { target: { document: "general", articleId: at.articleId }, node: p.nodeId };
  if (at.document === "special" && at.ownerId) return { target: { document: "special", productCoverageId: at.ownerId, articleId: at.articleId }, node: p.nodeId };
  return undefined;
}
