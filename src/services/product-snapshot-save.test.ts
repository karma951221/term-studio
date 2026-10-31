import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CoverageMasterSource, CoverageTree } from "@/domain/product";
import type { Actor, Id, Impact, Issue } from "@/domain/types";

import { reductionPeriodEnumSeed } from "@/domain/coverage";

import { insertEnum } from "@/db/repo/catalog";
import { readSlots, writeSlot } from "@/db/repo/values";
import { createTestDb, type TestDb } from "@/db/test-utils";
import { createProductService, type ProductService } from "./product";

/**
 * 상품담보 값 화면 저장 한 번 (기능/상품 §3.4 · §4.8, M12 재작성) — 모든 노드의 값 초안을 한 서비스 호출 · 한 트랜잭션으로.
 * 전부 검사한 뒤 쓴다 — 하나라도 틀리면 아무것도 안 쓰고 이슈는 그 노드(`ownerId`) · 그 칸(`refPath`)에. 특성(감액 · 면책)을 떼는
 * 저장은 1차가 영향 확인(「특성 해제 · {급부명} — 사라질 값」) — 역할 관문은 없다(편집자도).
 */

const editor: Actor = { userId: "00000000-0000-4000-8000-000000000002", role: "editor" };

function unwrap<T>(r: { ok: true; value: T } | { ok: false; rejection: unknown }): T {
  if (!r.ok) throw new Error(`기대: ok, 실제: ${JSON.stringify(r.rejection)}`);
  return r.value;
}
function rejected(r: { ok: boolean; rejection?: unknown }) {
  if (r.ok) throw new Error("기대: 거부, 실제: ok");
  return r.rejection as { reason: string; issues?: Issue[]; impact?: Impact };
}

const CANCER = "bbbbbbbb-0000-4000-8000-000000000001";
const CANCER_SUB = "bbbbbbbb-0000-4000-8000-000000000011";
const CANCER_BEN = "bbbbbbbb-0000-4000-8000-000000000111";
const CANCER_BEN2 = "bbbbbbbb-0000-4000-8000-000000000112";

const trees = new Map<string, CoverageTree>([
  [
    CANCER,
    {
      id: CANCER,
      name: "암진단비",
      subCoverages: [
        {
          id: CANCER_SUB,
          key: "01",
          name: "암진단",
          order: 0,
          benefits: [
            { id: CANCER_BEN, key: "1", name: "암진단급부", order: 0 },
            { id: CANCER_BEN2, key: "2", name: "유사암진단급부", order: 1 },
          ],
        },
      ],
    },
  ],
]);
const master: CoverageMasterSource = { tree: async (id) => trees.get(id) };

