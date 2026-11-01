/**
 * 지급금액 표 — 손으로 쓴 정적 표를 「감액 있음」 조건 + 표 구분자로 (개발 도구 — 제품 기능 아님). 근거: ADR-0099 결정 4 · 기능/구분자 §3.7 · 기능/동적표 §3.3.
 *
 * 담보약관 원문의 감액 지급금액 표(「(최초)계약일부터 N경과시점 전일 이전 / 이후」 열 · 「보험가입금액의 X%」 셀)를 읽어
 * 감액 구간(「감액기간」 값 코드) · 지급률 · 단서문구(머리글 꼬리 + 셀 꼬리)를 담보 시드 값으로 돌려주고, 표 자리는
 * `IF 감액 있음 { 보험금 지급금액표 }` 로 바꾼다. 그 조의 「자동갱신」 항 바로 뒤 표는 `IF 감액 있음 그리고 갱신형 { 갱신 보험금 지급금액표 }`.
 * 항(문장)은 그대로 둔다 — 표 자리만 바꾼다.
 *
 * 생성되는 표가 원문 표와 같은 값을 내는 경우만 바꾼다(모양 — 행 = 급부명 · 머리글 한 줄 · 셀 어구 — 는 허용 차이):
 * - 경계가 「감액기간」 값(90일 · 180일 · 1년 · 2년)이고 행마다 비율이 같다(체증 연차 행 · 간병인 열은 다른 모양).
 * - 행 수 = 그 담보의 세부보장 수(표 구분자는 급부마다 한 행을 세운다).
 * - 한 문서에 감액 표는 한 자리(갱신형 짝 가지의 같은 조는 하나로 센다) — 표마다 다른 급부를 가리키면 표 구분자 하나로 가를 수 없다.
 * 못 바꾸는 표는 정적 표로 남는다.
 */
import type { BlockNode, DocumentNode, InlineNode, TableNode } from "../../src/domain/document/nodes";
import { reductionPeriodEnumSeed } from "../../src/domain/coverage/traits";

/** 「감액 있음」 — 담보 레벨 `exist(reduction.periods)` (ADR-0099 결정 4). */
export const REDUCTION_PRESENT = "D0013";
/** 「갱신형 담보」 — 담보 레벨 `exist(attr.A0001) and attr.A0001 = '2'`. */
export const RENEWABLE_COVERAGE = "D0005";
/** 보험금 지급금액표(일반 · 갱신) — 시스템 표 구분자 (`dyntable/system.ts`). */
export const PAYMENT_TABLE = "DT000001";
export const RENEWAL_PAYMENT_TABLE = "DT000002";

export interface PaymentTrait {
  /** 감액 구간 — 경계는 「감액기간」 값 코드, 비율은 지급률 대비 %. */
  periods: { end: string; rate: number }[];
  afterRate: number;
  /** 지급률(%) — 마지막 열의 비율. */
  payRate: number;
  /** 단서문구 — 감액 열 머리글 꼬리 + 셀 꼬리(셀 꼬리 특성은 두지 않는다 — 기능/동적표 §3.3). */
  proviso?: string;
}

export interface ReadTable {
  /** 데이터 행 수 — 표 구분자는 급부마다 한 행. */
  rows: number;
  trait: PaymentTrait;
}

const BOUNDARY = new Map(reductionPeriodEnumSeed().values.map((v) => [v.label, { code: v.code, order: v.order }]));

const B = String.raw`(?:최초)?계약일부터\s*(\d+\s*(?:일|년))\s*경과시점`;
const FIRST = new RegExp(String.raw`^\s*${B}\s*전일\s*이전\s*(.*?)\s*$`);
const MIDDLE = new RegExp(String.raw`^\s*${B}\s*이후\s*${B}\s*전일\s*이전\s*(.*?)\s*$`);
const LAST = new RegExp(String.raw`^\s*${B}\s*이후\s*(.*?)\s*$`);
const AMOUNT = /보험가입금액의\s*(\d+)%\s*(.*?)\s*$/;

const squash = (s: string) => s.replace(/\s+/g, "");

function inlineText(nodes: readonly InlineNode[]): string {
  return nodes.map((n) => (n.kind === "text" ? n.text : "")).join("");
}

type Column = { prev?: string; end?: string; tail: string };

/** 열 머리글 하나 — 첫(끝 경계) · 가운데(앞 · 끝 경계) · 마지막(앞 경계). */
function column(text: string): Column | undefined {
  const m = MIDDLE.exec(text);
  if (m) return { prev: squash(m[1]), end: squash(m[2]), tail: m[3] };
  const f = FIRST.exec(text);
  if (f) return { end: squash(f[1]), tail: f[2] };
  const l = LAST.exec(text);
  if (l) return { prev: squash(l[1]), tail: l[2] };
  return undefined;
}

