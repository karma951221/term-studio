/**
 * 연결 조의 사본 잠금 · 회색 사본 (ADR-0082 결정 10 · 기능/상품 §3.10) — 순수.
 *
 * - 이 상품의 블록 · 기본계약 담보약관이 조연결한 템플릿 조는 조 사본을 만들 수 없다(대치 형태 · 절 형태 공통, 대치 자리 포함).
 *   잠금을 만드는 상품담보 = 주계약이면 기본계약(1개 대치 · 2+ 절 형태), 독립특약이면 탑재 상품담보 전부(블록 후보).
 * - 잠금은 **정적 연결**로 센다 — 담보약관 트리의 조연결을 조건 가지 안까지(조건은 평가하지 않는다). 저장하지 않는 계산값이다.
 *   판정은 조건 해소 뒤 셈이라, 잠겼는데 판정은 마스터 · 특칙일 수 있다(결정 10).
 * - 잠기기 전에 있던 사본은 지우지 않고 쓰지 않는다 — 회색 사본. 조립은 그 조를 템플릿 조로 두고(`grayCopy` 경고), 담보 해제 · 조연결 해제로
 *   잠금이 풀리면 다시 쓰인다.
 */
import { indexTree, type DocumentNode } from "../document/nodes";
import type { Id } from "../types";

/** 담보약관 트리의 정적 조연결 — 조 자리 · 관 · 조건 블록 가지 안까지, 문서 순. */
export function staticLinks(tree: DocumentNode): Id[] {
  const out: Id[] = [];
  for (const e of indexTree(tree).nodes.values()) if (e.node.kind === "article" && e.node.linkedArticleId) out.push(e.node.linkedArticleId);
  return out;
}

/** 잠금을 만드는 상품담보 — 주계약: 기본계약 · 독립특약: 탑재 전부. */
export function lockingCoverageIds({ standalone, baseContractIds, mountIds }: { standalone: boolean; baseContractIds: readonly Id[]; mountIds: readonly Id[] }): Set<Id> {
  return new Set(standalone ? mountIds : baseContractIds.filter((id) => mountIds.includes(id)));
}

export interface LockSource {
  productCoverageId: Id;
  /** 상품담보명 — 잠금 안내 · 회색 사본 경고에 쓴다. */
  name: string;
  /** 그 담보약관의 정적 조연결(`staticLinks`). */
  links: readonly Id[];
}

/** 잠긴 템플릿 조 id → 그 조에 조연결한 상품담보 이름(받은 순 — 블록 순서). */
export function copyLocks(sources: readonly LockSource[]): Map<Id, string[]> {
  const out = new Map<Id, string[]>();
  for (const s of sources) {
    for (const t of new Set(s.links)) {
      const names = out.get(t) ?? [];
      if (!names.includes(s.name)) names.push(s.name);
      out.set(t, names);
    }
  }
  return out;
}

/** 사본 중 잠긴 조의 것 — 회색 사본(쓰이지 않음). */
export function grayCopyIds(copyArticleIds: Iterable<Id>, locks: ReadonlyMap<Id, unknown>): Set<Id> {
  return new Set([...copyArticleIds].filter((id) => locks.has(id)));
}
