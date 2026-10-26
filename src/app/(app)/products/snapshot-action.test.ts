import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { readSlots } from "@/db/repo/values";
import { createTestDb, type TestDb } from "@/db/test-utils";
import type { Actor } from "@/domain/types";
import { createServices, type Services } from "@/services/container";

/**
 * 상품담보 값 화면 저장 액션 (기능/상품 §4.8) — 초안 전체를 한 번에. 특성 해제는 1차 `confirm`(영향), 이슈는 그 노드 · 그 칸으로.
 */
const editor: Actor = { userId: "00000000-0000-4000-8000-000000000002", role: "editor" };
let t: TestDb;
let s: Services;

vi.mock("@/lib/services", () => ({ getServices: () => s, currentActor: async () => editor }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const { saveSnapshotAction } = await import("./actions");

function unwrap<T>(r: { ok: true; value: T } | { ok: false; rejection: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.rejection));
  return r.value;
}

describe("saveSnapshotAction", () => {
  let productId: string;
  let pcId: string;
  let benefitId: string;

  beforeAll(async () => {
    t = await createTestDb();
    s = createServices(t.db);
    const coverage = unwrap(await s.coverage.create(editor, { name: "암진단비", subCoverageName: "암진단", benefitName: "암진단급부" }));
    const product = unwrap(await s.product.createProduct(editor, { name: "액션 상품" }));
    productId = product.id;
    pcId = unwrap(await s.product.mount(editor, productId, coverage.id, [], "special")).id;
    benefitId = unwrap(await s.product.getSnapshot(pcId)).subCoverages[0]!.benefits[0]!.id;
  });
  afterAll(async () => {
    await t.close();
  });

  it("저장 — 특성 붙이기 · 값", async () => {
    const r = await saveSnapshotAction(productId, pcId, [{ owner: { kind: "productBenefit", id: benefitId }, entries: [{ path: "exemption.months", value: 3 }, { path: "exemption.new_only", value: true }] }]);
    expect(r).toEqual({ ok: true });
    expect((await readSlots(t.db, { kind: "productBenefit", id: benefitId })).get("exemption.months")).toEqual({ entered: true, value: 3 });
  });

  it("특성 해제는 1차 confirm, 확인하면 저장", async () => {
    const detach = [{ owner: { kind: "productBenefit" as const, id: benefitId }, entries: [{ path: "exemption.months", value: undefined }, { path: "exemption.new_only", value: undefined }] }];
    const first = await saveSnapshotAction(productId, pcId, detach);
    expect(first.ok).toBe("confirm");
    expect(first.ok === "confirm" && first.impact.cascade[0]).toMatch(/^특성 해제 · 암진단급부 · 면책/);
    expect(await saveSnapshotAction(productId, pcId, detach, true)).toEqual({ ok: true });
  });

  it("거부 — 그 칸의 이슈를 싣는다", async () => {
    const r = await saveSnapshotAction(productId, pcId, [{ owner: { kind: "productBenefit", id: benefitId }, entries: [{ path: "pay.rate", value: "많이" }] }]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.issues[0]!.at).toMatchObject({ ownerId: benefitId, refPath: "pay.rate" });
  });
});
