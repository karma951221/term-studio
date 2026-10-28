"use client";

/**
 * 상품 상세의 편집 상태 — 제목 줄 오른쪽 끝의 조작(편집 / 취소 · 저장)과 영역 본문이 함께 쓴다
 * (와이어프레임 §20.2 「화면 전체의 저장 버튼 하나」 · 기능/상품 §3.8).
 *
 * 서버 컴포넌트인 page.tsx 는 `ProductEditProvider` 로 본문을 감싸기만 한다. 편집이 있는 탭(기본정보 · 상품담보 · 보통약관)의 본문이
 * 마운트되며 제 begin · cancel · save · dirty 를 등록하고, 제목 줄 오른쪽 끝의 `ProductHeadActions` 가 그것을 부른다.
 * 영역 탭(세그먼트)이 상품명 바로 오른쪽에 서서 편집이 지금 영역의 것으로 읽힌다 (2026-10-28, ADR-0094 — 앞서 탭 첫 줄 오른쪽).
 *
 * 편집은 한 항목 탭만(ADR-0094) — 다른 상품 탭으로 가도 초안은 남는다: 본문의 `snapshot` 을 맡기고, 돌아오면 같은 영역의 본문에 `restore`.
 * 저장이 끝나면 여기서 읽기로 돌아가고 `router.refresh()` 로 서버 값을 다시 받는다.
 *
 * 편집 중 떠나는 조작 — ✕ 취소 · 하위 탭 링크(`ProductTabs`) · 경로 링크(`ProductPath`) — 은 고친 것이 있으면
 * EditShell 과 같은 `DiscardDialog`(「고친 내용을 버립니까?」)를 거친다 (디자인원칙 §1.7 · 점검 M21).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { DiscardDialog } from "@/app/_components/EditShell";
import { useItemEdit, useRestoredDraft } from "@/app/_components/ListDetailLayout";
import { MoreMenu, type MoreMenuItem } from "@/app/_components/MoreMenu";
import { HeadActions, HeadButton, HeadIconButton } from "@/app/_components/HeadActions";
import { IconClose } from "@/app/_components/icons";
import { ENTITY_LABEL } from "@/app/_lib/labels";

/**
 * 본문이 등록하는 손잡이. `save` 는 저장이 끝나 읽기로 돌아가도 되면 `"done"`, 입력을 유지해야 하면 `"stay"`.
 * `dirty` 는 지금 초안이 편집 시작과 달라졌는가 — 떠나는 조작의 「버립니까?」 판정에 쓴다.
 */
export interface ProductEditHandlers {
  begin(): void;
  cancel(): void;
  save(confirmed: boolean): Promise<"done" | "stay">;
  dirty(): boolean;
  /** 항목 탭을 옮길 때 맡길 초안 — 돌아오면 `restore` 로 받는다 (ADR-0094). */
  snapshot?(): unknown;
  restore?(kept: unknown): void;
}

interface ProductEditContextValue {
  editing: boolean;
  pending: boolean;
  /** 이 탭에 편집할 것이 있는가 — 기본정보 탭 · 상품담보 탭 · 템플릿이 있는 보통약관 탭. */
  canEdit: boolean;
  begin(): void;
  /** ✕ — 고친 것이 있으면 「버립니까?」 뒤에, 없으면 바로 읽기로. */
  cancel(): void;
  save(confirmed?: boolean): void;
  /** 이 편집 화면을 떠나는 조작(탭 링크 · 경로 링크) — 고친 것이 있으면 「버립니까?」 뒤에, 없으면 바로 `go`. */
  leave(go: () => void): void;
  /** 묻지 않고 초안을 버리고 읽기로 — 사용자가 이미 버림을 안내받은 조작(보통약관 템플릿 교체)이 부른다. */
  end(): void;
  register(handlers: ProductEditHandlers | null): void;
}

const ProductEditContext = createContext<ProductEditContextValue | null>(null);

