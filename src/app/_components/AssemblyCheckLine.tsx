import type { PendingBranch } from "@/domain/assembly";
import { formatCoordinate } from "@/domain/coordinate";
import type { Issue } from "@/domain/types";

import { coordinateHref } from "./coordinateHref";

/**
 * 조립 검사 · 내용 검토 한 줄 (디자인원칙 §9.2 · 기능/조립산출 §4.1) — 미리보기 머리에 선다.
 *
 * - 막힌 분기 기록(`pending`, ADR-0092 결정 6)이 있으면 「조립 검사: 오류 a · 경고 b · 평가 대기 c · 내용 검토: 미실시」.
 *   「평가 대기 c」 = 조건 평가 오류로 어느 가지도 고르지 못한 분기 수 — 0 이어도 붙인다(「오류 0」이 「전부 검사했다」로 읽히지 않게).
 *   누르면 막힌 분기 목록 — 줄마다 결과 자리 · 원인 · 「미리보기에서 보기」(`viewHref` — 그 조의 출처 패널 + 그 분기 강조) · 「고치러 가기」(원천).
 * - 옛 산출본(`pending` 없음)은 고정 문구 「분기 미결로 미검사 범위가 있을 수 있음」.
 * 「내용 검토: 미실시」 는 MVP 고정 문구 — 자동 검사를 사람의 검토 완료로 확대하지 않는다(결정 5).
 */
export function AssemblyCheckLine({ issues, pending, viewHref }: { issues: readonly Issue[]; pending?: readonly PendingBranch[]; viewHref?: (p: PendingBranch) => string | undefined }) {
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const errors = issues.length - warnings;
  if (pending === undefined) {
    return (
      <p className="ts-count">
        조립 검사: 오류 <b>{errors}</b> · 경고 {warnings} — 분기 미결로 미검사 범위가 있을 수 있음 (밟지 않은 가지 안쪽은 검사하지 않는다) · 내용 검토: 미실시
      </p>
    );
  }
  const head = (
    <>
      조립 검사: 오류 <b>{errors}</b> · 경고 {warnings} ·{" "}
    </>
  );
  if (pending.length === 0) {
    return (
      <p className="ts-count">
        {head}평가 대기 0 · 내용 검토: 미실시
      </p>
    );
  }
  return (
    <details className="ts-count ts-pending">
      <summary style={{ cursor: "pointer" }}>
        {head}
        <span className="ts-pending-count">평가 대기 {pending.length}</span> · 내용 검토: 미실시
      </summary>
      <ul className="ts-pending-list" aria-label="평가 대기 — 막힌 분기">
        {pending.map((p, i) => {
          const view = viewHref?.(p);
          const fix = coordinateHref(p.source);
          return (
            <li key={i}>
              {formatCoordinate(p.at)} — {p.message}
              {view && (
                <>
                  {" "}
                  · <a href={view}>미리보기에서 보기</a>
                </>
              )}
              {fix && (
                <>
                  {" "}
                  · <a href={fix}>고치러 가기</a>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
