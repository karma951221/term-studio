/** 전역 명명 템플릿 (기능/담보속성 §3.4). `[담보명]`과 속성 종류 코드 칩을 실제 문구로 치환한다. */
import type { AttributeKind, AttributeSelection } from "./types";

export const DEFAULT_NAMING_TEMPLATE = "[담보명]";
/** 상품의 담보명 접사 칩 — 간편심사 · 건강고지 상품의 「(통합간편심사형)」 류 (기능/상품 §3.1 · 2026-10-29). */
export const NOTICE_AFFIX_CHIP = "고지 접사";

/** 작명 재료 중 상품 사실 — 칩 `[고지 접사]` 의 값 (`noticeAffixOf`). */
export interface ProductNamingFacts {
  noticeAffix?: string;
}

export function defaultCoverageName(
  coverageName: string,
  selections: readonly AttributeSelection[],
  kinds: readonly AttributeKind[],
  template: string,
  facts: ProductNamingFacts = {},
): string {
  const fragments = new Map<string, string>();
  for (const kind of kinds) {
    const sel = selections.find((s) => s.kindCode === kind.code);
    if (!sel) continue;
    const value = kind.values.find((v) => v.code === sel.valueCode);
    if (value) fragments.set(kind.code, value.fragment.trim());
  }
  return template
    .replace(/\[([^\]]+)]/g, (_chip, code: string) => (code === "담보명" ? coverageName.trim() : code === NOTICE_AFFIX_CHIP ? (facts.noticeAffix ?? "").trim() : (fragments.get(code) ?? "")))
    .replace(/\s+/g, " ")
    .trim();
}

/** 현재 전역 템플릿에서 빠진 속성 종류. */
export function missingTemplateKinds(kinds: readonly AttributeKind[], template: string): AttributeKind[] {
  return kinds.filter((kind) => !template.includes(`[${kind.code}]`));
}

/** 편집기 안내용: 저장 칩 코드를 표시명으로 바꾼다. */
export function displayNamingTemplate(template: string, kinds: readonly AttributeKind[]): string {
  const labels = new Map(kinds.map((kind) => [kind.code, kind.label]));
  return template.replace(/\[([^\]]+)]/g, (chip, code: string) => (code === "담보명" || code === NOTICE_AFFIX_CHIP ? chip : `[${labels.get(code) ?? code}]`));
}
