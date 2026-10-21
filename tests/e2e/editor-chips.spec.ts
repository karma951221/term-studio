import { type Page } from "@playwright/test";

import { expect, test } from "./_lib/fixtures";

/**
 * 편집기 칩 표시 세 가지 (2026-10-21 사용자 QA, 기능/문면 §3.5 · 기능/함수조항 §3.5 · §4.4).
 *
 * ① 펼친 함수조항 안 항을 가리키는 조 참조 칩은 편집기 번호(「제5조(특별약관의 소멸) 제3항」) — 「항 P0300」이 아니다, 코드는 툴팁.
 * ② 함수조항 편집기의 자기 참조 칩은 범위 이름 없이 「제1항」 — 「이 함수조항 제1항」이 아니다.
 * ③ 문면에 넣은 함수조항의 옵션 자리는 고른 선택지의 글만 칩으로 — 다른 선택지 · ✓ 를 늘어놓지 않는다.
 * 시드(알파Plus2607 16대특정암 담보약관 · 함수조항 C0003 주소변경통지)를 읽기만 한다 — 저장하지 않는다.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "칩 표시 — 펼친 함수조항 안 참조는 번호 · 자기 참조는 「제1항」 · 옵션 자리는 고른 글만",
  { annotation: { type: "좌표없음", description: "기능/문면 §3.5 · 기능/함수조항 §3.5 · §4.4 편집기 칩 표시 — 시나리오 파일에 칩 표기 시나리오가 아직 없다" } },
  async ({ page, ev }) => {
    test.setTimeout(120_000);
    await ev.action("칩#0", "관리자로 로그인한다", () => login(page));

    await ev.action("칩#1", "16대특정암 담보약관 — 제5조(특별약관의 소멸) 안 C0146 셋째 항 참조는 「제3항」 칩, 툴팁에 코드", async () => {
      await page.goto(`/documents?kind=coverage&q=${encodeURIComponent("16대특정암진단비보장")}`);
      await page.getByRole("link", { name: "16대특정암진단비보장 특별약관", exact: true }).first().click();
      await page.waitForURL(/\/documents\/[0-9a-f-]+$/);
      const body = page.locator(".ts-l3-body");
      const chip = body.locator(".ts-doc-ref", { hasText: "제5조(특별약관의 소멸)" }).first();
      await expect(chip).toHaveText("제5조(특별약관의 소멸) 제3항");
      await expect(chip).toHaveAttribute("title", /번호는 조립 때 확정 · 코드 P0100 안 P0300/);
      await expect(body).not.toContainText(/[항호목] P\d{4}/);
    });

    await ev.action("칩#2", "같은 문서 제4조(특별약관의 무효) — C0146 옵션 자리는 고른 선택지 글만(다른 선택지 · ✓ 없음)", async () => {
      await page.getByRole("button", { name: "제4조(특별약관의 무효)", exact: true }).first().click();
      const opt = page.locator(".ts-clause-model-opt", { hasText: "16대특정암보장개시일" }).first();
      await expect(opt).toHaveText(/^16대특정암보장개시일의 전일 이전에「16대특정암」[^|〔]*$/);
      await expect(page.locator(".ts-l3-body")).not.toContainText("✓16대특정암");
      await expect(page.locator(".ts-l3-body")).not.toContainText("첫번째암보장개시일");
    });

    await ev.action("칩#3", "함수조항 C0003(주소변경통지) — 둘째 항의 자기 참조 칩은 「제1항」", async () => {
      await page.goto("/functions/C0003");
      const editor = page.locator(".ts-clause-editor");
      const chip = editor.locator(".ts-doc-ref", { hasText: /^제1항$/ }).first();
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAttribute("title", /이 함수조항/);
      await expect(editor).not.toContainText("이 함수조항 제1항");
    });
  },
);
