import type { Page } from "@playwright/test";

import { expect, test } from "./_lib/fixtures";
import { productWithGeneral } from "./_lib/product";

/**
 * 정적 마스터 › 박스 (기능/박스 §4, 최종 결정 9) — 박스를 만들고, 보통약관 템플릿의 항 뒤에 툴바 「박스」로 놓고, 미리보기에 박스 내용이 선다.
 * 시드 문서는 건드리지 않는다 — 새로 만든 템플릿 · 박스만 쓴다(템플릿 이름에 시각을 붙여 다시 돌려도 겹치지 않게).
 * 박스는 제목 · 본문만 받는다 — 박스 이름 칸은 없고, 같은 제목이 여럿이어도 된다(코드로 가른다, 2026-10-21).
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "박스 생성 → 템플릿 항 뒤에 넣기 → 미리보기에 박스",
  { annotation: { type: "좌표없음", description: "기능/박스 §4.1 ~ §4.4 — 박스 전용 시나리오 파일이 없다 (기능/박스 §7)" } },
  async ({ page, ev }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const docTitle = `박스검증 보통약관 ${stamp}`;
    await ev.action("박스#1", "관리자로 로그인한다", () => login(page));

    await ev.action("박스#2", "내비 「정적 마스터」 아래에 별표 · 박스가 선다", async () => {
      await page.goto("/boxes");
      const nav = page.getByRole("navigation");
      await expect(nav.getByText("정적 마스터", { exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "별표", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "박스", exact: true })).toBeVisible();
    });

    let code = "";
    await ev.action("박스#3", "새 박스 — 제목(【】를 쳐도 한 겹으로) · 본문을 쓰고 만들면 상세로 가고 코드 BX 가 붙는다", async () => {
      await page.goto("/boxes/new");
      await expect(page.getByLabel("박스 이름")).toHaveCount(0);
      await page.getByLabel("제목").fill("【보험연도】");
      await page.getByLabel("본문").fill(`보험연도란 계약일부터 1년 단위로 끊은 기간을 말합니다. ${stamp}\n예: 2026년 3월 1일 계약이면 첫 보험연도는 2027년 2월 28일까지`);
      await page.getByRole("button", { name: "생성", exact: true }).click();
      await page.waitForURL(/\/boxes\/BX\d+$/);
      code = decodeURIComponent(page.url().split("/").at(-1)!);
      await expect(page.locator(".ts-field-static")).toHaveText(code);
      // 경로의 현재 마디 = 【제목】 · 미리보기 머리도 한 겹
      await expect(page.locator(".ts-crumb-current")).toHaveText("【보험연도】");
      await expect(page.locator("aside.ts-doc-box")).toContainText("【보험연도】");
      await expect(page.locator("aside.ts-doc-box")).not.toContainText("【【");
      await expect(page.locator("aside.ts-doc-box")).toContainText("보험연도란 계약일부터 1년 단위로");
    });

    let twin = "";
    await ev.action("박스#4", "같은 제목으로 또 만들어도 된다 — 다른 코드가 붙고, 목록에서 본문으로 찾으면 그 박스가 【제목】으로 선다", async () => {
      await page.goto("/boxes/new");
      await page.getByLabel("제목").fill("보험연도");
      await page.getByLabel("본문").fill(`다른 보험연도 설명 ${stamp}`);
      await page.getByRole("button", { name: "생성", exact: true }).click();
      await page.waitForURL(/\/boxes\/BX\d+$/);
      twin = decodeURIComponent(page.url().split("/").at(-1)!);
      expect(twin).not.toBe(code);
      await page.goto(`/boxes?q=${encodeURIComponent(`다른 보험연도 설명 ${stamp}`)}`);
      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(twin);
      await expect(rows.first().getByRole("link", { name: "【보험연도】" })).toBeVisible();
    });

    await ev.action("박스#5", "보통약관 템플릿을 새로 만든다", async () => {
      await page.goto("/documents/new");
      await page.getByLabel("제목").fill(docTitle);
      await page.getByRole("button", { name: "생성" }).first().click();
      await page.waitForURL(/\/documents\/[0-9a-f-]+$/);
    });

    const body = page.locator(".ts-l3-body");
    const toolbar = page.getByRole("toolbar", { name: "약관 편집 도구" });
    const tool = (name: string) => toolbar.getByRole("button", { name, exact: true });

    await ev.action("박스#6", "편집 — 조 · 항을 쓰고, 항에 커서를 둔 채 툴바 「박스」에서 그 박스를 고르면 항 뒤에 박스가 선다", async () => {
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await tool("조").click();
      const title = body.getByRole("textbox", { name: "조 제목" });
      await title.fill("용어의 정의");
      await title.press("Enter");
      await tool("항").click();
      const paragraph = body.getByRole("textbox", { name: "항", exact: true });
      await paragraph.fill("이 약관에서 쓰는 용어의 뜻은 다음과 같습니다.");
      await paragraph.press("End");
      await expect(tool("박스")).toBeEnabled();
      await tool("박스").click();
      // 같은 제목이 둘 — 줄 이름의 코드 · 본문 앞머리로 가른다
      await expect(page.getByRole("menuitem", { name: `【보험연도】(${twin})` })).toBeVisible();
      await page.getByRole("menuitem", { name: `【보험연도】(${code}) 보험연도란` }).click();
      const placed = body.locator(`aside[data-box="${code}"]`);
      await expect(placed).toBeVisible();
      await expect(placed).toContainText("보험연도란 계약일부터 1년 단위로");
    });

    await ev.action("박스#7", "저장 — 읽기 모드에도 박스가 남는다", async () => {
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await expect(body.locator(`aside[data-box="${code}"]`)).toContainText("【보험연도】");
    });

    const docUrl = page.url();
    await ev.action("박스#8", "이 템플릿을 보통약관으로 쓰는 상품을 만들면 우측 미리보기 탭이 그 상품 문맥의 조에 박스 제목 · 줄을 그 자리에 보인다 (기능/문면 §3.9)", async () => {
      await productWithGeneral(page, `박스미리보기 ${docTitle}`, docTitle);
      await page.goto(docUrl);
      const preview = page.locator("#ts-side-panel-preview");
      await expect(preview.getByRole("combobox", { name: "상품" })).toHaveValue(/.+/);
      await expect(preview).toContainText("이 약관에서 쓰는 용어의 뜻은 다음과 같습니다.");
      await expect(preview.locator(".ts-doc-box")).toContainText("【보험연도】");
      await expect(preview.locator(".ts-doc-box")).toContainText("예: 2026년 3월 1일 계약이면");
    });
  },
);
