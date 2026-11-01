/**
 * 구분자의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { TABLE_DISCRIMINATORS } from "@/domain/dyntable/system";
import { getServices } from "@/lib/services";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  // 시스템 표 구분자(기능/구분자 §3.7)도 같은 목록에 선다 — DB 가 아니라 코드에 정의된다
  const items = [...(await getServices().catalog.list()), ...TABLE_DISCRIMINATORS].map((d) => ({ key: d.code, code: d.code, name: d.label, href: `/catalog/${d.code}` }));
  return (
    <ListDetailLayout menus={[{ id: "catalog", title: ENTITY_LABEL.discriminator, listHref: "/catalog", base: "/catalog", exclude: ["enums"], items }]}>
      {children}
    </ListDetailLayout>
  );
}
