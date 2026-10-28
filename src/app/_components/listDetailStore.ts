/**
 * 목록 → 상세 한 화면의 브라우저 쪽 보관소 (ADR-0094) — 화면(React) 밖에 두어 메뉴를 오가도 남는다.
 *
 * - 열어 둔 탭 · 패널 접힘: localStorage(메뉴마다 따로) — 새로고침해도 남는다. 읽기 · 쓰기는 모두 try/catch — 저장소가 없거나 막혀도 화면은 돈다.
 * - 편집 중 표시 · 초안: 메모리만 — 이 브라우저 탭 안에서 항목 탭을 오갈 때 남고, 새로고침하면 사라진다(지금과 같다).
 *
 * `useSyncExternalStore` 로 읽는다 — 값이 바뀔 때만 새 객체를 돌려준다.
 */
import { NO_TABS, parseTabs, type ItemTabs } from "@/app/_lib/itemTabs";

type Listener = () => void;
const listeners = new Set<Listener>();
function emit(): void {
  for (const l of listeners) l();
}
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소가 없거나 가득 참 — 이번 화면에서만 기억한다
  }
}

/* ── 열어 둔 탭 ───────────────────────────────────────────────────────────── */

const tabsCache = new Map<string, ItemTabs>();
const tabsKey = (menu: string) => `ts-ld:${menu}:tabs`;

export function getTabs(menu: string): ItemTabs {
  let tabs = tabsCache.get(menu);
  if (!tabs) {
    tabs = typeof window === "undefined" ? NO_TABS : parseTabs(readJson(tabsKey(menu)));
    tabsCache.set(menu, tabs);
  }
  return tabs;
}
export function setTabs(menu: string, next: ItemTabs): void {
  if (getTabs(menu) === next) return;
  tabsCache.set(menu, next);
  writeJson(tabsKey(menu), next);
  emit();
}

/* ── 패널 접힘 ────────────────────────────────────────────────────────────── */

const collapsedCache = new Map<string, boolean>();
const collapsedKey = (menu: string) => `ts-ld:${menu}:collapsed`;

/** 접혔나 — 고른 적이 없으면 메뉴의 기본값(칸이 많은 약관 편집기 메뉴는 접힘, ADR-0094). */
export function getCollapsed(menu: string, fallback = false): boolean {
  let value = collapsedCache.get(menu);
  if (value === undefined) {
    if (typeof window === "undefined") return fallback;
    const stored = readJson(collapsedKey(menu));
    value = typeof stored === "boolean" ? stored : fallback;
    collapsedCache.set(menu, value);
  }
  return value;
}
export function setCollapsed(menu: string, value: boolean): void {
  if (collapsedCache.get(menu) === value) return;
  collapsedCache.set(menu, value);
  writeJson(collapsedKey(menu), value);
  emit();
}

/* ── 편집 중 (메모리) ─────────────────────────────────────────────────────── */

/** 메뉴에서 편집 중인 탭 — 한 번에 하나(`editBlocker`). `part` 는 그 화면 안 편집기(한 화면에 편집기가 둘이어도 서로 지우지 않게). */
export interface EditingMark {
  key: string;
  part: string;
  dirty: boolean;
}
const editing = new Map<string, EditingMark>();

export function getEditing(menu: string): EditingMark | undefined {
  return editing.get(menu);
}
export function setEditing(menu: string, mark: EditingMark | undefined): void {
  const now = editing.get(menu);
  if (now?.key === mark?.key && now?.part === mark?.part && now?.dirty === mark?.dirty) return;
  if (mark) editing.set(menu, mark);
  else editing.delete(menu);
  emit();
}

/* ── 초안 (메모리) ────────────────────────────────────────────────────────── */

const drafts = new Map<string, unknown>();

export function draftId(menu: string, key: string, part: string): string {
  return `${menu}|${key}|${part}`;
}
export function keepDraft(id: string, value: unknown): void {
  drafts.set(id, value);
}
export function peekDraft<S>(id: string): S | undefined {
  return drafts.get(id) as S | undefined;
}
export function dropDraft(id: string): void {
  drafts.delete(id);
}
/** 한 탭의 초안을 모두 버린다 — 편집 중인 탭을 닫을 때. */
export function dropDraftsOf(menu: string, key: string): void {
  const prefix = `${menu}|${key}|`;
  for (const id of [...drafts.keys()]) if (id.startsWith(prefix)) drafts.delete(id);
}
