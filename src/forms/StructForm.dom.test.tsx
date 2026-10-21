// @vitest-environment jsdom
/**
 * 「특성 ⊕」 메뉴 · 머리 줄 「지급률 ⊕/⊖」 — 실제로 눌러 본다 (기능/담보 §3.4 · §3.6, 2026-10-21).
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MasterForm } from "@/domain/master";

import { buildForm } from "./model";
import { StructForm } from "./StructForm";

afterEach(cleanup);

const master: MasterForm[] = [
  { key: "pay", label: "보험금지급", level: "benefit", fields: [{ key: "rate", label: "지급률", type: { kind: "number" }, unit: "%", optional: true }] },
  { key: "reduction", label: "감액", level: "benefit", optional: true, fields: [{ key: "new_only", label: "신규계약만 적용", type: { kind: "boolean" } }] },
  { key: "exemption", label: "면책", level: "benefit", optional: true, fields: [{ key: "months", label: "기간", type: { kind: "number" } }] },
];

function mount() {
  const model = buildForm("benefit", () => undefined, new Map(), undefined, master);
  return render(
    <StructForm
      model={model}
      embedded
      flat
      headPaths={["pay.rate"]}
      frame={({ head, body }) => (
        <section>
          <div data-testid="head">{head}</div>
          {body}
        </section>
      )}
    />,
  );
}

describe("특성 ⊕ — 메뉴에서 고르면 그 특성 박스가 생기고 메뉴에서 빠진다", () => {
  it("감액 → 면책 순으로 붙이면 ⊕ 가 잠기고, 박스 ⊖ 로 닫으면 다시 고를 수 있다", () => {
    mount();
    const add = screen.getByRole("button", { name: "특성 추가" });
    fireEvent.click(add);
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["감액", "면책"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "감액" }));
    expect(screen.getByRole("group", { name: "감액" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(add);
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["면책"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "면책" }));
    expect((screen.getByRole("button", { name: "특성 추가" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "감액 없음으로 — 값을 지운다" }));
    expect(screen.queryByRole("group", { name: "감액" })).toBeNull();
    expect((screen.getByRole("button", { name: "특성 추가" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("머리 줄 「지급률 ⊕」", () => {
  it("⊕ 를 누르면 그 자리에 칸이 열리고, ⊖ 로 닫으면 다시 ⊕ 다", () => {
    mount();
    const head = screen.getByTestId("head");
    fireEvent.click(within(head).getByTitle("지급률 추가"));
    expect(within(head).getByRole("spinbutton")).toBeTruthy();
    fireEvent.click(within(head).getByRole("button", { name: "지급률 빼기 — 값을 지운다(100%)" }));
    expect(within(head).queryByRole("spinbutton")).toBeNull();
    expect(within(head).getByTitle("지급률 추가")).toBeTruthy();
  });
});
