import { type Page } from "@playwright/test";

import { expect, test } from "./_lib/fixtures";

/**
 * 동적표 상세 — 견본 표 · 칸 ↔ 필드 강조 (기능/동적표 §4.2).
 * 시드 DT000001 「감액 지급금액 표」를 연다. 견본 「감액 3구간」이면 열 머리글이 첫 · 가운데 · 마지막, 「감액 없음」이면 단일 열 하나.
 * 칸을 누르면 같은 영역 칸 전부와 오른쪽 그 필드가 강조되고, 다시 누르면 풀린다. 필드에 들어가면 표의 그 영역이 칠해진다.
 * 편집 중 템플릿을 고치면 저장 전에 표가 바로 바뀐다. 저장하지 않으므로 시드는 그대로다.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "동적표 상세 — 칸을 누르면 그 필드가 강조되고, 견본을 바꾸면 열 수가 바뀐다",
  { annotation: { type: "좌표없음", description: "기능/동적표 §4.2 견본 표 · 칸 ↔ 필드 — 시나리오 파일이 아직 없다" } },
  async ({ page, ev }) => {
    await ev.action("동적표상세#1", "관리자로 로그인한다", () => login(page));

    const table = page.getByRole("table", { name: /견본 「.*」으로 펼친 표/ });
    const headerCells = table.locator("thead th");

    await ev.action("동적표상세#2", "DT000001 을 열면 견본 「감액 3구간」 표 — 구분 칸 + 첫 · 가운데 · 마지막 열", async () => {
      await page.goto("/dyntables/DT000001");
      await expect(page.getByLabel("견본", { exact: true })).toHaveValue("reduction3");
      await expect(headerCells).toHaveCount(4);
      await expect(headerCells).toHaveText(["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후 계약일부터 2년경과시점 전일 이전", "계약일부터 2년경과시점 이후"]);
      await expect(table.locator("tbody tr").first().locator("th, td")).toHaveText(["사망보험금", "보험가입금액의 25%", "보험가입금액의 50%", "보험가입금액의 100%"]);
    });

    await ev.action("동적표상세#3", "셀 칸을 누르면 셀 칸 전부와 오른쪽 「셀 템플릿」 필드가 강조, 다시 누르면 풀린다", async () => {
      const cellButton = table.locator('td[data-region="cell"] button').first();
      await cellButton.click();
      await expect(cellButton).toHaveAttribute("aria-pressed", "true");
      await expect(table.locator('td[data-region="cell"].is-on')).toHaveCount(3);
      await expect(page.locator('[data-dyn-field="cell"]')).toHaveClass(/is-on/);
      await expect(page.locator('[data-dyn-field="first"]')).not.toHaveClass(/is-on/);
      await cellButton.click();
      await expect(cellButton).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator('[data-dyn-field="cell"]')).not.toHaveClass(/is-on/);
    });

    await ev.action("동적표상세#4", "오른쪽 「가운데 열」 필드를 누르면 표의 가운데 열 머리글이 칠해진다", async () => {
      await page.locator('[data-dyn-field="middle"] .ts-dyn-field-label').click();
      await expect(table.locator('th[data-region="middle"]')).toHaveClass(/is-on/);
    });

    await ev.action("동적표상세#5", "견본 「감액 없음」 — 열이 하나(단일 열), 첫 · 가운데 · 마지막 필드는 「이 견본엔 없음」", async () => {
      await page.getByLabel("견본", { exact: true }).selectOption("noReduction");
      await expect(headerCells).toHaveText(["구 분", "지급금액"]);
      await expect(page.locator('[data-dyn-field="first"]')).toContainText("이 견본엔 없음");
      await expect(page.locator('[data-dyn-field="single"]')).not.toContainText("이 견본엔 없음");
    });

    await ev.action("동적표상세#6", "견본 「급부 여럿」 — 경계 합집합으로 열 셋 · 급부마다 한 행", async () => {
      await page.getByLabel("견본", { exact: true }).selectOption("multiBenefit");
      await expect(headerCells).toHaveCount(4);
      await expect(table.locator("tbody tr")).toHaveCount(2);
      await expect(table.locator("tbody tr").nth(1).locator("th, td")).toHaveText(["급성심근경색진단비", "해당보장의 보험가입금액의 6%", "해당보장의 보험가입금액의 12%", "해당보장의 보험가입금액의 20%"]);
    });

    await ev.action("동적표상세#7", "편집 — 구분 칸 머리글을 고치면 저장 전에 표가 바로 바뀌고, 취소하면 원래대로", async () => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await page.locator("#dyn-rowheader").fill("구분");
      await expect(headerCells.first()).toHaveText("구분");
      await page.getByRole("button", { name: /편집 취소/ }).click();
      await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await expect(headerCells.first()).toHaveText("구 분");
    });
  },
);
