/**
 * 표 구분자 상세 — 읽기 전용 (기능/구분자 §4.5, ADR-0099).
 *
 * 시스템이 정의한 구분자라 `편집` · 🗑 이 없다. 기본(코드 · 구분자명 · 레벨 · 결과 타입 · 짝 구분자 · 읽는 폼) → 계산 · 문구(견본 미리보기 + 문구 템플릿).
 */
import Link from "next/link";

import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { FIELD_LABEL, LEVEL_LABEL } from "@/app/_lib/labels";
import { DISCRIMINATORS_MENU, menuCrumb } from "@/app/_lib/menu";
import type { EnumDef } from "@/domain/catalog/types";
import type { TableDiscriminator } from "@/domain/dyntable/system";
import { findTableDiscriminator } from "@/domain/dyntable/system";
import { findMasterField } from "@/domain/master";

import { TablePreview } from "../_components/TablePreview";

/** 읽는 폼 값 자리 → 「감액 › 구간」 꼴 이름. */
function readLabel(path: string): string {
  const ref = findMasterField(path);
  return ref ? `${ref.form.label} › ${ref.field.label}` : path;
}

export function TableDiscriminatorDetail({ system, enums }: { system: TableDiscriminator; enums: readonly EnumDef[] }) {
  const pair = findTableDiscriminator(system.pair);
  const basics: [string, React.ReactNode][] = [
    [FIELD_LABEL.code, system.code],
    ["구분자명", system.label],
    ["레벨", LEVEL_LABEL[system.level]],
    [FIELD_LABEL.resultType, `표 — ${system.definition} · ${system.variant === "general" ? "일반표(감액 구간 열)" : "갱신표(열 하나)"}`],
    ["짝 구분자", pair ? <Link href={`/catalog/${pair.code}`}>{pair.label}</Link> : "—"],
    ["읽는 폼", system.reads.map(readLabel).join(" · ")],
  ];
  return (
    <div>
      <Breadcrumb items={[menuCrumb(DISCRIMINATORS_MENU), { label: system.label }]} />
      <div className="ts-dyn-page">
        <section className="ts-dyn-section" aria-labelledby="table-disc-basic">
          <h2 id="table-disc-basic" className="ts-dyn-section-title">
            기본 <span className="ts-badge" title="시스템이 정의한 표 구분자 — 고치거나 지울 수 없다">시스템</span>
          </h2>
          <div className="ts-dyn-basics">
            {basics.map(([label, value]) => (
              <div key={label} className="ts-dyn-basic">
                <span className="ts-form-label">{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <p className="ts-muted">
            식에서 읽을 수 없다 — 담보약관 문면의 블록 자리(조 · 항 아래)에만 놓고, 언제 낼지는 감싼 조건 블록이 정한다(예: 「감액 있음」 = 담보 레벨 구분자 <code>exist(reduction.periods)</code>).
          </p>
        </section>
        <section className="ts-dyn-section" aria-labelledby="table-disc-structure">
          <h2 id="table-disc-structure" className="ts-dyn-section-title">
            계산 · 문구
          </h2>
          <TablePreview code={system.code} enums={enums} />
        </section>
      </div>
    </div>
  );
}
