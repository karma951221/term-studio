import type { Page } from "@playwright/test";

import { expect, test } from "./_lib/fixtures";

/**
 * 담보 상세 — 중첩 카드 그리드 (기능/담보 §3.6 · §4, 2026-09-27 aaf753c · 07b93ba).
 * 시드 담보 「수술비(1-7종, 연간3회한)[상해]보장」(세부보장 7 — 「N종 상해수술비(연간3회한)」)로:
 * - 조회만으로(아무것도 누르지 않고) 세부보장 7개가 다 보인다 — 접혀 있지 않다.
 * - 데스크톱 너비에서 세부보장 카드가 한 줄에 2개 이상 선다(그리드).
 * - 담보약관 템플릿 띠가 없다. 담보 본문은 라벨 열 하나 — 「담보」(이름) · 「담보분류」가 같은 세로줄, 보험금명 줄은 없다 (2026-10-21).
 * - 편집 모드: 라벨 행 「세부보장 ⊕」 · 「급부 ⊕」 · ⊖ 가 보이고, 「특성 ⊕」 메뉴에서 면책을 고르면 면책 박스가 열린다.
 * - 지급률: 읽기 모드엔 값이 없으면 자리가 없고, 편집 모드 급부 이름 줄 「지급률 ⊕」로 칸이 생긴다 (2026-10-21).
 * - 최초1회한(pay.first_only)은 어디에도 없다 (2026-09-27 삭제).
 * 전제: `npm run db:seed` 로 관통 1 시드가 들어간 개발 DB — 시드 담보 · 문서는 건드리지 않는다(취소로 마친다).
 */

