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
 */
import type { Discriminator } from "../../src/domain/catalog/types";
import type { ParamDef } from "../../src/domain/clause/params";

import type { ClauseRecord } from "./clauses";

type Node = { id: string; kind: string; text?: string; code?: string; targets?: { articleId?: string }[]; connector?: string; children?: Node[]; branches?: { id: string; when?: string; children: Node[] }[] };

const LEAD = "다만, ";

/** 노드 트리를 복사하며 id 마다 표지를 붙인다 — 가지마다 편 항의 노드 id 가 함수조항 안에서 유일하도록. */
function suffixed<T>(x: T, suffix: string): T {
  if (Array.isArray(x)) return x.map((v) => suffixed(v, suffix)) as T;
  if (typeof x !== "object" || x === null) return x;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) out[k] = k === "id" && typeof v === "string" ? `${v}${suffix}` : k === "targets" ? v : suffixed(v, suffix);
  return out as T;
}

export function rewriteExclusions(clauses: ClauseRecord[], catalog: readonly Discriminator[]): string[] {
  const report: string[] = [];
  const lists = catalog.filter((d) => d.resultType?.kind === "list<ref>");
  for (const clause of clauses) {
    if (clause.mode !== "block" || !clause.label.startsWith("준용규정")) continue;
    const params: ParamDef[] = [];
    const missing: string[] = [];
    const paramFor = (ids: string[]): string | undefined => {
      const def = lists.find((d) => (d.candidates ?? []).join() === ids.join());
      if (!def) {
        missing.push(ids.join(" · "));
        return undefined;
      }
      const have = params.find((p) => p.default?.kind === "discriminator" && p.default.code === def.code);
      if (have) return have.name;
      const name = params.length === 0 ? "준용예외" : `준용예외${params.length + 1}`;
      params.push({ name, type: { kind: "list<ref>" }, default: { kind: "discriminator", code: def.code } });
      return name;
    };

    /** 문장 끝(「다.」가 든 글) 전에 서는 문장 안 조건 — 있으면 가지마다 항을 편다. */
    const blockingCond = (xs: Node[], k: number): number => {
      for (let i = k + 1; i < xs.length; i++) {
        const n = xs[i];
        if (n.kind === "inlineCond") return i;
        if (n.kind === "text" && n.text!.includes("다.")) return -1;
      }
      return -1;
    };

    /** 한 항을 바꾼다 — 바뀐 자리(항 하나 또는 가지마다 편 조건 블록)를 돌려준다. 손댈 것이 없으면 그대로. */
    const rewrite = (p: Node): Node => {
      const xs = p.children ?? [];
      const k = xs.findIndex((n) => n.kind === "text" && n.text!.endsWith(LEAD));
      if (k < 0) return p;
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
      const ref = xs[k + 1];
      if (ref?.kind !== "articleRef" || !ref.targets?.length || ref.targets.some((t) => typeof t.articleId !== "string")) {
        report.push(`${clause.code} ${clause.label}: 「다만, 」 뒤가 보통약관 조 참조가 아니다 — 준용예외로 바꾸지 않는다`);
        return p;
      }
      const name = paramFor(ref.targets.map((t) => t.articleId!));
      if (!name) return p;
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
      const cond: Node = {
        id: `${ref.id}-if`,
        kind: "inlineCond",
        branches: [
          {
            id: `${ref.id}-if-b`,
            when: `count(arg.${name}) > 0`,
            children: [
              { id: `${ref.id}-if-t`, kind: "text", text: ` ${LEAD}` },
              { id: each, kind: "inlineFor", source: { kind: "refList", ref: `arg.${name}` }, alias: "준용예외마다", connector: ref.connector ?? "및", children: [{ id: ref.id, kind: "articleRef", targets: [{ restrict: { current: each } }] }] } as unknown as Node,
              ...inside,
            ],
          },
        ],
      };
      const before = lead.text!.slice(0, -LEAD.length).trimEnd();
      return { ...p, children: [...xs.slice(0, k), ...(before ? [{ ...lead, text: before }] : []), cond, ...(rest ? [rest] : []), ...xs.slice(end)] };
    };

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
