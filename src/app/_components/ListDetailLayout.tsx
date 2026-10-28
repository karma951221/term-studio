"use client";

/**
 * 목록 → 상세 한 화면 (ADR-0094 · 디자인원칙 §2 「목록 → 상세」).
 *
 * 메뉴의 `layout.tsx` 가 요약 목록(코드 · 이름)을 읽어 이것으로 감싼다. 전체 목록(L1)에서는 아무것도 더하지 않고,
 * 상세(`/<메뉴>/<항목>…`) · 생성(`/<메뉴>/new`)이면 목록을 왼쪽 패널로 줄이고 상세 맨 위에 항목 탭 줄을 세운다.
 *
 * - 패널: 머리 = L1 이름(누르면 목록 펼치기 — 전체 목록으로) · 패널 접기. 검색칸 · 코드 + 이름 줄 · 총 N건. 접히면 얇은 띠. 접힘은 메뉴마다 기억.
 * - 항목 탭: 고른 항목이 쌓이고(현재 = 밑줄), ✕ 로 닫는다. 탭마다 마지막으로 본 주소를 기억한다. 규칙은 순수 함수 `itemTabs`.
 * - 편집은 한 탭만: 편집기는 `useItemEdit` 으로 잠금을 묻고 · 「편집 중」을 알리고 · 떠날 때 초안을 맡긴다.
 *
 * 경로(§1.7)의 첫 마디(L1)는 패널 머리가 맡으므로 이 틀 안의 `Breadcrumb` 은 그 마디를 그리지 않는다(`useInListDetail`).
 */
import { ChevronRight, Maximize2, PanelLeftClose } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { closeTab, editBlocker, itemKeyOf, NO_TABS, openTab, pruneTabs } from "@/app/_lib/itemTabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { DiscardDialog } from "./EditShell";
import { IconButton, IconClose } from "./icons";
import { dropDraft, dropDraftsOf, draftId, getCollapsed, getEditing, getTabs, keepDraft, peekDraft, setCollapsed, setEditing, setTabs, subscribe } from "./listDetailStore";

/** 패널 한 줄 — 항목 하나. */
export interface PanelItem {
  key: string;
  /** 코드가 있는 실체만 (상품 · 약관 템플릿은 이름 한 줄). */
  code?: string;
  name: string;
  /** 상세 주소. */
  href: string;
}

/** 이 틀이 감싸는 메뉴 하나. 한 경로를 두 메뉴가 나눠 쓰면(약관 템플릿 — 종류) 둘을 넘긴다. */
export interface ListDetailMenu {
  /** 저장소 이름 — 메뉴마다 따로 기억한다. */
  id: string;
  /** L1 이름 — 패널 머리. */
  title: string;
  /** 전체 목록 주소 — 목록 펼치기. */
  listHref: string;
  /** 상세 주소의 앞 (`/documents`). */
  base: string;
  /** 항목이 아닌 하위 화면(L1 하위 탭 — `template`). */
  exclude?: readonly string[];
  /** 항목 키가 마디의 이 글자 앞까지(폼 필드 상세 `폼키.필드키` → 폼 탭). */
  keySeparator?: string;
  /** 생성 화면(`/new`)이 이 메뉴 것인지 — 쿼리가 맞으면(`kind=coverage`). 없으면 첫 메뉴. */
  newQuery?: Readonly<Record<string, string>>;
  items: readonly PanelItem[];
}

/** 화면이 들고 다니면 안 되는 일회성 쿼리 — 탭이 기억하는 주소에서 뺀다(삭제 확인 · 오류 배너 · 복제 카드). */
const TRANSIENT_QUERY = ["error", "del", "dup", "confirm"];

interface ItemTabContextValue {
  menu: string;
  itemKey: string;
  /** 편집을 시작해도 되나 — 다른 탭이 편집 중이면 안내를 띄우고 false. */
  requestEdit(): boolean;
}
const ItemTabContext = createContext<ItemTabContextValue | null>(null);
const InListDetailContext = createContext(false);

/** 목록 → 상세 틀 안의 상세인가 — 경로의 L1 마디를 그리지 않는다(§1.7). */
export function useInListDetail(): boolean {
  return useContext(InListDetailContext);
}

