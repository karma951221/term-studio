/**
 * Tooltip — 공급자(TooltipProvider)는 루트 레이아웃에 하나다 (2026-11-01, ADR-0085 잔여).
 * 공급자 없는 자리(테스트 · 격리 렌더)에서도 Tooltip 이 죽지 않게 자체 공급자로 물러난다.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InfoTip } from "./InfoTip";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

describe("Tooltip 공급자", () => {
  it("공급자 없이도 렌더된다 (InfoTip — 서버 렌더 테스트 수십 건이 공급자를 따로 안 감싼다)", () => {
    expect(renderToStaticMarkup(<InfoTip text="설명" />)).toContain('aria-label="설명"');
  });

  it("바깥 공급자 안에서도 렌더된다", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>트리거</TooltipTrigger>
          <TooltipContent>내용</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(html).toContain("트리거");
  });

  it("InfoTip 은 자기 공급자를 두지 않는다 — ⓘ 마다 공급자가 하나씩 생기던 것을 루트 하나로", () => {
    expect(readFileSync("src/app/_components/InfoTip.tsx", "utf8")).not.toMatch(/TooltipProvider/);
  });

  it("루트 레이아웃이 TooltipProvider 를 한 번 둔다", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/<TooltipProvider[\s>]/);
  });
});
