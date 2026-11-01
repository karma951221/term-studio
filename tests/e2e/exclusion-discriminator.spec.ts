import { type Page } from "@playwright/test";

import { expect, test } from "./_lib/fixtures";

/**
 * 준용예외 구분자 (기능/구분자 §3.8 · ADR-0098 결정 1) — 결과 타입 「조 참조 목록」, 식 대신 후보 조(보통약관 템플릿 조).
 *
 * - 상세(시드 D0014 「준용예외」): 결과 타입 「조 참조 목록」 · 후보 조 목록(템플릿 「제N조(제목)」) · 식 칸 없음.
 * - 생성: 결과 타입 「조 참조 목록 (준용예외)」을 고르면 레벨이 담보로 고정되고 식 칸 대신 후보 칸(템플릿마다 조 체크)이 선다 → 저장하면 상세에 후보가 보인다.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "준용예외 구분자 — 후보 조 읽기 · 결과 타입 「조 참조 목록」으로 만들기",
  { annotation: { type: "좌표없음", description: "기능/구분자 §3.8 (2026-11-01)" } },
  async ({ page, ev }) => {
    await ev.action("준용예외#1", "관리자로 로그인한다", () => login(page));

    await ev.action("준용예외#2", "시드 D0014 상세 — 결과 타입 「조 참조 목록」 · 후보 조 셋 · 식 칸 없음", async () => {
      await page.goto("/catalog/D0014");
      await expect(page.getByText("조 참조 목록", { exact: true })).toBeVisible();
      const list = page.getByRole("list", { name: "후보 조" });
      await expect(list.getByRole("listitem")).toHaveCount(3);
      await expect(list).toContainText("적립부분 적립이율에 관한 사항");
      await expect(list).toContainText("중도인출");
      await expect(page.getByText("식", { exact: true })).toHaveCount(0);
    });

    await ev.action("준용예외#3", "새 구분자 — 결과 타입 「조 참조 목록 (준용예외)」를 고르면 후보 칸이 서고, 조를 골라 저장하면 상세에 후보가 보인다", async () => {
      await page.goto("/catalog/new");
      await page.locator("#new-label").fill("준용예외(시험)");
      await page.locator("#new-result-type").selectOption({ label: "조 참조 목록 (준용예외)" });
      await expect(page.locator("#new-expr")).toHaveCount(0);
      const picker = page.getByRole("group", { name: "후보 조" });
      await picker.getByLabel(/만기환급금의 지급/).first().check();
      await page.getByRole("button", { name: "생성" }).click();
      await page.waitForURL(/\/catalog\/D\d{4}$/);
      await expect(page.getByRole("list", { name: "후보 조" })).toContainText("만기환급금의 지급");
    });

    await ev.action("준용예외#4", "준용규정(알파Plus) 함수조항 — 본문에 「준용예외마다」 문장 안 반복이 서고 저장 검사 오류가 없다", async () => {
      await page.goto("/functions/C0057");
      await expect(page.getByText(/준용예외마다/).first()).toBeVisible();
      await expect(page.getByText(/함수조항 본문의 문장 안 반복에서만/)).toHaveCount(0);
    });
  },
);
