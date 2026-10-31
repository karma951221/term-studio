/**
 * CoverageCards — 중첩 카드 그리드 (기능/담보 §3.6, 2026-09-27 aaf753c · 07b93ba).
 *
 * - 담보약관 템플릿 띠 · 옵션 미결정 배지가 없다 (07b93ba).
 * - 카드는 접지 않는다 — 형제가 3개 이상이어도 모두 늘 보인다 (aaf753c).
 * - 세부보장 카드는 그리드(`.ts-cov-grid`) 안에, 급부 카드는 제 세부보장 카드 안(`.ts-cov-benefits`)에 선다.
 * - 편집 모드에만 구조 조작(⊖ · ↑↓ · 라벨 행 「세부보장 ⊕」 · 「급부 ⊕」 · 「특성 ⊕」 · 「지급률 ⊕」)이 있다. 읽기 모드에는 하나도 없다 (2026-10-21).
 *
 * `EditShell.initialMode` 로 편집/읽기를 정적으로 고정해 `renderToStaticMarkup` 으로 본다
 * (같은 패턴: `EditShell.test.tsx`).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));

import { EditShell } from "@/app/_components/EditShell";
import { encodeNodeKey, type StructureDraftSub, type StructureSavedSub } from "@/domain/coverage";
import { entered } from "@/domain/types";
import { buildForm, type FormModel } from "@/forms";

import { CoverageCards, MIN_STRUCTURE } from "./CoverageCards";

const COVERAGE_KEY = encodeNodeKey("coverage", "cov-1");

/** 세부보장 `n`개 · 세부보장마다 급부 1개 — 모두 저장된 노드(id 있음). */
function subs(n: number): StructureDraftSub[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    key: encodeNodeKey("subCoverage", `s${i + 1}`),
    nodeKey: String(i + 1).padStart(2, "0"),
    name: `세부보장${i + 1}`,
    benefits: [{ id: `b${i + 1}`, key: encodeNodeKey("benefit", `b${i + 1}`), nodeKey: "1", name: `급부${i + 1}` }],
  }));
}

function savedOf(draft: StructureDraftSub[]): StructureSavedSub[] {
  return draft.map((s) => ({ ...s, id: s.id!, benefits: s.benefits.map((b) => ({ ...b, id: b.id! })) }));
}

function render(mode: "read" | "edit", n = 2, formByNode: Record<string, FormModel> = {}) {
  const structure = subs(n);
  return renderToStaticMarkup(
    <EditShell
      initial={{ label: "수술비", structure, values: {} }}
      title="수술비"
      path={[{ label: "담보", href: "/coverages" }]}
      saveAction={async () => ({ ok: true })}
      initialMode={mode}
    >
      <CoverageCards coverageKey={COVERAGE_KEY} formByNode={formByNode} original={savedOf(structure)} attributeValueLabels={[]} />
    </EditShell>,
  );
}

describe("CoverageCards — 담보약관 템플릿 띠 · 옵션 미결정 배지가 없다 (07b93ba)", () => {
  it("읽기 · 편집 모드 모두 ts-cov-band · 「담보약관」 · 「미결정」이 없다", () => {
    for (const mode of ["read", "edit"] as const) {
      const html = render(mode);
      expect(html).not.toContain("ts-cov-band");
      expect(html).not.toContain("담보약관");
      expect(html).not.toContain("미결정");
    }
  });
});

describe("CoverageCards — 접지 않는다 (aaf753c)", () => {
  it("펼치기/접기 버튼이 없다 — ▸ · ▾ 도 안 쓴다", () => {
    for (const mode of ["read", "edit"] as const) {
      const html = render(mode, 3);
      expect(html).not.toContain("펼치기");
      expect(html).not.toContain("접기");
      expect(html).not.toContain("▸");
      expect(html).not.toContain("▾");
      // aria-hidden="true" 는 아이콘 SVG 의 정상 속성이다 — 본문을 숨기는 hidden 속성만 본다.
      expect(html).not.toMatch(/<div class="ts-cov-card-body"[^>]*\shidden/);
      expect(html).not.toContain("ts-cov-card-body\" hidden");
    }
  });

  it("형제가 3개 이상이어도 모든 세부보장 · 급부 카드 본문이 늘 렌더된다", () => {
    const html = render("read", 3);
    for (let i = 1; i <= 3; i++) {
      expect(html).toContain(`세부보장${i}`);
      expect(html).toContain(`급부${i}`);
    }
    expect((html.match(/ts-cov-card-body/g) ?? []).length).toBe(1 /* coverage */ + 3 /* sub */ + 3 /* benefit */);
  });

  it("편집 모드에서도 3개 모두 본문이 렌더된다", () => {
    const html = render("edit", 3);
    for (let i = 1; i <= 3; i++) {
      expect(html).toContain(`세부보장${i}`);
      expect(html).toContain(`급부${i}`);
    }
  });
});

