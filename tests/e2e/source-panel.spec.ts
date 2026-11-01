import { applyFrom, editForm, saveDocumentEdit } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";

/**
 * 출처 패널 (ADR-0092 · 기능/조립산출 §3.7 · §4.1, M08 ②) — 책자 미리보기에서 조를 누르면 오른쪽 패널에 덧칠한 원본.
 *
 * 1. 알파Plus보장보험 — 「일반상해사망보장 특별약관」 제4조(준용규정)를 누른다 → 패널 · 함수조항 호출 줄(인자 ← 구분자 = 값) → 펼치면
 *    탄 가지(진하게) · 안 탄 가지(회색 · 「앞 가지에서 결정 — 평가 안 함」) · 아이콘 바로가기 href → `?article=&pc=` 새로고침해도 같은 패널 → ✕.
 * 2. 템플릿 제4조 준용하기 옵션 「전체항 모으기」 저장(공유 마스터가 바뀐다) → 표본 「독립특약 블록 2개」를 다시 실행 →
 *    제1절 전체항 합침으로 블록에서 빠진 조가 원래 자리에 회색 「(생략) …」 → 누르면 생략 판정 패널.
 * 3. 알파Plus 의 저장본은 이제 오래된 결과 — 조를 누르면 패널 대신 「입력이 바뀌어 출처를 볼 수 없습니다 — 다시 실행」.
 * 끝에 템플릿 옵션을 「없음」으로 되돌린다.
 */