describe("saveSnapshot — 상품담보 값 화면 저장 한 번 (PGlite)", () => {
  let t: TestDb;
  let svc: ProductService;

  /** 새 상품 + 암진단비 탑재 → 상품담보 id 와 급부 스냅샷 id 둘. */
  async function mounted(name: string): Promise<{ pcId: Id; ben: Id; ben2: Id }> {
    const p = unwrap(await svc.createProduct(editor, { name }));
    const pc = unwrap(await svc.mount(editor, p.id, CANCER, [], "special"));
    const snap = unwrap(await svc.getSnapshot(pc.id));
    const [ben, ben2] = snap.subCoverages[0]!.benefits;
    return { pcId: pc.id, ben: ben!.id, ben2: ben2!.id };
  }

  beforeAll(async () => {
    t = await createTestDb();
    // 감액 구간의 경계는 열거형 「감액기간」(E0010) 값이다 — 시드 그대로 넣는다 (2026-10-31)
    await insertEnum(t.db, reductionPeriodEnumSeed(), editor.userId);
    // 마스터 — 암진단급부엔 면책 특성(90일 · 신규만), 지급률 100
    await writeSlot(t.db, { kind: "benefit", id: CANCER_BEN }, "exemption.months", 3);
    await writeSlot(t.db, { kind: "benefit", id: CANCER_BEN }, "exemption.new_only", true);
    await writeSlot(t.db, { kind: "benefit", id: CANCER_BEN }, "pay.rate", 100);
    svc = createProductService(t.db, { coverageMaster: master });
  });
  afterAll(async () => {
    await t.close();
  });

  it("여러 노드의 값을 한 번에 쓴다 — 특성 붙이기(감액)도 값 쓰기다, 마스터는 그대로", async () => {
    const { pcId, ben, ben2 } = await mounted("한 번에");
    unwrap(
      await svc.saveSnapshot(editor, pcId, [
        { owner: { kind: "productBenefit", id: ben }, entries: [{ path: "pay.rate", value: 80 }] },
        { owner: { kind: "productBenefit", id: ben2 }, entries: [{ path: "reduction.periods", value: [{ end: "V03", rate: 50 }] }, { path: "reduction.new_only", value: true }] },
      ]),
    );
    expect((await readSlots(t.db, { kind: "productBenefit", id: ben })).get("pay.rate")).toEqual({ entered: true, value: 80 });
    expect((await readSlots(t.db, { kind: "productBenefit", id: ben2 })).get("reduction.new_only")).toEqual({ entered: true, value: true });
    expect((await readSlots(t.db, { kind: "benefit", id: CANCER_BEN2 })).size).toBe(0);
  });

  it("하나라도 틀리면 아무것도 안 쓴다 — 이슈는 그 노드 · 그 칸", async () => {
    const { pcId, ben, ben2 } = await mounted("거부");
    const r = rejected(
      await svc.saveSnapshot(editor, pcId, [
        { owner: { kind: "productBenefit", id: ben }, entries: [{ path: "pay.rate", value: 70 }] },
        { owner: { kind: "productBenefit", id: ben2 }, entries: [{ path: "reduction.periods", value: [{ end: "V03", rate: 50 }, { end: "V01", rate: 10 }] }] },
      ]),
    );
    expect(r.reason).toBe("invalid");
    expect(r.issues![0]!.at).toMatchObject({ ownerId: ben2, refPath: "reduction.periods" });
    expect((await readSlots(t.db, { kind: "productBenefit", id: ben })).get("pay.rate")).toEqual({ entered: true, value: 100 });
  });

  it("이 상품담보의 노드가 아니면 notFound", async () => {
    const { pcId } = await mounted("남의 노드");
    const other = await mounted("다른 상품");
    expect(rejected(await svc.saveSnapshot(editor, pcId, [{ owner: { kind: "productBenefit", id: other.ben }, entries: [{ path: "pay.rate", value: 1 }] }])).reason).toBe("notFound");
  });

  it("특성을 떼는 저장은 1차가 영향 확인 — 쓰지 않는다. 편집자도 확인하면 저장된다(무면책)", async () => {
    const { pcId, ben } = await mounted("특성 해제");
    const detach = [{ owner: { kind: "productBenefit" as const, id: ben }, entries: [{ path: "exemption.months", value: undefined }, { path: "exemption.new_only", value: undefined }] }];
    const r = rejected(await svc.saveSnapshot(editor, pcId, detach));
    expect(r.reason).toBe("needsConfirmation");
    expect(r.impact!.valueRowsLost).toBe(2);
    expect(r.impact!.cascade).toEqual(["특성 해제 · 암진단급부 · 면책 — 사라질 값: 기간 3 · 신규계약만 적용 예"]);
    expect((await readSlots(t.db, { kind: "productBenefit", id: ben })).get("exemption.months")).toEqual({ entered: true, value: 3 });

    unwrap(await svc.saveSnapshot(editor, pcId, detach, { confirm: true }));
    const after = await readSlots(t.db, { kind: "productBenefit", id: ben });
    expect([...after.keys()].filter((p) => p.startsWith("exemption."))).toEqual([]);
    // 마스터의 특성은 그대로 — 구조도 값도 상품담보가 바꾸지 않는다
    expect((await readSlots(t.db, { kind: "benefit", id: CANCER_BEN })).get("exemption.months")).toEqual({ entered: true, value: 3 });
  });

  it("한 칸만 비우는 것은 특성 해제가 아니다 — 확인 없이 저장", async () => {
    const { pcId, ben } = await mounted("한 칸");
    unwrap(await svc.saveSnapshot(editor, pcId, [{ owner: { kind: "productBenefit", id: ben }, entries: [{ path: "exemption.months", value: undefined }] }]));
    expect((await readSlots(t.db, { kind: "productBenefit", id: ben })).get("exemption.months")).toBeUndefined();
  });
});