/**
 * 이 탭에서 편집하다 다른 탭(또는 전체 목록)으로 갔다 돌아왔으면 맡겨 둔 초안 — `useItemEdit` 의 `snapshot()` 이 만든 것.
 * 첫 렌더에 한 번 읽는다 — 편집기의 상태 초기값(모드 · 초안)으로 쓴다. 틀 밖이면 늘 undefined.
 */
export function useRestoredDraft<S>(part: string): S | undefined {
  const ctx = useContext(ItemTabContext);
  const [restored] = useState(() => (ctx ? peekDraft<S>(draftId(ctx.menu, ctx.itemKey, part)) : undefined));
  return restored;
}

/**
 * 편집기가 부른다 — 편집은 한 탭만 (ADR-0094 결정 3).
 * - `allowEdit()` — 「편집」을 누를 때. 다른 탭이 편집 중이면 「먼저 A 를 저장하거나 버리세요」를 띄우고 false.
 * - `release()` — 「저장하지 않고 나가기」처럼 초안을 버리고 떠날 때 먼저 부른다 — 떠날 때 초안을 맡기지 않는다.
 * 편집 중(`editing`)이면 탭에 「편집 중」이 붙고, 화면이 사라질 때(다른 탭 · 전체 목록으로) `snapshot()` 을 맡긴다 — 돌아오면 `useRestoredDraft`.
 * 틀 밖(생성 화면 · L1 하위 탭)에서는 아무것도 하지 않는다 — `allowEdit` 는 늘 true.
 */
export function useItemEdit({ part, editing, dirty, snapshot }: { part: string; editing: boolean; dirty: boolean; snapshot: () => unknown }): {
  allowEdit: () => boolean;
  release: () => void;
} {
  const ctx = useContext(ItemTabContext);
  const menu = ctx?.menu;
  const key = ctx?.itemKey;
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  });

  // 맡긴 초안은 한 번 받으면 지운다. 화면이 사라질 때 아직 편집 중이면 다시 맡긴다.
  useEffect(() => {
    if (menu === undefined || key === undefined) return;
    const id = draftId(menu, key, part);
    dropDraft(id);
    return () => {
      const mark = getEditing(menu);
      if (mark?.key === key && mark.part === part) keepDraft(id, latest.current());
    };
  }, [menu, key, part]);

  useEffect(() => {
    if (menu === undefined || key === undefined) return;
    if (editing) setEditing(menu, { key, part, dirty });
    else {
      const mark = getEditing(menu);
      if (mark?.key === key && mark.part === part) setEditing(menu, undefined);
    }
  }, [menu, key, part, editing, dirty]);

  const allowEdit = useCallback(() => (ctx ? ctx.requestEdit() : true), [ctx]);
  const release = useCallback(() => {
    if (menu === undefined || key === undefined) return;
    const mark = getEditing(menu);
    if (mark?.key === key && mark.part === part) setEditing(menu, undefined);
  }, [menu, key, part]);
  return { allowEdit, release };
}

