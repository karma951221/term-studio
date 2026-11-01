/**
 * 문서 저장의 판정 변화 영향 (ADR-0082 결정 11 · ADR-0098 결정 7) — 담보약관 · 보통약관 템플릿 저장이 그 문서를 쓰는 상품의 판정을 바꾸는가.
 * `documentJudgment` 는 그 문서를 쓰는 상품(담보약관 = 그 담보를 탑재한 상품, 템플릿 = 그 템플릿을 고른 상품)만 골라 저장 전 판정을 읽고,
 * 저장(`write`)을 세이브포인트에서 해 본 뒤 판정을 다시 읽어 견주고 되돌린다. 바뀐 상품만 돌려준다.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DocumentNode, ParagraphNode } from "@/domain/document";
import { titleNodes } from "@/domain/document/title";
import type { CoverageTree } from "@/domain/product";
import type { Actor } from "@/domain/types";

import * as repo from "@/db/repo/product";
import { createTestDb, type TestDb } from "@/db/test-utils";
import { createProductService, type ProductService } from "./product";

const editor: Actor = { userId: "00000000-0000-4000-8000-000000000002", role: "editor" };
function unwrap<T>(r: { ok: true; value: T } | { ok: false; rejection: unknown }): T {
  if (!r.ok) throw new Error(`기대: ok, 실제: ${JSON.stringify(r.rejection)}`);
  return r.value;
}

const GENERAL = "dddddddd-0000-4000-8000-0000000000ce";
const OTHER = "dddddddd-0000-4000-8000-0000000000cf";
const BASE = "aaaaaaaa-0000-4000-8000-0000000000f1";
const SPECIAL = "aaaaaaaa-0000-4000-8000-0000000000f2";
const para = (id: string, code: string): ParagraphNode => ({ id, kind: "paragraph", code, children: [{ id: `${id}-t`, kind: "text", text: "글" }] });
const template = (id: string): DocumentNode => ({
  id,
  kind: "document",
  title: "보통약관",
  children: [
    { id: "a30", kind: "article", title: titleNodes("지급사유", "a30"), children: [para("p30", "P0100")] },
    { id: "a31", kind: "article", title: titleNodes("세부규정", "a31"), children: [para("p31", "P0100")] },
  ],
});

type Exclusion = { productCoverageId: string; name: string; code: string; value: string[] };

describe("문서 저장의 판정 변화 영향 — documentJudgment (PGlite)", () => {
  let t: TestDb;
  let svc: ProductService;
  /** 준용예외 기록 가짜 — 조립 한 번마다 차례로(없으면 빈 목록). */
  let exclusions: Exclusion[][] = [];
  let booklets: string[] = [];

  beforeAll(async () => {
    t = await createTestDb();
    const trees: Record<string, CoverageTree> = { [BASE]: { id: BASE, name: "상해사망", subCoverages: [] }, [SPECIAL]: { id: SPECIAL, name: "골절진단", subCoverages: [] } };
    svc = createProductService(t.db, {
      coverageMaster: { tree: async (id) => trees[id] },
      generalDocuments: {
        exists: async (id) => id === GENERAL || id === OTHER,
        articleIds: async () => ["a30", "a31"],
        clauseRef: async () => undefined,
        template: async (id) => (id === GENERAL || id === OTHER ? { tree: template(id), version: 1 } : undefined),
        validate: async () => [],
        dependents: async () => ({ documents: [], clauses: [] }),
      },
      judgment: {
        booklet: async (productId) => {
          booklets.push(productId);
          return { omitted: [], exclusions: exclusions.shift() ?? [] };
        },
      },
    });
  });
  afterAll(async () => {
    await t.close();
  });

  it("담보약관 — 그 담보를 탑재한 상품만 견준다 · 준용예외가 바뀌면 「상품 · 특약」 줄 · write 는 되돌린다", async () => {
    const p1 = unwrap(await svc.createProduct(editor, { name: "준용 상품", generalDocumentId: GENERAL }));
    unwrap(await svc.mount(editor, p1.id, BASE, [], "base"));
    const pc = unwrap(await svc.mount(editor, p1.id, SPECIAL, [], "special"));
    const p2 = unwrap(await svc.createProduct(editor, { name: "다른 상품", generalDocumentId: GENERAL }));
    unwrap(await svc.mount(editor, p2.id, BASE, [], "base"));

    const row = (value: string[]): Exclusion => ({ productCoverageId: pc.id, name: "골절진단", code: "D0014", value });
    exclusions = [[row(["a30"])], [row(["a30", "a31"])]];
    booklets = [];
    let wrote = 0;
    const out = await svc.documentJudgment({ kind: "special", coverageId: SPECIAL }, async (tx) => {
      wrote++;
      await repo.updateProduct(tx, p2.id, { name: "해 본 저장" }, editor.userId);
    });
    expect(wrote).toBe(1);
    expect(booklets).toEqual([p1.id, p1.id]);
    expect(out).toEqual([
      {
        productId: p1.id,
        productName: "준용 상품",
        judgment: { verdicts: [], grayed: [], revived: [], brokenRefs: [], exclusions: [{ productCoverageId: pc.id, label: "준용 상품 · 골절진단", added: [{ articleId: "a31", label: "제2조(세부규정)" }], removed: [] }] },
      },
    ]);
    // 해 본 저장은 되돌린다
    expect((await svc.getProduct(p2.id))?.name).toBe("다른 상품");
  });

  it("보통약관 템플릿 — 그 템플릿을 고른 상품만 · 판정이 그대로면 빈 목록", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "다른 템플릿 상품", generalDocumentId: OTHER }));
    unwrap(await svc.mount(editor, p.id, BASE, [], "base"));
    exclusions = [];
    booklets = [];
    expect(await svc.documentJudgment({ kind: "general", documentId: OTHER }, async () => {})).toEqual([]);
    expect(booklets).toEqual([p.id, p.id]);
  });

  it("그 문서를 쓰는 상품이 없으면 조립하지도 write 하지도 않는다", async () => {
    booklets = [];
    let wrote = 0;
    expect(await svc.documentJudgment({ kind: "special", coverageId: "aaaaaaaa-0000-4000-8000-0000000000ff" }, async () => void wrote++)).toEqual([]);
    expect(booklets).toEqual([]);
    expect(wrote).toBe(0);
  });
});
