/**
 * 금액 표기 (순수) — 기능/동적표 §3.7 「금액」. 정액은 원 단위 정수로 입력하고, 표기는 만원 단위 글자다:
 * `5만원` · `2만 5천원` · `1,000만원` · `1억원` · `1억 5,000만원`. 천원 미만이 남으면(또는 정수가 아니면 — 감액 열의 정액 × 비율은 반올림하지 않는다) 원 단위 전체 `2,500원`.
 *
 * DB·React import 금지 (순수층).
 */

const comma = (n: number): string => n.toLocaleString("en-US");

export function formatWon(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount % 1000 !== 0) return `${comma(amount)}원`;
  if (amount === 0) return "0원";
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const cheon = Math.floor((amount % 10_000) / 1_000);
  const parts: string[] = [];
  if (eok > 0) parts.push(`${comma(eok)}억`);
  if (man > 0) parts.push(`${comma(man)}만`);
  if (cheon > 0) parts.push(`${cheon}천`);
  return `${parts.join(" ")}원`;
}
