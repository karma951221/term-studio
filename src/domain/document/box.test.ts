import { describe, expect, it } from "vitest";

import { boxGist, boxHeading, boxHint, boxLabel, boxLinesFromText, boxLinesText, boxSearchTexts, createBox, formatBoxCode, isValidBoxCode, normalizeBoxTitle, reviseBox } from "./box";

/** 순번 출처 흉내 — 부를 때마다 1 씩 오른다. */
function seqSource(start = 1) {
  let next = start;
  return () => next++;
}

describe("박스 마스터 (기능/박스 §3.1 — 정적 마스터, 코드는 시스템 채번 BX000001 · 등록 후 불변)", () => {
  it("코드 접두는 BX · 최소 6자리, 자리수를 넘으면 자연 확장한다", () => {
    expect(formatBoxCode(1)).toBe("BX000001");
    expect(formatBoxCode(1_000_000)).toBe("BX1000000");
    expect(() => formatBoxCode(0)).toThrow(RangeError);
    expect(isValidBoxCode("BX000001")).toBe(true);
    expect(isValidBoxCode("AX000001")).toBe(false);
  });

  it("제목 · 줄을 넣으면 코드는 시스템이 BX000001 부터 채번한다 — 제목은 비워도 된다 (박스 이름 칸은 없다, 2026-10-21)", async () => {
    const nextSeq = seqSource();
    expect(await createBox({ title: "보험연도", lines: ["보험연도란 …"] }, nextSeq)).toEqual({
      ok: true,
      value: { code: "BX000001", title: "보험연도", lines: ["보험연도란 …"] },
    });
    expect(await createBox({ lines: ["가", "", "나"] }, nextSeq)).toMatchObject({ ok: true, value: { code: "BX000002", title: "", lines: ["가", "", "나"] } });
  });

  it("같은 제목의 박스가 여럿이어도 된다 — 코드로 가른다", async () => {
    const nextSeq = seqSource();
    expect(await createBox({ title: "보험료", lines: ["가"] }, nextSeq)).toMatchObject({ ok: true, value: { code: "BX000001" } });
    expect(await createBox({ title: "보험료", lines: ["나"] }, nextSeq)).toMatchObject({ ok: true, value: { code: "BX000002", title: "보험료" } });
  });

  it("제목은 괄호 없이 적는다 — 통째로 【】에 싸여 들어오면 벗기고, 안에 【】가 남으면 거부한다 (순번도 태우지 않는다)", async () => {
    const nextSeq = seqSource();
    expect(normalizeBoxTitle(" 【 보험료 】 ")).toBe("보험료");
    expect(normalizeBoxTitle("보험료")).toBe("보험료");
    expect(await createBox({ title: "【보험료】", lines: ["x"] }, nextSeq)).toMatchObject({ ok: true, value: { code: "BX000001", title: "보험료" } });
    const r = await createBox({ title: "【보험료】(알파Plus)", lines: ["x"] }, nextSeq);
    expect(r.ok).toBe(false);
    if (!r.ok && r.rejection.reason === "invalid") expect(r.rejection.issues[0].message).toContain("【】");
    expect(await createBox({ title: "x", lines: ["x"] }, nextSeq)).toMatchObject({ ok: true, value: { code: "BX000002" } });
  });

  it("줄 비움 거부 — 줄이 하나도 없는 박스는 만들 수 없다", async () => {
    const nextSeq = seqSource();
    const noLines = await createBox({ title: "제목", lines: [] }, nextSeq);
    expect(noLines.ok).toBe(false);
    if (!noLines.ok && noLines.rejection.reason === "invalid") expect(noLines.rejection.issues[0].message).toContain("줄이 하나 이상");
  });

  it("고치기 — 제목 · 줄을 한 번에 바꾼다", () => {
    const box = { code: "BX000001", title: "", lines: ["a"] };
    expect(reviseBox(box, { title: " 【보험연도】", lines: ["b"] })).toEqual({ ok: true, value: { ...box, title: "보험연도", lines: ["b"] } });
    expect(reviseBox(box, { title: "보험연도", lines: [] }).ok).toBe(false);
  });

  it("표시 — 제목은 시스템이 【】로 감싸고, 제목 없는 박스는 「(제목 없음)」 + 첫 줄 앞머리, 고르는 곳의 힌트는 코드 · 본문 앞머리", () => {
    expect(boxHeading("보험료")).toBe("【보험료】");
    expect(boxHeading("")).toBe("");
    expect(boxLabel({ title: "보험료", lines: ["가"] })).toBe("【보험료】");
    expect(boxLabel({ title: "", lines: ["", "발생할 경우 미리 정해진 비율로 보험금을 감액하여 지급"] })).toBe("(제목 없음) 발생할 경우 미리 정해진 비율로…");
    expect(boxLabel({ title: "", lines: [] })).toBe("(제목 없음)");
    expect(boxGist({ lines: ["  짧은 줄  "] })).toBe("짧은 줄");
    expect(boxHint({ code: "BX000003", title: "보험료", lines: ["보험료는 계약자가 회사에 내는 돈으로 매월 납입한다"] })).toBe("BX000003 · 보험료는 계약자가 회사에 내는 돈으로…");
  });

  it("검색 — 코드 · 제목 · 본문 글", () => {
    expect(boxSearchTexts({ code: "BX000001", title: "보험료", lines: ["가", "나"] })).toEqual(["BX000001", "보험료", "【보험료】", "가", "나"]);
  });

  it("줄 칸 글 ↔ 줄 목록 — 한 줄 = 한 줄, 가운데 빈 줄은 남고 끝의 빈 줄은 버린다", () => {
    expect(boxLinesFromText("가\r\n\n나\n\n")).toEqual(["가", "", "나"]);
    expect(boxLinesFromText("  \n")).toEqual([]);
    expect(boxLinesText(["가", "", "나"])).toBe("가\n\n나");
  });
});
