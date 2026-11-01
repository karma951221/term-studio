// @vitest-environment jsdom
/**
 * 표 입력의 글 열 칩 — 체증 구분의 「(최초)계약일」 버튼이 커서 자리에 칩 글을 넣는다 (기능/담보 §3.4, 2026-11-01).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { BASE_DATE_CHIP, findMasterField } from "@/domain/master";

import type { Draft, FieldState } from "./model";
import { TableInput } from "./TableInput";

afterEach(cleanup);

function Harness({ initial }: { initial: string[][] }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const ref = findMasterField("escalation.steps")!;
  const field = { view: { path: "escalation.steps", label: "구간", type: ref.field.type }, draft } as unknown as FieldState;
  return (
    <>
      <TableInput id="esc" field={field} onEdit={setDraft} />
      <output data-testid="draft">{JSON.stringify(draft)}</output>
    </>
  );
}

const draftOf = () => JSON.parse(screen.getByTestId("draft").textContent ?? "[]") as string[][];

describe("체증 구분 칩 「(최초)계약일」", () => {
  it("구분 칸의 커서 자리에 칩 글이 들어간다", () => {
    render(<Harness initial={[["부터 5년경과시점 전일 이전", "1"]]} />);
    const cell = screen.getByRole("textbox", { name: "1행 구분" }) as HTMLInputElement;
    cell.setSelectionRange(0, 0);
    fireEvent.select(cell);
    fireEvent.click(screen.getByRole("button", { name: "(최초)계약일" }));
    expect(draftOf()[0][0]).toBe(`${BASE_DATE_CHIP}부터 5년경과시점 전일 이전`);
  });

  it("select 이벤트 없이 커서만 옮겨도(키보드 이동) 누르는 순간의 커서 자리에 넣는다", () => {
    render(<Harness initial={[["부터 5년", "1"]]} />);
    const cell = screen.getByRole("textbox", { name: "1행 구분" }) as HTMLInputElement;
    fireEvent.focus(cell);
    cell.setSelectionRange(cell.value.length, cell.value.length);
    fireEvent.select(cell);
    cell.setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "(최초)계약일" }));
    expect(draftOf()[0][0]).toBe(`${BASE_DATE_CHIP}부터 5년`);
  });

  it("커서를 둔 칸이 없으면 마지막 행 구분 끝에, 행이 없으면 새 행에 넣는다", () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "(최초)계약일" }));
    expect(draftOf()).toEqual([[BASE_DATE_CHIP, ""]]);
  });
});
