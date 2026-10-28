import { expect, test } from "./_lib/fixtures";

/**
 * 연결 조 사본 잠금 · 회색 사본 · 블록 지정 참조 (ADR-0082 결정 10 · 12 · 기능/상품 §3.10 · §4.6) — 합성 표본 「표본 — 기본계약 2개(주계약)」.
 * 시드: 일반상해80%이상후유장해(기본계약)가 제3조 · 제4조에 조연결 → 두 조가 잠긴다. 제4조에는 기본계약 지정 전에 만든 사본(회색)이 있다.
 * 제25조(계약의 소멸)는 상품 사본 + 블록 지정 참조(①은 블록 1 제1조, ②는 블록 2 전체).
 * 편집은 저장하지 않고 취소한다 — 다른 spec 이 보는 시드 상품을 바꾸지 않는다.
 */
test(
  "사본 잠금: 잠긴 조는 읽기만 · 회색 사본 경고 · 계약 소멸 사본에 블록 지정 참조 넣기",
  {
    annotation: {
      type: "좌표없음",
      description: "기능/상품 §4.6 조 편집 패널 잠금 · 회색 사본 · 블록 지정 참조(ADR-0082 결정 10 · 12, 2026-10-17 ③ 구현) — 시나리오 좌표가 아직 없다",
    },
  },
  async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/login");
    await page.getByRole("button", { name: /admin/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/products");
    await page.getByRole("link", { name: "표본 — 기본계약 2개(주계약)", exact: true }).click();
    await page.waitForURL(/\/products\/[0-9a-f-]{36}/);
    const productUrl = page.url().split("?")[0]!;
    await page.goto(`${productUrl}?tab=general`);

    const toc = page.getByRole("navigation", { name: "보통약관 목차" });
    // 읽기 — 회색 사본은 회색 점(빨강 아님)
    await expect(toc.getByRole("img", { name: /^쓰이지 않는 사본 · 제4조\(보험금 지급에 관한 세부규정\)/ })).toBeVisible();
    await expect(toc.getByRole("img", { name: /^이 상품 사본 · 제4조/ })).toHaveCount(0);
    // 미리보기(조립)에는 회색 사본 문장이 없다
    await expect(page.getByText("이 상품이 잠기기 전에 고친 세부규정 문장입니다.")).toHaveCount(0);

    await page.getByRole("button", { name: "편집", exact: true }).click();
    const panel = page.locator(".ts-copy-editor");

    // ── 잠긴 조(사본 없음) — 안내 · 툴바 없음
    await toc.getByRole("link", { name: /^제3조\(보험금의 지급사유\)/ }).click();
    await expect(panel.locator(".ts-copy-locked")).toHaveText("잠김 — 블록 1개(「일반상해80%이상후유장해」)가 조연결한 조라 이 상품에서 고칠 수 없습니다 — 이 상품 판정 = 특칙 1/2");
    await expect(panel.getByRole("toolbar", { name: "약관 편집 도구" })).toHaveCount(0);

    // ── 회색 사본 — 회색 본문 · 경고 · 「템플릿대로 되돌리기」
    await toc.getByRole("link", { name: /^제4조\(/ }).click();
    await expect(panel.locator(".ts-copy-locked")).toContainText("잠김 — 블록 1개");
    await expect(panel.getByText("이 사본은 쓰이지 않습니다", { exact: true })).toBeVisible();
    await expect(panel.locator(".ts-copy-editor-body.is-gray")).toContainText("이 상품이 잠기기 전에 고친 세부규정 문장입니다.");
    await expect(panel.getByRole("button", { name: "템플릿대로 되돌리기", exact: true })).toBeVisible();

    // ── 계약 소멸 사본 — 블록 지정 참조 칩 · 넣기
    await toc.getByRole("link", { name: /\(계약의 소멸\)/ }).click();
    await expect(panel.locator("[data-chip]").filter({ hasText: "제2절 보장조항 1. 일반상해80%이상후유장해 제1조(보험금의 지급사유)" })).toHaveCount(1);
    await expect(panel.locator("[data-chip]").filter({ hasText: "제2절 보장조항 2. 일반상해사망보장" })).toHaveCount(1);
    const paragraphs = panel.getByRole("textbox", { name: "항", exact: true });
    await paragraphs.nth(2).click();
    await paragraphs.nth(2).press("End");
    await panel.getByRole("toolbar", { name: "약관 편집 도구" }).getByRole("button", { name: "조 참조", exact: true }).click();
    await page.getByRole("menuitem", { name: "블록 지정 참조…", exact: true }).click();
    const d = page.getByRole("dialog", { name: "블록 지정 참조 넣기" });
    await expect(d).toBeVisible();
    await d.getByLabel("대상 블록").selectOption({ label: "2. 일반상해사망보장 — 블록 전체" });
    await d.getByRole("button", { name: "넣기", exact: true }).click();
    await expect(d).toHaveCount(0);
    await expect(panel.locator("[data-chip]").filter({ hasText: "제2절 보장조항 2. 일반상해사망보장" })).toHaveCount(2);

    // 저장하지 않는다 — 시드 그대로
    await page.getByRole("button", { name: "편집 취소", exact: true }).click();
  },
);
