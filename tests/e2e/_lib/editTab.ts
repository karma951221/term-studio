import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 문면 편집기 우측 패널 「편집」 탭 (2026-10-21, 기능/문면 §4.3) — 예전 본문 위 팝업(dialog) 자리.
 * 폼은 이름(`aria-label`)이 붙은 영역이고, 탭 맨 아래 고정 줄 〔되돌리기 · 적용〕(넣기 폼은 〔되돌리기 · 넣기〕)이 그 폼을 낸다.
 */
export function editTab(page: Page): Locator {
  return page.locator("#ts-side-panel-edit");
}

/** 편집 탭의 폼 하나 — 이름이 정확히 같은 영역. */
export function editForm(page: Page, name: string | RegExp): Locator {
  return editTab(page).getByRole("region", { name, exact: typeof name === "string" });
}

/** 탭 맨 아래 고정 줄의 버튼 — 「적용」 · 「넣기」 · 「되돌리기」. */
export function editFoot(page: Page, name: "적용" | "넣기" | "되돌리기"): Locator {
  return editTab(page).locator(".ts-edit-foot").getByRole("button", { name, exact: true });
}

/** 넣기 폼을 낸다 — 넣으면 그 폼은 사라진다(넣은 칩 · 블록의 속성 폼이나 빈 상태로 이어진다). */
export async function insertFrom(page: Page, form: Locator): Promise<void> {
  await editFoot(page, "넣기").click();
  await expect(form).toHaveCount(0);
}

/** 고치기 폼을 적용한다 — 적용되면 고친 것 없음(적용 · 되돌리기가 꺼진다). */
export async function applyFrom(page: Page): Promise<void> {
  await editFoot(page, "적용").click();
  await expect(editFoot(page, "적용")).toBeDisabled();
}

/**
 * 문면 편집기 〔저장〕 — 저장이 그 문서를 쓰는 상품의 판정을 바꾸면 확인 모달(「저장하면 아래 내용이 함께 바뀝니다」, ADR-0082 결정 11)이 선다.
 * 서면 그 글을 돌려주고 〔바꾸고 저장〕으로 넘긴다. 읽기 모드(〔편집〕)로 돌아올 때까지 기다린다. 모달이 없었으면 undefined.
 */
export async function saveDocumentEdit(page: Page): Promise<string | undefined> {
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const edit = page.getByRole("button", { name: "편집", exact: true });
  const dialog = page.getByRole("dialog", { name: "저장하면 아래 내용이 함께 바뀝니다" });
  await expect(edit.or(dialog)).toBeVisible({ timeout: 60_000 });
  let text: string | undefined;
  if (await dialog.isVisible()) {
    text = (await dialog.textContent()) ?? "";
    await dialog.getByRole("button", { name: "바꾸고 저장", exact: true }).click();
  }
  await expect(edit).toBeVisible({ timeout: 60_000 });
  return text;
}
