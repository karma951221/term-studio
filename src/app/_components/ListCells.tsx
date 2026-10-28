/**
 * L1 목록의 두 줄 칸 (디자인원칙 §2 L1, 2026-10-21) — 짝으로 다니는 두 열을 한 열 두 줄로 묶는다.
 *
 * - `IdentCell` — 조회 대상의 이름 · 코드. 1줄째 이름(상세로 가는 링크 · 굵게), 2줄째 코드(작게 · mono · 옅은 색) (2026-10-29 뒤집음 — 사람은 이름으로 찾는다).
 *   하위 항목(담보속성의 값)의 이름 · 코드도 같은 칸이다 — 링크 없이. 편집 모드면 이름 자리에 입력칸이 선다 (2026-10-21).
 * - `AuditCell` — 최종수정. 1줄째 수정일자(mono), 2줄째 수정자.
 *
 * ListPage 의 `identCol` · `auditCol` 이 쓰고, ListPage 를 거치지 않는 표(폼 조회)도 같은 칸을 쓴다.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { formatDate, type AuditStamp } from "../_lib/list";

export function IdentCell({ code, name, href, title }: { code: ReactNode; name: ReactNode; href?: string; title?: string }) {
  return (
    <span className="ts-two-line ts-ident">
      {href ? (
        <Link href={href} className="ts-ident-name" title={title}>
          {name}
        </Link>
      ) : (
        <span className="ts-ident-name">{name}</span>
      )}
      <code className="ts-ident-code">{code}</code>
    </span>
  );
}

/** 수정 기록이 없으면 「—」. 수정자를 모르는 대상(담보 — 스키마에 없다)은 날짜 한 줄. */
export function AuditCell({ audit, names }: { audit: AuditStamp | undefined; names?: ReadonlyMap<string, string> }) {
  if (!audit) return <span className="ts-muted">—</span>;
  const by = audit.updatedBy ? names?.get(audit.updatedBy) : undefined;
  return (
    <span className="ts-two-line ts-audit">
      <span className="ts-mono">{formatDate(audit.updatedAt)}</span>
      {names ? <span className="ts-audit-by">{by ?? "—"}</span> : null}
    </span>
  );
}
