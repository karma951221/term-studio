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

// ───────────────────────────── 상품담보 값 — 비우기 · 가져오기 · 마스터 특성 가져오기 (기능/상품 §3.4 · §4.8) ─────────────────────────────

describe("값 명령(valueCommands) — 칸의 값 비우기 · 현재 마스터 값 가져오기", () => {
  const snapshotMaster: MasterForm[] = [
    { key: "pay", label: "보험금지급", level: "benefit", fields: [{ key: "rate", label: "지급률", type: { kind: "number" }, unit: "%", optional: true }, { key: "note", label: "비고", type: { kind: "string" } }] },
    { key: "exemption", label: "면책", level: "benefit", optional: true, fields: [{ key: "months", label: "기간", type: { kind: "number" } }] },
  ];
  const mountSnapshot = (mine: [string, unknown][], theirs: [string, unknown][]) =>
    render(
      <StructForm
        model={buildForm(
          "benefit",
          () => undefined,
          new Map(mine.map(([p, v]) => [p, { entered: true, value: v as never }])),
          { masterLabel: "급부 (마스터)", masterValues: new Map(theirs.map(([p, v]) => [p, { entered: true, value: v as never }])) },
          snapshotMaster,
        )}
        embedded
        flat
        valueCommands
      />,
    );

  it("가져오기 아이콘은 마스터와 다른 칸에만 — tooltip 「현재 마스터 값 가져오기 · 마스터 {m} · 이 값 {v}」, 누르면 채우고 사라진다", () => {
    mountSnapshot([["pay.note", "이 값"]], [["pay.note", "마스터 값"]]);
    const button = screen.getByRole("button", { name: "현재 마스터 값 가져오기 · 마스터 마스터 값 · 이 값 이 값" });
    fireEvent.click(button);
    expect((screen.getByRole("textbox", { name: "비고" }) as HTMLInputElement).value).toBe("마스터 값");
    expect(screen.queryByRole("button", { name: /현재 마스터 값 가져오기/ })).toBeNull();
  });

  it("마스터 값이 미입력인 칸엔 가져오기가 없다", () => {
    mountSnapshot([["pay.note", "이 값"]], []);
    expect(screen.queryByRole("button", { name: /현재 마스터 값 가져오기/ })).toBeNull();
  });

  it("값 비우기 — 칸이 미입력이 되고, 마스터와 달라져 가져오기가 선다(이 값 미입력)", () => {
    mountSnapshot([["pay.note", "같음"]], [["pay.note", "같음"]]);
    fireEvent.click(screen.getByRole("button", { name: "비고 값 비우기" }));
    expect((screen.getByRole("textbox", { name: "비고" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "현재 마스터 값 가져오기 · 마스터 같음 · 이 값 미입력" })).toBeTruthy();
  });

  it("마스터에 있는 특성이 이 상품담보에 없으면 「마스터에는 면책 있음 · 가져오기」 — 누르면 마스터 값으로 붙는다", () => {
    mountSnapshot([], [["exemption.months", 3]]);
    fireEvent.click(screen.getByRole("button", { name: "마스터에는 면책 있음 · 가져오기" }));
    const box = screen.getByRole("group", { name: "면책" });
    expect((within(box).getByRole("spinbutton", { name: "기간" }) as HTMLInputElement).value).toBe("3");
    expect(screen.queryByRole("button", { name: "마스터에는 면책 있음 · 가져오기" })).toBeNull();
  });

  it("valueCommands 가 없으면(담보 상세) 비우기 · 가져오기가 없다", () => {
    render(<StructForm model={buildForm("benefit", () => undefined, new Map([["pay.note", { entered: true, value: "x" }]]), undefined, snapshotMaster)} embedded flat />);
    expect(screen.queryByRole("button", { name: "비고 값 비우기" })).toBeNull();
  });
});
