import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 버튼 — 디자인원칙 §1.3 · §1.6 · §5, ADR-0085.
 * primary 는 채우지 않는다(주칠 테두리 + 주칠 굵은 글자). destructive 는 평소 뉴트럴, hover · focus 에서만 error 로 물든다.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] leading-none no-underline transition-[color,background-color,border-color,box-shadow] duration-150 ease-out outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border border-input bg-card text-foreground hover:bg-accent",
        primary: "border border-mark bg-card font-bold text-mark hover:bg-mark-bg",
        destructive:
          "border border-input bg-card text-muted-foreground hover:border-destructive hover:bg-destructive-bg hover:text-destructive focus-visible:border-destructive focus-visible:text-destructive",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        "ghost-destructive": "text-muted-foreground hover:bg-destructive-bg hover:text-destructive focus-visible:text-destructive",
        /** 상자 없는 글자 버튼 — 둘러싼 글자의 색 · 크기를 그대로 잇고 hover 에만 마크색. 줄 안에 박힌 조작(조건 머리 · 접기 ▸). */
        bare: "inline h-auto whitespace-normal rounded-none p-0 text-left text-inherit hover:text-mark",
        /** 글자처럼 보이는 버튼 — 본문 속에서 「누를 수 있다」를 점선 밑줄로 말한다(고칠 자리로 · 추천 · 그 자리로). aria-current 는 실선 마크색. */
        text: "inline h-auto whitespace-normal rounded-none p-0 text-left text-inherit underline decoration-dotted decoration-input underline-offset-4 hover:decoration-muted-foreground aria-[current=true]:decoration-solid aria-[current=true]:decoration-mark",
        link: "h-auto px-0 text-foreground underline-offset-4 hover:text-mark hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5",
        icon: "size-8",
        "icon-sm": "size-6",
        /** 줄 안 작은 조작(+칸 · +조건) — 22px, 11px 글자 */
        xs: "h-[22px] px-1.5 text-[11px]",
      },
    },
    // 글자 버튼(bare · text · link)은 상자 규격(높이 32 · 가로 12)을 입지 않는다 — size 클래스가 variant 뒤에 붙어 이기므로 여기서 되돌린다
    compoundVariants: [{ variant: ["bare", "text", "link"], size: "default", class: "h-auto min-h-0 px-0" }],
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
