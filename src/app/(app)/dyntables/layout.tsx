/**
 * 동적표의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function DynTablesLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().dynTable.summaries()).map((t) => ({ key: t.code, code: t.code, name: t.label, href: `/dyntables/${t.code}` }));
  return (
    <ListDetailLayout menus={[{ id: "dyntables", title: ENTITY_LABEL.dynTable, listHref: "/dyntables", base: "/dyntables", items }]}>
      {children}
    </ListDetailLayout>
  );
}
