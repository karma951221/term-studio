/**
 * 0040_benefit_name_optional — 급부명은 선택: 형제 유일 인덱스가 적힌 이름만 본다 (기능/담보 §3.1, 2026-10-31).
 * 0000 ~ 0039 로 스키마를 만들고 0040 을 적용한 뒤 빈 급부명 둘을 한 세부보장 아래 넣는다.
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
const IDX = journal.entries.find((e) => e.tag === "0040_benefit_name_optional")!.idx;

const COV = "11111111-1111-4111-8111-111111111111";
const SUB = "22222222-2222-4222-8222-222222222222";

let client: PGlite;
beforeEach(async () => {
  client = new PGlite();
  for (let idx = 0; idx < IDX; idx++) for (const s of statementsOf(tagOf(idx))) await client.exec(s);
  await client.query(`INSERT INTO coverages (id, code, name, description) VALUES ($1, 'COV000001', '암진단비', '')`, [COV]);
  await client.query(`INSERT INTO sub_coverages (id, coverage_id, key, name, "order") VALUES ($1, $2, '01', '암진단', 0)`, [SUB, COV]);
});
afterEach(() => client.close());

const insertBenefit = (key: string, name: string) => client.query(`INSERT INTO benefits (sub_coverage_id, key, name, "order") VALUES ($1, $2, $3, 0)`, [SUB, key, name]);

describe("0040_benefit_name_optional", () => {
  it("적용 전엔 빈 급부명 둘이 유일 인덱스에 걸리고, 적용 뒤엔 들어간다 — 적힌 이름의 중복은 그대로 막는다", async () => {
    await insertBenefit("1", "");
    await expect(insertBenefit("2", "")).rejects.toThrow();
    for (const s of statementsOf(tagOf(IDX))) await client.exec(s);
    await insertBenefit("2", "");
    await insertBenefit("3", "소액암");
    await expect(insertBenefit("4", "소액암")).rejects.toThrow();
    const r = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE sub_coverage_id = $1`, [SUB]);
    expect(r.rows[0]!.n).toBe(3);
  });
});
