import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { DISCRIMINATORS_MENU, menuCrumb } from "@/app/_lib/menu";
import { findTableDiscriminator } from "@/domain/dyntable/system";
import { MASTER } from "@/domain/master";
import { getServices } from "@/lib/services";

import { candidateGroupsOfGenerals } from "../generals";
import { insertPanelData } from "../lib";
import { CatalogEditor } from "./CatalogEditor";
import { TableDiscriminatorDetail } from "./TableDiscriminatorDetail";

export const dynamic = "force-dynamic";

export default async function CatalogDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const services = getServices();
  // 시스템 표 구분자(기능/구분자 §3.7 · §4.5) — 읽기 전용 상세 · 견본 미리보기
  const system = findTableDiscriminator(code);
  if (system) return <TableDiscriminatorDetail system={system} enums={await services.catalog.listEnums()} />;
  const def = await services.catalog.get(code);
  if (!def) return <div><Breadcrumb items={[menuCrumb(DISCRIMINATORS_MENU), { label: code }]} /><p className="ts-error-banner">찾을 수 없습니다.</p></div>;
  const [enums, defs, candidateGroups, inspection] = await Promise.all([
    services.catalog.listEnums(),
    services.catalog.list(),
    // 준용예외 구분자의 후보 칸 재료 (ADR-0098 결정 1) — 다른 구분자는 쓰지 않는다
    def.resultType?.kind === "list<ref>" ? candidateGroupsOfGenerals() : Promise.resolve([]),
    // 저장된 정의를 그대로 검사 — 읽기 모드의 경고 배지(별칭 · 깨진 사용처) 재료 (기능/구분자 §3.3).
    // 경고는 저장하지 않고 읽을 때 계산한다.
    services.catalog.inspect({ code, expression: def.expression, level: def.level, ...(def.resultType ? { resultType: def.resultType } : {}) }),
  ]);
  // 넣기 패널 재료 — 마스터 필드 트리와 구분자 목록을 직렬화해 넘긴다 (기능/구분자 §4.3)
  const panel = insertPanelData(MASTER, defs);
  // 사용처(쓰는 조문 · 참조하는 구분자 · 영향 받는 상품)는 이 화면에 두지 않는다 — 관계정보 메뉴 (디자인원칙 §11.2, 2026-10-01).
  return <div><CatalogEditor def={def} enums={enums} catalog={defs.filter((d) => d.code !== code)} warnings={inspection.warnings} panel={panel} candidateGroups={candidateGroups} /></div>;
}
