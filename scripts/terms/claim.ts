/**
 * 보험금명 — 변환 안에서만 쓰는 자리표 (ADR-0091, 2026-10-21).
 *
 * 담보약관 템플릿은 담보 하나가 한 벌 소유라 「…을 사망보험금으로 지급합니다」의 보험금 이름은 그 담보약관에 **글자로** 쓴다.
 * 변환기는 원문에서 함수조항을 묶을 때(여러 담보가 같은 소멸 조를 쓴다) 보험금 이름 자리를 자리표 `CLAIM_SLOT` 슬롯으로 두어
 * 「글이 같은 조」를 찾고(`parameterize` 가 함수조항의 인자 + 기본 연결로 바꾼다), 출력 직전에 `inlineClaimNames` 로 없앤다 —
 * 담보약관의 슬롯은 같은 id 의 글 노드로, 함수조항 인자의 기본 연결은 지우고 사용처마다 그 담보의 보험금명 **상수** 연결로.
 * 시드에는 자리표가 남지 않는다 — 구분자 카탈로그에 이 코드가 없다.
 */
import type { Discriminator } from "../../src/domain/catalog/types";
import type { DocumentNode } from "../../src/domain/document/nodes";

import type { ClauseRecord } from "./clauses";

/** 자리표 코드 — 옛 투영 구분자 「담보명」(D0001)의 코드를 변환 안에서만 빌린다. */
export const CLAIM_SLOT = "D0001";

/** `parameterize` 가 자리표를 인자로 바꿀 수 있게 주는 변환 전용 카탈로그 항목 — 인자 이름 「담보명」 · 타입 문자열. */
export const CLAIM_CATALOG_ENTRY: Discriminator = {
  code: CLAIM_SLOT,
  label: "담보명",
  description: "변환 전용 자리표 — 출력 전에 글자 · 상수로 바뀐다 (scripts/terms/claim.ts)",
  level: "coverage",
  expression: "'보험금명'",
  resultType: { kind: "string" },
};

export interface ClaimDocument {
  code: string;
  tree: DocumentNode;
}

/**
 * 자리표를 없앤다 — 슬롯은 글로, 인자 기본 연결은 사용처 상수로. `claimOf` = 문서 코드 → 그 담보약관의 보험금명.
 * 돌려주는 수(`slots` · `bindings`)는 바꾼 슬롯 · 더한 상수 연결 수다.
 */
export function inlineClaimNames<D extends ClaimDocument>(
  documents: readonly D[],
  clauses: readonly ClauseRecord[],
  claimOf: ReadonlyMap<string, string>,
): { documents: D[]; clauses: ClauseRecord[]; slots: number; bindings: number } {
  const claimParams = new Map<string, string[]>();
  const nextClauses = clauses.map((c) => {
    const names = (c.params ?? []).filter((p) => p.default?.kind === "discriminator" && p.default.code === CLAIM_SLOT).map((p) => p.name);
    if (names.length === 0) return c;
    claimParams.set(c.code, names);
    return { ...c, params: c.params!.map((p) => (names.includes(p.name) ? { name: p.name, type: p.type } : p)) };
  });
  for (const c of nextClauses) {
    if (JSON.stringify([c.body, c.options, c.params]).includes(`"${CLAIM_SLOT}"`)) throw new Error(`${c.code}: 함수조항 본문 · 연결에 보험금명 자리표가 남았다`);
  }

  let slots = 0;
  let bindings = 0;
  const nextDocuments = documents.map((d) => {
    const claim = claimOf.get(d.code);
    const need = (): string => {
      if (claim === undefined) throw new Error(`${d.code}: 보험금명을 모르는 문서에 보험금명 자리가 있다`);
      return claim;
    };
    const walk = (n: unknown): unknown => {
      if (Array.isArray(n)) return n.map(walk);
      if (!n || typeof n !== "object") return n;
      const o = n as Record<string, unknown>;
      if (o.kind === "slot" && o.ref === CLAIM_SLOT) {
        slots++;
        return { id: o.id, kind: "text", text: need() };
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) out[k] = walk(v);
      const names = typeof o.clauseCode === "string" ? claimParams.get(o.clauseCode) : undefined;
      if (names) {
        const current = (out.bindings ?? {}) as Record<string, { kind: string; code?: string }>;
        const next: Record<string, unknown> = { ...current };
        for (const name of names) {
          const b = current[name];
          if (b && !(b.kind === "discriminator" && b.code === CLAIM_SLOT)) continue;
          next[name] = { kind: "const", value: need() };
          bindings++;
        }
        out.bindings = next;
      }
      return out;
    };
    const tree = walk(d.tree) as DocumentNode;
    if (JSON.stringify(tree).includes(`"${CLAIM_SLOT}"`)) throw new Error(`${d.code}: 보험금명 자리표가 남았다`);
    return { ...d, tree };
  });
  return { documents: nextDocuments, clauses: nextClauses, slots, bindings };
}
