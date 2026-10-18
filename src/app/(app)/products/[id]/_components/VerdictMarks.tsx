/**
 * 판정 배지 · 「잠김」 · 일부 연결 경고 아이콘 (기능/상품 §3.12 · §4.6) — 보통약관 탭 목차 줄 · 모델링 패널 조 머리가 같이 쓴다.
 * 재료는 `verdictView.articleMarks`(판정기 결과 · 정적 연결 잠금). 마스터는 배지가 없다. 경고 아이콘은 준용하기 옵션 조의 일부 연결에만.
 */
import { IconWarn } from "@/app/_components/icons";

import type { ArticleMark } from "../../verdictView";

/** 일부 연결 경고 아이콘 — 마우스를 올리면 경고 문구(연결하지 않은 담보). */
export function PartialLinkIcon({ warning, label }: { warning: string; label: string }) {
  return (
    <span className="ts-verdict-warn" role="img" aria-label={`일부 연결 경고 · ${label}`} title={warning}>
      <IconWarn />
    </span>
  );
}

/** 판정 배지 + 「잠김」 (+ 목차면 경고 아이콘). `withWarning` 이 거짓이면 아이콘은 부르는 쪽이 옵션 표시 옆에 둔다. */
export function VerdictMarks({ mark, label, withWarning = true }: { mark: ArticleMark | undefined; label: string; withWarning?: boolean }) {
  if (!mark) return null;
  return (
    <>
      {mark.verdict && (
        <span className="ts-badge ts-verdict-badge" aria-label={`이 상품 판정 · ${mark.verdict.text}`} title={mark.verdict.tip}>
          {mark.verdict.text}
        </span>
      )}
      {mark.locked && (
        <span className="ts-badge locked ts-lock-badge" title="블록 · 기본계약이 조연결한 조 — 이 상품에서 사본으로 고칠 수 없다">
          잠김
        </span>
      )}
      {withWarning && mark.warning && <PartialLinkIcon warning={mark.warning} label={label} />}
    </>
  );
}
