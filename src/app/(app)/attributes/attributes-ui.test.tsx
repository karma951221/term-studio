/**
 * 담보속성 화면 (기능/담보속성 §4, 2026-09-28).
 *
 * - 조회: 한 행 = 유효값 하나(갱신유형의 비갱신형 · 갱신형이 각각 한 행) · 「수」 컬럼 없음 · 검색은 유형 · 값 어느 쪽으로도.
 * - 상세 값 표: 값(코드 · 이름 두 줄, 2026-10-21) · 「상품담보명 표기」ⓘ — 순서 · 사용 수 컬럼 없음, 「명명 조각」이라는 말 없음.
 * - 편집 모드: 값 행 표 문법(ValueRowsTable, 2026-10-01) — 행 앞 ⊖ 「행 삭제 · {값 이름}」 · 마지막 행 아래 ⊕ 「행 추가 · 값」.
 *   코드가 곧 순서라 끌기 손잡이는 없다. 읽기 모드에는 조작이 없다.
 *
 * 조회 페이지는 서비스를 바꿔 끼워 서버 컴포넌트를 그대로 그리고, 상세 표는 `EditShell.initialMode` 로 모드를 고정해 본다
 * (같은 패턴: `EditShell.test.tsx` · `CoverageCards.test.tsx`).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/attributes",
  useSearchParams: () => new URLSearchParams(),
}));

import { EditShell } from "@/app/_components/EditShell";
import type { AttributeKind } from "@/domain/product";

const KINDS: AttributeKind[] = [
  { code: "A0001", label: "갱신유형", order: 0, values: [{ code: "1", label: "비갱신형", fragment: "" }, { code: "2", label: "갱신형", fragment: "갱신형" }] },
  { code: "A0002", label: "부가유형", order: 1, values: [{ code: "1", label: "기본", fragment: "" }, { code: "2", label: "추가", fragment: "추가" }] },
  { code: "A0003", label: "심사유형", order: 2, values: [] },
];

vi.mock("@/lib/services", () => ({
  getServices: () => ({ product: { listAttributeKinds: async () => KINDS }, auth: { listUsers: async () => [] } }),
  currentActor: async () => ({ userId: "u", role: "admin" }),
}));
vi.mock("./ui-data", () => ({ attributeAudits: async () => new Map() }));
vi.mock("./edit-actions", () => ({ saveAttributeEditAction: async () => ({ ok: true }), removeAttributeEditAction: async () => ({ ok: true }) }));

const { default: AttributesPage } = await import("./page");
const { attributeValueRows, matchesAttributeRow } = await import("./list-rows");
const { ValuesEditor } = await import("./[code]/AttributeEditor");

async function listHtml(q?: string) {
  return renderToStaticMarkup(await AttributesPage({ searchParams: Promise.resolve(q ? { q } : {}) }));
}

const headers = (html: string) => [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, "").trim());
// 두 줄 칸(코드 · 이름)은 줄 사이를 「/」로 이어 읽는다 — 「A0001/갱신유형」
const cellText = (html: string) => html.replace(/<\/(code|a|span)><(a|span)[^>]*>/g, "/").replace(/<[^>]+>/g, "");
const bodyRows = (html: string) => [...(html.match(/<tbody>(.*?)<\/tbody>/)?.[1] ?? "").matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => cellText(c[1]!)));

describe("담보속성 조회 — 한 행 = 유효값 하나", () => {
  it("유형마다 값 수만큼 행, 값 없는 유형은 한 행 · 유형 순 → 코드 순", () => {
    expect(attributeValueRows(KINDS).map((r) => `${r.kind.code}/${r.value?.code ?? "-"}`)).toEqual(["A0001/1", "A0001/2", "A0002/1", "A0002/2", "A0003/-"]);
  });

  it("컬럼 — 담보속성(코드 · 이름 두 줄) · 값(코드 · 이름 두 줄) · 상품담보명 표기 · 최종수정(일자 · 수정자 두 줄) (「수」 · 「값」 미리보기 없음, 2026-10-21)", async () => {
    const html = await listHtml();
    expect(headers(html)).toEqual(["담보속성", "값", "상품담보명 표기", "최종수정"]);
    expect(headers(html)).not.toContain("수");
    expect(html).not.toContain("명명");
    // 담보속성 칸 · 최종수정 칸은 유형마다 한 번만(rowSpan) — 이어지는 값 행에는 그 칸이 없다
    const rows = bodyRows(html);
    expect(rows).toEqual([
      ["A0001/갱신유형", "1/비갱신형", "—", "—"],
      ["2/갱신형", "갱신형"],
      ["A0002/부가유형", "1/기본", "—", "—"],
      ["2/추가", "추가"],
      ["A0003/심사유형", "값 없음", "—", "—"],
    ]);
    expect(html.match(/rowSpan="2"|rowspan="2"/g)).toHaveLength(4);
    // 괘선은 묶음 사이에만 — 묶음 안의 행(다음 행이 같은 유형)에 표시
    expect(html.match(/<tr class="ts-group-inner">/g)).toHaveLength(2);
    // 값 칸도 두 줄 칸(IdentCell) — 1줄째 코드(mono · 옅은 색), 2줄째 이름. 두 줄 칸은 줄바꿈 없이 한 줄씩
    expect(html).toMatch(/<td class="col-flex"><span class="ts-two-line ts-ident"><code class="ts-ident-code">1<\/code><span class="ts-ident-name">비갱신형<\/span><\/span><\/td>/);
    // 행의 담보속성명은 유형 상세로 간다
    expect(html).toContain('href="/attributes/A0001"');
  });

  it("검색 — 유형 이름이면 그 유형의 값 행 전부, 값 이름이면 그 값 행만", async () => {
    // 값 칸 — 묶음 첫 행은 앞에 담보속성 칸이 하나 더 있다
    const valueNames = async (q: string) => bodyRows(await listHtml(q)).map((r) => (r.length === 4 ? r[1] : r[0]));
    expect(await valueNames("갱신유형")).toEqual(["1/비갱신형", "2/갱신형"]);
    expect(await valueNames("비갱신")).toEqual(["1/비갱신형"]);
    // 코드로도 이름으로도 걸린다
    expect(await valueNames("A0002")).toEqual(["1/기본", "2/추가"]);
    expect(matchesAttributeRow("A0002", { kind: KINDS[1]!, value: KINDS[1]!.values[0] })).toBe(true);
  });
});

function detailHtml(mode: "read" | "edit") {
  const kind = KINDS[0]!;
  return renderToStaticMarkup(
    <EditShell initial={{ label: kind.label, values: kind.values.map(({ code, label, fragment }) => ({ code, label, fragment })) }} title={kind.label} path={[{ label: "담보속성", href: "/attributes" }]} saveAction={async () => ({ ok: true })} initialMode={mode}>
      <ValuesEditor />
    </EditShell>,
  );
}

describe("담보속성 상세 — 유효값 표", () => {
  it("읽기: 값(코드 · 이름 두 줄) · 상품담보명 표기(ⓘ) — 순서 · 사용 수 없음 · ⊕ · ⊖ 없음", () => {
    const html = detailHtml("read");
    expect(headers(html)).toEqual(["값", "상품담보명 표기"]);
    expect(html).toContain('aria-label="상품담보명에 이 값 대신 들어갈 말 — 비우면 붙지 않는다"');
    expect(html).not.toMatch(/사용 수|순서|명명/);
    expect(html).not.toMatch(/행 추가|행 삭제|순서 옮기기/);
    expect(bodyRows(html)).toEqual([
      ["1/비갱신형", "—"],
      ["2/갱신형", "갱신형"],
    ]);
  });

  it("편집: 값 칸은 코드 줄 아래 값 이름 입력칸(한 칸 두 줄), 표기가 입력칸, 행 앞 ⊖(행 삭제), 마지막 행 아래(tfoot) ⊕ 「행 추가 · 값」 — 코드 순이라 손잡이 · ↑↓ 없음", () => {
    const html = detailHtml("edit");
    expect(html).toMatch(/<tfoot><tr class="ts-vrows-add"><td class="ts-vrows-ctl"[^>]*><button[^>]*aria-label="행 추가 · 값"/);
    expect(headers(html)).toEqual(["조작", "값", "상품담보명 표기"]);
    expect(html).toMatch(/<tr><td class="ts-vrows-ctl">.*?aria-label="행 삭제 · 비갱신형".*?<\/td><td class="col-flex[^"]*"><span class="ts-two-line ts-ident"><code class="ts-ident-code">1<\/code><span class="ts-ident-name"><input/);
    expect(html).toContain('aria-label="값 이름 2"');
    expect(html).toContain('aria-label="상품담보명 표기 — 갱신형"');
    expect(html).not.toMatch(/위로|아래로|순서 옮기기|ts-add-row/);
  });
});
