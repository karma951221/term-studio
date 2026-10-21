import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 값 입력칸은 밑줄 하나 (2026-10-21, 사용자 결정 — outline → underline, 전 폼 공통). globals.css §3 입력과 같은 문법.
 * `variant="box"` 는 상자가 뜻을 가진 칸만 — 아이콘과 한 몸인 검색칸(목록 필터 줄).
 */
const UNDERLINE =
  "rounded-none border-0 border-b border-input bg-transparent px-0.5 hover:border-muted-foreground focus-visible:border-mark focus-visible:shadow-[0_1px_0_var(--color-mark)] aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_1px_0_var(--color-destructive)] disabled:border-dashed read-only:border-dashed read-only:focus-visible:shadow-none"
const BOX =
  "rounded-md border border-input bg-card px-3 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 aria-invalid:border-destructive aria-invalid:ring-destructive/20"

function Input({
  className,
  type,
  variant = "underline",
  ...props
}: React.ComponentProps<"input"> & { variant?: "underline" | "box" }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 py-1 text-[13px] transition-[color,border-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-[13px] file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        variant === "box" ? BOX : UNDERLINE,
        className
      )}
      {...props}
    />
  )
}

export { Input }
