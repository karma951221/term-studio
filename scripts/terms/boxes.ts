/**
 * 원문 박스 → 정적 마스터 박스 (개발 도구 — 제품 기능 아님). 근거: 기능/박스 §3.1 · 최종 결정 9 (박스는 함수조항 유형이 아니다).
 *
 * 원문의 박스(【용어풀이】 · 【보험금 지급예시】 · 민법 인용 …)는 모두 박스 마스터 레코드가 되고, 그 자리는 박스 참조(`boxRef`)가 된다.
 *
 * - 같은 박스(제목 · 줄이 글자까지 같다)는 하나로 합친다.
 * - 낱말만 다른 박스도 **따로** 만든다 — 박스에는 옵션이 없다(정적 마스터 = 코드 · 제목 · 줄). 각 자리는 제 글의 박스를 놓는다.
 *   낱말만 다른 무리(제목 · 줄 수가 같고, 줄마다 공통 앞뒤를 떼고 남는 구간이 짧다 — `MAX_REGION` 자 · 다른 줄 `MAX_LINES` 이하)는
 *   순서에만 쓴다: 한 무리의 박스는 붙여서 코드를 받는다.
 * - 박스 이름 칸은 없다(2026-10-21) — 제목이 같은 박스가 여럿이어도 되고 코드로 가른다.
 */
import type { BoxNode, DocumentNode, Node } from "../../src/domain/document/nodes";
import type { Id } from "../../src/domain/types";

/** 다른 구간 하나의 최대 길이(자) · 한 박스에서 다른 줄의 최대 수 — 넘으면 낱말 차이가 아니라 다른 박스다. */
const MAX_REGION = 30;
const MAX_LINES = 3;

/** 원문 박스 하나 — 어느 문서의 어느 목록 자리에 있나. */
export interface BoxSite {
  doc: string;
  product: string;
  general: boolean;
  /** 자동 탑재 특약(맨 뒤에 더한 특약 전체)의 자리 — 앞 박스 무리에 들지 않고 이름도 맨 나중에 짓는다(앞 이름을 바꾸지 않는다). */
  late?: boolean;
  list: Node[];
  node: BoxNode;
}

/** 박스 마스터 레코드 — 시드 `boxes.json` 한 줄. 코드는 적재 순서로 변환기가 매긴다(채번 대조용). */
export interface BoxRecord {
  code: string;
  title: string;
  lines: string[];
}

/** 박스 한 건의 계획 — 레코드와 그것을 놓을 원문 자리들. */
export interface BoxPlan {
  key: string;
  record: BoxRecord;
  sites: BoxSite[];
}

/** 문서의 박스 자리 전부 — 조 직속 · 항의 목록 자리 · 조건 가지 안, 문서 순. */
export function boxSites(tree: DocumentNode, meta: Omit<BoxSite, "list" | "node">): BoxSite[] {
  const out: BoxSite[] = [];
  const visit = (list: Node[]) => {
    for (const n of list) {
      if (n.kind === "box") {
        out.push({ ...meta, list, node: n });
        continue;
      }
      const any = n as { children?: Node[]; items?: Node[]; subitems?: Node[]; branches?: { children: Node[] }[] };
      for (const key of ["children", "items", "subitems"] as const) if (Array.isArray(any[key]) && n.kind !== "table") visit(any[key]!);
      if (n.kind === "condBlock") for (const b of any.branches ?? []) visit(b.children);
    }
  };
  visit(tree.children as Node[]);
  return out;
}

const isSpace = (c: string) => /\s/.test(c);

/** 여러 글의 공통 앞 · 뒤를 떼고 남는 구간 — 낱말 경계로 넓힌다. 모두 같으면 undefined. */
export function diffRegion(texts: readonly string[]): { prefix: number; suffixes: number[]; regions: string[] } | undefined {
  if (texts.every((t) => t === texts[0])) return undefined;
  const chars = texts.map((t) => [...t]);
  const min = Math.min(...chars.map((c) => c.length));
  let prefix = 0;
  while (prefix < min && chars.every((c) => c[prefix] === chars[0][prefix])) prefix++;
  let suffix = 0;
  while (suffix < min - prefix && chars.every((c) => c[c.length - 1 - suffix] === chars[0][chars[0].length - 1 - suffix])) suffix++;
  // 낱말 경계로 — 앞은 공백 뒤까지 물리고, 뒤는 공백 앞까지 물린다(구간이 낱말 가운데서 끊기지 않게)
  while (prefix > 0 && !isSpace(chars[0][prefix - 1])) prefix--;
  while (suffix > 0 && !isSpace(chars[0][chars[0].length - suffix])) suffix--;
  const regions = chars.map((c) => c.slice(prefix, c.length - suffix).join(""));
  // 빈 구간(낱말을 더하거나 뺀 자리)이면 앞 낱말 하나를 더 품는다
  if (regions.some((r) => r.trim() === "") && prefix > 0) {
    let p = prefix - 1;
    while (p > 0 && isSpace(chars[0][p - 1])) p--;
    while (p > 0 && !isSpace(chars[0][p - 1])) p--;
    return { prefix: p, suffixes: chars.map(() => suffix), regions: chars.map((c) => c.slice(p, c.length - suffix).join("")) };
  }
  return { prefix, suffixes: chars.map(() => suffix), regions };
}