describe("CoverageCards — 중첩 카드 그리드 (기능/담보 §3.6)", () => {
  it("세부보장 카드는 ts-cov-grid 다음에, 급부 카드는 ts-cov-benefits 다음에 온다 (순서로 포함관계를 본다)", () => {
    const html = render("read", 2);
    const gridIndex = html.indexOf("ts-cov-grid");
    const sub1 = html.indexOf(`data-node="${encodeNodeKey("subCoverage", "s1")}"`);
    const benefitsIndex = html.indexOf("ts-cov-benefits", sub1);
    const ben1 = html.indexOf(`data-node="${encodeNodeKey("benefit", "b1")}"`);
    expect(gridIndex).toBeGreaterThan(0);
    expect(sub1).toBeGreaterThan(gridIndex);
    expect(benefitsIndex).toBeGreaterThan(sub1);
    expect(ben1).toBeGreaterThan(benefitsIndex);
    expect((html.match(/ts-cov-benefits/g) ?? []).length).toBe(2);
  });

  it("담보 카드(coverage) 는 그리드 바깥, 세부보장을 감싼다", () => {
    const html = render("read", 1);
    const coverageOpenIndex = html.indexOf('data-level="coverage"');
    const gridIndex = html.indexOf("ts-cov-grid");
    const subIndex = html.indexOf('data-level="subCoverage"');
    expect(coverageOpenIndex).toBeGreaterThanOrEqual(0);
    expect(coverageOpenIndex).toBeLessThan(gridIndex);
    expect(gridIndex).toBeLessThan(subIndex);
  });
});

describe("CoverageCards — 편집 모드 구조 조작 (aaf753c)", () => {
  it("편집 모드: 카드마다 ⊖ 빼기 버튼 — 형제가 1개뿐이면 잠기고 tooltip 은 MIN_STRUCTURE", () => {
    const html = render("edit", 1);
    expect(html).toContain(MIN_STRUCTURE);
    const removeButtons = html.match(/<button[^>]*class="[^"]*ts-iconbtn danger[^>]*>/g) ?? [];
    // 세부보장 1개(마지막) · 그 급부 1개(마지막) — 둘 다 잠긴 ⊖
    const locked = removeButtons.filter((t) => t.includes(MIN_STRUCTURE));
    expect(locked.length).toBeGreaterThanOrEqual(2);
    for (const tag of locked) expect(tag).toMatch(/disabled=""/);
  });

  it("편집 모드: 형제가 여럿이면 각자의 ⊖ 는 잠기지 않는다", () => {
    const html = render("edit", 2);
    const removeButtons = html.match(/<button[^>]*class="[^"]*ts-iconbtn danger[^>]*>/g) ?? [];
    const unlocked = removeButtons.filter((t) => !t.includes(MIN_STRUCTURE));
    expect(unlocked.length).toBeGreaterThan(0);
    for (const tag of unlocked) expect(tag).not.toMatch(/disabled=""/);
  });

  it("편집 모드: 담보 본문의 라벨 행 「세부보장 ⊕」(aria-label=세부보장 추가)이 세부보장 그리드 앞에 온다 — 점선 타일은 없다 (2026-10-21)", () => {
    const html = render("edit", 2);
    expect(html).not.toContain("ts-cov-add-tile");
    const row = html.indexOf("ts-cov-add-row");
    expect(row).toBeGreaterThan(0);
    expect(html.slice(row, html.indexOf("ts-cov-grid"))).toContain('aria-label="세부보장 추가"');
    expect(html.slice(row, html.indexOf("ts-cov-grid"))).toContain(">세부보장<");
  });

  it("편집 모드: 세부보장 박스마다 라벨 행 「급부 ⊕」 — 급부 박스 목록 앞, 아래쪽 「+ 급부」 링크는 없다", () => {
    const html = render("edit", 2);
    const addBenefit = html.match(/aria-label="[^"]*에 급부 추가"/g) ?? [];
    expect(addBenefit.length).toBe(2);
    const sub1 = html.indexOf(`data-node="${encodeNodeKey("subCoverage", "s1")}"`);
    const add = html.indexOf("세부보장1에 급부 추가", sub1);
    expect(add).toBeLessThan(html.indexOf("ts-cov-benefits", sub1));
    expect(html).not.toContain("ts-cov-add\"");
  });

  it("읽기 모드: ⊖ · ↑↓ · 「+ 세부보장」 · 「+ 급부」 조작이 전혀 없다", () => {
    const html = render("read", 3);
    expect(html).not.toContain("ts-cov-remove");
    expect(html).not.toContain("ts-cov-add-tile");
    expect(html).not.toContain("세부보장 추가");
    expect(html).not.toContain("급부 추가");
    expect(html).not.toContain("ts-row-actions");
  });
});

