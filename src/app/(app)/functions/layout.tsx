/**
 * 함수조항의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function FunctionsLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().clause.summaries()).map((c) => ({ key: c.code, code: c.code, name: c.label, href: `/functions/${c.code}` }));
  return (
    <ListDetailLayout menus={[{ id: "functions", title: ENTITY_LABEL.clause, listHref: "/functions", base: "/functions", items }]}>
      {children}
    </ListDetailLayout>
  );
}
