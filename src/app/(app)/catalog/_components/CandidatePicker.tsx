"use client";

/**
 * 준용예외 구분자의 후보 칸 (기능/구분자 §3.8 · ADR-0098 결정 1) — 보통약관 템플릿마다 조를 체크로 고른다(여러 템플릿 가능).
 * 식 칸 대신 선다. 값(준용예외 목록)은 조립이 특약 · 블록 문맥마다 판정한다 — 여기서 고르는 것은 「빼는 대상으로 볼 조」다.
 * `name` 을 주면 고른 조마다 hidden input 을 실어 폼 제출(생성)에 쓴다.
 */
import type { Id } from "@/domain/types";

import type { CandidateGroup } from "../lib";

export function CandidatePicker({ groups, value, onChange, name }: { groups: readonly CandidateGroup[]; value: readonly Id[]; onChange: (next: Id[]) => void; name?: string }) {
  const picked = new Set(value);
  const toggle = (id: Id) => onChange(picked.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="ts-candidate-picker" role="group" aria-label="후보 조">
      {groups.length === 0 ? <p className="ts-muted">보통약관 템플릿이 없습니다.</p> : null}
      {groups.map((g) => (
        <fieldset key={g.id} className="ts-candidate-group">
          <legend>{g.title}</legend>
          {g.articles.map((a) => (
            <label key={a.id} className="ts-candidate-item">
              <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} /> {a.label}
            </label>
          ))}
        </fieldset>
      ))}
      {name ? value.map((id) => <input key={id} type="hidden" name={name} value={id} />) : null}
    </div>
  );
}

/** 읽기 표시 — 고른 조를 템플릿 · 「제N조(제목)」로. 템플릿에서 지워진 조는 「없는 조」. */
export function candidateLabels(groups: readonly CandidateGroup[], value: readonly Id[]): string[] {
  return value.map((id) => {
    for (const g of groups) {
      const a = g.articles.find((x) => x.id === id);
      if (a) return `${g.title} ${a.label}`;
    }
    return `없는 조 ${id}`;
  });
}
