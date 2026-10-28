import { describe, expect, it } from "vitest";

import { fitChipCount } from "./value-chips";

describe("fitChipCount — 칸에 통째로 들어가는 칩 수", () => {
  it("다 들어가면 전부 — 「+N」 자리를 남기지 않는다", () => {
    // 40 + 4 + 40 + 4 + 40 = 128
    expect(fitChipCount([40, 40, 40], 128, { gap: 4, more: 30 })).toBe(3);
  });

  it("넘치면 「+N」 자리(간격 + 폭)를 남기고 앞에서부터 들어가는 만큼", () => {
    // 2개 = 84, + 4 + 30 = 118 ≤ 120 · 3개 = 128 + 34 > 120
    expect(fitChipCount([40, 40, 40, 40], 120, { gap: 4, more: 30 })).toBe(2);
  });

  it("「+N」 자리 때문에 하나가 빠질 수 있다", () => {
    // 3개 = 128 ≤ 130 이지만 4개는 안 들어가니 「+N」(34)을 남기면 2개
    expect(fitChipCount([40, 40, 40, 40], 130, { gap: 4, more: 30 })).toBe(2);
  });

  it("첫 칩부터 안 들어가도 하나는 보인다 — 그 칩만 줄여 말줄임", () => {
    expect(fitChipCount([300, 40], 120, { gap: 4, more: 30 })).toBe(1);
  });

  it("칩이 없으면 0", () => {
    expect(fitChipCount([], 120, { gap: 4, more: 30 })).toBe(0);
  });
});
