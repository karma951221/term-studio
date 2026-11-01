import { type Page } from "@playwright/test";

import { editForm, insertFrom } from "./_lib/editTab";
import { expect, test } from "./_lib/fixtures";

/**
 * 함수조항 편집기 — 조 참조 목록 인자의 문장 안 반복 넣기 (ADR-0098 결정 2 · 기능/함수조항 §3.7).
 *
 * 새 함수조항(항)에 인자 「준용예외」(타입 「조 참조 목록」)를 선언하고, 항 문장 「다만, 」 끝에 툴바 「문장 안 반복」 → 원천 「준용예외마다」 · 연결어 「및」로 넣는다.
 * 이어 열린 반복 창의 본문에는 현재 원소를 가리키는 조 참조 칩 하나가 서 있다. 「은 제외합니다.」를 붙여 저장하면 본문 검사 오류 없이 저장된다.
 * 시드는 건드리지 않는다 — 새 함수조항만 쓴다.
 */

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /admin/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test(
  "준용예외 문장 안 반복 넣기 — 조 참조 목록 인자 · 원천 「준용예외마다」 · 현재 조 참조 칩 → 저장",
  { annotation: { type: "좌표없음", description: "기능/함수조항 §3.7 문장 안 반복(조 참조 목록) — 시나리오 파일에 준용예외 시나리오가 아직 없다" } },
  async ({ page, ev }) => {
    test.setTimeout(120_000);
    const clauseName = `준용 시험(${Date.now()})`;
    await ev.action("준용넣기#1", "관리자로 로그인한다", () => login(page));

    const editor = page.locator(".ts-clause-editor");
    const toolbar = page.getByRole("toolbar", { name: "약관 편집 도구" });

    await ev.action("준용넣기#2", "새 함수조항(항) — 인자 「준용예외」(조 참조 목록) · 항 「다만, 」", async () => {
      await page.goto("/functions/new?type=block");
      await page.getByLabel("함수조항명").fill(clauseName);
      await page.getByLabel("새 인자 이름", { exact: true }).fill("준용예외");
      await page.getByLabel("새 인자 타입", { exact: true }).selectOption("list<ref>");
      await page.getByRole("button", { name: "인자 추가" }).click();
      const paragraph = editor.getByRole("textbox", { name: "항", exact: true });
      await paragraph.click();
      await paragraph.fill("다만, ");
      await paragraph.press("End");
    });

    await ev.action("준용넣기#3", "툴바 「문장 안 반복」 → 원천 후보는 「준용예외마다」 · 연결어 「및」 → 넣기", async () => {
      await toolbar.getByRole("button", { name: "문장 안 반복", exact: true }).click();
      const dialog = editForm(page, "문장 안 반복 넣기");
      const source = dialog.getByLabel("반복 원천");
      await expect(source.locator("option", { hasText: "준용예외마다" })).toHaveCount(1);
      await expect(source.locator("option", { hasText: "종마다" })).toHaveCount(0);
      await source.selectOption({ label: "준용예외마다" });
      await dialog.getByRole("radio", { name: "및", exact: true }).check();
      await insertFrom(page, dialog);
    });

    await ev.action("준용넣기#4", "이어 열린 반복 창 — 본문에 현재 원소 조 참조 칩 · 문장을 마치고 저장하면 오류 없이 저장된다", async () => {
      const dialog = editForm(page, "문장 안 반복");
      await expect(dialog).toBeVisible();
      const each = dialog.getByRole("textbox", { name: "원소마다", exact: true });
      await expect(each).toContainText("현재 조 ⟨준용예외마다⟩");
      await expect(editor.locator(".ts-doc-inline-chip.is-repeat")).toHaveText("〔준용예외마다〕");
      const paragraph = editor.getByRole("textbox", { name: "항", exact: true });
      await paragraph.click();
      await paragraph.press("End");
      await paragraph.pressSequentially("은 제외합니다.");
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await page.waitForURL(/\/functions\/C\d+$/);
      await expect(page.locator(".ts-error-banner")).toHaveCount(0);
      await expect(editor.locator(".ts-doc-inline-chip.is-repeat")).toHaveText("〔준용예외마다〕");
      await expect(editor).toContainText("은 제외합니다.");
    });
  },
);
