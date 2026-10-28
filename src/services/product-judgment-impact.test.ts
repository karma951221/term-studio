/**
 * 판정 변화 영향 카드 — 상품담보 탭 저장 (ADR-0082 결정 11 · ADR-0081 결정 3 · 기능/상품 §3.8 · §3.10).
 * 저장이 판정 · 잠금을 바꾸면(탑재 · 해제 · 기본계약 지정 — 블록 1 ↔ 2 포함) 1차 호출은 needsConfirmation 이고 영향에 판정이 바뀌는 조(전 → 후) ·
 * 회색이 되는 사본 · 다시 쓰이는 사본 · 깨지는 블록 지정 참조가 실린다. 잃는 값이 없으니 편집자도 확인하고 저장한다(역할 관문 없음).
 * 견주기는 저장 전후를 실제로 돌린다 — 저장을 세이브포인트에서 해 보고 판정을 읽은 뒤 되돌린다. 바뀐 것이 없으면 그대로 저장된다.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArticleNode, DocumentNode, ParagraphNode } from "@/domain/document";
import { titleNodes } from "@/domain/document/title";
import { articleHash, type CoverageTree, type GeneralDependents } from "@/domain/product";
import type { Actor, Impact } from "@/domain/types";

import { createTestDb, type TestDb } from "@/db/test-utils";
import { createProductService, type ProductService } from "./product";

const editor: Actor = { userId: "00000000-0000-4000-8000-000000000002", role: "editor" };
function unwrap<T>(r: { ok: true; value: T } | { ok: false; rejection: unknown }): T {
  if (!r.ok) throw new Error(`기대: ok, 실제: ${JSON.stringify(r.rejection)}`);
  return r.value;
}
function confirmation(r: { ok: boolean; rejection?: { reason: string; impact?: Impact } }): Impact {
  if (r.ok || r.rejection?.reason !== "needsConfirmation") throw new Error(`기대: needsConfirmation, 실제: ${JSON.stringify(r)}`);
  return r.rejection.impact!;
}

const GENERAL = "dddddddd-0000-4000-8000-0000000000cd";
const BASE = "aaaaaaaa-0000-4000-8000-0000000000e1";
const BASE2 = "aaaaaaaa-0000-4000-8000-0000000000e2";
const para = (id: string, code: string, t = "글"): ParagraphNode => ({ id, kind: "paragraph", code, children: [{ id: `${id}-t`, kind: "text", text: t }] });

/** 제1조(a20 — 기본계약 BASE 가 조연결) · 제2조(a21 — BASE2 가 조연결) · 제3조(a22 — 연결 없음). */
function template(): DocumentNode {
  return {
    id: GENERAL,
    kind: "document",
    title: "보통약관",
    children: [
      { id: "a20", kind: "article", title: titleNodes("지급사유", "a20"), children: [para("p20", "P0100")] },
      { id: "a21", kind: "article", title: titleNodes("세부규정", "a21"), children: [para("p21", "P0100")] },
      { id: "a22", kind: "article", title: titleNodes("계약의 소멸", "a22"), children: [para("p22", "P0100")] },
    ],
  };
}
const original = (id: string) => template().children.find((a) => a.id === id) as ArticleNode;
const copyOf = (id: string, t: string) => ({ articleId: id, article: { ...original(id), children: [para(`${id}-c`, "PZ0100", t)] }, templateHash: articleHash(original(id)) });
const dependents = (): GeneralDependents => ({
  documents: [
    { coverageId: BASE, clauseCodes: [], refs: [], links: ["a20"], articleIds: ["b-pay"] },
    { coverageId: BASE2, clauseCodes: [], refs: [], links: ["a21"], articleIds: ["b2-pay"] },
  ],
  clauses: [],
});

