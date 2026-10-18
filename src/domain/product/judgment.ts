/**
 * 판정 배지 표기 · 판정 변화 영향 (ADR-0082 결정 11 · 기능/상품 §3.8 · §3.12) — 순수.
 *
 * - 판정 결과는 저장하지 않는 계산값이다(조립의 판정 기록 `Booklet.firstSection`). 배지는 그 결과를 「특칙 k/N」 · 「위임 N/N」 …로 적는다.
 * - 판정을 바꾸는 저장(상품담보 탭 — 탑재 · 해제 · 기본계약 지정)은 저장 전후의 판정 재료(`judgmentSnapshot`)를 견줘
 *   판정이 바뀌는 조(전 → 후) · 회색이 되는 사본 · 다시 쓰이는 사본 · 깨지는 블록 지정 참조를 확인 모달에 보인다(`judgmentImpact`).
 * - 대치 형태(주계약 기본계약 하나)는 판정 기록이 없다 — 기본계약이 조연결한 조(잠금)를 「대치」로 둔다. 그래서 블록 1 → 2(대치 → 절 형태)도
 *   「대치 → 특칙 1/2」처럼 같은 표로 보인다.
 * 이 모듈은 조립(`domain/assembly`)을 import 하지 않는다 — 판정 기록의 필요한 칸만 구조로 받는다.
 */
import type { Id, Issue, JudgmentImpact } from "../types";

/** 판정 결과 6종 — `domain/assembly` `VerdictKind` 와 같은 값. */
export type VerdictResult = "master" | "special" | "common" | "delegate" | "commonSplit" | "joinAll";

/** 판정 결과의 이름 (조립산출 §3.9 「결과 6종」). */
export const VERDICT_WORD: Record<VerdictResult, string> = { master: "마스터", special: "특칙", common: "공통", delegate: "위임", commonSplit: "공통항 분리", joinAll: "전체항 합침" };

/** 판정 배지 표기 — 특칙 · 공통 · 위임은 k/N(공통은 전부 연결이라 N/N), 공통항 분리 · 전체항 합침은 이름만, 마스터는 「마스터」(배지는 서지 않는다). */
export function verdictText(r: { result: VerdictResult; k: number; n: number }): string {
  if (r.result === "special" || r.result === "delegate") return `${VERDICT_WORD[r.result]} ${r.k}/${r.n}`;
  if (r.result === "common") return `${VERDICT_WORD.common} ${r.n}/${r.n}`;
  return VERDICT_WORD[r.result];
}

/** 대치 형태에서 기본계약이 조연결한 조의 표기. */
export const REPLACED_TEXT = "대치";

/** 저장 한쪽의 판정 재료. */
export interface JudgmentSnapshot {
  /** 판정 대상 조 → 표기(「위임 2/2」 · 「대치」). 없는 조는 마스터. */
  verdicts: ReadonlyMap<Id, string>;
  /** 회색 사본 — 쓰이는 자리(템플릿에 남은 조)의 사본 중 잠긴 조의 것. */
  grayCopies: ReadonlySet<Id>;
  /** 사본의 블록 지정 참조 깨짐 (`copyBlockRefIssues`). */
  blockRefIssues: readonly Issue[];
}

export function judgmentSnapshot({
  records,
  locks,
  copyIds,
  blockRefIssues,
}: {
  /** 절 형태의 판정 기록 — 없으면 대치 형태(또는 조립 불가)로 보고 잠긴 조를 「대치」로 둔다. */
  records?: readonly { articleId: Id; result: VerdictResult; k: number; n: number }[];
  /** 잠긴 조 id → 조연결한 상품담보 이름 (`copyLocks`). */
  locks: ReadonlyMap<Id, unknown>;
  /** 쓰이는 자리의 사본 조 id (`liveArticleCopies`). */
  copyIds: Iterable<Id>;
  blockRefIssues: readonly Issue[];
}): JudgmentSnapshot {
  const verdicts = new Map<Id, string>();
  if (records) {
    for (const r of records) if (r.result !== "master") verdicts.set(r.articleId, verdictText(r));
  } else {
    for (const id of locks.keys()) verdicts.set(id, REPLACED_TEXT);
  }
  return { verdicts, grayCopies: new Set([...copyIds].filter((id) => locks.has(id))), blockRefIssues };
}

const issueKey = (i: Issue) => `${i.at.articleId ?? ""}|${(i.at.nodePath ?? []).join("/")}|${i.message}`;

/** 저장 전후 견주기 — 바뀐 것이 없으면 undefined. 조 순서는 판정 기록 순(전 → 후 차례로 처음 본 순)이다. */
export function judgmentImpact(before: JudgmentSnapshot, after: JudgmentSnapshot, labelOf: (articleId: Id) => string): JudgmentImpact | undefined {
  const verdicts: JudgmentImpact["verdicts"] = [];
  const ids = [...new Set([...before.verdicts.keys(), ...after.verdicts.keys()])];
  for (const id of ids) {
    const b = before.verdicts.get(id) ?? VERDICT_WORD.master;
    const a = after.verdicts.get(id) ?? VERDICT_WORD.master;
    if (a !== b) verdicts.push({ articleId: id, label: labelOf(id), before: b, after: a });
  }
  const grayed = [...after.grayCopies].filter((id) => !before.grayCopies.has(id)).map((id) => ({ articleId: id, label: labelOf(id) }));
  const revived = [...before.grayCopies].filter((id) => !after.grayCopies.has(id)).map((id) => ({ articleId: id, label: labelOf(id) }));
  const known = new Set(before.blockRefIssues.map(issueKey));
  const brokenRefs = after.blockRefIssues.filter((i) => !known.has(issueKey(i))).map((i) => ({ articleId: i.at.articleId ?? "", label: i.at.articleId ? labelOf(i.at.articleId) : "보통약관", message: i.message }));
  if (!verdicts.length && !grayed.length && !revived.length && !brokenRefs.length) return undefined;
  return { verdicts, grayed, revived, brokenRefs };
}