function rememberedHref(pathname: string, search: URLSearchParams): string {
  const q = new URLSearchParams(search);
  for (const k of TRANSIENT_QUERY) q.delete(k);
  const qs = q.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function matchesQuery(search: URLSearchParams, query: Readonly<Record<string, string>> | undefined): boolean {
  return query !== undefined && Object.entries(query).every(([k, v]) => search.get(k) === v);
}

export function ListDetailLayout({ menus, children }: { menus: readonly ListDetailMenu[]; children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  // ── 지금 화면이 어느 메뉴의 무엇인가 ──
  const base = menus[0]!.base;
  const itemKey = itemKeyOf(pathname, base, { ...(menus[0]!.exclude ? { exclude: menus[0]!.exclude } : {}), ...(menus[0]!.keySeparator ? { keySeparator: menus[0]!.keySeparator } : {}) });
  const isNew = pathname === `${base}/new` || pathname.startsWith(`${base}/new/`);
  const menu = (itemKey !== undefined ? menus.find((m) => m.items.some((i) => i.key === itemKey)) : isNew ? menus.find((m) => matchesQuery(search, m.newQuery)) : undefined) ?? menus[0]!;
  const detail = itemKey !== undefined || isNew;

  const tabs = useSyncExternalStore(subscribe, () => getTabs(menu.id), () => NO_TABS);
  const collapsed = useSyncExternalStore(subscribe, () => getCollapsed(menu.id), () => false);
  const editing = useSyncExternalStore(subscribe, () => getEditing(menu.id), () => undefined);

  const byKey = useMemo(() => new Map(menu.items.map((i) => [i.key, i] as const)), [menu.items]);
  const href = rememberedHref(pathname, search);

  // ── 지금 본 항목을 탭에 올린다 · 없어진 항목의 탭은 뺀다 ──
  useEffect(() => {
    if (itemKey === undefined) return;
    const known = (k: string) => k === itemKey || byKey.has(k);
    setTabs(menu.id, openTab(pruneTabs(getTabs(menu.id), known), itemKey, href, { ...(getEditing(menu.id) ? { editing: getEditing(menu.id)!.key } : {}) }));
  }, [menu.id, itemKey, href, byKey]);

  // 방금 만든 항목처럼 요약 목록에 아직 없으면 레이아웃을 한 번 새로 받는다(이름 · 패널 줄).
  const refreshedFor = useRef<string>(undefined);
  useEffect(() => {
    if (itemKey === undefined || byKey.has(itemKey) || refreshedFor.current === itemKey) return;
    refreshedFor.current = itemKey;
    router.refresh();
  }, [itemKey, byKey, router]);

  const [blockedBy, setBlockedBy] = useState<string>();
  const [discard, setDiscard] = useState<{ go: () => void }>();
  const requestEdit = useCallback(() => {
    if (itemKey === undefined) return true;
    const blocker = editBlocker(getEditing(menu.id)?.key, itemKey);
    if (blocker === undefined) return true;
    setBlockedBy(blocker);
    return false;
  }, [menu.id, itemKey]);
  const ctx = useMemo<ItemTabContextValue | null>(() => (itemKey !== undefined ? { menu: menu.id, itemKey, requestEdit } : null), [menu.id, itemKey, requestEdit]);

  if (!detail) return <>{children}</>;

  const labelOf = (key: string) => byKey.get(key)?.name ?? key;
  const tabHref = (key: string) => tabs.tabs.find((t) => t.key === key)?.href;
  const shownTabs = pruneTabs(tabs, (k) => k === itemKey || byKey.has(k)).tabs;
  // 저장소를 아직 못 읽은 첫 렌더(서버)에도 현재 항목 탭은 선다
  const visibleTabs = itemKey !== undefined && !shownTabs.some((t) => t.key === itemKey) ? [...shownTabs, { key: itemKey, href, seen: 0 }] : shownTabs;

  const close = (key: string) => {
    const mark = getEditing(menu.id);
    const run = () => {
      if (mark?.key === key) {
        setEditing(menu.id, undefined);
        dropDraftsOf(menu.id, key);
      }
      const result = closeTab(getTabs(menu.id), key, itemKey);
      setTabs(menu.id, result.state);
      if (result.next === null) router.push(menu.listHref);
      else if (result.next) router.push(result.next);
    };
    if (mark?.key === key && mark.dirty) setDiscard({ go: run });
    else run();
  };

  return (
    <InListDetailContext.Provider value>
      <ItemTabContext.Provider value={ctx}>
        {/* data-ld-keep — 이 안의 링크는 화면을 떠나는 것이 아니다(초안이 남는다). 링크를 가로채 「버립니까?」를 묻는 편집기(문면)가 건너뛴다 */}
        <div className="ts-ld" data-collapsed={collapsed || undefined}>
          {collapsed ? (
            <div className="ts-ld-strip" data-ld-keep>
              <IconButton framed label="목록 펼치기 — 상세를 닫고 전체 목록으로" icon={<Maximize2 className="size-4" />} onClick={() => router.push(menu.listHref)} />
              <IconButton framed label="패널 펼치기" aria-expanded={false} icon={<ChevronRight className="size-4" />} onClick={() => setCollapsed(menu.id, false)} />
            </div>
          ) : (
            <ListPanel menu={menu} currentKey={itemKey} editingKey={editing?.key} tabHref={tabHref} onCollapse={() => setCollapsed(menu.id, true)} onExpandList={() => router.push(menu.listHref)} />
          )}
          <section className="ts-ld-detail">
            <div className="ts-ld-tabs" data-ld-keep role="tablist" aria-label={`${menu.title} 열린 항목`}>
              {visibleTabs.map((t) => {
                const current = t.key === itemKey;
                const label = labelOf(t.key);
                const isEditing = editing?.key === t.key;
                return (
                  <div key={t.key} className="ts-ld-tab" data-current={current || undefined}>
                    <Link href={t.href} role="tab" aria-selected={current} title={isEditing ? `${label} — 편집 중` : label} className="ts-ld-tab-link">
                      <span className="ts-ld-tab-label">{label}</span>
                      {isEditing ? (
                        <span className="ts-ld-tab-editing">
                          <span aria-hidden className="ts-ld-dot" />
                          편집 중
                        </span>
                      ) : null}
                    </Link>
                    <IconButton size="sm" className="ts-ld-tab-close" label={`탭 닫기 — ${label}`} icon={<IconClose />} onClick={() => close(t.key)} />
                  </div>
                );
              })}
            </div>
            <div className="ts-ld-body">{children}</div>
          </section>
        </div>
        {blockedBy !== undefined ? (
          <Dialog open onOpenChange={(open) => (open ? undefined : setBlockedBy(undefined))}>
            <DialogContent showCloseButton={false} className="sm:max-w-md">
              <DialogTitle className="ts-confirm-title">먼저 「{labelOf(blockedBy)}」 편집을 저장하거나 버리세요</DialogTitle>
              <DialogDescription className="ts-confirm-body">편집은 한 번에 한 탭에서만 할 수 있습니다. 「{labelOf(blockedBy)}」 탭이 편집 중입니다.</DialogDescription>
              <DialogFooter className="ts-confirm-actions">
                <Button onClick={() => setBlockedBy(undefined)}>닫기</Button>
                <Button
                  variant="primary"
                  autoFocus
                  onClick={() => {
                    const target = tabHref(blockedBy) ?? byKey.get(blockedBy)?.href;
                    setBlockedBy(undefined);
                    if (target) router.push(target);
                  }}
                >
                  편집 중인 탭으로
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
        {discard ? (
          <DiscardDialog
            onStay={() => setDiscard(undefined)}
            onDiscard={() => {
              const { go } = discard;
              setDiscard(undefined);
              go();
            }}
          />
        ) : null}
      </ItemTabContext.Provider>
    </InListDetailContext.Provider>
  );
}

/** 펼친 목록 패널 — 머리(L1 이름 · 접기) · 검색칸 · 줄 · 총 N건. 페이저 · 열 필터는 전체 목록에만. */
function ListPanel({
  menu,
  currentKey,
  editingKey,
  tabHref,
  onCollapse,
  onExpandList,
}: {
  menu: ListDetailMenu;
  currentKey: string | undefined;
  editingKey: string | undefined;
  tabHref: (key: string) => string | undefined;
  onCollapse: () => void;
  onExpandList: () => void;
}) {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = words.length === 0 ? menu.items : menu.items.filter((i) => words.every((w) => `${i.code ?? ""} ${i.name}`.toLowerCase().includes(w)));
  const currentRow = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    currentRow.current?.scrollIntoView({ block: "nearest" });
  }, [currentKey]);

  return (
    <aside className="ts-ld-panel" data-ld-keep aria-label={`${menu.title} 목록`}>
      <div className="ts-ld-panel-head">
        <button type="button" className="ts-ld-panel-title" title="목록 펼치기 — 상세를 닫고 전체 목록으로" onClick={onExpandList}>
          {menu.title}
        </button>
        <IconButton framed label="패널 접기" aria-expanded icon={<PanelLeftClose className="size-4" />} onClick={onCollapse} />
      </div>
      <Input className="ts-ld-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={menu.items.some((i) => i.code) ? "코드 · 이름" : "이름"} aria-label={`${menu.title} 찾기`} />
      <nav className="ts-ld-rows">
        {rows.map((item) => {
          const current = item.key === currentKey;
          return (
            <Link key={item.key} ref={current ? currentRow : undefined} href={tabHref(item.key) ?? item.href} className="ts-ld-row" aria-current={current ? "page" : undefined}>
              {item.code ? <span className="ts-ld-row-code ts-mono">{item.code}</span> : null}
              <span className="ts-ld-row-name">
                {item.name}
                {item.key === editingKey ? <span aria-label="편집 중" title="편집 중" className="ts-ld-dot" /> : null}
              </span>
            </Link>
          );
        })}
        {rows.length === 0 ? <p className="ts-ld-empty">일치하는 항목 없음</p> : null}
      </nav>
      <p className="ts-ld-count">
        총 <b>{rows.length}</b>건
      </p>
    </aside>
  );
}