describe("상품담보 탭 저장의 판정 변화 영향 (PGlite)", () => {
  let t: TestDb;
  let svc: ProductService;
  /** 판정 기록 가짜 — 조립 대신 부를 때마다 차례로 돌려준다(없으면 판정 기록 없음 = 대치 형태로 본다). */
  let records: (undefined | { articleId: string; result: "special" | "delegate"; k: number; n: number }[])[] = [];
  /** 특약 조 판정 기록 가짜 (ADR-0093 결정 6) — 같은 조립 한 번이 돌려주는 생략 기록, 부를 때마다 차례로(없으면 빈 목록). */
  type Omission = { productCoverageId: string; productCoverageName: string; articleId: string; articleTitle: string; disposition: "omitted" | "applied" | "full" };
  let omissions: Omission[][] = [];
  let bookletCalls = 0;

  beforeAll(async () => {
    t = await createTestDb();
    svc = createProductService(t.db, {
      coverageMaster: { tree: async (id) => (id === BASE ? ({ id: BASE, name: "상해사망", subCoverages: [] } satisfies CoverageTree) : id === BASE2 ? ({ id: BASE2, name: "질병사망", subCoverages: [] } satisfies CoverageTree) : undefined) },
      generalDocuments: {
        exists: async (id) => id === GENERAL,
        articleIds: async (id) => (id === GENERAL ? ["a20", "a21", "a22"] : []),
        clauseRef: async () => undefined,
        template: async (id) => (id === GENERAL ? { tree: template(), version: 1 } : undefined),
        validate: async () => [],
        dependents: async (id) => (id === GENERAL ? dependents() : { documents: [], clauses: [] }),
      },
      judgment: {
        booklet: async () => {
          bookletCalls++;
          const firstSection = records.shift();
          return { ...(firstSection ? { firstSection } : {}), omitted: omissions.shift() ?? [] };
        },
      },
    });
  });
  afterAll(async () => {
    await t.close();
  });

  const addBase2 = { added: [{ key: "k1", coverageId: BASE2, attributes: [], section: "base" as const, plans: [] }], updated: [], removed: [] };

  it("블록 1 → 2(기본계약 추가) — 판정이 바뀌는 조 · 회색이 되는 사본, 편집자도 확인 모달(잃는 값 없음) → 확인하면 저장", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "판정 변화 1", generalDocumentId: GENERAL }));
    unwrap(await svc.mount(editor, p.id, BASE, [], "base"));
    unwrap(await svc.saveGeneralSettings(editor, p.id, { generalDocumentId: GENERAL, hiddenArticles: [], overrides: [], copies: [copyOf("a21", "상품이 고친 세부규정")] }));
    records = [undefined, [{ articleId: "a20", result: "special", k: 1, n: 2 }, { articleId: "a21", result: "special", k: 1, n: 2 }]];
    const impact = confirmation(await svc.saveCoverages(editor, p.id, addBase2));
    expect(impact.valueRowsLost).toBe(0);
    expect(impact.cascade).toEqual([]);
    expect(impact.judgment?.verdicts).toEqual([
      { articleId: "a20", label: "제1조(지급사유)", before: "대치", after: "특칙 1/2" },
      { articleId: "a21", label: "제2조(세부규정)", before: "마스터", after: "특칙 1/2" },
    ]);
    expect(impact.judgment?.grayed).toEqual([{ articleId: "a21", label: "제2조(세부규정)" }]);
    // 1차는 되돌린다 — 아직 기본계약 하나
    expect(await svc.listBaseContractIds(p.id)).toHaveLength(1);
    unwrap(await svc.saveCoverages(editor, p.id, addBase2, { confirm: true }));
    expect(await svc.listBaseContractIds(p.id)).toHaveLength(2);
  });

  it("대치 형태끼리 — 첫 기본계약 탑재는 잠금만 생기고 판정 · 회색 사본 줄이 없어 묻지 않고 저장된다", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "판정 변화 0", generalDocumentId: GENERAL }));
    records = [undefined, undefined];
    unwrap(await svc.saveCoverages(editor, p.id, { added: [{ key: "k0", coverageId: BASE, attributes: [], section: "base", plans: [] }], updated: [], removed: [] }));
    expect(await svc.listBaseContractIds(p.id)).toHaveLength(1);
  });

  it("판정이 그대로인 저장(이름 고치기)은 묻지 않고 저장된다", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "판정 변화 2", generalDocumentId: GENERAL }));
    const pc = unwrap(await svc.mount(editor, p.id, BASE, [], "base"));
    records = [undefined, undefined];
    unwrap(await svc.saveCoverages(editor, p.id, { added: [], updated: [{ id: pc.id, name: "새 이름", plans: [] }], removed: [] }));
    expect((await svc.getProductCoverage(pc.id))?.name).toBe("새 이름");
  });

  it("다시 쓰이는 사본 · 깨지는 블록 지정 참조 — 기본계약 해제(관리자 확인)에 같은 모달 줄이 더해진다", async () => {
    const admin: Actor = { userId: "00000000-0000-4000-8000-000000000001", role: "admin" };
    const p = unwrap(await svc.createProduct(editor, { name: "판정 변화 3", generalDocumentId: GENERAL }));
    unwrap(await svc.mount(editor, p.id, BASE, [], "base"));
    const settings = (copies: Parameters<ProductService["saveGeneralSettings"]>[2]["copies"]) => svc.saveGeneralSettings(editor, p.id, { generalDocumentId: GENERAL, hiddenArticles: [], overrides: [], copies });
    // 제2조 사본은 잠기기 전에 — 기본계약 2(질병사망)를 얹으면 회색이 된다
    const gray = copyOf("a21", "잠기기 전 세부규정");
    unwrap(await settings([gray]));
    const pc2 = unwrap(await svc.mount(editor, p.id, BASE2, [], "base"));
    // 제3조(잠기지 않음) 사본 — 블록 2 를 가리키는 블록 지정 참조
    const lapse: ArticleNode = { ...original("a22"), children: [{ id: "a22-p", kind: "paragraph", code: "PZ0100", children: [{ id: "a22-r", kind: "blockRef", productCoverageId: pc2.id }] }] };
    unwrap(await settings([gray, { articleId: "a22", article: lapse, templateHash: articleHash(original("a22")) }]));
    records = [[{ articleId: "a20", result: "special", k: 1, n: 2 }, { articleId: "a21", result: "special", k: 1, n: 2 }], undefined];
    const impact = confirmation(await svc.saveCoverages(admin, p.id, { added: [], updated: [], removed: [pc2.id] }));
    expect(impact.cascade[0]).toMatch(/^탑재 해제 · 질병사망 — 기본계약 해제/);
    expect(impact.judgment?.verdicts.map((v) => `${v.label} ${v.before} → ${v.after}`)).toEqual(["제1조(지급사유) 특칙 1/2 → 대치", "제2조(세부규정) 특칙 1/2 → 마스터"]);
    expect(impact.judgment?.revived).toEqual([{ articleId: "a21", label: "제2조(세부규정)" }]);
    expect(impact.judgment?.brokenRefs).toEqual([{ articleId: "a22", label: "제3조(계약의 소멸)", message: expect.stringContaining("이 상품의 블록이 아닙니다") }]);
  });
  it("상품담보 탭 저장이 특약 조 판정을 바꾸면(제1절 판정은 그대로) 영향에 「특약 조 판정이 바뀌는 조」 묶음(specials) — 확인 모달 · 1차는 되돌린다", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "판정 변화 — 특약 조", generalDocumentId: GENERAL }));
    const pc = unwrap(await svc.mount(editor, p.id, BASE, [], "base"));
    const rec = (disposition: Omission["disposition"]): Omission => ({ productCoverageId: "pc9", productCoverageName: "골절진단", articleId: "b9", articleTitle: "제2조(보험금 지급에 관한 세부규정)", disposition });
    records = [undefined, undefined];
    omissions = [[rec("applied")], [rec("full")]];
    const rename = { added: [], updated: [{ id: pc.id, name: "새 이름", plans: [] }], removed: [] };
    const impact = confirmation(await svc.saveCoverages(editor, p.id, rename));
    expect(impact.valueRowsLost).toBe(0);
    expect(impact.judgment?.verdicts).toEqual([]);
    expect(impact.judgment?.specials).toEqual([{ productCoverageId: "pc9", articleId: "b9", label: "골절진단 › 제2조(보험금 지급에 관한 세부규정)", before: "준용", after: "통째" }]);
    expect((await svc.getProductCoverage(pc.id))?.name).not.toBe("새 이름");
    omissions = [];
    unwrap(await svc.saveCoverages(editor, p.id, rename, { confirm: true }));
    expect((await svc.getProductCoverage(pc.id))?.name).toBe("새 이름");
  });

  it("보통약관 탭 — 생략 기준을 바꿔 특약 조 판정이 바뀌면 확인(편집자도) · 확인하면 저장 · 판정이 그대로면 묻지 않고 저장 · 생략 기준을 안 바꾼 저장은 probe 하지 않는다", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "판정 변화 — 생략 기준", generalDocumentId: GENERAL }));
    const settings = (omitModes: { articleId: string; mode: "exact" | "contained" }[], hiddenArticles: string[] = [], confirm = false) =>
      svc.saveGeneralSettings(editor, p.id, { generalDocumentId: GENERAL, hiddenArticles, overrides: [], copies: [], omitModes }, { confirm });
    const rec = (disposition: Omission["disposition"]): Omission => ({ productCoverageId: "pc1", productCoverageName: "암진단", articleId: "b1", articleTitle: "제1조(보험금의 지급사유)", disposition });
    records = [];

    // 통째 → 생략 — 편집자도 확인 모달(잃는 값 없음), 1차는 되돌린다
    omissions = [[rec("full")], [rec("omitted")]];
    const impact = confirmation(await settings([{ articleId: "a22", mode: "contained" }]));
    expect(impact.valueRowsLost).toBe(0);
    expect(impact.cascade).toEqual([]);
    expect(impact.judgment?.specials).toEqual([{ productCoverageId: "pc1", articleId: "b1", label: "암진단 › 제1조(보험금의 지급사유)", before: "통째", after: "생략" }]);
    expect(await svc.listArticleOmitModes(p.id)).toEqual([]);

    // 확인하면 저장 — 다시 견주지 않는다
    const calls = bookletCalls;
    unwrap(await settings([{ articleId: "a22", mode: "contained" }], [], true));
    expect(await svc.listArticleOmitModes(p.id)).toEqual([{ articleId: "a22", mode: "contained" }]);
    expect(bookletCalls).toBe(calls);

    // 판정이 그대로 — 묻지 않고 저장된다(해 본 저장을 그대로 남긴다)
    omissions = [[rec("full")], [rec("full")]];
    unwrap(await settings([{ articleId: "a22", mode: "contained" }, { articleId: "a20", mode: "contained" }]));
    expect(await svc.listArticleOmitModes(p.id)).toEqual([
      { articleId: "a20", mode: "contained" },
      { articleId: "a22", mode: "contained" },
    ]);
    expect(bookletCalls).toBe(calls + 2);

    // 생략 기준을 안 바꾼 저장(조 노출 끔)은 견주지 않는다
    omissions = [];
    unwrap(await settings([{ articleId: "a20", mode: "contained" }, { articleId: "a22", mode: "contained" }], ["a21"]));
    expect(await svc.listHiddenArticles(p.id)).toEqual(["a21"]);
    expect(bookletCalls).toBe(calls + 2);
  });
});
