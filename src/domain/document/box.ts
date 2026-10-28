/**
 * 박스 마스터 — 정적 마스터의 하위 (기능/박스 · ADR-0076 결정 11 · 최종 결정 9).
 *
 * - 박스 = 놓인 자리에 내용이 그대로 들어가는 고정 글(직접참조). 코드 · 제목 · 줄뿐이다.
 *   **안에 참조 · 슬롯 · 옵션을 두지 않는다** — 줄은 글 한 줄(string). 박스 안 「제2항」은 고정 글이다(기존 한계).
 * - 문서 · 함수조항 본문은 박스 참조 노드(`boxRef`)에 코드만 저장하고, 조립이 이 마스터에서 내용을 읽어 그 자리에 편다.
 * - 코드는 **시스템 자동 채번 · 등록 후 불변** — `BX000001` 부터. 순번은 `code_sequences` kind `box`(별표와 같은 방식).
 * - **박스 이름은 따로 없다** — 제목이 곧 이름이다(2026-10-21). 제목은 **목록 · 검색 · 고르기에서 박스를 부르는 이름일 뿐**
 *   출력에 찍히지 않는다(2026-10-28). 약관에 찍히는 「【…】」 머리는 본문 첫 줄에 직접 적는다 — 출력은 본문(줄)만 쓴다.
 *   제목은 비워도 되고 같은 제목이 여럿이어도 된다 — 고르는 곳은 코드 · 본문 앞머리를 함께 보인다.
 * - 줄은 하나 이상. 가운데 빈 줄은 간격으로 남는다(실물 박스에 있다).
 */

import { ok, reject } from "../types";
import type { Code, Result } from "../types";

export interface Box {
  code: Code;
  /** 목록 이름 — 괄호 없이. 출력에 찍히지 않는다(【…】 머리는 본문에). 비울 수 있고 겹쳐도 된다. */
  title: string;
  /** 줄 — 글 한 줄씩. 하나 이상. */
  lines: string[];
}

/** 생성 입력에 code 는 없다 — 코드는 시스템이 채번한다 (타입으로 강제). */
export interface NewBox {
  title?: string;
  lines: readonly string[];
}

/** 상세 저장 한 번의 최종 상태 — 제목 · 줄 (디자인원칙: 편집 화면 하나 = 저장 하나). */
export interface BoxRevision {
  title: string;
  lines: readonly string[];
}

function invalid<T>(message: string): Result<T> {
  return reject({ reason: "invalid", issues: [{ kind: "typeMismatch", message, at: {} }] });
}

/* ── 채번 ─────────────────────────────────────────────────────────────────── */

export const BOX_CODE_PREFIX = "BX";
export const BOX_CODE_MIN_WIDTH = 6;
export const BOX_CODE_PATTERN = /^BX(\d+)$/;

/** 순번의 출처 — 저장소가 구현한다 (`code_sequences` 의 kind `box` · scope 전역). */
export type BoxNextSeq = () => Promise<number> | number;

export function formatBoxCode(seq: number): Code {
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError(`코드 순번은 1 이상의 정수여야 합니다: ${seq}`);
  return BOX_CODE_PREFIX + String(seq).padStart(BOX_CODE_MIN_WIDTH, "0");
}

export function isValidBoxCode(code: string): boolean {
  return BOX_CODE_PATTERN.test(code);
}

/* ── 규칙 ─────────────────────────────────────────────────────────────────── */

/** 제목 정리 — 앞뒤 공백을 떼고, 통째로 【…】에 싸여 들어오면 벗긴다(사람이 【】를 쳐도 이중으로 감싸지 않게). */
export function normalizeBoxTitle(raw: string): string {
  const t = raw.trim();
  const m = /^【([^【】]*)】$/.exec(t);
  return m ? m[1].trim() : t;
}

/** 제목 · 줄 검사 — 통과하면 정리한 값. */
function checked(input: BoxRevision): Result<Omit<Box, "code">> {
  const title = normalizeBoxTitle(input.title);
  if (/[【】]/.test(title)) return invalid("제목은 목록 이름이라 【】를 넣지 않는다 — 약관에 찍을 【…】 머리는 본문 첫 줄에 적는다");
  if (input.lines.length === 0) return invalid("박스에는 줄이 하나 이상 있어야 합니다");
  return ok({ title, lines: [...input.lines] });
}

