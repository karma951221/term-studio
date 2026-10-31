/**
 * 금액 표기 — 기능/동적표 §3.7 「금액」: 정액은 원 단위 정수, 표기는 만원 단위 글자 · 천원 미만이 남으면 원 단위.
 */
import { describe, expect, it } from "vitest";

import { formatWon } from "./amount";

describe("formatWon — 만원 단위 글자 (기능/동적표 §3.7)", () => {
  it("만원 · 천원 · 억원", () => {
    expect(formatWon(50_000)).toBe("5만원");
    expect(formatWon(25_000)).toBe("2만 5천원");
    expect(formatWon(10_000_000)).toBe("1,000만원");
    expect(formatWon(40_000_000)).toBe("4,000만원");
    expect(formatWon(100_000_000)).toBe("1억원");
    expect(formatWon(150_000_000)).toBe("1억 5,000만원");
    expect(formatWon(100_050_000)).toBe("1억 5만원");
    expect(formatWon(5_000)).toBe("5천원");
  });
  it("천원 미만이 남으면 원 단위 전체 — 감액 열의 소수도 반올림하지 않고 그대로", () => {
    expect(formatWon(2_500)).toBe("2,500원");
    expect(formatWon(12_500)).toBe("12,500원");
    expect(formatWon(4_073.85)).toBe("4,073.85원");
    expect(formatWon(0)).toBe("0원");
  });
});
