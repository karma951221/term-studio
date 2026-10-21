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

const PANEL_KEYS = ["article", "pc", "node", "omitted"] as const;

/**
 * 다른 쿼리를 쓰는 화면(상품 탭 `tab` · `art` · `cov` · `pc`)에 패널 상태를 합친다 (기능/조립산출 §4.2) — 화면 쿼리는 그대로 두고 패널 키만 바꾼다.
 * - `own` — 화면도 쓰는 패널 키(특별약관 탭의 `pc` = 고른 상품담보). 닫아도 남기고, 특약 대상이면 그 값으로 맞춘다.
 * - `set` — 화면 쿼리를 함께 바꾼다(값 없음 = 뺀다). 보통약관 탭은 연 조를 `art` 로도 남겨 새로고침하면 같은 관이 열린다.
 * 오류 배너(`error`)는 지나간 일이라 버린다.
 */
export function mergePanelQuery(search: string, state: PanelQueryState, opts: { own?: readonly string[]; set?: Record<string, string | undefined> } = {}): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const own = new Set(opts.own ?? []);
  q.delete("error");
  for (const k of PANEL_KEYS) if (!own.has(k)) q.delete(k);
  q.delete("article");
  q.delete("node");
  for (const [k, v] of Object.entries(opts.set ?? {})) {
    if (v === undefined) q.delete(k);
    else q.set(k, v);
  }
  const t = state.target;
  if (t) {
    if (t.document === "special" && own.has("pc")) q.set("pc", t.productCoverageId);
    q.set("article", t.articleId);
    if (t.document === "special" && !own.has("pc")) q.set("pc", t.productCoverageId);
    if (state.node) q.set("node", state.node);
  }
  if (state.showOmitted === false) q.set("omitted", "off");
  else q.delete("omitted");
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
