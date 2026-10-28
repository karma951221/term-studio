/**
 * 목록 값 칩 한 줄에 통째로 들어가는 칩 수 (기능/열거형 §4.1) — 칩 글자는 자르지 않고, 안 들어가는 칩은 「+N」으로 센다.
 * `widths` 는 칩마다 제 폭(줄이지 않은), `available` 은 칸 폭. 넘치면 「+N」 자리(`gap + more`)를 남긴다.
 * 첫 칩부터 안 들어가도 하나는 보인다 — 그 칩만 줄여 말줄임.
 */
export function fitChipCount(widths: readonly number[], available: number, { gap, more }: { gap: number; more: number }): number {
  const total = widths.reduce((sum, width, index) => sum + width + (index > 0 ? gap : 0), 0);
  if (total <= available) return widths.length;
  let used = 0;
  let count = 0;
  for (const width of widths) {
    const next = used + (count > 0 ? gap : 0) + width;
    if (next + gap + more > available) break;
    used = next;
    count += 1;
  }
  return Math.max(count, widths.length > 0 ? 1 : 0);
}
