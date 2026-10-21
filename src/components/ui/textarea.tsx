import * as React from "react"
import { cn } from "@/lib/utils"

/** 값 입력칸은 밑줄 하나 (2026-10-21, 사용자 결정 — outline → underline). Input 과 같은 문법. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-none border-0 border-b border-input bg-transparent px-0.5 py-2 text-[13px] transition-[color,border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-mark focus-visible:shadow-[0_1px_0_var(--color-mark)] disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-50 read-only:border-dashed read-only:focus-visible:shadow-none aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_1px_0_var(--color-destructive)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