describe("CoverageCards — 담보 본문은 라벨 열 하나 (2026-10-21)", () => {
  for (const mode of ["read", "edit"] as const) {
    it(`${mode} — 담보 카드는 머리 줄 대신 본문 첫 행 「담보 [이름]」 — 담보분류와 같은 ts-form-row 라벨 열, 보험금명 행은 없다`, () => {
      const structure = subs(1);
      const html = renderToStaticMarkup(
        <EditShell initial={{ label: "수술비", category: "V01", structure, values: {} }} title="수술비" path={[{ label: "담보", href: "/coverages" }]} saveAction={async () => ({ ok: true })} initialMode={mode}>
          <CoverageCards coverageKey={COVERAGE_KEY} formByNode={{}} original={savedOf(structure)} attributeValueLabels={[]} categories={[{ code: "V01", label: "상해" }]} />
        </EditShell>,
      );
      const coverage = html.slice(html.indexOf('data-level="coverage"'), html.indexOf("ts-cov-grid"));
      expect(coverage).not.toContain("ts-cov-card-head");
      const nameRow = coverage.indexOf("ts-cov-name-row");
      const categoryRow = coverage.indexOf('data-path="category"');
      expect(nameRow).toBeGreaterThan(-1);
      expect(categoryRow).toBeGreaterThan(nameRow);
      expect(coverage.match(/class="ts-form-row[^"]*"/g)?.length).toBeGreaterThanOrEqual(2);
      expect(coverage).toContain(">담보<");
      expect(html).not.toContain("보험금명");
    });
  }
});

describe("CoverageCards — 급부 박스: 이름 줄 「지급률 ⊕」 · 본문 「특성 ⊕」 (2026-10-21)", () => {
  const BEN = encodeNodeKey("benefit", "b1");
  const forms = (rate?: number) => ({ [BEN]: buildForm("benefit", () => undefined, new Map(rate === undefined ? [] : [["pay.rate", entered(rate)]])) });
  const head = (html: string) => {
    const at = html.indexOf(`data-node="${BEN}"`);
    return html.slice(at, html.indexOf("ts-cov-card-body", at));
  };

  it("편집 — 지급률은 급부 이름 줄 오른쪽 「지급률 ⊕」, 본문에는 「특성 ⊕」 라벨 행 · 「⊕ 감액」「⊕ 면책」 줄 · 「미입력」 배지가 없다", () => {
    const html = render("edit", 1, forms());
    expect(head(html)).toContain('title="지급률 추가"');
    expect(html).toContain('aria-label="특성 추가"');
    expect(html).not.toContain('title="감액 추가"');
    expect(html).not.toContain('title="면책 추가"');
    expect(html).not.toContain("미입력");
  });

  it("편집 — 지급률 값이 있으면 이름 줄에 칸이 열린 채 + ⊖", () => {
    const h = head(render("edit", 1, forms(80)));
    expect(h).toContain('name="pay.rate"');
    expect(h).toContain('value="80"');
    expect(h).toContain("지급률 빼기");
  });

  it("읽기 — 값이 있을 때만 「지급률 80%」, 없으면 지급률 자리가 없다", () => {
    expect(head(render("read", 1, forms(80)))).toContain("80%");
    expect(render("read", 1, forms())).not.toContain("지급률");
  });
});

describe("CoverageCards — 담보 카드의 「담보분류」 칸 (ADR-0090 · 기능/담보 §3.1 · §4)", () => {
  const categories = [
    { code: "V01", label: "상해" },
    { code: "V02", label: "질병" },
  ];
  function renderCategory(mode: "read" | "edit", category: string) {
    const structure = subs(1);
    return renderToStaticMarkup(
      <EditShell initial={{ label: "수술비", category, structure, values: {} }} title="수술비" path={[{ label: "담보", href: "/coverages" }]} saveAction={async () => ({ ok: true })} initialMode={mode}>
        <CoverageCards coverageKey={COVERAGE_KEY} formByNode={{}} original={savedOf(structure)} attributeValueLabels={[]} categories={categories} />
      </EditShell>,
    );
  }
  const categoryRow = (html: string) => html.match(/<div class="ts-form-row"[^>]*data-path="category"[\s\S]*?<\/div><\/div>/)?.[0] ?? "";

  it("읽기 — 값 이름 글자만, 고르기 칸이 없다 · 미입력(옛 데이터)은 「—」", () => {
    const row = categoryRow(renderCategory("read", "V02"));
    expect(row).toContain("담보분류");
    expect(row).toContain("질병");
    expect(row).not.toContain("<select");
    expect(categoryRow(renderCategory("read", ""))).toContain("—");
  });

  it("편집 — 열거값 전부를 고르는 select(「없음」이 없다 — 필수), 지금 값이 골라져 있다", () => {
    const row = categoryRow(renderCategory("edit", "V01"));
    expect(row).toContain('aria-label="담보분류"');
    expect(row).not.toMatch(/<option value="">/);
    expect(row).toMatch(/<option value="V01" selected="">상해<\/option>/);
    expect(row).toContain('<option value="V02">질병</option>');
  });

  it("미입력(옛 데이터) — 편집에 「고르세요」 · 지운 값은 「없는 값 V09」 + 다른 값을 고르라는 줄", () => {
    const empty = categoryRow(renderCategory("edit", ""));
    expect(empty).toMatch(/<option value="" selected="">— 고르세요 —<\/option>/);
    expect(empty).toContain("담보분류를 고르세요");
    expect(categoryRow(renderCategory("read", "V09"))).toContain("없는 값 V09");
    expect(categoryRow(renderCategory("edit", "V09"))).toMatch(/<option value="V09" selected="">없는 값 V09<\/option>/);
  });

  it("세부보장 · 급부 카드에는 담보분류 칸이 없다 — 담보 카드에 한 번", () => {
    expect((renderCategory("edit", "V01").match(/data-path="category"/g) ?? []).length).toBe(1);
  });
});

describe("CoverageCards — 레벨 라벨은 노드 키 (ADR-0087 · 기능/담보 §3.6)", () => {
  it("순서를 바꿔도 키가 그대로 — 둘째 자리의 03 은 「세부보장 03」", () => {
    const structure = subs(2);
    structure[1] = { ...structure[1]!, nodeKey: "03" };
    const html = renderToStaticMarkup(
      <EditShell initial={{ label: "수술비", structure, values: {} }} title="수술비" path={[{ label: "담보", href: "/coverages" }]} saveAction={async () => ({ ok: true })} initialMode="read">
        <CoverageCards coverageKey={COVERAGE_KEY} formByNode={{}} original={savedOf(structure)} attributeValueLabels={[]} />
      </EditShell>,
    );
    expect(html).toContain("세부보장 01");
    expect(html).toContain("세부보장 03");
    expect(html).not.toContain("세부보장 2<");
    expect(html).toContain("급부 1");
  });
});

describe("CoverageCards — 급부명은 선택: 비면 세부보장명으로 보인다 (기능/담보 §3.1, 2026-10-31)", () => {
  function renderBlank(mode: "read" | "edit") {
    const structure = subs(1);
    structure[0]!.benefits[0]!.name = "";
    return renderToStaticMarkup(
      <EditShell initial={{ label: "암진단비", structure, values: {} }} title="암진단비" path={[{ label: "담보", href: "/coverages" }]} saveAction={async () => ({ ok: true })} initialMode={mode}>
        <CoverageCards coverageKey={COVERAGE_KEY} formByNode={{}} original={savedOf(structure)} attributeValueLabels={[]} />
      </EditShell>,
    );
  }
  it("읽기 — 급부 카드 이름 자리에 세부보장명이 흐리게 선다 · aria 이름도 세부보장명", () => {
    const html = renderBlank("read");
    expect(html).toContain('class="ts-cov-card-name ts-cov-name-inherited"');
    expect(html).toContain('title="급부명이 비어 세부보장명으로 읽는다"');
    expect(html).toContain('aria-label="급부 세부보장1"');
  });
  it("편집 — 빈 급부명 입력칸의 placeholder 가 「세부보장명을 따른다」, 빈 이름 오류가 없다", () => {
    const html = renderBlank("edit");
    expect(html).toContain('placeholder="비우면 세부보장명 (세부보장1)"');
    expect(html).not.toContain("비울 수 없습니다");
  });
});
