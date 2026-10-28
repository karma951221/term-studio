import { type Page } from "@playwright/test";

import { editFoot, editForm, editTab, insertFrom } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";

/**
 * 문면 편집기 우측 패널 「편집」 탭 (2026-10-21, 기능/문면 §4.3) — 본문 위 팝업을 패널 탭 폼으로 옮겼다.
 *
 * 편집에 들어가면 탭 줄 맨 앞에 「편집」 탭이 서고 그 탭으로 간다(빈 상태 안내 한 줄). 본문에서 칩을 고르면 편집 탭에 그 고치기 폼,
 * 고친 것은 탭 아래 고정 줄 「적용」으로 편집본에 — 적용하지 않은 채 다른 칩을 고르면 확인 카드(적용 / 버리기 / 돌아가기).
 * 저장하면 편집 탭은 사라지고 들어오기 전 탭(미리보기)으로 돌아간다. 새로 만든 템플릿만 쓴다.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "편집 탭 — 편집 진입 때 서고, 칩을 고르면 그 폼, 미적용이면 확인 카드, 적용하면 본문에, 저장하면 사라진다",
  { annotation: { type: "좌표없음", description: "기능/문면 §4.3 우측 패널 「편집」 탭 (2026-10-21)" } },
  async ({ page, ev }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    await ev.action("편집탭#1", "관리자로 로그인하고 보통약관 템플릿을 새로 만든다", async () => {
      await login(page);
      await page.goto("/documents/new");
      await page.getByLabel("제목").fill(`편집탭검증 보통약관 ${stamp}`);
      await page.getByRole("button", { name: "생성" }).first().click();
      await page.waitForURL(/\/documents\/[0-9a-f-]+$/);
    });

    const body = page.locator(".ts-l3-body");
    const toolbar = page.getByRole("toolbar", { name: "약관 편집 도구" });
    const tool = (name: string) => toolbar.getByRole("button", { name, exact: true });
    // 우측 패널의 탭 — 위쪽 항목 탭 줄(ADR-0094)도 role=tab 이고 문서 이름이 「편집…」으로 시작해 패널 탭 줄로 좁힌다
    const sideTabs = page.getByRole("tablist", { name: "우측 패널" });
    const editTabButton = sideTabs.getByRole("tab", { name: /^편집/ });
    const previewTab = sideTabs.getByRole("tab", { name: "미리보기", exact: true });

    await ev.action("편집탭#2", "읽기 모드엔 편집 탭이 없다 — 편집을 누르면 맨 앞에 서고 그 탭으로, 빈 상태 안내 한 줄", async () => {
      await expect(previewTab).toHaveAttribute("aria-selected", "true");
      await expect(editTabButton).toHaveCount(0);
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await expect(editTabButton).toHaveAttribute("aria-selected", "true");
      await expect(sideTabs.getByRole("tab").first()).toHaveText("편집");
      await expect(editTab(page)).toHaveText("본문에서 함수조항 · 조 참조 · 조건식 · 동적표를 고르면 여기서 고칩니다.");
    });

    const chips = body.locator("[data-chip]");
    await ev.action("편집탭#3", "조 · 항 둘을 쓰고, 둘째 항에 툴바 「조 참조」로 제1조 · 제1항을 가리키는 칩 둘을 넣는다 — 넣으면 편집 탭은 그 칩의 폼으로", async () => {
      await tool("조").click();
      const title = body.getByRole("textbox", { name: "조 제목" });
      await title.fill("보험금의 지급사유");
      await title.press("Enter");
      await tool("항").click();
      const first = body.getByRole("textbox", { name: "항", exact: true });
      await first.fill("회사는 보험금을 지급합니다.");
      await first.press("End");
      await first.press("Enter");
      const second = body.getByRole("textbox", { name: "항", exact: true }).nth(1);
      await second.fill("앞의 규정은 ");
      await second.press("End");
      for (const level of [1, 2]) {
        await tool("조 참조").click();
        const form = editForm(page, "조 참조 넣기");
        await expect(form).toBeVisible();
        if (level === 2) await form.getByRole("button", { name: /펴기$/ }).first().click();
        await form.getByRole("treeitem", { level }).first().getByRole("checkbox").check();
        await insertFrom(page, form);
        await expect(editForm(page, "조 참조")).toBeVisible();
      }
      await expect(chips).toHaveCount(2);
    });

    const before = await chips.first().innerText();
    await ev.action("편집탭#4", "다른 탭(미리보기)에 있다가 첫 칩을 누르면 편집 탭으로 — 그 칩에 테두리, 고친 것이 없으면 적용 · 되돌리기가 꺼져 있다", async () => {
      await previewTab.click();
      await expect(previewTab).toHaveAttribute("aria-selected", "true");
      await chips.first().click();
      await expect(editTabButton).toHaveAttribute("aria-selected", "true");
      await expect(editForm(page, "조 참조")).toBeVisible();
      await expect(chips.first()).toHaveCSS("outline-style", "solid");
      await expect(editFoot(page, "적용")).toBeDisabled();
      await expect(editFoot(page, "되돌리기")).toBeDisabled();
    });

    const form = editForm(page, "조 참조");
    const card = page.getByRole("dialog", { name: "적용하지 않은 변경이 있습니다" });
    await ev.action("편집탭#5", "대상을 제1조 → 제1항으로 바꾸면 편집 탭 이름 옆에 점 — 적용 전에 다른 칩을 누르면 확인 카드, 돌아가기면 그대로", async () => {
      await form.getByRole("button", { name: /펴기$/ }).first().click();
      await form.getByRole("treeitem", { level: 1 }).first().getByRole("checkbox").uncheck();
      await form.getByRole("treeitem", { level: 2 }).first().getByRole("checkbox").check();
      await expect(editFoot(page, "적용")).toBeEnabled();
      await expect(editTabButton.getByRole("img", { name: "적용하지 않은 변경" })).toBeVisible();
      await chips.nth(1).click();
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: "돌아가기", exact: true }).click();
      await expect(card).toHaveCount(0);
      await expect(form.getByRole("treeitem", { level: 2 }).first().getByRole("checkbox")).toBeChecked();
      await expect(chips.first()).toHaveText(before);
    });

    const after = await ev.action("편집탭#6", "다시 다른 칩을 누르고 카드에서 「적용」 — 본문 첫 칩이 바뀌고, 편집 탭은 둘째 칩의 폼", async () => {
      await chips.nth(1).click();
      await card.getByRole("button", { name: "적용", exact: true }).click();
      await expect(card).toHaveCount(0);
      await expect(chips.first()).not.toHaveText(before);
      await expect(chips.nth(1)).toHaveCSS("outline-style", "solid");
      await expect(editTabButton.getByRole("img", { name: "적용하지 않은 변경" })).toHaveCount(0);
      return chips.first().innerText();
    });

    await ev.action("편집탭#7", "Esc 로 고른 것을 풀면 탭은 그대로 · 편집 탭은 빈 상태", async () => {
      // 입력칸 · 문장 칸 안의 Esc 는 그쪽 몫 — 초점을 내려놓고 누른다
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press("Escape");
      await expect(editTabButton).toHaveAttribute("aria-selected", "true");
      await expect(editTab(page)).toHaveText("본문에서 함수조항 · 조 참조 · 조건식 · 동적표를 고르면 여기서 고칩니다.");
    });

    await ev.action("편집탭#8", "저장 — 편집 탭이 사라지고 들어오기 전 탭(미리보기)으로, 바뀐 칩은 읽기 모드에도 남는다", async () => {
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
      await expect(editTabButton).toHaveCount(0);
      await expect(previewTab).toHaveAttribute("aria-selected", "true");
      await expect(body.locator(".ts-doc-paragraph").nth(1)).toContainText(after);
    });
  },
);
