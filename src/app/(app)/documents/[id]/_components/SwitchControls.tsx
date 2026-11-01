"use client";

/**
 * 값별 분기(switch, 최종 결정 5) 칸 머리의 조작 — 값 칩(× 빼기) · `+ 값`(칸 없는 값만) · 「문구 없음」(본문이 있으면 잠김) · 빈 칸 안내.
 * 블록 분기의 칸 머리(DocBody)와 문장 안 분기 팝업(Popups)이 같이 쓴다. 명령은 `setCase` 하나 — 값은 대상 열거형 순서로 넣는다.
 */
import { SWITCH_WORD } from "@/app/_lib/labels";
import type { EditOp } from "@/domain/document";

import { sortValues, switchValueLabel, unassignedValues, type SwitchSubject } from "./switchCases";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface CaseLike {
  id: string;
  values?: string[];
  empty?: true;
  children: readonly unknown[];
}

/** 값 표시 — 대상 열거형에 없는 코드는 「없는 값 V09」. */
export function caseValueLabel(subject: SwitchSubject | undefined, code: string): string {
  const known = subject ? subject.values.some((v) => v.code === code) : true;
  return known ? switchValueLabel(subject, code) : `없는 값 ${code}`;
}

/**
 * `reserve` — 「칸이 비었다」 줄의 자리를 늘 잡아 둔다(편집 탭 폼). 좁은 폭에서 그 줄은 제 줄을 차지하는데, 칸 문구를 쓰다 다른 칸을 누르면
 * 누르는 순간(초점이 떠나며 문구가 적용) 줄이 사라져 아래 칸이 밀려 올라가고, 뗄 때 다른 곳을 눌러 클릭이 빗나간다.
 */
export function CaseControls({ subject, branch, branches, apply, reserve = false }: { subject: SwitchSubject | undefined; branch: CaseLike; branches: readonly CaseLike[]; apply: (ops: readonly EditOp[]) => boolean; reserve?: boolean }) {
  const values = branch.values ?? [];
  const known = new Set((subject?.values ?? []).map((v) => v.code));
  const set = (next: readonly string[], empty = branch.empty === true) => apply([{ type: "setCase", branchId: branch.id, values: sortValues(subject, next), empty }]);
  const free = unassignedValues(subject, branches);
  const hasBody = branch.children.length > 0;
  return (
    <>
      {values.map((v) => (
        <span key={v} className={`ts-switch-chip${subject && !known.has(v) ? " is-missing" : ""}`}>
          {caseValueLabel(subject, v)}
          <Button type="button" variant="ghost" className="h-[18px] px-1 text-xs leading-[18px]" aria-label={`값 ${caseValueLabel(subject, v)} 빼기`} onClick={() => set(values.filter((x) => x !== v))}>
            ×
          </Button>
        </span>
      ))}
      {values.length === 0 && <span className="ts-cond-issue">값 없음 — 값을 고른다</span>}
      {free.length > 0 && (
        <NativeSelect aria-label="칸에 값 더하기" value="" onChange={(e) => e.target.value && set([...values, e.target.value])}>
          <option value="">+ 값</option>
          {free.map((v) => (
            <option key={v.code} value={v.code}>
              {v.label}
            </option>
          ))}
        </NativeSelect>
      )}
      <label className="ts-switch-empty" title={hasBody && !branch.empty ? "본문을 지운 뒤 켠다 — 「문구 없음」 칸은 본문이 없다" : "이 칸은 아무것도 내지 않는다"}>
        <Checkbox checked={branch.empty === true} disabled={hasBody && !branch.empty} onCheckedChange={(on) => set(values, on === true)} /> {SWITCH_WORD.empty}
      </label>
      {(reserve || (!branch.empty && !hasBody)) && (
        <span className="ts-cond-issue" style={!branch.empty && !hasBody ? undefined : { visibility: "hidden" }} aria-hidden={!branch.empty && !hasBody ? undefined : true}>
          칸이 비었다 — 본문을 쓰거나 「{SWITCH_WORD.empty}」
        </span>
      )}
    </>
  );
}
