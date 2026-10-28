import { applyFrom, editForm } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";

/**
 * 절 형태 ⑤ 화면 — 판정 배지 · 조연결 현황 · 준용하기 옵션 → 판정 변화 · 판정 변화 영향 카드 (기능/상품 §3.12 · §4.6 · §3.8, ADR-0082 결정 5 · 11).
 * 합성 표본 「표본 — 독립특약 블록 2개」(같은 담보약관 두 블록 — 지급사유 · 세부규정 위임 2/2)와 「표본 — 기본계약 2개(주계약)」(일부 연결 1/2 = 특칙).
 * 템플릿(보통약관(일반)) 제4조의 준용하기 옵션을 「전체항 모으기」로 저장해 판정이 바뀌는 것을 보고, 끝에 「없음」으로 되돌린다.
 * 상품담보 탭은 저장하지 않고 취소한다 — 다른 spec 이 보는 시드 상품을 바꾸지 않는다.
 */
test(
  "판정 배지 · 조연결 현황 · 준용하기 옵션으로 판정이 바뀐다 · 상품담보 탭 저장의 판정 변화 영향 카드",
  {
    annotation: {
      type: "좌표없음",
      description: "기능/상품 §3.12 · §4.6 판정 배지 · 조연결 현황 · §3.8 영향 카드 · 기능/문면 §4 준용하기 옵션 (ADR-0082 결정 5 · 11, 2026-10-18 ⑤ 구현) — 시나리오 좌표가 아직 없다",
    },
  },
  async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/login");
    await page.getByRole("button", { name: /admin/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    const open = async (name: string) => {
      await page.goto("/products");
      await page.getByRole("link", { name, exact: true }).click();
      await page.waitForURL(/\/products\/[0-9a-f-]{36}/);
      return page.url().split("?")[0]!;
    };
    const twoBlocks = await open("표본 — 독립특약 블록 2개");
    const twoBases = await open("표본 — 기본계약 2개(주계약)");
    const toc = page.getByRole("navigation", { name: "보통약관 목차" });
    const tocRow = (n: number) => toc.locator(".ts-toc-row").filter({ has: page.getByRole("link", { name: new RegExp(`^제${n}조\\(`) }) });

    // ── 판정 배지 · 잠김 — 독립특약 블록 2개: 지급사유 · 세부규정 위임 2/2
    await page.goto(`${twoBlocks}?tab=general`);
    await expect(tocRow(3).getByLabel("이 상품 판정 · 위임 2/2")).toBeVisible();
    await expect(tocRow(3).getByText("잠김", { exact: true })).toBeVisible();
    await expect(tocRow(4).getByLabel("이 상품 판정 · 위임 2/2")).toBeVisible();
    // 마스터 조는 배지가 없다
    await expect(tocRow(1).locator(".ts-verdict-badge")).toHaveCount(0);

    // ── 조연결 현황 — 위 한 줄 [조연결 현황] 으로 편다. 열 = 블록 머리 · 이름, 행 끝 판정 · k/N
    const statusButton = page.getByRole("button", { name: "조연결 현황", exact: true });
    await statusButton.click();
    const status = page.getByRole("region", { name: "조연결 현황" });
    await expect(status.getByRole("columnheader", { name: "Ⅰ-1. 일반상해80%이상후유장해", exact: true })).toBeVisible();
    await expect(status.getByRole("columnheader", { name: "Ⅰ-2. 일반상해80%이상후유장해 추가", exact: true })).toBeVisible();
    const statusRow = (n: number) => status.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^제${n}조\\(`) }) });
    await expect(statusRow(3).getByRole("cell").last()).toHaveText("위임 2/2");
    await expect(statusRow(4).getByRole("cell").first()).toHaveText("없음");
    await statusButton.click();
    await expect(status).toHaveCount(0);

    // ── 준용하기 옵션 — 템플릿 문면 편집기의 조 속성(제4조 → 전체항 모으기) · 저장 한 번
    await page.goto("/documents");
    await page.getByRole("link", { name: "보통약관(일반)", exact: true }).click();
    await page.waitForURL(/\/documents\/[0-9a-f-]{36}$/);
    const templateUrl = page.url();
    const body = page.locator(".ts-l3-body");
    const setJoinMode = async (open: () => Promise<void>, value: "all" | "none") => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
      await open();
      const form = editForm(page, "준용하기");
      await form.locator("select[name=joinMode]").selectOption(value);
      await applyFrom(page);
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible({ timeout: 60_000 });
    };
    await setJoinMode(async () => {
      // 목차로 조를 열고(가운데는 조 하나) 툴바 「고른 것 속성」의 「준용하기」
      await page.locator(".ts-l3-toc").getByText(/^제4조\(보험금 지급에 관한 세부/).click();
      await expect(page.getByRole("toolbar", { name: "약관 편집 도구" })).toContainText("자리 — 제4조");
      await page.getByRole("toolbar", { name: "약관 편집 도구" }).getByRole("button", { name: "준용하기", exact: true }).click();
    }, "all");
    await page.locator(".ts-l3-toc").getByText(/^제4조\(보험금 지급에 관한 세부/).click();
    await expect(body.getByText("준용하기 — 전체항 모으기", { exact: true })).toBeVisible();

    // ── 판정이 바뀐다 — 블록 2개: 제4조 위임 2/2 → 전체항 합침, 모델링 조 머리에 옵션 표시
    await page.goto(`${twoBlocks}?tab=general`);
    await expect(tocRow(4).getByLabel("이 상품 판정 · 전체항 합침")).toBeVisible();
    await tocRow(4).getByRole("link").click();
    await expect(page.locator(".ts-terms-panel").getByText("준용하기 — 전체항 모으기", { exact: true }).first()).toBeVisible();
    // 기본계약 2개: 제4조 일부 연결 1/2 + 옵션 → 특칙 + 일부 연결 경고 아이콘(목차 · 조연결 현황)
    await page.goto(`${twoBases}?tab=general`);
    await expect(tocRow(4).getByLabel("이 상품 판정 · 특칙 1/2")).toBeVisible();
    const warn = tocRow(4).getByRole("img", { name: /^일부 연결 경고 · 제4조/ });
    await expect(warn).toBeVisible();
    await expect(warn).toHaveAttribute("title", /연결되지 않은 담보: 일반상해사망보장/);
    await page.getByRole("button", { name: "조연결 현황", exact: true }).click();
    await expect(statusRow(4).getByRole("cell").first()).toHaveText("전체항 모으기");
    await expect(statusRow(4).getByRole("link", { name: "연결 안 함" })).toBeVisible();

    // ── 템플릿 되돌리기 — 「없음」
    await page.goto(templateUrl);
    await setJoinMode(async () => {
      // 조 바로 위 「준용하기 — …」 평문을 눌러 고친다(편집 중)
      await page.locator(".ts-l3-toc").getByText(/^제4조\(보험금 지급에 관한 세부/).click();
      await body.getByRole("button", { name: "준용하기 — 전체항 모으기", exact: true }).click();
    }, "none");
    await expect(body.getByText("준용하기 — 전체항 모으기", { exact: true })).toHaveCount(0);

    // ── 판정 변화 영향 카드 — 블록 하나를 탑재 해제하면 확인 모달에 「위임 2/2 → 위임 1/1」. 저장하지 않는다
    await page.goto(`${twoBlocks}?tab=coverages`);
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await page.getByRole("button", { name: "탑재 해제 · 일반상해80%이상후유장해 추가", exact: true }).click();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "저장하면 아래 내용이 함께 바뀝니다" });
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toContainText("판정이 바뀌는 조");
    await expect(dialog.getByText(/^제3조\(보험금의 지급사유\) — 위임 2\/2 → 위임 1\/1$/)).toBeVisible();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    // 고친 것(탑재 해제 표시)을 버리고 읽기로
    await page.getByRole("button", { name: "편집 취소", exact: true }).click();
    await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
    await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
  },
);
