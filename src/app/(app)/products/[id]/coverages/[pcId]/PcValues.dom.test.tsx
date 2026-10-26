// @vitest-environment jsdom
/**
 * 상품담보 값 — 편집 · 저장 하나 흐름 (기능/상품 §4.8). 저장 액션은 가짜로 바꿔 무엇을 보내는지 본다.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { entered, type ValueSlot } from "@/domain/types";
import { buildForm } from "@/forms";

const save = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock("../../../actions", () => ({ saveSnapshotAction: (...args: unknown[]) => save(...args) }));

const { ProductEditProvider } = await import("../../_components/ProductEdit");
const { PcValues } = await import("./PcValues");

afterEach(cleanup);
beforeEach(() => save.mockReset());

const benefitModel = (mine: [string, unknown][], theirs: [string, unknown][]) =>
  buildForm("benefit", () => undefined, new Map(mine.map(([p, v]) => [p, entered(v as never)])), {
    masterLabel: "암진단급부 (마스터)",
    masterValues: new Map<string, ValueSlot>(theirs.map(([p, v]) => [p, entered(v as never)])),
  });

function mount(mine: [string, unknown][] = [["exemption.months", 3], ["exemption.age15_only", false], ["exemption.new_only", true]], theirs: [string, unknown][] = [["exemption.months", 3]]) {
  return render(
    <ProductEditProvider canEdit>
      <PcValues
        productId="p1"
        productName="상품"
        productHref="/products/p1?tab=coverages"
        coverageId="c1"
        coverageName="암진단비"
        tree={{ id: "pc1", name: "암진단비", subCoverages: [{ id: "s1", key: "01", name: "암진단", benefits: [{ id: "b1", key: "1", name: "암진단급부" }] }] }}
        owners={[{ owner: { kind: "productBenefit", id: "b1" }, model: benefitModel(mine, theirs) }]}
      />
    </ProductEditProvider>,
  );
}

describe("PcValues — 읽기 / 편집 · 저장 하나", () => {
  it("`편집` → 같은 자리 [취소] [저장], 고친 것 없이 취소하면 묻지 않고 읽기로", () => {
    mount();
    expect(screen.queryByRole("button", { name: "특성 추가" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(screen.getByRole("button", { name: "특성 추가" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("고친 내용을 버립니까?")).toBeNull();
    expect(screen.getByRole("button", { name: "편집" })).toBeTruthy();
  });

  it("고친 뒤 취소하면 「고친 내용을 버립니까?」", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "기간" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByText("저장하지 않은 변경 사항이 있습니다")).toBeTruthy();
  });

  it("특성 ⊖ 뒤 저장 — 서버의 확인을 SaveConfirmDialog 로 보이고, 「바꾸고 저장」이 confirm 으로 다시 부른다", async () => {
    save.mockResolvedValueOnce({ ok: "confirm", impact: { valueRowsLost: 3, brokenRefs: [], cascade: ["특성 해제 · 암진단급부 · 면책 — 사라질 값: 기간 3"] } }).mockResolvedValueOnce({ ok: true });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.click(screen.getByRole("button", { name: "면책 없음으로 — 값을 지운다" }));
    // 마스터엔 면책이 있으니 다시 가져올 길이 선다
    expect(screen.getByRole("button", { name: "마스터에는 면책 있음 · 가져오기" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(screen.getByText("특성 해제 · 암진단급부 · 면책 — 사라질 값: 기간 3")).toBeTruthy());
    expect(save.mock.calls[0]).toEqual([
      "p1",
      "pc1",
      [{ owner: { kind: "productBenefit", id: "b1" }, entries: [{ path: "exemption.months", value: undefined }, { path: "exemption.age15_only", value: undefined }, { path: "exemption.new_only", value: undefined }] }],
      false,
    ]);
    await waitFor(() => expect((screen.getByRole("button", { name: "바꾸고 저장" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "바꾸고 저장" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]![3]).toBe(true);
    await waitFor(() => expect(screen.getByRole("button", { name: "편집" })).toBeTruthy());
  });

  it("서버 거부 — 그 칸에 오류, 편집은 유지", async () => {
    save.mockResolvedValueOnce({ ok: false, message: "저장하지 못한 값이 있습니다. 표시된 칸을 고쳐 주세요.", issues: [{ kind: "typeMismatch", message: "기간이 틀렸습니다", at: { ownerId: "b1", refPath: "exemption.months" } }] });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "기간" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    const box = await screen.findByRole("group", { name: "면책" });
    await waitFor(() => expect(within(box).getByText("기간이 틀렸습니다")).toBeTruthy());
    expect(screen.getByRole("button", { name: "저장" })).toBeTruthy();
  });
});
