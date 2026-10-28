import { applyFrom, editForm } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";

/**
 * 생략 기준 옵션 (ADR-0093 결정 1 · 6 · 7 · 기능/상품 §3.6 · §3.8 · 기능/문면 §3.10) — 템플릿 조 폼의 「포함하면 생략」과 상품 보통약관 탭 목차 줄의 조 단위 변경.
 * 템플릿(보통약관(일반)) 제2조를 「포함하면 생략」으로 저장하고, 상품 「표본 — 기본계약 2개(주계약)」의 목차 줄 고르기가
 * 「템플릿대로(포함하면)」인 것을 본 뒤 다른 조(제6조)를 「포함하면 생략」으로 저장한다(시드에 그 조를 가리키는 연결이 없어 판정 변화 확인 모달 없음).
 * 끝에 상품 · 템플릿 둘 다 되돌린다 — 다른 spec 이 보는 시드를 바꾸지 않는다.
 */
test(
  "템플릿 조 「포함하면 생략」 · 상품 목차 줄 생략 기준 고르기 · 읽기 「포함 생략」",
  {
    annotation: {
      type: "좌표없음",
      description: "기능/상품 §3.6 · §3.8 조 생략 기준 · 기능/문면 §3.10 생략 기준 옵션 (ADR-0093 결정 1 · 6 · 7, 2026-10-28 구현) — 시나리오 좌표가 아직 없다",
    },
  },
  async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/login");
    await page.getByRole("button", { name: /admin/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    // ── 템플릿 조 폼 — 제2조 「포함하면 생략」 · 저장 한 번 → 조 위 평문
    await page.goto("/documents");
    await page.getByRole("link", { name: "보통약관(일반)", exact: true }).click();
    await page.waitForURL(/\/documents\/[0-9a-f-]{36}$/);
    const templateUrl = page.url();
    const body = page.locator(".ts-l3-body");
    const templateArticle = () => page.locator(".ts-l3-toc").getByText(/^제2조\(/).first();
    const setTemplateOmitMode = async (value: "exact" | "contained") => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
      await templateArticle().click();
      await expect(page.getByRole("toolbar", { name: "약관 편집 도구" })).toContainText("자리 — 제2조");
      await page.getByRole("toolbar", { name: "약관 편집 도구" }).getByRole("button", { name: "준용하기", exact: true }).click();
      await editForm(page, "준용하기").locator("select[name=omitMode]").selectOption(value);
      await applyFrom(page);
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible({ timeout: 60_000 });
    };
    await setTemplateOmitMode("contained");
    await templateArticle().click();
    await expect(body.getByText("생략 기준 — 포함하면 생략", { exact: true })).toBeVisible();

    // ── 상품 보통약관 탭 — 목차 줄 고르기
    await page.goto("/products");
    await page.getByRole("link", { name: "표본 — 기본계약 2개(주계약)", exact: true }).click();
    await page.waitForURL(/\/products\/[0-9a-f-]{36}/);
    const productUrl = page.url().split("?")[0]!;
    await page.goto(`${productUrl}?tab=general`);
    const toc = page.getByRole("navigation", { name: "보통약관 목차" });
    const tocRow = (n: number) => toc.locator(".ts-toc-row").filter({ has: page.getByRole("link", { name: new RegExp(`^제${n}조\\(`) }) });
    const omitSelect = (n: number) => tocRow(n).getByRole("combobox", { name: /^생략 기준 · / });
    const saveProduct = async () => {
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible({ timeout: 60_000 });
    };

    // 읽기 — 템플릿대로라 표시 없음
    await expect(tocRow(6).locator(".ts-omit-mark")).toHaveCount(0);
    await page.getByRole("button", { name: "편집", exact: true }).click();
    // 템플릿이 「포함하면」인 조는 「템플릿대로(포함하면)」
    await expect(omitSelect(2).locator("option:checked")).toHaveText("템플릿대로(포함하면)");
    await expect(omitSelect(6).locator("option:checked")).toHaveText("템플릿대로(같을 때만)");
    await omitSelect(6).selectOption("contained");
    await expect(tocRow(6).getByText("변경", { exact: true })).toBeVisible();
    await saveProduct();
    // 연결이 없는 조라 판정 변화 확인 모달 없이 저장 → 읽기 「포함 생략」
    await expect(page.getByRole("dialog", { name: "저장하면 아래 내용이 함께 바뀝니다" })).toHaveCount(0);
    await expect(tocRow(6).locator(".ts-omit-mark")).toHaveText("포함 생략");
    await expect(tocRow(2).locator(".ts-omit-mark")).toHaveCount(0);

    // ── 되돌리기 — 상품(템플릿대로) · 템플릿(같을 때만)
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await omitSelect(6).selectOption("template");
    await saveProduct();
    await expect(tocRow(6).locator(".ts-omit-mark")).toHaveCount(0);
    await page.goto(templateUrl);
    await setTemplateOmitMode("exact");
    await templateArticle().click();
    await expect(body.getByText("생략 기준 — 포함하면 생략", { exact: true })).toHaveCount(0);
  },
);