test(
  "출처 패널: 조 클릭 → 덧칠한 원본(탄 · 회색 가지 · 값) · 바로가기 · URL 유지 · 생략 자리 · 오래된 결과 차단",
  {
    annotation: {
      type: "좌표없음",
      description: "기능/조립산출 §3.7 · §4.1 출처 패널 (ADR-0092, 2026-10-21 ② 구현) — 시나리오 좌표가 아직 없다",
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
      return `${page.url().split("?")[0]!}/preview`;
    };
    const run = async (url: string) => {
      await page.goto(url);
      await page.getByRole("button", { name: /^(다시 )?실행$/ }).first().click();
      await expect(page.getByRole("button", { name: "다시 실행", exact: true }).first()).toBeVisible({ timeout: 120_000 });
    };
    const panel = page.getByRole("complementary", { name: "출처" });
    /** 본문을 누른다 — 클릭 위임은 하이드레이션 뒤에 붙으므로 패널이 기대대로 열릴 때까지 다시 누른다. */
    const clickUntil = async (target: import("@playwright/test").Locator, expectation: () => Promise<void>) => {
      await expect(async () => {
        await target.click();
        await expectation();
      }).toPass({ timeout: 60_000 });
    };

    // ── 1. 알파Plus — 특약 제4조(준용규정)
    const alpha = await open("알파Plus보장보험");
    await run(alpha);
    const special = page.locator("article.ts-doc").filter({ has: page.getByRole("heading", { name: "일반상해사망보장 특별약관", exact: true }) });
    const article = special.locator("[data-article]").filter({ has: page.getByRole("heading", { name: /^제\d+조\(준용규정\)$/ }) });
    await clickUntil(article.getByRole("heading"), () => expect(panel.locator(".ts-src-place")).toHaveText(/^일반상해사망보장 특별약관 › 제\d+조\(준용규정\)$/, { timeout: 5_000 }));
    await expect(article).toHaveClass(/is-selected/);
    await expect(page).toHaveURL(/\?article=[^&]+&pc=[0-9a-f-]{36}/);
    // 함수조항 호출 줄 — 인자 ← 구분자 = 값, 정의 바로가기
    const call = panel.locator(".ts-src-call").first();
    await expect(call).toContainText("납입면제_있음 ← 납입면제 있음 = 예");
    await expect(call.getByRole("link", { name: /^함수조항 정의 열기/ }).first()).toHaveAttribute("href", /^\/functions\/C\d+$/);
    await call.getByRole("button", { name: /^펼치기/ }).first().click();
    // 탄 가지 진하게 · 안 탄 가지 회색(평가 안 함)
    await expect(call.locator('.ts-src-branch.is-taken[data-outcome="taken"]').first()).toBeVisible();
    await expect(call.locator('.ts-src-branch.is-dim[data-outcome="skipped"]').first()).toContainText("앞 가지에서 결정 — 평가 안 함");
    await expect(call.locator('.ts-src-branch.is-dim[data-outcome="false"]').first()).toContainText("거짓");
    // 아이콘 바로가기 — 원본 조(문면 편집기의 그 조) · 상품 구성(상품담보)
    await expect(panel.getByRole("link", { name: /^원본 조 열기/ })).toHaveAttribute("href", /^\/documents\/[0-9a-f-]{36}\?node=/);
    await expect(panel.getByRole("link", { name: /^상품 구성 열기/ })).toHaveAttribute("href", /^\/products\/[0-9a-f-]{36}\/coverages\/[0-9a-f-]{36}$/);
    await expect(panel.getByRole("link", { name: /미리보기로/ })).toHaveCount(0);
    // 새로고침 — 같은 패널
    const panelUrl = page.url();
    await page.reload();
    await expect(panel.locator(".ts-src-place")).toHaveText(/준용규정/);
    expect(page.url()).toBe(panelUrl);
    // 다른 조를 누르면 내용만 바뀐다
    await clickUntil(page.locator("article.ts-doc").first().locator("[data-article]").first().getByRole("heading"), () => expect(panel.locator(".ts-src-place")).toHaveText(/^보통약관 › 제1조\(/, { timeout: 5_000 }));
    await expect(panel.getByText("템플릿", { exact: true })).toBeVisible();
    // ✕
    await panel.getByRole("button", { name: "출처 패널 닫기" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).not.toHaveURL(/article=/);

    // ── 2. 템플릿 제4조 준용하기 「전체항 모으기」 → 블록 조가 제1절로 올라 블록에서 생략
    await page.goto("/documents");
    await page.getByRole("link", { name: "보통약관(일반)", exact: true }).click();
    await page.waitForURL(/\/documents\/[0-9a-f-]{36}$/);
    const templateUrl = page.url();
    const setJoinMode = async (value: "all" | "none") => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
      await page.locator(".ts-l3-toc").getByText(/^제4조\(보험금 지급에 관한 세부/).click();
      await expect(page.getByRole("toolbar", { name: "약관 편집 도구" })).toContainText("자리 — 제4조");
      await page.getByRole("toolbar", { name: "약관 편집 도구" }).getByRole("button", { name: "준용하기", exact: true }).click();
      // 편집 탭의 「준용하기」 폼 → 적용 (기능/문면 §3.9, 2026-10-21)
      await editForm(page, "준용하기").locator("select[name=joinMode]").selectOption(value);
      await applyFrom(page);
      // 쓰는 상품의 판정이 바뀌면 확인 모달(ADR-0082 결정 11) — 〔바꾸고 저장〕
      await saveDocumentEdit(page);
    };
    await setJoinMode("all");

    const twoBlocks = await open("표본 — 독립특약 블록 2개");
    await run(twoBlocks);
    const slot = page.locator(".ts-doc-omitted").first();
    await expect(slot).toHaveText(/^\(생략\) .+ — 제1절 제4조와 같음$/);
    // 생략 자리 보기 끄기 · 켜기
    // 켜기 · 끄기는 URL 을 바꾸고 서버가 다시 그린다(제어형 체크박스) — 누르고 결과를 본다
    await page.getByLabel("생략 자리 보기").click();
    await expect(page.locator(".ts-doc-omitted")).toHaveCount(0);
    await expect(page).toHaveURL(/omitted=off/);
    await expect(page.getByLabel("생략 자리 보기")).not.toBeChecked();
    await page.getByLabel("생략 자리 보기").click();
    await expect(slot).toBeVisible();
    await clickUntil(slot, () => expect(panel).toContainText(/이 상품 결과에서 생략 — 제1절 제4조\(.+\)와 같음/, { timeout: 5_000 }));
    await expect(panel.locator(".ts-verdict-badge")).toHaveText("전체항 합침");

    // ── 3. 알파Plus 저장본은 오래된 결과 — 출처를 열지 않는다
    await page.goto(alpha);
    await expect(page.getByText("오래된 결과 — 생성 이후 입력이 바뀌었습니다")).toBeVisible();
    await clickUntil(page.locator("article.ts-doc").first().locator("[data-article]").first().getByRole("heading"), () => expect(panel.getByRole("status")).toHaveText("입력이 바뀌어 출처를 볼 수 없습니다 — 다시 실행", { timeout: 5_000 }));
    await expect(panel.getByRole("button", { name: "다시 실행", exact: true })).toBeVisible();

    // ── 되돌리기
    await page.goto(templateUrl);
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await page.locator(".ts-l3-toc").getByText(/^제4조\(보험금 지급에 관한 세부/).click();
    await page.locator(".ts-l3-body").getByRole("button", { name: "준용하기 — 전체항 모으기", exact: true }).click();
    await editForm(page, "준용하기").locator("select[name=joinMode]").selectOption("none");
    await applyFrom(page);
    await saveDocumentEdit(page);
  },
);