/** 박스 무리(같은 제목 · 같은 줄 수)를 낱말 옵션 하나로 합칠 수 있나 — 다른 줄마다 짧은 구간 하나, 띄어쓰기만 다르지 않다. */
function mergeable(boxes: readonly BoxNode[]): boolean {
  const lines = boxes[0].lines.length;
  if (boxes.some((b) => b.lines.length !== lines || b.title !== boxes[0].title)) return false;
  let differing = 0;
  for (let i = 0; i < lines; i++) {
    const texts = [...new Set(boxes.map((b) => b.lines[i]))];
    if (texts.length === 1) continue;
    differing += 1;
    const d = diffRegion(texts);
    if (!d) continue;
    if (d.regions.some((r) => [...r].length > MAX_REGION || r.trim() === "")) return false;
    if (new Set(d.regions.map((r) => r.replace(/\s/g, ""))).size !== d.regions.length) return false;
  }
  return differing > 0 && differing <= MAX_LINES;
}

/**
 * 원문 박스 자리 전부 → 박스 마스터 계획. 같은 박스(글자까지 같다)는 하나, 낱말만 다른 박스도 **따로**(옵션 없음).
 * 순서는 첫 등장 순(문서 순서 그대로, 한 무리의 박스는 붙여서) — 코드는 변환기가 적재 순서대로 매긴다.
 */
export function planBoxes(sites: readonly BoxSite[]): BoxPlan[] {
  const key = (b: BoxNode) => `${b.title}\u0001${b.lines.join("\u0002")}`;
  // 1. 글자까지 같은 박스끼리
  const distinct: { box: BoxNode; sites: BoxSite[] }[] = [];
  const byKey = new Map<string, { box: BoxNode; sites: BoxSite[] }>();
  for (const s of sites) {
    const k = key(s.node);
    const hit = byKey.get(k);
    if (hit) hit.sites.push(s);
    else {
      const entry = { box: s.node, sites: [s] };
      byKey.set(k, entry);
      distinct.push(entry);
    }
  }
  // 2. 낱말만 다른 박스끼리 — 첫 등장이 무리의 씨앗 (순서용 — 한 무리의 박스는 붙여서 코드를 받는다)
  const clusters: { variants: { box: BoxNode; sites: BoxSite[] }[] }[] = [];
  // 자동 탑재 특약만 쓰는 박스는 자동 탑재 특약만 쓰는 무리에만 든다 — 앞 무리에 변형이 끼면 앞 박스 코드가 밀린다
  const lateOnly = (sites: readonly BoxSite[]) => sites.every((s) => s.late);
  for (const d of distinct) {
    const home = clusters.find((c) => lateOnly(c.variants.flatMap((v) => v.sites)) === lateOnly(d.sites) && mergeable([...c.variants.map((v) => v.box), d.box]));
    if (home) home.variants.push(d);
    else clusters.push({ variants: [d] });
  }
  // 3. 무리 → 박스 하나씩(한 무리의 박스는 붙여서). 박스 이름 칸은 없다 — 같은 제목은 코드로 가른다 (기능/박스 §3.1, 2026-10-21)
  return clusters.flatMap((c, ci) =>
    c.variants.map((v, vi): BoxPlan => ({ key: `box-${ci + 1}-${vi + 1}`, record: { code: "", title: v.box.title, lines: [...v.box.lines] }, sites: v.sites })),
  );
}

/** 원문 박스 자리 하나를 박스 참조로 바꾼다 — 같은 목록 자리, id 는 `<박스 id>-k`. */
export function replaceBox(site: BoxSite, code: string): void {
  const at = site.list.indexOf(site.node);
  if (at < 0) throw new Error(`박스 ${site.node.id} 자리를 잃었다`);
  site.list.splice(at, 1, { id: `${site.node.id}-k` as Id, kind: "boxRef", boxCode: code } as Node);
}
