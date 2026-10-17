/**
 * ADR-0082 결정 10 — 연결 조의 사본 잠금 · 회색 사본 (기능/상품 §3.10). 보통약관 탭 저장은 이 상품의 블록 · 기본계약 담보약관이
 * 조연결한 템플릿 조의 **새** 사본(또는 고친 사본)을 거부한다. 잠기기 전에 있던 사본(회색)은 그대로 두면 남고, 빼면(템플릿대로 되돌리기) 지운다.
 * 회색 사본은 참조 무결성 검사(ADR-0081)에서 빠진다.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArticleNode, DocumentNode, ParagraphNode } from "@/domain/document";
import { articleHash, type CoverageTree, type GeneralDependents } from "@/domain/product";
import type { Actor, Issue } from "@/domain/types";

import { createTestDb, type TestDb } from "@/db/test-utils";
import { createProductService, type ProductService } from "./product";
import { titleNodes } from "@/domain/document/title";

const editor: Actor = { userId: "00000000-0000-4000-8000-000000000002", role: "editor" };
function unwrap<T>(r: { ok: true; value: T } | { ok: false; rejection: unknown }): T {
  if (!r.ok) throw new Error(`기대: ok, 실제: ${JSON.stringify(r.rejection)}`);
  return r.value;
}
function issuesOf(r: { ok: boolean; rejection?: { reason: string; issues?: Issue[] } }): Issue[] {
  if (r.ok || r.rejection?.reason !== "invalid") throw new Error(`기대: invalid, 실제: ${JSON.stringify(r)}`);
  return r.rejection.issues!;
}

const GENERAL = "dddddddd-0000-4000-8000-0000000000ab";
const BASE = "aaaaaaaa-0000-4000-8000-0000000000d1";
const text = (id: string, t = "글") => ({ id, kind: "text" as const, text: t });
const para = (id: string, code: string, t?: string): ParagraphNode => ({ id, kind: "paragraph", code, children: [text(`${id}-t`, t)] });

/** 제1조(a20 — 기본계약이 조연결) · 제2조(a21 — 연결 없음). */
function template(): DocumentNode {
  return {
    id: GENERAL,
    kind: "document",
    title: "보통약관",
    children: [
      { id: "a20", kind: "article", title: titleNodes("지급사유", "a20"), children: [para("p20-1", "P0100")] },
      { id: "a21", kind: "article", title: titleNodes("계약의 소멸", "a21"), children: [para("p21-1", "P0100")] },
    ],
  };
}
const original = (id: string) => template().children.find((a) => a.id === id) as ArticleNode;
const rewritten = (id: string, t: string): ArticleNode => ({ ...original(id), children: [para(`${id}-p`, "PZ0100", t)] });
const copy = (article: ArticleNode) => ({ articleId: article.id, article, templateHash: articleHash(original(article.id)) });

/** 기본계약 담보약관 — 제1조(a20)에 조연결(정적). */
const dependents = (): GeneralDependents => ({ documents: [{ coverageId: BASE, clauseCodes: [], refs: [], links: ["a20"] }], clauses: [] });

describe("ADR-0082 결정 10 — 연결 조 사본 잠금 · 회색 사본 (PGlite)", () => {
  let t: TestDb;
  let svc: ProductService;
  const save = (productId: string, input: Partial<Parameters<ProductService["saveGeneralSettings"]>[2]>) =>
    svc.saveGeneralSettings(editor, productId, { generalDocumentId: GENERAL, hiddenArticles: [], overrides: [], ...input });

  beforeAll(async () => {
    t = await createTestDb();
    svc = createProductService(t.db, {
      coverageMaster: { tree: async (id) => (id === BASE ? ({ id: BASE, name: "상해사망", subCoverages: [] } satisfies CoverageTree) : undefined) },
      generalDocuments: {
        exists: async (id) => id === GENERAL,
        articleIds: async (id) => (id === GENERAL ? ["a20", "a21"] : []),
        clauseRef: async () => undefined,
        template: async (id) => (id === GENERAL ? { tree: template(), version: 1 } : undefined),
        validate: async () => [],
        dependents: async (id) => (id === GENERAL ? dependents() : { documents: [], clauses: [] }),
      },
    });
  });
  afterAll(async () => {
    await t.close();
  });

  it("copyLocks — 기본계약이 조연결한 조 → 그 상품담보 이름, 기본계약이 아니면(특약 탑재) 잠그지 않는다", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "잠금 1", generalDocumentId: GENERAL }));
    const pc = unwrap(await svc.mount(editor, p.id, BASE, []));
    expect(Object.fromEntries(await svc.copyLocks(p.id))).toEqual({});
    unwrap(await svc.designateBaseContract(editor, p.id, pc.id));
    expect(Object.fromEntries(await svc.copyLocks(p.id))).toEqual({ a20: [pc.name] });
  });

  it("잠긴 조의 새 사본은 거부 — 그 조 자리 · 「조연결한 조라 이 상품에서 고칠 수 없습니다」, 잠기지 않은 조는 그대로 저장", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "잠금 2", generalDocumentId: GENERAL }));
    const pc = unwrap(await svc.mount(editor, p.id, BASE, [], "base"));
    const issues = issuesOf(await save(p.id, { copies: [copy(rewritten("a20", "사본")), copy(rewritten("a21", "상품 소멸"))] }));
    expect(issues.map((i) => [i.kind, i.at.articleId, i.message])).toEqual([["structure", "a20", `이 조는 기본계약 「${pc.name}」이(가) 조연결한 조라 이 상품에서 고칠 수 없습니다 — 사본을 저장하지 않습니다`]]);
    unwrap(await save(p.id, { copies: [copy(rewritten("a21", "상품 소멸"))] }));
    expect((await svc.listArticleCopies(p.id)).map((c) => c.articleId)).toEqual(["a21"]);
  });

  it("회색 사본 — 잠기기 전 사본은 그대로 보내면 남고(고친 것만 거부) · 빼면 지운다(템플릿대로 되돌리기)", async () => {
    const p = unwrap(await svc.createProduct(editor, { name: "잠금 3", generalDocumentId: GENERAL }));
    const pc = unwrap(await svc.mount(editor, p.id, BASE, []));
    const gray = copy(rewritten("a20", "잠기기 전 사본"));
    unwrap(await save(p.id, { copies: [gray] }));
    unwrap(await svc.designateBaseContract(editor, p.id, pc.id));
    // 회색 사본을 그대로 다시 보낸다 — 다른 조를 고친 저장이 막히지 않는다
    unwrap(await save(p.id, { copies: [gray, copy(rewritten("a21", "상품 소멸"))] }));
    expect((await svc.listArticleCopies(p.id)).map((c) => c.articleId).sort()).toEqual(["a20", "a21"]);
    // 회색 사본을 고치면 거부
    expect(issuesOf(await save(p.id, { copies: [copy(rewritten("a20", "고친 회색 사본"))] })).map((i) => i.at.articleId)).toEqual(["a20"]);
    // 빼면 지운다
    unwrap(await save(p.id, { copies: [copy(rewritten("a21", "상품 소멸"))] }));
    expect((await svc.listArticleCopies(p.id)).map((c) => c.articleId)).toEqual(["a21"]);
  });
});
