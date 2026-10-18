"use client";

/**
 * 기본정보 저장 확인 — 화면 위쪽 모달 (2026-10-01, 옛 인라인 「저장하면 아래 항목이 삭제된다」 카드).
 *
 * 저장이 무엇을 함께 바꾸는지 서비스가 준 줄(`impact.cascade`)을 그대로 보인다 — 세목 제거(보험종목 · 종·형 조합 · 세목 부착)와
 * 독립특약 전환의 기본계약 해제(기능/상품 §3.1)가 한 창에 모인다. 상품담보 탭 저장도 같은 모달이다 — 탑재 해제 · 세목 부착 해제 줄에
 * 판정 변화 묶음(`impact.judgment` — 판정이 바뀌는 조 · 회색이 되는 사본 · 다시 쓰이는 사본 · 깨지는 참조)이 더해진다. 모양 · 여는 법은 편집 떠나기 확인(`DiscardDialog`)과 같다:
 * ref + effect 로 showModal (jsdom 은 제자리로 연다), Esc = 취소.
 */
import { useEffect, useRef } from "react";

import type { Impact, JudgmentImpact } from "@/domain/types";

/**
 * 판정 변화 묶음 (ADR-0082 결정 11 · 기능/상품 §3.8) — 상품담보 탭 저장이 판정 · 잠금을 바꿀 때. 막지 않는다(확인하면 저장).
 * 줄의 조 이름은 템플릿 번호 「제N조(제목)」(목차와 같은 표기).
 */
function JudgmentLines({ judgment }: { judgment: JudgmentImpact }) {
  const groups: { title: string; lines: string[] }[] = [
    { title: "판정이 바뀌는 조", lines: judgment.verdicts.map((v) => `${v.label} — ${v.before} → ${v.after}`) },
    { title: "회색이 되는 사본", lines: judgment.grayed.map((g) => `${g.label} — 사본이 쓰이지 않습니다(지우지 않는다)`) },
    { title: "다시 쓰이는 사본", lines: judgment.revived.map((g) => `${g.label} — 사본이 다시 쓰입니다`) },
    { title: "깨지는 참조", lines: judgment.brokenRefs.map((b) => `${b.label} — ${b.message}`) },
  ];
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g) => (
      <li key={g.title} className="ts-confirm-group">
        <span className="ts-confirm-group-title">{g.title}</span>
        <ul>
          {g.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </li>
    ));
}

export function SaveConfirmDialog({ impact, pending, onCancel, onConfirm }: { impact: Impact; pending?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    // jsdom 에는 showModal 이 없다 — 그때는 제자리로 연다
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);
  return (
    <dialog
      ref={ref}
      className="ts-dialog ts-dialog-top"
      aria-labelledby="ts-save-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <p id="ts-save-confirm-title" className="ts-confirm-title">저장하면 아래 내용이 함께 바뀝니다</p>
      <ul className="ts-confirm-loss">
        {impact.valueRowsLost > 0 && <li>입력한 값 {impact.valueRowsLost}건이 함께 삭제됩니다</li>}
        {impact.cascade.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        {impact.brokenRefs.length > 0 && <li>깨지는 참조 {impact.brokenRefs.length}건</li>}
        {impact.judgment && <JudgmentLines judgment={impact.judgment} />}
      </ul>
      <div className="ts-confirm-actions">
        <button type="button" autoFocus disabled={pending} onClick={onCancel}>
          취소
        </button>
        <button type="button" className="danger" disabled={pending} onClick={onConfirm}>
          바꾸고 저장
        </button>
      </div>
    </dialog>
  );
}