/** 박스 등록. 검사를 먼저 하고 채번한다 — 거절된 등록이 순번을 태우지 않게. */
export async function createBox(input: NewBox, nextSeq: BoxNextSeq): Promise<Result<Box>> {
  const r = checked({ title: input.title ?? "", lines: input.lines });
  if (!r.ok) return r;
  return ok({ code: formatBoxCode(await nextSeq()), ...r.value });
}

/** 상세 저장 — 제목 · 줄의 최종 상태를 한 번에 검사한다. */
export function reviseBox(box: Box, input: BoxRevision): Result<Box> {
  const r = checked(input);
  if (!r.ok) return r;
  return ok({ code: box.code, ...r.value });
}

/* ── 표시 ─────────────────────────────────────────────────────────────────── */

/** 머리 줄 — 줄 전체가 「【…】」 한 덩이. 출력은 굵게 그리고, 앞머리는 건너뛴다. */
export function isBoxHeadingLine(line: string): boolean {
  return /^【[^【】]+】$/.test(line.trim());
}

/** 제목을 본문 머리로 — 제목이 있으면 본문 앞에 「【제목】」 줄을 넣는다. 제목이 출력에 찍히던 옛 박스를 렌더 결과 그대로 옮길 때 쓴다(2026-10-28). */
export function headedBoxLines(title: string, lines: readonly string[]): string[] {
  return title === "" ? [...lines] : [`【${title}】`, ...lines];
}

const GIST_MAX = 20;

/** 본문 앞머리 — 머리 줄(【…】)을 건너뛴 첫 글 있는 줄을 낱말 단위로 20자 안쪽까지, 잘렸으면 「…」. */
export function boxGist(box: Pick<Box, "lines">): string {
  const line = (box.lines.find((l) => l.trim() !== "" && !isBoxHeadingLine(l)) ?? "").replace(/\s+/g, " ").trim();
  if ([...line].length <= GIST_MAX) return line;
  let out = "";
  for (const word of line.split(" ")) {
    const next = out === "" ? word : `${out} ${word}`;
    if ([...next].length > GIST_MAX) break;
    out = next;
  }
  return `${out === "" ? [...line].slice(0, GIST_MAX).join("") : out}…`;
}

/** 박스를 부르는 이름 — 제목 그대로, 제목 없는 박스는 「(제목 없음) 본문 앞머리」 (목록 · 경로 · 고르기 목록). */
export function boxLabel(box: Pick<Box, "title" | "lines">): string {
  if (box.title !== "") return box.title;
  const gist = boxGist(box);
  return gist === "" ? "(제목 없음)" : `(제목 없음) ${gist}`;
}

/** 고르는 칸(검색 콤보)의 줄 — 「제목 본문 앞머리」(코드는 힌트로 따로). 같은 제목이 여럿이어도 본문으로 가른다. */
export function boxGistLabel(box: Pick<Box, "title" | "lines">): string {
  if (box.title === "") return boxLabel(box);
  const gist = boxGist(box);
  return gist === "" ? box.title : `${box.title} ${gist}`;
}

/** 고르기 목록 한 줄 — 「제목(코드) 본문 앞머리」. 같은 제목이 여럿이어도 코드 · 본문으로 가른다. */
export function boxPickLabel(box: Box): string {
  const gist = boxGist(box);
  const head = `${box.title === "" ? "(제목 없음)" : box.title}(${box.code})`;
  return gist === "" ? head : `${head} ${gist}`;
}

/** 검색이 보는 글 — 코드 · 제목 · 본문 줄(【…】 머리 줄 포함). */
export function boxSearchTexts(box: Box): string[] {
  return [box.code, ...(box.title === "" ? [] : [box.title]), ...box.lines];
}

/* ── 줄 칸 ─────────────────────────────────────────────────────────────────── */

/** 줄 칸(여러 줄 글) → 줄 목록. 한 줄 = 한 줄, 가운데 빈 줄은 남기고 끝의 빈 줄 · 공백 줄은 버린다. */
export function boxLinesFromText(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines;
}

/** 줄 목록 → 줄 칸 글. */
export function boxLinesText(lines: readonly string[]): string {
  return lines.join("\n");
}
