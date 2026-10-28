/**
 * 목록 → 상세 한 화면의 항목 탭 규칙 — 순수 함수 (ADR-0094 · 디자인원칙 §2 「목록 → 상세」).
 *
 * 목록에서 고른 항목이 상세 맨 위에 탭으로 쌓인다. 현재 항목은 URL 하나이고, 열어 둔 탭 목록은 브라우저(localStorage)가 든다.
 * 탭마다 그 항목 안에서 마지막으로 본 주소(상품의 `?tab=` 영역 · 상세2 포함)를 기억한다 — 탭을 누르면 그 주소로 간다.
 * 편집은 한 번에 한 탭만이다(`editBlocker`).
 */

/** 탭 상한 — 넘치면 가장 오래 안 본 탭부터 닫힌다(현재 · 편집 중 제외). */
export const MAX_ITEM_TABS = 8;

export interface ItemTab {
  /** 항목 키 — 상세 주소의 메뉴 바로 아래 마디(`itemKeyOf`). */
  key: string;
  /** 이 항목 안에서 마지막으로 본 주소(경로 + 쿼리). */
  href: string;
  /** 마지막으로 본 때 — `clock` 의 값. 넘칠 때 닫을 탭을 고른다. */
  seen: number;
}

export interface ItemTabs {
  tabs: readonly ItemTab[];
  clock: number;
}

export const NO_TABS: ItemTabs = { tabs: [], clock: 0 };

/**
 * 상세 주소 → 항목 키. 메뉴(`base`) 바로 아래 한 마디가 항목이고, 더 깊은 상세2(`/products/p1/coverages/x`)도 그 항목이다.
 * 목록 자체 · 생성 화면(`new`) · `exclude` 의 하위 탭 화면은 항목이 아니다. `keySeparator` 가 있으면 그 앞까지(폼키.필드키 → 폼키).
 */
export function itemKeyOf(pathname: string, base: string, options: { exclude?: readonly string[]; keySeparator?: string } = {}): string | undefined {
  if (!pathname.startsWith(`${base}/`)) return undefined;
  const segment = pathname.slice(base.length + 1).split("/")[0] ?? "";
  if (segment === "" || segment === "new" || options.exclude?.includes(segment)) return undefined;
  let key = segment;
  try {
    key = decodeURIComponent(segment);
  } catch {
    // 잘못된 % 는 원문 그대로
  }
  if (options.keySeparator) key = key.split(options.keySeparator)[0]!;
  return key || undefined;
}

/**
 * 항목을 연다(그 상세를 보았다). 이미 열린 항목이면 새 탭을 만들지 않고 그 탭의 마지막 주소 · 본 때만 바꾼다 — 자리는 그대로.
 * 없으면 끝에 붙이고, 상한을 넘으면 가장 오래 안 본 탭을 닫는다 — 방금 연 탭 · 편집 중 탭(`editing`)은 닫지 않는다.
 */
export function openTab(state: ItemTabs, key: string, href: string, options: { editing?: string } = {}): ItemTabs {
  const clock = state.clock + 1;
  if (state.tabs.some((t) => t.key === key)) {
    return { clock, tabs: state.tabs.map((t) => (t.key === key ? { key, href, seen: clock } : t)) };
  }
  let tabs = [...state.tabs, { key, href, seen: clock }];
  while (tabs.length > MAX_ITEM_TABS) {
    const victims = tabs.filter((t) => t.key !== key && t.key !== options.editing);
    if (victims.length === 0) break;
    const oldest = victims.reduce((a, b) => (b.seen < a.seen ? b : a));
    tabs = tabs.filter((t) => t !== oldest);
  }
  return { clock, tabs };
}

/**
 * 탭을 닫는다. `next` — 닫은 것이 현재 탭이면 갈 주소(오른쪽 이웃 → 왼쪽 이웃의 마지막 주소), 남은 탭이 없으면 `null`(전체 목록),
 * 현재 탭이 아니면 `undefined`(그 자리에 머문다).
 */
export function closeTab(state: ItemTabs, key: string, current: string | undefined): { state: ItemTabs; next: string | null | undefined } {
  const index = state.tabs.findIndex((t) => t.key === key);
  if (index < 0) return { state, next: undefined };
  const tabs = state.tabs.filter((t) => t.key !== key);
  const next = key !== current ? undefined : (tabs[index] ?? tabs[index - 1])?.href ?? null;
  return { state: { clock: state.clock, tabs }, next };
}

/** 편집 잠금 — 다른 탭이 편집 중이면 그 탭 키(「먼저 A 를 저장하거나 버리세요」), 아니면 없음. */
export function editBlocker(editing: string | undefined, key: string): string | undefined {
  return editing !== undefined && editing !== key ? editing : undefined;
}

/** 없어진 항목(지워진 것)의 탭을 뺀다. 바뀐 것이 없으면 같은 값을 돌려준다(렌더 루프 방지). */
export function pruneTabs(state: ItemTabs, known: (key: string) => boolean): ItemTabs {
  const tabs = state.tabs.filter((t) => known(t.key));
  return tabs.length === state.tabs.length ? state : { clock: state.clock, tabs };
}

/**
 * 저장소(localStorage)에서 읽은 값 → 믿을 수 있는 모양. 깨진 값은 빈 탭, 모양이 틀린 줄 · 겹친 키 · 앱 밖 주소는 버리고, 상한까지만.
 * 저장소는 사람이 고칠 수도, 옛 판이 남을 수도 있다.
 */
export function parseTabs(raw: unknown): ItemTabs {
  if (!raw || typeof raw !== "object") return NO_TABS;
  const { tabs, clock } = raw as { tabs?: unknown; clock?: unknown };
  if (!Array.isArray(tabs)) return NO_TABS;
  const seenKeys = new Set<string>();
  const out: ItemTab[] = [];
  for (const t of tabs) {
    if (!t || typeof t !== "object") continue;
    const { key, href, seen } = t as Record<string, unknown>;
    if (typeof key !== "string" || key === "" || typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push({ key, href, seen: typeof seen === "number" && Number.isFinite(seen) ? seen : 0 });
    if (out.length === MAX_ITEM_TABS) break;
  }
  const maxSeen = out.reduce((m, t) => Math.max(m, t.seen), 0);
  return { tabs: out, clock: typeof clock === "number" && Number.isFinite(clock) ? Math.max(clock, maxSeen) : maxSeen };
}
