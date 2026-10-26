/**
 * 급부 특성(감액 · 면책 = 여는 폼)의 해제 판정 — 순수 (기능/담보 §3.4 · 기능/상품 §3.4 · §4.8).
 *
 * 특성은 값이다 — 폼 자리에 값이 하나라도 있으면 특성 있음, 없으면 무면책 · 감액 없음 (ADR-0065 §4).
 * 상품담보는 특성을 붙이고 뗀다(값 행을 쓰고 지운다). 저장된 특성이 이번 제출로 값을 하나도 안 남기면 「해제」 —
 * 저장 확인(「특성 해제 · {급부명} — 사라질 값」)의 재료다.
 */
import type { AttachLevel, Code, ValueSlot } from "../types";
import { formsOfLevel, masterPath, type MasterTree } from "./paths";

/** 한 제출의 값 하나 — `value === undefined` 는 미입력으로 되돌리기. */
export interface TraitWrite {
  path: string;
  value: unknown;
}

export interface TraitDetachment {
  form: { key: Code; label: string };
  /** 사라질 값 — 폼 선언 순. */
  lost: { path: string; label: string; value: unknown }[];
}

/** 저장된 값(`before`) 위에 제출(`entries`)을 얹었을 때 떨어져 나가는 특성. */
export function traitDetachments(level: AttachLevel, before: ReadonlyMap<string, ValueSlot>, entries: readonly TraitWrite[], master?: MasterTree): TraitDetachment[] {
  const after = new Map<string, boolean>();
  for (const [path, slot] of before) after.set(path, slot.entered);
  for (const e of entries) after.set(e.path, e.value !== undefined);
  const out: TraitDetachment[] = [];
  for (const form of formsOfLevel(level, master)) {
    if (!form.optional) continue;
    const fields = form.fields.map((f) => ({ path: masterPath(form.key, f.key), label: f.label }));
    const lost = fields.flatMap(({ path, label }) => {
      const slot = before.get(path);
      return slot?.entered ? [{ path, label, value: slot.value as unknown }] : [];
    });
    if (lost.length === 0) continue;
    if (fields.some(({ path }) => after.get(path) === true)) continue;
    out.push({ form: { key: form.key, label: form.label }, lost });
  }
  return out;
}

function shown(value: unknown): string {
  if (value === true) return "예";
  if (value === false) return "아니오";
  if (Array.isArray(value)) return value.length > 0 && typeof value[0] === "object" ? `${value.length}행` : value.join(", ");
  return String(value);
}

/** 저장 확인 모달의 한 줄 — 「특성 해제 · 암진단급부 · 면책 — 사라질 값: 기간 3 · …」. */
export function describeTraitDetachment(nodeName: string, d: TraitDetachment): string {
  return `특성 해제 · ${nodeName} · ${d.form.label} — 사라질 값: ${d.lost.map((l) => `${l.label} ${shown(l.value)}`).join(" · ")}`;
}
