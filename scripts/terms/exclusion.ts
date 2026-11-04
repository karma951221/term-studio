/**
 * 준용규정 함수조항의 수동 제외 조 목록 → 준용예외 구분자 + 조건 + 문장 안 반복 (개발 도구 — ADR-0098 결정 2 · 기능/함수조항 §3.7).
 *
 * 원문 「… 을 따릅니다. 다만, 보통약관 제9조(…), 제10조(…) 및 제38조(…)은 제외합니다.」의 조 참조(대상 = 후보)를
 *   「… 을 따릅니다.」 + IF count(arg.준용예외) > 0 〔 다만, [준용예외마다 조 참조(현재)] … 제외합니다.〕
 * 로 바꾼다 — 목록은 조립이 판정한다(후보이고 특약에 없는 조 · 위임 조). 인자 `준용예외`의 기본 연결 = 후보가 같은(순서까지) 준용예외 구분자
 * (`discriminators.json` — 손으로 적는 시드). 없으면 보고하고 그 함수조항은 건드리지 않는다.
 * - 「다만, 」 뒤 첫 조 참조가 목록이다. 조건 안에 넣는 범위는 그 뒤 「…다.」로 끝나는 글까지(문장 끝) — 뒤 문장(「또한, 1종 …」 납입면제 단서)은 밖.
 * - 목록이 문장 안 조건 가지 안에 있거나(갱신형 · 비갱신 가지) 문장 끝 전에 문장 안 조건이 있으면(납입면제 가지) 문장 안 조건은 겹칠 수 없으므로
 *   그 조건의 가지마다 항을 하나씩 펴서(조건 블록 — 같은 자리라 P코드 공유) 가지마다 바꾼다. 가지마다 복사한 노드 id 에는 가지 표지를 붙인다.
 * - 조사 「은」은 원문 그대로 굳힌다(허용 차이 — 마지막 조 제목 받침을 따르지 않는다).
 * - 담보약관 문면에 직접 쓴 준용규정(함수조항이 아닌 것, `rewriteDocumentExclusions`)도 같은 규칙 — 원천은 인자 대신 구분자 코드(`count(D0014) > 0`),
 *   현재 원소 조 참조는 문면 트리 모양(빈 조 id · 범위 「보통약관」). 보통약관 범위 조 참조만 본다(「다만, 제N조에 따라 …」 이 문서 조 참조는 그대로).
 * - 후보는 순서 · 중복과 무관하게 집합으로 맞댄다 — 판정 결과는 보통약관 조 순서로 찍힌다(원문 순서와 다르면 허용 차이).
 */
import type { Discriminator } from "../../src/domain/catalog/types";
import type { ParamDef } from "../../src/domain/clause/params";

import type { ClauseRecord } from "./clauses";

type Node = { id: string; kind: string; text?: string; code?: string; scope?: string; targets?: { articleId?: string }[]; connector?: string; children?: Node[]; branches?: { id: string; when?: string; children: Node[] }[] };

const LEAD = "다만, ";

/** 노드 트리를 복사하며 id 마다 표지를 붙인다 — 가지마다 편 항의 노드 id 가 함수조항 안에서 유일하도록. */
function suffixed<T>(x: T, suffix: string): T {
  if (Array.isArray(x)) return x.map((v) => suffixed(v, suffix)) as T;
  if (typeof x !== "object" || x === null) return x;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) out[k] = k === "id" && typeof v === "string" ? `${v}${suffix}` : k === "targets" ? v : suffixed(v, suffix);
  return out as T;
}

/** 후보 집합이 같은 준용예외 구분자 — 순서 · 중복 무관 (판정 결과는 보통약관 조 순서로 찍힌다). */
function sameCandidates(lists: readonly Discriminator[], ids: readonly string[]): Discriminator | undefined {
  const key = [...new Set(ids)].sort().join();
  return lists.find((d) => [...new Set(d.candidates ?? [])].sort().join() === key);
}

/** 목록 뒤에 잇는 1종 납입면제 문장 — 「은 제외하며, 보통약관 1종(…)으로 가입한 경우 」 + [납입면제 조 참조] + 「도 제외합니다.」. */
const WAIVER_TAIL = /^은 제외하며, 보통약관 (1종\([^)]*\)으로 가입한 경우 )$/;

/**
 * 목록이 비었을 때의 가지 — 목록 뒤에 1종 납입면제 문장이 이어지면 그 문장만 「다만, 1종(…)으로 가입한 경우 [납입면제 조]은 제외합니다.」로 남긴다
 * (2026-11-04 — 적립부분 조가 없는 상품은 준용예외가 비어도 납입면제 두 조 제외는 남는다: 뇌심2610 원문). 그 꼴이 아니면 없음(목록과 함께 빠진다).
 */
