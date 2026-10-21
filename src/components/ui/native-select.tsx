import * as React from "react";

import { cn } from "@/lib/utils";

/** 네이티브 `<select>` 에 위젯 모양만 — 폼 제출 · 키보드 · E2E `selectOption` 이 그대로다 (ADR-0085). 밑줄 하나(2026-10-21, outline → underline). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full min-w-0 cursor-pointer appearance-none rounded-none border-0 border-b border-input bg-transparent bg-size-[14px] bg-position-[right_2px_center] bg-no-repeat py-0 pr-6 pl-0.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] duration-150 hover:border-muted-foreground focus-visible:border-mark focus-visible:shadow-[0_1px_0_var(--color-mark)] disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_1px_0_var(--color-destructive)]",
        "bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%2377726a%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E)]",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
