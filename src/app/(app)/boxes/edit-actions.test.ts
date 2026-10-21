import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/test-utils";
import type { Actor } from "@/domain/types";
import { createServices, type Services } from "@/services/container";

/** 박스 상세 저장 액션 — 이름 · 제목 · 줄을 한 번에 (기능/박스 §4.3). 줄 칸 글은 한 줄 = 박스의 한 줄. */
const editor: Actor = { userId: "00000000-0000-4000-8000-000000000002", role: "editor" };
let t: TestDb;
let s: Services;

vi.mock("@/lib/services", () => ({
  getServices: () => s,
  currentActor: async () => editor,
}));

const { saveBoxEditAction } = await import("./edit-actions");

describe("saveBoxEditAction — 저장 한 번", () => {
  beforeAll(async () => {
    t = await createTestDb();
    s = createServices(t.db);
  });
  afterAll(async () => {
    await t.close();
  });

  it("제목 · 본문(줄 칸 글)을 한 번에 저장한다 — 【】로 싸서 적은 제목은 벗기고, 끝의 빈 줄은 버린다", async () => {
    const r = await s.document.createBox(editor, { lines: ["a"] });
    if (!r.ok) throw new Error("생성 실패");
    expect(await saveBoxEditAction(r.value.code, { title: "【보험연도】", lines: "보험연도란\n\n1년 단위\n\n" })).toEqual({ ok: true });
    expect(await s.document.getBox(r.value.code)).toEqual({ code: r.value.code, title: "보험연도", lines: ["보험연도란", "", "1년 단위"] });
  });

  it("제목 안에 【】가 남거나 본문이 비면 거부하고 아무것도 저장하지 않는다", async () => {
    const r = await s.document.createBox(editor, { title: "옛 제목", lines: ["x"] });
    if (!r.ok) throw new Error("생성 실패");
    expect(await saveBoxEditAction(r.value.code, { title: "【보험료】(알파Plus)", lines: "y" })).toMatchObject({ ok: false, message: expect.stringContaining("【】") });
    expect(await saveBoxEditAction(r.value.code, { title: "새 제목", lines: " \n" })).toMatchObject({ ok: false, message: expect.stringContaining("줄이 하나 이상") });
    expect(await s.document.getBox(r.value.code)).toMatchObject({ title: "옛 제목", lines: ["x"] });
  });
});
