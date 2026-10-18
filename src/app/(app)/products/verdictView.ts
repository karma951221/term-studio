/**
 * 보통약관 탭의 판정 보기 재료 (기능/상품 §3.12 · §4.6, ADR-0082 결정 11) — 순수. 화면은 이 결과를 그리기만 한다.
 *
 * - `articleMarks` — 목차 · 모델링 패널의 조마다 판정 배지(마스터는 없음) · 「잠김」 · 일부 연결 경고.
 *   배지는 판정기 결과(조건 해소 · 빈 조 빼기 뒤 — 편집 추정 5), 잠김만 정적 연결(`copyLocks`)이다.
 *   경고는 준용하기 옵션이 「없음」이 아닌 조의 일부 연결(`partialOption`)에만 — 옵션 없음 조의 일부 연결은 정상 특칙이라
 *   배지의 이름 목록만 보인다(편집 추정 1).
 * - `linkMatrix` — 「조연결 현황」 표. 행 = 판정 대상 템플릿 조 + 준용하기 옵션 조(연결 0 이어도) + 정적으로만 연결한 조,
 *   열 = 블록(대치 형태면 기본계약 담보 한 열), 칸 = 연결함 · 안 함 · 「연결했지만 조건으로 빠짐」(정적 연결은 있는데 판정기의 연결에 없음 — 편집 추정 6).
 */
import type { FirstSectionRecord, JoinOption } from "@/domain/assembly";
import { REPLACED_TEXT, VERDICT_WORD, verdictText } from "@/domain/product";
import type { Id } from "@/domain/types";

export const JOIN_MODE_LABEL: Record<JoinOption, string> = { none: "없음", common: "공통항 모으기", all: "전체항 모으기" };

export interface ArticleMark {
  verdict?: { text: string; tip: string };
  locked?: true;
  /** 일부 연결 경고 문구 — 준용하기 옵션 조만. */
  warning?: string;
}

const names = (list: readonly { name: string }[]) => list.map((x) => x.name).join(" · ");

/** 일부 연결 경고 문구 (§3.12 — 문구 예시 그대로). 옵션 조의 일부 연결(`partialOption`)이 아니면 없다. */
export function partialLinkWarning(r: Pick<FirstSectionRecord, "reason" | "unlinked">): string | undefined {
  if (r.reason !== "partialOption") return undefined;
  return `담보 ${r.unlinked.length}개가 이 조에 조연결되지 않아 준용하기 옵션이 적용되지 않습니다 — 연결되지 않은 담보: ${names(r.unlinked)}`;
}

export function articleMarks(records: readonly FirstSectionRecord[] | undefined, locked: Iterable<Id>): Map<Id, ArticleMark> {
  const out = new Map<Id, ArticleMark>();
  const at = (id: Id) => {
    const m = out.get(id) ?? {};
    out.set(id, m);
    return m;
  };
  for (const id of locked) at(id).locked = true;
  for (const r of records ?? []) {
    if (r.result !== "master") {
      const tip = r.unlinked.length > 0 ? `조연결한 담보: ${names(r.linked)} — 조연결하지 않은 담보: ${names(r.unlinked)}` : `조연결한 담보: ${names(r.linked)}`;
      at(r.articleId).verdict = { text: verdictText(r), tip };
    }
    const warning = partialLinkWarning(r);
    if (warning) at(r.articleId).warning = warning;
  }
  return out;
}

/** 표의 열 하나 — 블록(또는 대치 형태의 기본계약). `links` = 정적 조연결: 템플릿 조 id → 그 블록 조 표기. */
export interface LinkColumn {
  productCoverageId: Id;
  name: string;
  /** 블록 머리 「1.」 · 「Ⅰ-1.」 — 대치 형태엔 없다. */
  head?: string;
  /** 그 담보약관 문서 — 빈칸을 누르면 담보 문면 편집기로. */
  documentId?: Id;
  links: Readonly<Record<Id, string>>;
}

export type LinkCell = { kind: "linked"; label?: string } | { kind: "none" } | { kind: "excluded"; label?: string };

export interface LinkRow {
  articleId: Id;
  label: string;
  option: JoinOption;
  cells: LinkCell[];
  /** 판정 결과 이름(「위임」 · 「특칙」 …) — 대치 형태면 「대치」 · 「마스터」. */
  result: string;
  /** k/N — 절 형태만. */
  count?: string;
  warning?: string;
}

export function linkMatrix({
  articles,
  columns,
  sectioned,
  records = [],
}: {
  /** 템플릿 조(템플릿 순) — 표기 · 준용하기 옵션. */
  articles: readonly { id: Id; label: string; joinMode?: Exclude<JoinOption, "none"> }[];
  columns: readonly LinkColumn[];
  sectioned: boolean;
  records?: readonly FirstSectionRecord[];
}): LinkRow[] {
  const byArticle = new Map(records.map((r) => [r.articleId, r]));
  return articles.flatMap((a): LinkRow[] => {
    const record = byArticle.get(a.id);
    const linkedAny = columns.some((c) => c.links[a.id] !== undefined);
    if (!record && !linkedAny && !a.joinMode) return [];
    const option: JoinOption = a.joinMode ?? "none";
    const cells = columns.map((c): LinkCell => {
      const label = c.links[a.id];
      const judged = sectioned ? (record?.linked.some((l) => l.productCoverageId === c.productCoverageId) ?? false) : label !== undefined;
      if (judged) return { kind: "linked", ...(label !== undefined ? { label } : {}) };
      if (label !== undefined) return { kind: "excluded", label };
      return { kind: "none" };
    });
    if (!sectioned) return [{ articleId: a.id, label: a.label, option, cells, result: linkedAny ? REPLACED_TEXT : VERDICT_WORD.master }];
    const warning = record ? partialLinkWarning(record) : undefined;
    return [
      {
        articleId: a.id,
        label: a.label,
        option,
        cells,
        result: VERDICT_WORD[record?.result ?? "master"],
        count: `${record?.k ?? 0}/${record?.n ?? columns.length}`,
        ...(warning ? { warning } : {}),
      },
    ];
  });
}