/** 원문 감액 지급금액 표를 읽는다 — 바꿀 수 없는 모양이면 undefined. */
export function readReductionTable(table: TableNode): ReadTable | undefined {
  const rows = table.rows.map((r) => r.cells.map(inlineText));
  if (!rows[0]?.some((c) => squash(c) === "지급금액")) return undefined;
  const at = rows.findIndex((r) => r.some((c) => column(c) !== undefined));
  if (at < 0) return undefined;
  const indices = rows[at].flatMap((c, i) => (column(c) ? [i] : []));
  const columns = indices.map((i) => column(rows[at][i])!);
  // 첫 · 가운데 … · 마지막 — 경계가 이어지고 「감액기간」 값이어야 한다
  if (columns.length < 2 || columns[0].prev !== undefined || columns.at(-1)!.end !== undefined) return undefined;
  const ends: string[] = [];
  for (let j = 0; j < columns.length - 1; j++) {
    const c = columns[j];
    if (c.end === undefined || (j > 0 && c.prev !== ends[j - 1])) return undefined;
    ends.push(c.end);
  }
  if (columns.at(-1)!.prev !== ends.at(-1)) return undefined;
  const bounds = ends.map((e) => BOUNDARY.get(e));
  if (bounds.some((b) => !b) || bounds.some((b, j) => j > 0 && b!.order <= bounds[j - 1]!.order)) return undefined;
  const headerTail = columns[0].tail;
  if (columns.some((c) => c.tail !== headerTail)) return undefined;

  const data = rows.slice(at + 1);
  if (data.length === 0) return undefined;
  let rates: number[] | undefined;
  let cellTail: string | undefined;
  for (const r of data) {
    const cells = indices.map((i) => AMOUNT.exec(r[i] ?? ""));
    if (cells.some((m) => !m)) return undefined;
    const rs = cells.map((m) => Number(m![1]));
    if (rates && rs.some((x, j) => x !== rates![j])) return undefined;
    rates = rs;
    for (const m of cells) {
      if (cellTail !== undefined && m![2] !== cellTail) return undefined;
      cellTail = m![2];
    }
  }
  const payRate = rates!.at(-1)!;
  const periods = ends.map((_, j) => ({ end: bounds[j]!.code, rate: (rates![j] * 100) / payRate }));
  if (periods.some((p) => !Number.isInteger(p.rate) || p.rate < 0 || p.rate > 100)) return undefined;
  const proviso = `${headerTail}${cellTail ?? ""}`;
  return { rows: data.length, trait: { periods, afterRate: 100, payRate, ...(proviso ? { proviso } : {}) } };
}

/** 「자동갱신」 항 바로 뒤의 갱신 지급금액 표 — 감액 열이 없고, 적힌 비율이 모두 지급률. */
function isRenewalTable(table: TableNode, payRate: number): boolean {
  const rows = table.rows.map((r) => r.cells.map(inlineText));
  const flat = rows.flat().join(" ");
  if (!rows[0]?.some((c) => squash(c) === "지급금액") || !flat.includes("보험가입금액") || flat.includes("경과시점")) return false;
  return [...flat.matchAll(/보험가입금액의\s*(\d+)%/g)].every((m) => Number(m[1]) === payRate);
}

type Article = { id: string; kind: "article"; title: InlineNode[]; children: BlockNode[] };

/** 조 전부 — 관 · 조건 블록 가지 안까지. `branched` = 조건 블록 가지 안의 조(갱신형 짝 가지). */
function articlesOf(nodes: readonly unknown[], branched = false, out: { article: Article; branched: boolean }[] = []): { article: Article; branched: boolean }[] {
  for (const n of nodes as { kind?: string; children?: unknown[]; branches?: { children: unknown[] }[] }[]) {
    if (n.kind === "article") out.push({ article: n as Article, branched });
    else if (n.kind === "section") articlesOf(n.children ?? [], branched, out);
    else if (n.kind === "condBlock") for (const b of n.branches ?? []) articlesOf(b.children, true, out);
  }
  return out;
}

function guarded(table: TableNode, when: string, code: string): BlockNode {
  return { id: `${table.id}-c`, kind: "condBlock", branches: [{ id: `${table.id}-c-b`, when, children: [{ id: table.id, kind: "tableRef", code }] }] } as unknown as BlockNode;
}

/**
 * 담보약관 트리의 감액 지급금액 표를 표 구분자로 바꾸고 원문 값을 돌려준다. 바꾸지 않으면 undefined(트리 그대로).
 * `subCoverages` — 그 담보의 세부보장 수(표의 행 수와 같아야 한다).
 */
export function applyPaymentTables(tree: DocumentNode, subCoverages: number): PaymentTrait | undefined {
  const sites: { article: Article; branched: boolean; index: number; read: ReadTable }[] = [];
  for (const { article, branched } of articlesOf(tree.children)) {
    const here = article.children.flatMap((c, index) => {
      const read = c.kind === "table" ? readReductionTable(c as TableNode) : undefined;
      return read ? [{ article, branched, index, read }] : [];
    });
    if (here.length > 1) return undefined;
    sites.push(...here);
  }
  if (sites.length === 0) return undefined;
  // 갱신형 짝 가지(조건 블록 안)의 같은 조만 여럿일 수 있다 — 조 제목 · 값이 모두 같아야 한다. 가지 밖에 나란히 선 조는 다른 급부다
  const title = (a: Article) => squash(inlineText(a.title));
  const [first] = sites;
  const same = (x: ReadTable) => JSON.stringify(x) === JSON.stringify(first.read);
  if (sites.length > 1 && sites.some((s) => !s.branched)) return undefined;
  if (sites.some((s) => title(s.article) !== title(first.article) || !same(s.read))) return undefined;
  if (first.read.rows !== subCoverages) return undefined;

  const trait = first.read.trait;
  for (const { article, index } of sites) {
    const table = article.children[index] as TableNode;
    article.children[index] = guarded(table, `${REDUCTION_PRESENT} = true`, PAYMENT_TABLE);
    for (let i = index + 1; i + 1 < article.children.length; i++) {
      const p = article.children[i];
      const next = article.children[i + 1];
      if (p.kind !== "paragraph" || !inlineText(p.children).includes("자동갱신")) continue;
      if (next.kind === "table" && isRenewalTable(next as TableNode, trait.payRate)) {
        article.children[i + 1] = guarded(next as TableNode, `${REDUCTION_PRESENT} = true and ${RENEWABLE_COVERAGE} = true`, RENEWAL_PAYMENT_TABLE);
      }
      break;
    }
  }
  return trait;
}