export function useProductEdit(): ProductEditContextValue {
  const ctx = useContext(ProductEditContext);
  if (!ctx) throw new Error("useProductEdit 는 ProductEditProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}

/**
 * 편집 중 떠나는 조작(✕ 취소 · 탭 링크 · 경로 링크)이 「고친 내용을 버립니까?」를 거치는가 (점검 M21 · 디자인원칙 §1.7).
 * EditShell 의 `leave` 와 같은 규칙 — 편집 중이고 고친 것이 있을 때만 묻는다.
 */
export function leaveNeedsConfirm({ editing, dirty }: { editing: boolean; dirty: boolean }): boolean {
  return editing && dirty;
}

export function ProductEditProvider({
  canEdit,
  area = "",
  initialEditing = false,
  children,
}: {
  canEdit: boolean;
  /** 지금 영역(`?tab=` · 상품담보 값 화면) — 맡긴 초안은 같은 영역에서만 돌려받는다. */
  area?: string;
  /** 테스트 · 렌더 검사용 — 편집 상태로 시작. */
  initialEditing?: boolean;
  children: ReactNode;
}) {
  // 다른 항목 탭에 갔다 돌아왔으면 맡겨 둔 초안으로 편집을 잇는다 (ADR-0094)
  const restored = useRestoredDraft<{ area: string; body: unknown }>("product");
  const resume = restored !== undefined && restored.area === area;
  const [editingState, setEditing] = useState(initialEditing || resume);
  /** 「버립니까?」 확인 — 버리면 그 조작의 `go` 로. */
  const [discard, setDiscard] = useState<{ go: () => void }>();
  const [pending, startTransition] = useTransition();
  const handlers = useRef<ProductEditHandlers | null>(null);
  /** 본문이 손잡이를 내려놓기 직전의 초안 — 화면이 사라질 때 본문이 먼저 내려놓아도 맡길 수 있게. */
  const lastBody = useRef<unknown>(undefined);
  const router = useRouter();

  // 편집할 것이 없는 탭으로 옮겨 오면(탭은 URL 이라 이 Provider 는 남는다) 편집을 푼다 —
  // 헤더가 본문 없는 `[취소] [저장]` 로 남지 않게 (점검 M21).
  if (editingState && !canEdit) setEditing(false);
  const editing = editingState && canEdit;

  const register = useCallback((h: ProductEditHandlers | null) => {
    if (h === null && handlers.current?.snapshot) lastBody.current = handlers.current.snapshot();
    handlers.current = h;
  }, []);
  // 고친 것은 본문 손잡이만 알아 렌더 중에 못 읽는다 — 편집 중인 상품 탭을 닫으면 늘 「버립니까?」를 묻는다
  const itemEdit = useItemEdit({ part: "product", editing, dirty: editing, snapshot: () => ({ area, body: handlers.current?.snapshot?.() ?? lastBody.current }) });
  // 맡긴 초안을 본문에 돌려준다 — 본문(자식)의 등록 이펙트가 먼저 돈 뒤다
  useEffect(() => {
    if (resume && restored.body !== undefined) handlers.current?.restore?.(restored.body);
    // 마운트 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const begin = useCallback(() => {
    if (!itemEdit.allowEdit()) return;
    handlers.current?.begin();
    setEditing(true);
  }, [itemEdit]);
  const leave = useCallback(
    (go: () => void) => (leaveNeedsConfirm({ editing, dirty: handlers.current?.dirty() ?? false }) ? setDiscard({ go }) : go()),
    [editing],
  );
  const cancel = useCallback(
    () =>
      leave(() => {
        handlers.current?.cancel();
        setEditing(false);
      }),
    [leave],
  );
  const end = useCallback(() => {
    handlers.current?.cancel();
    setEditing(false);
  }, []);
  const save = useCallback(
    (confirmed = false) => {
      const h = handlers.current;
      if (!h) return;
      startTransition(async () => {
        const outcome = await h.save(confirmed);
        if (outcome !== "done") return;
        setEditing(false);
        router.refresh();
      });
    },
    [router],
  );

  const value = useMemo<ProductEditContextValue>(
    () => ({ editing, pending, canEdit, begin, cancel, save, leave, end, register }),
    [editing, pending, canEdit, begin, cancel, save, leave, end, register],
  );
  return (
    <ProductEditContext.Provider value={value}>
      {children}
      {discard ? (
        <DiscardDialog
          onStay={() => setDiscard(undefined)}
          onDiscard={() => {
            const { go } = discard;
            setDiscard(undefined);
            itemEdit.release();
            go();
          }}
        />
      ) : null}
    </ProductEditContext.Provider>
  );
}

/**
 * 상품 상세의 제목 「{상품명}」 (디자인원칙 §1.7 — 목록 → 상세 틀 안에서는 L1 마디 「상품」을 그리지 않는다).
 * 편집 중 고친 것이 있으면 상위로 가는 링크가 「버립니까?」 확인을 거친다.
 */
export function ProductPath({ name }: { name: string }) {
  const { leave } = useProductEdit();
  return <Breadcrumb items={[{ label: ENTITY_LABEL.product, href: "/products" }, { label: name }]} guard={leave} />;
}

/**
 * 제목 줄 오른쪽 끝 — 더보기(미리보기 · 상품 삭제) · 편집 조작 (디자인원칙 §1.9, 2026-10-28 ADR-0094 — 영역마다 따로 두지 않는다).
 * 편집 중에는 더보기를 비운다: 미리보기 링크는 「버립니까?」를 거치지 않고 떠난다.
 */
export function ProductHeadActions({ menu }: { menu: MoreMenuItem[] }) {
  const { editing } = useProductEdit();
  return (
    <HeadActions>
      {!editing && <MoreMenu items={menu} />}
      <EditControls />
    </HeadActions>
  );
}

/**
 * 편집 조작만 — 읽기: `[편집]`, 편집: `✕ [저장]` (같은 자리 · 제목 줄과 같은 규격, 디자인원칙 §1.9). 상품담보 값 화면(상세2)의 제목 줄이 쓴다.
 * 편집할 것이 없는 영역(또는 템플릿 없는 보통약관)에서는 아무것도 그리지 않는다.
 */
export function ProductEditButtons() {
  return (
    <HeadActions>
      <EditControls />
    </HeadActions>
  );
}

function EditControls() {
  const { editing, pending, canEdit, begin, cancel, save } = useProductEdit();
  if (!canEdit) return null;
  return (
    <>
      {editing ? (
        <>
          <HeadIconButton icon={<IconClose />} label="편집 취소" disabled={pending} onClick={cancel} />
          <HeadButton primary disabled={pending} onClick={() => save()}>
            {pending ? "저장 중…" : "저장"}
          </HeadButton>
        </>
      ) : (
        <HeadButton onClick={begin}>편집</HeadButton>
      )}
    </>
  );
}
