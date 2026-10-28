/**
 * 제목 줄 · 탭 첫 줄 오른쪽의 조작 줄 — 디자인원칙 §1.9 (2026-10-28).
 *
 * 한 줄의 버튼은 모두 높이 32 · 모서리 6 · 1px 테두리다. 주 동작(편집 · 저장 · 생성, 저장의 일부인 「검사」)만 글자 버튼이고,
 * 나머지(패널 · 더보기 · 삭제 · 편집 취소 ✕ · 목록 `+`)는 32×32 테두리 아이콘 버튼이다 — 이름은 title · aria-label 로.
 * 순서는 왼쪽부터 보조 아이콘 → 편집 조작(검사 · ✕) → 주 동작(맨 오른쪽).
 */
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconButton, type IconButtonProps } from "./icons";

export function HeadActions({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("ts-head-actions", className)}>{children}</span>;
}

/** 글자 버튼 — 주 동작. `primary` 는 저장 · 생성(주칠 테두리). */
export function HeadButton({ primary, type, ...props }: Omit<ComponentProps<typeof Button>, "variant" | "size"> & { primary?: boolean }) {
  return <Button type={type ?? "button"} variant={primary ? "primary" : "default"} {...props} />;
}

/** 테두리 아이콘 버튼 — 보조 동작. 글자 버튼과 같은 높이 · 테두리 · 모서리. */
export function HeadIconButton(props: Omit<IconButtonProps, "size" | "framed">) {
  return <IconButton {...props} framed />;
}
