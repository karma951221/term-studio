"use client";

/**
 * 기본정보 저장 확인 — 화면 위쪽 모달 (2026-10-01, 옛 인라인 「저장하면 아래 항목이 삭제된다」 카드).
 *
 * 저장이 무엇을 함께 바꾸는지 서비스가 준 줄(`impact.cascade`)을 그대로 보인다 — 세목 제거(보험종목 · 종·형 조합 · 세목 부착)와
 * 독립특약 전환의 기본계약 해제(기능/상품 §3.1)가 한 창에 모인다. 상품담보 탭 저장도 같은 모달이다 — 탑재 해제 · 세목 부착 해제 줄에
 * 판정 변화 묶음(`impact.judgment` — 판정이 바뀌는 조 · 회색이 되는 사본 · 다시 쓰이는 사본 · 깨지는 참조)이 더해진다. 모양 · 여는 법은 편집 떠나기 확인(`DiscardDialog`)과 같다:
 * Radix Dialog(위젯, 2026-11-01 ADR-0085 2단계) — Esc · 바깥 누름 = 취소. 화면 위쪽(12vh)에 고정한다.
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { JudgmentLines } from "@/app/_components/JudgmentLines";
import type { Impact } from "@/domain/types";

export function SaveConfirmDialog({ impact, pending, onCancel, onConfirm }: { impact: Impact; pending?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="top-[12vh] translate-y-0 sm:max-w-[560px]">
        <DialogTitle className="ts-confirm-title">저장하면 아래 내용이 함께 바뀝니다</DialogTitle>
        <ul className="ts-confirm-loss">
          {impact.valueRowsLost > 0 && <li>입력한 값 {impact.valueRowsLost}건이 함께 삭제됩니다</li>}
          {impact.cascade.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          {impact.brokenRefs.length > 0 && <li>깨지는 참조 {impact.brokenRefs.length}건</li>}
          {impact.judgment && <JudgmentLines judgment={impact.judgment} />}
        </ul>
        <DialogFooter className="ts-confirm-actions">
          <Button autoFocus disabled={pending} onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            바꾸고 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
