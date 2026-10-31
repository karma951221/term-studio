// @vitest-environment jsdom
/**
 * 출처 패널 — 정액형 동적표(기능/동적표 §5 「출처 패널의 정액형 표」). 표본은 정액형 표 하나를 넣은 담보약관을 실제로 조립 · 설명한 결과.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { assemble, buildSourceView, explainArticle, type AssemblyInput, type ExplainTarget } from "@/domain/assembly";
import { alphaMaster, alphaPlusFixture, coverageEntry } from "@/domain/assembly/fixture";
import { reductionPeriodEnumSeed } from "@/domain/coverage/traits";
import { titleNodes } from "@/domain/document/title";
import { dynTableFixtureF } from "@/domain/dyntable";
import { findForm } from "@/domain/master";

import { SourcePanel } from "./SourcePanel";

afterEach(cleanup);

const grid = (label: string) => ({ columns: ["분류"], rows: [{ cells: [label], amounts: { "30000000": 50_000, "50000000": 80_000 } }] });

function fixedInput(insuredAmounts: number[]): AssemblyInput {
  const base = alphaPlusFixture();
  const entry = coverageEntry({
    id: "pc-dyn",
    name: "통합치료비",
    coverageId: "cov-dyn",
    coverageName: "통합치료비",
    attributes: [],
    subCoverages: [
      {
        id: "s1",
        key: "01",
        masterNodeId: "m-s1",
        name: "통합치료비",
        benefits: [
          { id: "b1", key: "1", masterNodeId: "m-b1", name: "상해로 인한 경우" },
          { id: "b2", key: "2", masterNodeId: "m-b2", name: "질병으로 인한 경우" },
        ],
      },
    ],
    values: {
      "pc-dyn": { "coverage_basic.renewal": false, ...(insuredAmounts.length ? { "insured_amount.amounts": insuredAmounts.map((amount) => ({ amount })) } : {}) },
      b1: { "pay.rate": 100, "fixed_table.grid": grid("상해") },
      b2: { "pay.rate": 100, "fixed_table.grid": grid("질병") },
    } as never,
  });
  return {
    ...base,
    master: [...alphaMaster, findForm("reduction")!, findForm("insured_amount")!, findForm("fixed_table")!],
    coverages: [...base.coverages, entry],
    specialDocuments: new Map([
      ...base.specialDocuments,
      ["cov-dyn", { id: "dyn-doc", kind: "document", title: "통합치료비 특별약관", children: [{ id: "dyn-art", kind: "article", title: titleNodes("보험금의 지급", "dyn-art"), children: [{ id: "dyn-ref", kind: "dynTableRef", tableCode: "DT000003", bindings: { 갱신형: { kind: "const", value: false } } }] }] }],
    ]),
    enums: [...base.enums, reductionPeriodEnumSeed()],
    dynTables: [{ id: "dt-f", code: "DT000003", ...dynTableFixtureF() }],
  } as AssemblyInput;
}

const target: ExplainTarget = { document: "special", productCoverageId: "pc-dyn", articleId: "dyn-art" };
const viewOf = (input: AssemblyInput) => buildSourceView(input, input, explainArticle(input, input, target), assemble(input, input));
const block = (container: HTMLElement) => container.querySelector('[data-node="dyn-ref"]') as HTMLElement;

describe("정액형 동적표 — 표 블록(급부 × 가입금액) 탭", () => {
  it("탭 = 「급부명 · 가입금액」, 탭 묶음 이름은 「표」", () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: viewOf(fixedInput([50_000_000, 30_000_000])) }} onClose={() => {}} />);
    const tabs = within(block(container)).getByRole("tablist", { name: "동적표 DT000003 표" });
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["상해로 인한 경우 · 3,000만원", "상해로 인한 경우 · 5,000만원", "질병으로 인한 경우 · 3,000만원", "질병으로 인한 경우 · 5,000만원"]);
    expect(within(tabs).getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true");
  });

  it("결과에서 누른 칸 — 그 칸이 속한 표의 탭이 처음부터 골라진다", () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: viewOf(fixedInput([50_000_000, 30_000_000])) }} focus="dyn-ref/txt@k7r1c1" onClose={() => {}} />);
    const tabs = within(block(container)).getAllByRole("tab");
    expect(tabs.find((t) => t.getAttribute("aria-selected") === "true")?.textContent).toBe("질병으로 인한 경우 · 3,000만원");
  });

  it("탭을 누르면 그 표로 바뀐다", async () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: viewOf(fixedInput([30_000_000])) }} onClose={() => {}} />);
    await userEvent.click(within(block(container)).getByRole("tab", { name: "질병으로 인한 경우 · 3,000만원" }));
    expect(within(block(container)).getByRole("tab", { name: "질병으로 인한 경우 · 3,000만원" }).getAttribute("aria-selected")).toBe("true");
  });

  it("펼치지 못함 — 오류 문구 · 「표 없음」", () => {
    const { container } = render(<SourcePanel content={{ state: "ok", view: viewOf(fixedInput([])) }} onClose={() => {}} />);
    expect(block(container).textContent).toMatch("운영 가입금액이 없습니다");
    expect(screen.getByText(/^표 없음/)).toBeTruthy();
  });
});