function onlyWaiver(inside: readonly Node[], refId: string): Node[] | undefined {
  const [head, refs, tail] = inside;
  const m = head?.kind === "text" ? WAIVER_TAIL.exec(head.text!) : null;
  if (!m || refs?.kind !== "articleRef" || tail?.kind !== "text" || !tail.text!.startsWith("도 제외합니다.") || inside.length !== 3) return undefined;
  return [
    { id: `${refId}-if-e-t`, kind: "text", text: ` ${LEAD}${m[1]}` },
    suffixed(refs, "-none"),
    { id: `${refId}-if-e-t2`, kind: "text", text: `은${tail.text!.slice("도".length)}` },
  ];
}

interface RewriteOptions {
  /** 「다만, 」 뒤 조 참조가 바꿀 목록인가 — 아니면 `skip` 으로 넘긴다. */
  accepts(ref: Node): boolean;
  /** 아닐 때 — 보고하거나(함수조항) 조용히 둔다(문면의 이 문서 조 참조). */
  skip(): void;
  /** 대상 조 id 목록 → 반복 원천(`arg.<이름>` · 구분자 코드). 없으면 그 자리는 그대로(빠진 것은 호출 쪽이 모은다). */
  sourceFor(ids: string[]): string | undefined;
  /** 반복의 현재 원소 조 참조 — 함수조항은 대상 조 없이, 문면은 빈 조 id · 보통약관 범위. */
  currentRef(id: string, each: string): Node;
}

/** 항 하나를 바꾸는 함수 — 바뀐 자리(항 하나 또는 가지마다 편 조건 블록)를 돌려준다. 손댈 것이 없으면 그대로. */
function paragraphRewriter(o: RewriteOptions): (p: Node) => Node {
  /** 문장 끝(「다.」가 든 글) 전에 서는 문장 안 조건 — 있으면 가지마다 항을 편다. */
  const blockingCond = (xs: Node[], k: number): number => {
    for (let i = k + 1; i < xs.length; i++) {
      const n = xs[i];
      if (n.kind === "inlineCond") return i;
      if (n.kind === "text" && n.text!.includes("다.")) return -1;
    }
    return -1;
  };
  const rewrite = (p: Node): Node => {
    const xs = p.children ?? [];
    const k = xs.findIndex((n) => n.kind === "text" && n.text!.endsWith(LEAD));
    if (k < 0) return p;
    const ref = xs[k + 1];
    if (ref?.kind !== "articleRef" || !ref.targets?.length || ref.targets.some((t) => typeof t.articleId !== "string") || !o.accepts(ref)) {
      // 목록이 문장 안 조건 가지 안(「다만, 」 바로 뒤가 조건)이면 아래에서 가지마다 편다
      if (ref?.kind !== "inlineCond") {
        o.skip();
        return p;
      }
    }
    const j = blockingCond(xs, k);
    if (j >= 0) {
      const cond = xs[j];
      const branches = [...cond.branches!];
      if (branches.at(-1)?.when !== undefined) branches.push({ id: `${cond.id}-else`, children: [] });
      return {
        id: `${p.id}-x`,
        kind: "condBlock",
        branches: branches.map((b) => ({
          id: `${b.id}-x`,
          ...(b.when !== undefined ? { when: b.when } : {}),
          children: [rewrite(suffixed({ ...p, children: [...xs.slice(0, j), ...b.children, ...xs.slice(j + 1)] }, `-${b.id.split("-").at(-1)}`))],
        })),
      };
    }
    if (ref?.kind !== "articleRef") return p;
    const source = o.sourceFor(ref.targets!.map((t) => t.articleId!));
    if (!source) return p;
    // 문장 끝까지 — 「…다.」가 든 글을 거기서 가른다. 없으면 항 끝까지(옵션 자리로 끝나는 글)
    let end = xs.length;
    let rest: Node | undefined;
    const inside: Node[] = [];
    for (let i = k + 2; i < xs.length; i++) {
      const n = xs[i];
      if (n.kind === "text" && n.text!.includes("다.")) {
        const cut = n.text!.indexOf("다.") + 2;
        inside.push({ ...n, text: n.text!.slice(0, cut) });
        if (cut < n.text!.length) rest = { id: `${n.id}-rest`, kind: "text", text: n.text!.slice(cut) };
        end = i + 1;
        break;
      }
      inside.push(n);
    }
    const lead = xs[k];
    const each = `${ref.id}-each`;
    const none = onlyWaiver(inside, ref.id);
    const cond: Node = {
      id: `${ref.id}-if`,
      kind: "inlineCond",
      branches: [
        {
          id: `${ref.id}-if-b`,
          when: `count(${source}) > 0`,
          children: [
            { id: `${ref.id}-if-t`, kind: "text", text: ` ${LEAD}` },
            { id: each, kind: "inlineFor", source: { kind: "refList", ref: source }, alias: "준용예외마다", connector: ref.connector ?? "및", children: [o.currentRef(ref.id, each)] } as unknown as Node,
            ...inside,
          ],
        },
        ...(none ? [{ id: `${ref.id}-if-e`, children: none }] : []),
      ],
    };
    const before = lead.text!.slice(0, -LEAD.length).trimEnd();
    return { ...p, children: [...xs.slice(0, k), ...(before ? [{ ...lead, text: before }] : []), cond, ...(rest ? [rest] : []), ...xs.slice(end)] };
  };
  return rewrite;
}

