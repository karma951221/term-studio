import { applyFrom, editForm } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";

/**
 * 문서 저장의 판정 변화 영향 카드 (ADR-0082 결정 11 · ADR-0098 결정 7 · 기능/조립산출 §5) — 담보약관 저장이 그 담보를 탑재한 상품의 판정을 바꾸면
 * 저장 확인 모달(role=dialog)에 상품마다 판정 변화 묶음이 선다. 시드 「일반상해사망보장 특별약관」은 조연결이 없다 — 제1조를 템플릿
 * 「적립부분 적립이율에 관한 사항」(준용예외 D0014 후보)에 이으면 그 특약의 준용예외에서 그 조가 빠진다.
 * 저장하지 않고 취소한다 — 다른 spec 이 보는 시드를 바꾸지 않는다. `SHOT_DIR` 이 있으면 모달을 찍는다(`SHOT_SCHEME` light · dark).
 */
test(
  "담보약관 저장이 준용예외를 바꾸면 확인 모달에 「상품 · 특약 — 준용예외에 제N조 빠짐」",
  { annotation: { type: "좌표없음", description: "기능/조립산출 §5 판정 변화 영향 카드 — 문서 저장 (ADR-0082 결정 11 · ADR-0098 결정 7, 2026-11-02) — 시나리오 좌표가 아직 없다" } },
  async ({ page }) => {
    test.setTimeout(240_000);
    const shot = process.env.SHOT_DIR;
    const scheme = process.env.SHOT_SCHEME ?? "light";
    if (scheme === "dark") await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    await page.getByRole("button", { name: /admin/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto(`/documents?kind=coverage&q=${encodeURIComponent("일반상해사망보장 특별약관")}`);
    await expect(page.getByRole("link", { name: "일반상해사망보장 특별약관", exact: true })).toHaveCount(1);
    await page.getByRole("link", { name: "일반상해사망보장 특별약관", exact: true }).click();
    await page.waitForURL(/\/documents\/[0-9a-f-]{36}$/);

    // 편집 → 제1조를 고르고 툴바 「보통약관 조 연결」 → 편집 탭 조연결 폼에서 템플릿 조를 골라 적용
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
    await page.locator(".ts-l3-toc").getByText(/^제1조\(/).first().click();
    await page.getByRole("toolbar", { name: "약관 편집 도구" }).getByRole("button", { name: "보통약관 조 연결", exact: true }).click();
    const form = editForm(page, "조연결");
    const combo = form.getByRole("combobox");
    await expect(async () => {
      await combo.click();
      await combo.fill("적립이율");
      await expect(combo).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await page.locator(`[id="${await combo.getAttribute("aria-controls")}"]`).getByRole("option").first().click();
    await applyFrom(page);

    // 저장 → 확인 모달: 상품마다 묶음 · 준용예외 줄 · 절 형태 상품은 판정 줄
    await page.getByRole("button", { name: "저장", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "저장하면 아래 내용이 함께 바뀝니다" });
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toContainText("이 문서를 쓰는 상품 3개에서 판정이 바뀝니다");
    await expect(dialog).toContainText("준용예외가 바뀌는 특약");
    await expect(dialog.getByText("알파Plus보장보험 · 일반상해사망보장 — 준용예외에 제11조(적립부분 적립이율에 관한 사항) 빠짐", { exact: true })).toBeVisible();
    await expect(dialog.getByText("제11조(적립부분 적립이율에 관한 사항) — 마스터 → 특칙 1/2", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "바꾸고 저장", exact: true })).toBeVisible();
    if (shot) {
      // 열리는 애니메이션이 끝난 뒤 찍는다
      await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      await page.screenshot({ path: `${shot}/document-judgment-impact-${scheme}.png` });
    }

    // 취소 — 저장하지 않고 편집을 버린다
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: /^편집 취소/ }).click();
    await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
    await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
  },
);
