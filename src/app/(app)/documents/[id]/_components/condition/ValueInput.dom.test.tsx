// @vitest-environment jsdom
/**
 * 조건 값 칸 — 「uncontrolled 에서 controlled 로」 경고가 없다 (2026-11-01, E2E 함수조항 생성에서 관측).
 *
 * 좌변이 비었을 때(`disabled` 자리 칸)와 좌변을 고른 뒤(글 칸)는 같은 자리의 같은 `<Input>` 이라 DOM 이 재사용된다.
 * 앞쪽에 value 가 없으면 React 가 비제어 → 제어로 바뀐다고 경고한다.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConditionRow } from "@/domain/document";

import { ValueInput } from "./CondRows";
import type { CtxDiscriminator } from "./types";

afterEach(cleanup);

const empty = { left: undefined, op: "==", right: undefined } as unknown as ConditionRow;
const picked = { left: { kind: "discriminator", code: "D1" }, op: "==", right: undefined } as unknown as ConditionRow;
const stringDef = { code: "D1", label: "사유", type: { kind: "string" } } as unknown as CtxDiscriminator;

describe("ValueInput", () => {
  it("좌변이 빈 줄에서 좌변을 고른 줄로 바뀌어도 비제어 → 제어 경고가 없다", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const props = { name: "IF 1번 줄", refText: () => "", onChange: () => {}, onDone: () => {} };
    const { rerender, getByLabelText } = render(<ValueInput {...props} row={empty} />);
    expect((getByLabelText("IF 1번 줄 값") as HTMLInputElement).disabled).toBe(true);
    rerender(<ValueInput {...props} row={picked} def={stringDef} />);
    expect((getByLabelText("IF 1번 줄 값") as HTMLInputElement).disabled).toBe(false);
    const messages = warn.mock.calls.map((c) => String(c[0]));
    warn.mockRestore();
    expect(messages.filter((m) => m.includes("uncontrolled"))).toEqual([]);
  });
});
