/**
 * 구분자의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().catalog.list()).map((d) => ({ key: d.code, code: d.code, name: d.label, href: `/catalog/${d.code}` }));
  return (
    <ListDetailLayout menus={[{ id: "catalog", title: ENTITY_LABEL.discriminator, listHref: "/catalog", base: "/catalog", exclude: ["enums"], items }]}>
      {children}
    </ListDetailLayout>
  );
}
