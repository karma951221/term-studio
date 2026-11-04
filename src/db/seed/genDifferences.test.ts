/**
 * 원문 대조 실패 모으기 — 새 실물 상품의 알려진 차이를 만들 때 쓰는 도구(평소에는 건너뛴다). 매뉴얼 §7.7.
 *   GEN_PRODUCT=<상품명> GEN_DIR=<fixture 폴더> GEN_CODE=<시드 상품 code> [GEN_OUT=<json 경로>] npx vitest run src/db/seed/genDifferences.test.ts
 * 책자(보통약관 · 블록 · 특약)를 그 상품 fixture 의 기대 줄과 대조해 다른 조(원문에만 · 조립에만)를 JSON 으로 쓴다 — 거기서 knownDifferences 항목을 고른다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readdirSync } from "node:fs";
import { it } from "vitest";
import { diffArticlesUnordered, renderedToLines, sourceToLines } from "@/domain/assembly/compare";
import { createTestDb } from "@/db/test-utils";
import { createServices } from "@/services/container";
import { autoFixtures } from "../../../scripts/terms/auto";
import { expectedLines } from "./knownDifferences";
import { loadAlphaPlus } from "./load";

const F = path.join(process.cwd(), "tests/fixtures/terms");
const lines = (dir: string, file: string) => sourceToLines(readFileSync(path.join(F, dir, file), "utf8"));
const NAME = process.env.GEN_PRODUCT!;
const D = process.env.GEN_DIR!;
const CODE = process.env.GEN_CODE!;
it.skipIf(!process.env.GEN_PRODUCT)("원문 대조 실패 모으기", async () => {
  const db = await createTestDb();
  const s = createServices(db.db);
  const admin = await s.auth.ensureSeedAdmin();
  await loadAlphaPlus(s, { userId: admin.id, role: admin.role });
  const p = (await s.product.listProducts()).find((x) => x.name === NAME)!;
  const r = await s.assembly.preview(p.id);
  if (!r.ok) throw new Error("preview");
  const b = r.value;
  const out: unknown[] = [];
  const cmp = (file: string, got: string[]) => {
    let exp: string[];
    try {
      exp = expectedLines(D, file, lines(D, file), undefined, lines);
    } catch (e) {
      out.push({ file, error: String(e) });
      return;
    }
    const d = diffArticlesUnordered(exp, got);
    if (d.missing.length || d.extra.length || d.sections) out.push({ file, missing: d.missing, extra: d.extra, sections: d.sections });
  };
  if (b.general) cmp("보통약관.md", renderedToLines(b.general));
  for (const doc of (b.blocks ?? []).flatMap((g) => g.docs)) cmp(`${doc.title.replace(/ /g, "_")}.md`, renderedToLines(doc));
  // 책자 특약 제목 → 이 상품 폴더의 fixture(제목 첫 줄로 찾는다)
  const byTitle = new Map<string, string>();
  for (const f of readdirSync(path.join(F, D))) {
    if (!f.endsWith(".md")) continue;
    for (const [t] of autoFixtures([{ file: f, auto: {} }], (x) => readFileSync(path.join(F, D, x), "utf8").split("\n")[0])) byTitle.set(t, f);
  }
  for (const doc of b.specials.flatMap((g) => g.docs)) {
    const file = byTitle.get(doc.title);
    if (!file) { out.push({ missingFixture: doc.title }); continue; }
    cmp(file, renderedToLines(doc));
  }
  writeFileSync(process.env.GEN_OUT ?? `gen_${CODE}.json`, JSON.stringify({ form: b.form, issues: b.issues, groups: b.specials.map((g) => g.title), specials: b.specials.flatMap((g) => g.docs).length, out }, null, 1));
  await db.close();
}, 900_000);
