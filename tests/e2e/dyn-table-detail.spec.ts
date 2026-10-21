import { type Page } from "@playwright/test";

import { expect, test } from "./_lib/fixtures";

/**
 * 동적표 상세 — 견본 표 · 칸 ↔ 필드 강조 (기능/동적표 §4.2).
 * 시드 DT000001 「감액 지급금액 표」를 연다. 견본 「감액 3구간」이면 열 머리글이 첫 · 가운데 · 마지막, 「감액 없음」이면 단일 열 하나.
 * 칸을 누르면 같은 영역 칸 전부와 오른쪽 그 필드가 강조되고, 다시 누르면 풀린다. 필드에 들어가면 표의 그 영역이 칠해진다.
 * 편집 중 템플릿을 고치면 저장 전에 표가 바로 바뀐다. 저장하지 않으므로 시드는 그대로다.
 * 배치는 세 섹션 기본 → 인자(읽기 전용 표) → 구조(2단: 미리보기 · 영역별 템플릿) — 앱 오른쪽 창 폭(640px)에서도 구조는 2단이다.
 * 인자는 편집 모드에서도 고치지 않는다. 열 기준은 없다 — DT000002 는 첫 · 가운데 · 마지막을 비운 단일형이라 읽기 모드에 단일 열 줄만 있다.
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

    await ev.action("동적표상세#7", "편집 — 구분 칸 머리글을 고치면 저장 전에 표가 바로 바뀌고, 인자는 편집 중에도 읽기 전용 표, 취소하면 원래대로", async () => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      const params = page.getByRole("table", { name: "인자 목록" });
      await expect(params.locator("thead th")).toHaveText(["이름", "타입", "값을 대는 곳", "쓰이는 곳"]);
      await expect(params.locator("tbody tr")).toHaveText([/갱신형\s*참거짓\s*담보약관에서 연결\s*첫 열 · 가운데 열 · 마지막 열/]);
      await expect(page.getByLabel("새 인자 이름")).toHaveCount(0);
      await expect(params.locator("input, select")).toHaveCount(0);
      await page.locator("#dyn-rowheader").fill("구분");
      await expect(headerCells.first()).toHaveText("구분");
      await page.getByRole("button", { name: /편집 취소/ }).click();
      await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await expect(headerCells.first()).toHaveText("구 분");
    });

    await ev.action("동적표상세#8", "배치 — 기본 → 인자 → 구조 세 섹션, 앱 오른쪽 창 폭(640px)에서도 미리보기 · 템플릿이 나란히", async () => {
      await page.setViewportSize({ width: 640, height: 900 });
      // 미리보기는 sticky — 맨 위로 되돌린 뒤 잰다
      await page.locator(".ts-l3-body").evaluate((el) => el.scrollTo(0, 0));
      const box = async (selector: string) => {
        const b = await page.locator(selector).first().boundingBox();
        if (!b) throw new Error(`${selector} 가 보이지 않는다`);
        return b;
      };
      const basics = await box(".ts-dyn-basics");
      const params = await box(".ts-dyn-params-table");
      const sample = await box(".ts-dyn-sample");
      const panel = await box(".ts-dyn-panel");
      expect(basics.y).toBeLessThan(params.y);
      expect(params.y).toBeLessThan(sample.y);
      expect(sample.x + sample.width).toBeLessThanOrEqual(panel.x);
      expect(Math.abs(sample.y - panel.y)).toBeLessThan(4);
      await expect(page.locator(".ts-dyn-section-title")).toHaveText(["기본", "인자", "구조"]);
      await expect(page.locator(".ts-dyn-page")).not.toContainText("열 기준");
    });

    await ev.action("동적표상세#9", "DT000002 — 인자 없음 한 줄, 단일형이라 읽기 모드 열 머리글 필드는 단일 열 하나 · 감액 3구간 견본도 열 하나", async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/dyntables/DT000002");
      await expect(page.locator(".ts-dyn-params-none")).toHaveText("인자 없음");
      await expect(page.locator('[data-dyn-field="single"]')).toBeVisible();
      await expect(page.locator('[data-dyn-field="first"]')).toHaveCount(0);
      await expect(headerCells).toHaveText(["구 분", "지급금액"]);
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(page.locator('[data-dyn-field="first"]')).toBeVisible();
      await page.getByRole("button", { name: /편집 취소/ }).click();
    });
  },
);
