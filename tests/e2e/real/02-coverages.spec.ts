import { expect, test } from "../_lib/fixtures";
import { NO_COORD, arrive, login, open, saveEdit } from "./_lib/app";
import { HUMAN, SEED } from "./_lib/seed";

/**
 * ★ 실물 재현(화면) ② 담보 9 — 담보 › 세부보장 › 급부 구조. 모델명세 §3.1. 담보 값은 없다(보험금명은 담보약관 글자 — ADR-0091).
 * 생성 화면에서 담보명 · 첫 세부보장명 · 첫 급부명, 세부보장이 여럿이면 상세 편집의 「세부보장 ⊕」로 나머지를 더한다 — 편집 한 번 = 저장 한 번.
 * 담보분류(열거형 E0009 값 — 필수, ADR-0090)는 생성 화면에서 고른다. 급부 특성 값(면책 — 시드 `benefitValues`)은 같은 편집에서 첫 급부의 「특성 ⊕」로 넣는다.
 */

/** 급부 특성 폼 열쇠 → 「특성 ⊕」 메뉴 줄 (기능/담보 §3.4). */
const TRAIT_LABELS: Record<string, string> = { exemption: "면책", reduction: "감액" };

test.describe.serial("실물 재현(화면) ② 담보", () => {
  // 사람처럼 넣는 담보(말기신부전증 — 맨 뒤 코드)는 03b-human 이 친다
  for (const spec of SEED.coverages.filter((c) => c.key !== HUMAN.coverage)) {
    test(`${spec.code} ${spec.name}`, NO_COORD, async ({ page, ev }) => {
      test.setTimeout(180_000);
      await ev.action("실물화면#2.1", "관리자로 로그인한다", () => login(page));
      const [first, ...rest] = spec.subCoverages ?? [{ name: spec.name, benefitName: spec.benefitName }];

      const categoryLabel = SEED.enums.find((e) => e.code === "E0009")!.values.find((v) => v.code === spec.category)!.label;
      await ev.action("실물화면#2.2", `담보를 만든다 — 세부보장 「${first.name}」 › 급부 「${first.benefitName}」 · 담보분류 「${categoryLabel}」`, async () => {
        await open(page, "/coverages/new");
        await page.getByLabel("담보명").fill(spec.name);
        await page.getByLabel("세부보장명").fill(first.name);
        await page.getByLabel("급부명").fill(first.benefitName);
        await page.getByLabel("담보분류").selectOption(spec.category);
        await page.getByRole("button", { name: "생성", exact: true }).click();
        await arrive(page, /\/coverages\/[0-9a-f-]{36}$/);
        await expect(page.locator(".ts-count code").first()).toHaveText(spec.code);
      });

      // 급부 특성 값(면책 — 첫 세부보장 첫 급부, 시드 적재와 같은 자리). 담보 값은 없다(보험금명 삭제 — ADR-0091).
      // 세부보장이 하나뿐이고 특성 값도 없으면 편집할 것이 없다 — 저장 버튼이 켜지지 않는다
      const traits = spec.benefitValues ?? [];
      if (rest.length > 0 || traits.length > 0) await ev.action("실물화면#2.3", `편집 — 세부보장 ${rest.length}개 더하기 · 첫 급부 특성 값 ${traits.length}개 · 저장 한 번`, async () => {
        await page.getByRole("button", { name: "편집", exact: true }).click();
        for (const [i, sub] of rest.entries()) {
          const n = i + 2;
          await page.getByRole("button", { name: "세부보장 추가", exact: true }).click();
          const card = page.locator("section.ts-cov-card[data-level='subCoverage']").nth(n - 1);
          await card.getByRole("textbox", { name: `세부보장명 · ${String(n).padStart(2, "0")}`, exact: true }).fill(sub.name);
          await card.getByRole("textbox", { name: "급부명 · 1", exact: true }).fill(sub.benefitName);
        }
        // 급부 카드 「특성 ⊕」 메뉴에서 특성 폼을 열고 칸마다 — 수는 입력칸, 참거짓은 예 · 아니오 라디오 (기능/담보 §3.4)
        const benefit = page.locator("section.ts-cov-card[data-level='benefit']").first();
        const opened = new Set<string>();
        for (const { path, value } of traits) {
          const form = path.split(".")[0];
          const label = TRAIT_LABELS[form];
          if (!label) throw new Error(`급부 특성 ${path} — 이 E2E 가 치지 않는 폼`);
          if (!opened.has(form)) {
            await benefit.getByRole("button", { name: "특성 추가", exact: true }).click();
            await benefit.getByRole("menuitem", { name: label, exact: true }).click();
            await expect(benefit.getByRole("group", { name: label })).toBeVisible();
            opened.add(form);
          }
          if (typeof value === "boolean") await benefit.locator(`input[type=radio][name="${path}"][value="${value}"]`).check();
          else await benefit.locator(`input[name="${path}"]`).fill(String(value));
        }
        await saveEdit(page);
      });

      await ev.action("실물화면#2.4", "읽기 모드 — 세부보장 · 급부 이름이 저장돼 있다", async () => {
        await page.reload();
        const subs = [first, ...rest];
        await expect(page.locator("section.ts-cov-card[data-level='subCoverage']")).toHaveCount(subs.length);
        await expect(page.locator("section.ts-cov-card[data-level='benefit']")).toHaveCount(subs.length);
        for (const sub of subs) {
          await expect(page.locator(".ts-cov-card-name", { hasText: sub.name }).first()).toBeVisible();
          await expect(page.locator(".ts-cov-card-name", { hasText: sub.benefitName }).first()).toBeVisible();
        }
        await expect(page.locator('[data-path="category"] .ts-form-control')).toHaveText(categoryLabel);
        for (const form of new Set(traits.map((t) => t.path.split(".")[0]))) await expect(page.locator("section.ts-cov-card[data-level='benefit']").first().getByRole("group", { name: TRAIT_LABELS[form] })).toBeVisible();
      });
    });
  }
});
