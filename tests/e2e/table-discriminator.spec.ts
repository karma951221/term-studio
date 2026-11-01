import { type Locator, type Page } from "@playwright/test";

import { pickCombo } from "./_lib/combo";
import { editForm, insertFrom } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";
import { productWithSpecial } from "./_lib/product";

/**
 * 표 구분자 — 지급금액 표는 시스템이 정의하는 구분자(일반 · 갱신 한 쌍)다 (기능/구분자 §3.7 · §4.5, ADR-0099).
 * 동적표 정의 객체(/dyntables · 인자 연결)를 대체한다 — 인수 케이스 1(옛 dyn-table.spec)을 표 구분자로 다시 돈다.
 *
 * ① 구분자 목록에 「보험금 지급금액표」(DT000001)가 결과 타입 「표」 · 「시스템」 배지로 서고, 상세는 읽기 전용(편집 없음) · 견본 표 · 짝 구분자 링크.
 * ② 새 담보 — 급부 하나(지급률 100 · 감액 1년 50%)에 체증(구분 둘 — 칩 「(최초)계약일」 · 비율 1 / 1.2) · 담보 특성 「단서문구」.
 * ③ 담보약관에 툴바 「표 구분자」로 DT000001 을 넣고(인자 연결 없음) 저장 → 특약으로 탑재한 상품의 미리보기:
 *    머리글 「계약일부터 1년경과시점 전일 이전 〈단서문구〉 · 이후 〈단서문구〉」, 체증 행 「급부명(구분)」 · 셀 50 / 100 · 60 / 120.
 * ④ 보통약관에는 「표 구분자」 넣기가 잠긴다.
 * 시드는 건드리지 않는다 — 새 담보 · 새 담보약관 · 새 상품만 쓴다.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function submit(page: Page, button: Locator): Promise<void> {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
  await page.waitForLoadState("networkidle");
}

const PROVISO = "「2대질환」으로 진단확정시";

test(
  "표 구분자 — 시스템 정의 보험금 지급금액표를 담보약관에 넣으면 상품 미리보기가 감액 열 · 단서문구 꼬리 · 체증 행으로 선다",
  { annotation: { type: "좌표없음", description: "기능/구분자 §3.7 · §4.5 (ADR-0099) — 시나리오 파일이 아직 없다" } },
  async ({ page, ev }) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const coverageName = `표구분자검증담보${stamp}`;
    await ev.action("표구분자#1", "관리자로 로그인한다", () => login(page));

    await ev.action("표구분자#2", "구분자 목록 — DT000001 「보험금 지급금액표」가 결과 타입 「표」 · 「시스템」 배지로 선다, 메뉴에 동적표가 없다", async () => {
      await page.goto("/catalog?q=DT0000");
      const row = page.getByRole("row").filter({ hasText: "DT000001" });
      await expect(row).toHaveCount(1);
      await expect(row.getByRole("link", { name: "보험금 지급금액표", exact: true })).toBeVisible();
      await expect(row).toContainText("표");
      await expect(row).toContainText("시스템");
      await expect(page.getByRole("row").filter({ hasText: "DT000004" })).toContainText("갱신 통합치료비 지급금액표");
      await expect(page.locator('a[href="/dyntables"]')).toHaveCount(0);
    });

    await ev.action("표구분자#3", "상세 — 읽기 전용(편집 없음) · 견본 표 「감액 3구간」 · 짝 구분자 「갱신 보험금 지급금액표」 링크", async () => {
      await page.goto("/catalog/DT000001");
      await expect(page.getByRole("button", { name: "편집", exact: true })).toHaveCount(0);
      const table = page.getByRole("table", { name: /견본 「.*」으로 펼친 표/ });
      await expect(table.locator("thead th")).toHaveText(["구 분", "계약일부터 1년경과시점 전일 이전", "계약일부터 1년경과시점 이후 계약일부터 2년경과시점 전일 이전", "계약일부터 2년경과시점 이후"]);
      await expect(page.getByRole("region", { name: "문구 템플릿" })).toContainText("〔(최초)계약일〕부터 {경계}경과시점 전일 이전〔 {단서문구}〕");
      await page.getByRole("link", { name: "갱신 보험금 지급금액표", exact: true }).click();
      await page.waitForURL(/\/catalog\/DT000002$/);
      await expect(page.getByRole("table", { name: /견본 「.*」으로 펼친 표/ }).locator("thead th")).toHaveText(["구 분", "지급금액"]);
    });

    await ev.action("표구분자#4", "새 담보 — 급부 지급률 100 · 감액 1년 50% · 체증(칩 「(최초)계약일」 + 구분 둘) · 담보 단서문구", async () => {
      await page.goto("/coverages/new");
      await page.locator("#cov-name").fill(coverageName);
      await page.locator("#cov-sub").fill("2대질환 주요치료비");
      await page.locator("#cov-benefit").fill("2대질환 주요치료비");
      await page.locator("#cov-category").selectOption({ label: "질병" });
      await page.getByRole("button", { name: "생성" }).first().click();
      await page.waitForURL(/\/coverages\/[0-9a-f-]+$/);

      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
      const coverage = page.locator("section.ts-cov-card[data-level='coverage']");
      await coverage.getByRole("button", { name: "특성 추가", exact: true }).first().click(); // 담보 카드 안에 급부 카드가 들어 있다 — 첫째가 담보의 것
      await coverage.getByRole("menuitem", { name: "단서문구", exact: true }).click();
      await coverage.locator('input[name="proviso.text"]').fill(PROVISO);

      const benefit = page.locator("section.ts-cov-card[data-level='benefit']").first();
      await benefit.getByTitle("지급률 추가").click();
      await benefit.locator('input[name="pay.rate"]').fill("100");
      await benefit.getByRole("button", { name: "특성 추가", exact: true }).click();
      await benefit.getByRole("menuitem", { name: "감액", exact: true }).click();
      const reduction = benefit.getByRole("group", { name: "감액" });
      await reduction.getByRole("button", { name: "+ 행", exact: true }).click();
      await reduction.getByRole("combobox", { name: "1행 기간", exact: true }).selectOption({ label: "1년" });
      await reduction.getByRole("textbox", { name: "1행 지급률", exact: true }).fill("50");

      await benefit.getByRole("button", { name: "특성 추가", exact: true }).click();
      await benefit.getByRole("menuitem", { name: "체증", exact: true }).click();
      const escalation = benefit.getByRole("group", { name: "체증" });
      await escalation.getByRole("button", { name: "+ 행", exact: true }).click();
      // 칩 — 구분 칸 맨 앞에 커서를 두고 「(최초)계약일」 버튼
      const first = escalation.getByRole("textbox", { name: "1행 구분", exact: true });
      await first.fill("부터 1년 이내");
      // Home 은 macOS Chromium 에서 커서를 옮기지 않는다 — 커서를 직접 맨 앞에
      await first.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
      await escalation.getByRole("button", { name: "(최초)계약일", exact: true }).click();
      await expect(first).toHaveValue("〔(최초)계약일〕부터 1년 이내");
      await escalation.getByRole("textbox", { name: "1행 비율", exact: true }).fill("1");
      await escalation.getByRole("button", { name: "+ 행", exact: true }).click();
      await escalation.getByRole("textbox", { name: "2행 구분", exact: true }).fill("2차 연도");
      await escalation.getByRole("textbox", { name: "2행 비율", exact: true }).fill("1.2");

      await submit(page, page.getByRole("button", { name: "저장", exact: true }));
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await expect(escalation.getByRole("textbox", { name: "2행 구분", exact: true })).toHaveValue("2차 연도");
      await expect(escalation.getByRole("textbox", { name: "1행 구분", exact: true })).toHaveValue("〔(최초)계약일〕부터 1년 이내");
    });

    const docUrl = await ev.action("표구분자#5", "그 담보의 담보약관 템플릿을 만든다", async () => {
      await page.goto("/documents/new?kind=coverage");
      await pickCombo(page.locator("#doc-coverage"), { label: coverageName });
      await page.getByRole("button", { name: "생성", exact: true }).click();
      await page.waitForURL(/\/documents\/[0-9a-f-]+$/);
      return page.url();
    });

    const body = page.locator(".ts-l3-body");
    const toolbar = page.getByRole("toolbar", { name: "약관 편집 도구" });

    await ev.action("표구분자#6", "편집 — 조를 쓰고 툴바 「표 구분자」로 DT000001 을 넣는다(인자 연결 없음) → 띠 「[DT000001] 표 구분자 보험금 지급금액표」 → 저장", async () => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await toolbar.getByRole("button", { name: "조", exact: true }).click();
      const title = body.getByRole("textbox", { name: "조 제목" });
      await title.fill("보험금의 지급사유");
      await title.press("Enter");
      await toolbar.getByRole("button", { name: "표 구분자", exact: true }).click();
      const dialog = editForm(page, "표 구분자 넣기");
      await dialog.getByLabel("표 구분자", { exact: true }).selectOption("DT000001");
      await insertFrom(page, dialog);
      const band = body.locator(".ts-doc-clause.is-dyntable");
      await expect(band).toHaveCount(1);
      await expect(band.locator(".ts-doc-clause-head")).toContainText("[DT000001] 표 구분자 보험금 지급금액표");
      await submit(page, page.getByRole("button", { name: "저장", exact: true }));
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await expect(body.locator(".ts-doc-clause.is-dyntable")).toHaveCount(1);
    });

    await ev.action("표구분자#7", "특약으로 탑재한 상품의 미리보기 — 감액 열 머리글 + 단서문구 꼬리 · 체증 행 「급부명(구분)」 · 칩은 계약일(갱신형 아님)", async () => {
      await productWithSpecial(page, `표구분자미리보기 ${coverageName}`, coverageName);
      await page.goto(docUrl);
      const preview = page.locator("#ts-side-panel-preview");
      const table = preview.locator("table").first();
      await expect(table).toBeVisible();
      await expect(table.locator("tr").first().locator("th, td")).toHaveText(["구 분", `계약일부터 1년경과시점 전일 이전 ${PROVISO}`, `계약일부터 1년경과시점 이후 ${PROVISO}`]);
      await expect(table.locator("tr").nth(1).locator("th, td")).toHaveText(["2대질환 주요치료비(계약일부터 1년 이내)", "보험가입금액의 50%", "보험가입금액의 100%"]);
      await expect(table.locator("tr").nth(2).locator("th, td")).toHaveText(["2대질환 주요치료비(2차 연도)", "보험가입금액의 60%", "보험가입금액의 120%"]);
      await expect(preview).not.toContainText("최초계약일");
    });

    await ev.action("표구분자#8", "보통약관에는 표 구분자 넣기가 잠긴다 — 툴바 「표 구분자」가 꺼져 있다", async () => {
      await page.goto("/documents/new");
      await page.getByLabel("제목").fill(`표구분자검증 보통약관 ${stamp}`);
      await page.getByRole("button", { name: "생성" }).first().click();
      await page.waitForURL(/\/documents\/[0-9a-f-]+$/);
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await toolbar.getByRole("button", { name: "조", exact: true }).click();
      const title = body.getByRole("textbox", { name: "조 제목" });
      await title.fill("보험금의 지급사유");
      await title.press("Enter");
      await expect(toolbar.getByRole("button", { name: "함수조항", exact: true })).toBeEnabled();
      await expect(toolbar.getByRole("button", { name: "표 구분자", exact: true })).toBeDisabled();
    });
  },
);
