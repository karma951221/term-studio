import { expect, test } from "./_lib/fixtures";

/**
 * 독립특약 상품의 상품담보 탭 — 「보장조항」 표 하나 (기능/상품 §4.5 · §6.2, 2026-11-01).
 * 시드 표본 「표본 — 독립특약 블록 2개」 · 「표본 — 기본계약 2개(주계약)」(주계약은 기본계약 · 특별약관 두 표 그대로).
 * 읽기 · 편집 모두 기본계약 표가 없고 행(블록)마다 「그룹」 열이 있다. SHOT_DIR 이 있으면 화면을 찍는다.
 */
async function openCoverages(page: import("@playwright/test").Page, productName: string): Promise<void> {
  await page.goto("/products");
  await page.getByRole("link", { name: productName, exact: true }).click();
  await page.waitForURL(/\/products\/[0-9a-f-]{36}/);
  const productUrl = page.url().split("?")[0]!;
  await page.goto(`${productUrl}?tab=coverages`);
  await page.waitForLoadState("networkidle");
}

test(
  "독립특약 상품담보 탭 — 「보장조항」 표 하나(그룹 열) · 기본계약 표 없음, 주계약은 두 표 그대로",
  { annotation: { type: "좌표없음", description: "기능/상품 §4.5 독립특약 「보장조항」 표 — 시나리오 좌표 없음" } },
  async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/login");
    await page.getByRole("button", { name: /admin/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    const shot = process.env.SHOT_DIR;
    const scheme = process.env.SHOT_SCHEME ?? "light";
    if (scheme === "dark") await page.emulateMedia({ colorScheme: "dark" });

    await openCoverages(page, "표본 — 독립특약 블록 2개");
    const table = page.getByRole("region", { name: "보장조항" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "그룹" })).toBeVisible();
    expect(await table.locator("tbody tr").count()).toBeGreaterThan(0);
    await expect(page.getByRole("region", { name: "기본계약", exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "특별약관", exact: true })).toHaveCount(0);
    if (shot) await page.screenshot({ path: `${shot}/standalone-read-${scheme}.png`, fullPage: true });

    await page.getByRole("button", { name: "편집", exact: true }).click();
    await expect(page.getByRole("button", { name: "보장조항에 담보 추가" })).toBeVisible();
    await expect(page.getByText("독립특약 상품은 기본계약을 두지 않습니다")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "기본계약", exact: true })).toHaveCount(0);
    if (shot) await page.screenshot({ path: `${shot}/standalone-edit-${scheme}.png`, fullPage: true });

    await openCoverages(page, "표본 — 기본계약 2개(주계약)");
    await expect(page.getByRole("region", { name: "기본계약", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "특별약관", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "보장조항", exact: true })).toHaveCount(0);
  },
);