export function rewriteExclusions(clauses: ClauseRecord[], catalog: readonly Discriminator[]): string[] {
  const report: string[] = [];
  const lists = catalog.filter((d) => d.resultType?.kind === "list<ref>");
  for (const clause of clauses) {
    if (clause.mode !== "block" || !clause.label.startsWith("준용규정")) continue;
    const params: ParamDef[] = [];
    const missing: string[] = [];
    const rewrite = paragraphRewriter({
      accepts: () => true,
      skip: () => report.push(`${clause.code} ${clause.label}: 「다만, 」 뒤가 보통약관 조 참조가 아니다 — 준용예외로 바꾸지 않는다`),
      sourceFor: (ids) => {
        const def = sameCandidates(lists, ids);
        if (!def) {
          missing.push(ids.join(" · "));
          return undefined;
        }
        const have = params.find((p) => p.default?.kind === "discriminator" && p.default.code === def.code);
        if (have) return `arg.${have.name}`;
        const name = params.length === 0 ? "준용예외" : `준용예외${params.length + 1}`;
        params.push({ name, type: { kind: "list<ref>" }, default: { kind: "discriminator", code: def.code } });
        return `arg.${name}`;
      },
      currentRef: (id, each) => ({ id, kind: "articleRef", targets: [{ restrict: { current: each } }] }) as unknown as Node,
    });

    const visit = (list: Node[]): Node[] =>
      list.map((n) => {
        if (n.kind === "paragraph") return rewrite(n);
        if (n.kind === "condBlock") return { ...n, branches: n.branches!.map((b) => ({ ...b, children: visit(b.children) })) };
        return n;
      });
    const body = visit(clause.body as unknown as Node[]);
    if (missing.length > 0) {
      report.push(`${clause.code} ${clause.label}: 후보가 같은 준용예외 구분자(결과 타입 「조 참조 목록」)가 discriminators.json 에 없다 — ${missing.join(" / ")}`);
      continue;
    }
    if (params.length === 0) continue;
    clause.body = body as unknown as ClauseRecord["body"];
    clause.params = [...(clause.params ?? []), ...params];
  }
  return report;
}

/**
 * 담보약관 문면에 직접 쓴 준용규정의 수동 제외 조 목록 → 준용예외 구분자 원천 + 조건 + 문장 안 반복 (B5 — 함수조항이 아닌 준용규정).
 * 문서 트리를 그 자리에서 고친다. 보통약관 범위 조 참조만 바꾼다. 후보가 같은 구분자가 없으면 보고하고 그 문서는 그대로 둔다.
 */
export function rewriteDocumentExclusions(code: string, tree: { children: unknown[] }, catalog: readonly Discriminator[]): string[] {
  const lists = catalog.filter((d) => d.resultType?.kind === "list<ref>");
  const missing: string[] = [];
  const rewrite = paragraphRewriter({
    accepts: (ref) => ref.scope === "general",
    skip: () => undefined,
    sourceFor: (ids) => {
      const def = sameCandidates(lists, ids);
      if (!def) missing.push(ids.join(" · "));
      return def?.code;
    },
    currentRef: (id, each) => ({ id, kind: "articleRef", targets: [{ articleId: "", restrict: { current: each } }], scope: "general" }) as unknown as Node,
  });
  /** 문단 자리를 훑는다 — 조 · 관 · 조건 블록 가지 · 반복 블록. 항의 글(인라인)로는 들어가지 않는다. */
  const visit = (list: Node[]): Node[] =>
    list.map((n) => {
      if (n.kind === "paragraph") return rewrite(n);
      if (n.branches) return { ...n, branches: n.branches.map((b) => ({ ...b, children: visit(b.children) })) };
      if (n.children && n.kind !== "text") return { ...n, children: visit(n.children) };
      return n;
    });
  const next = visit(tree.children as Node[]);
  if (missing.length > 0) return [`${code}: 후보가 같은 준용예외 구분자(결과 타입 「조 참조 목록」)가 discriminators.json 에 없다 — ${missing.join(" / ")}`];
  tree.children = next;
  return [];
}
