/**
 * 0039_reduction_period_enum — 감액 구간표의 기간(개월 정수)을 열거형 「감액기간」 값 코드로 옮긴다 (기능/담보 §3.4, 2026-10-31).
 * 0000 ~ 0038 로 스키마를 만들고 옛 모양의 값 행을 넣은 뒤 0039 를 적용한다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const DRIZZLE = path.resolve(import.meta.dirname, "../../drizzle");
const journal = JSON.parse(readFileSync(path.join(DRIZZLE, "meta/_journal.json"), "utf8")) as { entries: { idx: number; tag: string }[] };
const statementsOf = (tag: string) =>
  readFileSync(path.join(DRIZZLE, `${tag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
const tagOf = (idx: number) => journal.entries.find((e) => e.idx === idx)!.tag;
const IDX = journal.entries.find((e) => e.tag === "0039_reduction_period_enum")!.idx;

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const OWNER_C = "33333333-3333-4333-8333-333333333333";

let client: PGlite;
beforeEach(async () => {
  client = new PGlite();
  for (let idx = 0; idx < IDX; idx++) for (const s of statementsOf(tagOf(idx))) await client.exec(s);
});
afterEach(() => client.close());

async function apply() {
  await client.transaction(async (tx) => {
    for (const s of statementsOf(tagOf(IDX))) await tx.exec(s);
  });
}
async function insert(owner: string, fieldPath: string, value: unknown) {
  await client.query(`INSERT INTO entity_values (owner_kind, owner_id, field_path, value) VALUES ('benefit', $1, $2, $3::jsonb)`, [owner, fieldPath, JSON.stringify(value)]);
}
async function values(): Promise<Record<string, unknown>> {
  const r = await client.query<{ owner_id: string; field_path: string; value: unknown }>(`SELECT owner_id, field_path, value FROM entity_values ORDER BY owner_id, field_path`);
  return Object.fromEntries(r.rows.map((x) => [`${x.owner_id}/${x.field_path}`, x.value]));
}

describe("0039_reduction_period_enum", () => {
  it("개월 수 3 · 6 · 12 · 24 는 시드 열거값 V01 · V02 · V03 · V04 로, 이미 코드인 값 · 다른 경로는 그대로", async () => {
    await insert(OWNER_A, "reduction.periods", [{ end: 3, rate: 10 }, { end: 12, rate: 50 }]);
    await insert(OWNER_A, "reduction.after_rate", 100);
    await insert(OWNER_B, "reduction.periods", [{ end: "V02", rate: 30 }, { end: 24, rate: 60 }]);
    await insert(OWNER_B, "exemption.months", 12);
    await apply();
    expect(await values()).toEqual({
      [`${OWNER_A}/reduction.after_rate`]: 100,
      [`${OWNER_A}/reduction.periods`]: [{ end: "V01", rate: 10 }, { end: "V03", rate: 50 }],
      [`${OWNER_B}/exemption.months`]: 12,
      [`${OWNER_B}/reduction.periods`]: [{ end: "V02", rate: 30 }, { end: "V04", rate: 60 }],
    });
    const after = await values();
    await apply();
    expect(await values()).toEqual(after);
  });

  it("옮길 열거값이 없는 개월 수(18)가 섞인 구간 값 행은 지운다 — 감액 폼의 다른 칸은 남아 구간이 미입력으로 드러난다", async () => {
    await insert(OWNER_C, "reduction.periods", [{ end: 12, rate: 50 }, { end: 18, rate: 70 }]);
    await insert(OWNER_C, "reduction.new_only", true);
    await apply();
    expect(await values()).toEqual({ [`${OWNER_C}/reduction.new_only`]: true });
  });
});
