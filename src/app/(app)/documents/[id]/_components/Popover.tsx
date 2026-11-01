"use client";

/**
 * 그 자리 팝업 · 오른쪽 클릭 메뉴 (기능/문면 §4.3).
 *
 * - `Popover` — 누른 자리 **바로 아래**에 뜨는 모달 Radix Dialog(role=dialog). 아래가 모자라면 위로 올린다. Esc · 바깥 클릭으로 닫힌다.
 *   함수조항 · 동적표 템플릿 · 상품 조 사본 편집기의 고치기 · 넣기 폼과 삭제 확인 카드가 쓴다. 문면 편집기의 폼은 우측 패널 「편집」 탭이다(2026-10-21).
 * - `ContextMenu` — 브라우저 기본 메뉴 대신 뜨는 앱 메뉴(툴바의 지름길). 팝업 안에서 열면 그 팝업 안에 그린다(모달 밖은 눌리지 않는다).
 *   툴바의 여러 갈래 버튼(옵션 자리 ▾)도 이 메뉴로 고른다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dialog as DialogPrimitive } from "radix-ui";

import { HeadButton } from "@/app/_components/HeadActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { Anchor } from "./ctx";
import { forContextMenu, type MenuItem, type MenuSections } from "./menus";

/** 떠 있는 요소를 자리 바로 아래에 — 화면 밖으로 나가지 않게 당긴다. */
export function placeAt(el: HTMLElement, anchor: Anchor): void {
  el.style.position = "fixed";
  el.style.margin = "0";
  el.style.inset = "auto";
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = anchor.y + 4;
  if (top + r.height > vh - 8 && anchor.top !== undefined && anchor.top - r.height - 4 >= 8) top = anchor.top - r.height - 4;
  top = Math.max(8, Math.min(top, vh - r.height - 8));
  const left = Math.max(8, Math.min(anchor.x, vw - r.width - 8));
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

export function Popover({ anchor, label, onClose, children, wide }: { anchor: Anchor; label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  // Radix 는 내용을 포털에 늦게 붙인다 — 부모의 layout effect 로는 ref 가 비어 있다. 붙는 순간(콜백 ref)에 자리를 잡고, 정리 함수로 관찰을 끊는다.
  const place = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      placeAt(el, anchor);
      // 열린 뒤 내용이 자라면(값 한정 「해당 값들」 체크 목록 등) 다시 자리를 잡는다 — 처음 높이로 잡은 자리면 아래가 화면 밖으로 나가 확인 단추를 못 누른다
      if (typeof ResizeObserver === "undefined") return;
      const watch = new ResizeObserver(() => placeAt(el, anchor));
      watch.observe(el);
      return () => watch.disconnect();
    },
    [anchor],
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPortal>
        {/* 바깥 클릭으로 닫힌다 — 뒤는 어둡게 하지 않는다 */}
        <DialogOverlay className="bg-transparent" />
        <DialogPrimitive.Content
          ref={place}
          data-slot="dialog-content"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            // 팝업 안에서 연 오른쪽 클릭 메뉴의 Esc 는 메뉴만 닫는다
            if (e.target instanceof Element && e.target.closest("[role=menu]")) e.preventDefault();
          }}
          className={cn(
            "ts-pop fixed z-50 block max-h-[calc(100vh-32px)] overflow-auto rounded-md border border-input bg-card p-3 text-foreground shadow-float outline-none",
            wide ? "w-[min(600px,calc(100vw-32px))]" : "w-[min(440px,calc(100vw-32px))]",
          )}
        >
          <DialogTitle className="mb-2 text-[13px] leading-normal">{label}</DialogTitle>
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** 팝업의 확인 · 취소 줄 — 확인은 편집본에 곧바로 적용한다(서버로 가지 않는다). */
export function PopActions({ onCancel, confirmLabel = "확인", disabled }: { onCancel: () => void; confirmLabel?: string; disabled?: boolean }) {
  return (
    <div className="ts-form-actions">
      <HeadButton onClick={onCancel}>취소</HeadButton>
      <HeadButton type="submit" primary disabled={disabled}>
        {confirmLabel}
      </HeadButton>
    </div>
  );
}

/** 오른쪽 클릭 메뉴를 그릴 곳 — 열린 팝업(모달) 안. 모달 밖은 눌리지 않아서 body 에 그리면 메뉴가 죽는다. */
function topModal(): HTMLElement {
  const open = Array.from(document.querySelectorAll<HTMLElement>("[role=dialog][data-state=open]"));
  return open.at(-1) ?? document.body;
}

export function ContextMenu({ x, y, sections, onPick, onClose }: { x: number; y: number; sections: MenuSections; onPick: (item: MenuItem) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [host] = useState<HTMLElement>(() => topModal());
  // 툴바 전용(조건 넣기)은 오른쪽 클릭 메뉴에 싣지 않는다 (기능/문면 §4.3)
  const shown = forContextMenu(sections);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    placeAt(el, { x, y: y - 4 });
    el.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        // 팝업 안에서 연 메뉴면 Esc 가 팝업까지 닫지 않게 여기서 멈춘다
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);
    if (nodes.length === 0) return;
    e.preventDefault();
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    nodes[e.key === "ArrowDown" ? (at + 1) % nodes.length : (at - 1 + nodes.length) % nodes.length]?.focus();
  };

  return createPortal(
    <div ref={ref} role="menu" aria-label="편집 메뉴" className="ts-ctx-menu" onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
      {shown.length === 0 ? (
        <p className="ts-muted">이 자리에서 할 수 있는 것이 없다.</p>
      ) : (
        shown.map((section, i) => (
          <div key={i} className="ts-ctx-section">
            {section.map((item) => (
              <Button
                key={item.name ?? item.label}
                type="button"
                variant={item.danger ? "ghost-destructive" : "ghost"}
                role="menuitem"
                aria-label={item.name}
                className={cn("flex h-auto w-full justify-start rounded-none px-3 py-1 text-left text-[13px] focus-visible:bg-accent", item.danger ? "text-foreground hover:text-destructive" : "text-foreground", item.indent && "pl-6 text-ink-2")}
                disabled={item.disabled}
                onClick={() => {
                  onClose();
                  onPick(item);
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        ))
      )}
    </div>,
    host,
  );
}