const COVERAGE_NAME = "수술비(1-7종, 연간3회한)[상해]보장";
const SUB_NAMES = Array.from({ length: 7 }, (_, i) => `${i + 1}종 상해수술비(연간3회한)`);

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "담보 상세: 세부보장 7개가 접힘 없이 그리드로 보이고, 편집 모드에서만 구조 조작이 나온다",
  { annotation: { type: "좌표없음", description: "기능/담보 §3.6 · §4 — 중첩 카드 그리드 · 접지 않는다 · 담보약관 띠 없음" } },
  async ({ page, ev }) => {
    test.setTimeout(60_000);
    await ev.action("담보카드#1", "관리자로 로그인한다", () => login(page));

    await ev.action("담보카드#2", "담보 조회에서 「수술비(1-7종, 연간3회한)[상해]보장」을 검색해 연다", async () => {
      await page.goto("/coverages");
      // 검색칸은 sr-only 라벨 「검색」으로 접근한다 — placeholder 문구는 코드 열이 생기며 바뀔 수 있다.
      await page.getByRole("searchbox", { name: "검색" }).fill("수술비(1-7종");
      // 검색은 주소(?q=)를 바꾼다 — 그 이동이 끝난 뒤 눌러야 클릭이 묻히지 않는다.
      await page.waitForURL(/[?&]q=/);
      const link = page.getByRole("link", { name: COVERAGE_NAME, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/coverages\/[0-9a-f-]{36}$/);
    });

    await ev.action("담보카드#3", "아무것도 누르지 않아도 세부보장 7개 · 급부 이름이 다 보인다 — 접힘(▸/▾)이 없다", async () => {
      for (const name of SUB_NAMES) await expect(page.locator(".ts-cov-card-name", { hasText: name }).first()).toBeVisible();
      await expect(page.locator("section.ts-cov-card[data-level='subCoverage']")).toHaveCount(7);
      await expect(page.locator("section.ts-cov-card[data-level='benefit']")).toHaveCount(7);
      // 카드의 접힘만 센다 — 목록 패널의 「패널 접기」(ADR-0094)는 카드가 아니다
      await expect(page.locator(".ts-ld-body").getByRole("button", { name: /펼치기|접기/ })).toHaveCount(0);
    });

    await ev.action("담보카드#4", "담보약관 템플릿 띠 · 「미결정」 배지가 없다", async () => {
      await expect(page.locator(".ts-cov-band")).toHaveCount(0);
      await expect(page.getByText("미결정")).toHaveCount(0);
    });

    await ev.action("담보카드#4b", "담보 본문은 라벨 열 하나 — 「담보」 이름 줄과 「담보분류」 줄이 같은 세로줄에서 시작하고 보험금명 줄 · 폼 상자가 없다", async () => {
      const coverageCard = page.locator("section.ts-cov-card[data-level='coverage']");
      const body = coverageCard.locator(":scope > .ts-cov-card-body");
      await expect(coverageCard.getByText("보험금명")).toHaveCount(0);
      await expect(coverageCard.locator("fieldset.ts-form-card")).toHaveCount(0);
      const name = await body.locator(":scope > .ts-cov-name-row .ts-form-control").boundingBox();
      const category = await body.locator("[data-path='category'] .ts-form-control").boundingBox();
      expect(name && category, "두 줄이 화면에 있어야 한다").toBeTruthy();
      expect(Math.abs(name!.x - category!.x)).toBeLessThan(2);
    });

    await ev.action("담보카드#4c", "읽기 모드 급부 카드에는 값 없는 지급률 자리 · 면책여부 행이 없다", async () => {
      const benefits = page.locator("section.ts-cov-card[data-level='benefit']");
      await expect(benefits.locator("[data-path='pay.exempt']")).toHaveCount(0);
      await expect(benefits.locator("[data-path='pay.rate']")).toHaveCount(0);
      await expect(benefits.first().getByText("면책여부", { exact: true })).toHaveCount(0);
      await expect(benefits.first().getByText("지급률", { exact: true })).toHaveCount(0);
      // 최초1회한(pay.first_only)은 마스터에서 빠졌다 (2026-09-27)
      await expect(page.locator("main").getByText("최초1회한")).toHaveCount(0);
    });

    await ev.action("담보카드#5", "데스크톱 너비 — 세부보장 카드가 한 줄에 2개 이상(그리드) 선다", async () => {
      const cards = page.locator("section.ts-cov-card[data-level='subCoverage']");
      const box0 = await cards.nth(0).boundingBox();
      const box1 = await cards.nth(1).boundingBox();
      expect(box0, "첫 세부보장 카드가 화면에 있어야 한다").not.toBeNull();
      expect(box1, "둘째 세부보장 카드가 화면에 있어야 한다").not.toBeNull();
      // 같은 줄이면 y 가 거의 같고 x 는 다르다 (2열 그리드)
      expect(Math.abs(box0!.y - box1!.y)).toBeLessThan(4);
      expect(Math.abs(box0!.x - box1!.x)).toBeGreaterThan(50);
    });

    await ev.action("담보카드#6", "편집을 누르면 카드마다 ⊖ · 담보 본문 「세부보장 ⊕」 · 세부보장마다 「급부 ⊕」 라벨 행이 보인다 — 점선 타일은 없다", async () => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "세부보장 추가", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /에 급부 추가$/ })).toHaveCount(7);
      await expect(page.locator(".ts-cov-add-tile")).toHaveCount(0);
      await expect(page.locator("button.ts-cov-remove")).toHaveCount(14); // 세부보장 7 + 급부 7
    });

    await ev.action("담보카드#7", "첫 급부의 「특성 ⊕」 메뉴 — 감액 · 면책 · 통합치료비 · 체증 중 면책을 고르면 면책 박스가 열리고 메뉴엔 감액 · 통합치료비 · 체증만 남는다", async () => {
      const firstBenefit = page.locator("section.ts-cov-card[data-level='benefit']").first();
      await firstBenefit.getByRole("button", { name: "특성 추가", exact: true }).click();
      await expect(firstBenefit.getByRole("menuitem")).toHaveText(["감액", "면책", "통합치료비", "체증"]);
      await firstBenefit.getByRole("menuitem", { name: "면책", exact: true }).click();
      await expect(firstBenefit.getByRole("group", { name: "면책" })).toBeVisible();
      await expect(firstBenefit.locator('input[name="exemption.months"]')).toHaveCount(1);
      await firstBenefit.getByRole("button", { name: "특성 추가", exact: true }).click();
      await expect(firstBenefit.getByRole("menuitem")).toHaveText(["감액", "통합치료비", "체증"]);
      await firstBenefit.getByRole("button", { name: "특성 추가", exact: true }).click();
    });

    await ev.action("담보카드#7b", "첫 급부 이름 줄의 「지급률 ⊕」를 누르면 그 자리에 지급률 칸 + ⊖ 가 열리고, ⊖ 로 닫으면 다시 ⊕ 다", async () => {
      const firstBenefit = page.locator("section.ts-cov-card[data-level='benefit']").first();
      const head = firstBenefit.locator(":scope > .ts-cov-card-head");
      await expect(firstBenefit.locator('input[name="pay.rate"]')).toHaveCount(0);
      await head.getByTitle("지급률 추가").click();
      await expect(head.locator('input[name="pay.rate"]')).toHaveCount(1);
      await head.getByRole("button", { name: "지급률 빼기 — 값을 지운다(100%)" }).click();
      await expect(head.locator('input[name="pay.rate"]')).toHaveCount(0);
      await expect(head.getByTitle("지급률 추가")).toBeVisible();
      await expect(firstBenefit.getByText("면책여부", { exact: true })).toHaveCount(0);
      // 편집 모드에도 최초1회한 칸 · 버튼이 없다
      await expect(page.locator("main").getByText("최초1회한")).toHaveCount(0);
      await expect(page.locator('[data-path="pay.first_only"]')).toHaveCount(0);
    });

    await ev.action("담보카드#8", "취소 — 시드 담보를 바꾸지 않고 편집을 버린다", async () => {
      await page.getByRole("button", { name: "편집 취소", exact: true }).click();
      // 면책 폼을 열어 변경이 있다 — 「고친 내용을 버립니까?」를 거친다
      await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await page.reload();
      await expect(page.locator("section.ts-cov-card[data-level='subCoverage']")).toHaveCount(7);
    });
  },
);
