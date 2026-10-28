/**
 * 담보 조회(L1) — 담보코드 1열 · 코드로도 검색 (기능/담보 §4 · 2026-09-27).
 * 서버 컴포넌트를 서비스 흉내로 그려 문자열로 본다 — 클릭 흐름은 E2E(coverage-code.spec) 몫.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/coverages",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => {
    throw new Error("redirect");
  },
}));
vi.mock("@/lib/services", () => ({
  getServices: () => ({
    coverage: {
      listSummaries: async () => [
        { id: "c2", code: "COV000002", name: "골절진단비", category: "V09", updatedAt: new Date("2026-09-27T00:00:00Z") },
        { id: "c1", code: "COV000001", name: "일반상해사망보장", category: "V01", updatedAt: new Date("2026-09-27T00:00:00Z") },
        { id: "c3", code: "COV000003", name: "옛 담보", updatedAt: new Date("2026-09-27T00:00:00Z") },
      ],
    },
    catalog: { getEnum: async () => ({ code: "E0009", label: "담보분류", values: [{ code: "V01", label: "상해", order: 0 }] }) },
  }),
}));

import CoveragesPage from "./page";

async function render(sp: Record<string, string> = {}) {
  return renderToStaticMarkup(await CoveragesPage({ searchParams: Promise.resolve(sp) }));
}

describe("담보 조회 — 담보분류 열 (ADR-0090 · 기능/담보 §4)", () => {
  it("코드 · 담보명 다음 열 — 값 이름, 지운 값은 「없는 값 V09」, 미입력은 「—」", async () => {
    const html = await render();
    expect(html.indexOf("담보분류</th>")).toBeGreaterThan(html.indexOf("<th class=\"col-flex\">"));
    expect(html).toContain("<td class=\"col-fixed-md\">상해</td>");
    expect(html).toContain("없는 값 V09");
    expect(html).toMatch(/<span class="ts-muted">—<\/span>/);
  });
});

describe("담보 조회 — 담보코드", () => {
  it("1열이 담보 — 1줄째 담보명(상세로) · 2줄째 코드 두 줄 한 칸 · 검색창은 코드 · 담보명 (2026-10-21)", async () => {
    const html = await render();
    expect(html.indexOf("<th class=\"col-flex\">담보</th>")).toBeGreaterThan(-1);
    expect(html).not.toContain("<th class=\"col-code\">");
    expect(html).toMatch(/<td class="col-flex"><span class="ts-two-line ts-ident"><a class="ts-ident-name" href="\/coverages\/c1">일반상해사망보장<\/a><code class="ts-ident-code">COV000001<\/code><\/span><\/td>/);
    expect(html).toContain(">COV000002</code>");
    expect(html).toContain('placeholder="코드 · 담보명"');
  });

  it("최종수정은 날짜 한 줄 — 담보에는 수정자가 없다", async () => {
    const html = await render();
    expect(html.match(/<th[^>]*>최종수정<\/th>/g)).toHaveLength(1);
    expect(html).not.toContain("수정자");
    expect(html).toContain('<span class="ts-two-line ts-audit"><span class="ts-mono">2026-09-27</span></span>');
  });

  it("코드로 검색하면 그 담보만", async () => {
    const html = await render({ q: "cov000002" });
    expect(html).toContain("골절진단비");
    expect(html).not.toContain("일반상해사망보장");
  });

  it("이름 검색은 그대로", async () => {
    const html = await render({ q: "사망" });
    expect(html).toContain("COV000001");
    expect(html).not.toContain("COV000002");
  });
});
