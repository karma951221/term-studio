/**
 * Button 글자형 variant(bare · text · link)와 xs 크기 — 위젯 잔여 교체(2026-11-01).
 * size 클래스가 variant 뒤에 붙어 이기므로, 글자 버튼이 상자 규격(h-8 · px-3)을 입지 않는다는 것을 지킨다.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

const classes = (node: React.ReactElement) => renderToStaticMarkup(node).match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

describe("Button 글자형 variant", () => {
  for (const variant of ["bare", "text", "link"] as const) {
    it(`${variant} — 높이 자동 · 가로 여백 0 (상자 규격이 이기지 않는다)`, () => {
      const cls = classes(<Button variant={variant}>글</Button>);
      expect(cls).toContain("h-auto");
      expect(cls).toContain("px-0");
      expect(cls).not.toContain("h-8");
      expect(cls).not.toContain("px-3");
    });
  }

  it("text — 점선 밑줄, 현재(aria-current)는 실선 마크색", () => {
    const cls = classes(<Button variant="text">고칠 자리로</Button>).join(" ");
    expect(cls).toContain("decoration-dotted");
    expect(cls).toContain("aria-[current=true]:decoration-mark");
  });

  it("xs — 22px · 11px 글자, 호출자 className 이 마지막에 이긴다", () => {
    const cls = classes(<Button size="xs" className="h-5">+칸</Button>);
    expect(cls).toContain("text-[11px]");
    expect(cls).toContain("h-5");
    expect(cls).not.toContain("h-[22px]");
  });
});
