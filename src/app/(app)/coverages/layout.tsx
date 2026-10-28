/**
 * 담보의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function CoveragesLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().coverage.listSummaries()).map((c) => ({ key: c.id, code: c.code, name: c.name, href: `/coverages/${c.id}` }));
  return (
    <ListDetailLayout menus={[{ id: "coverages", title: ENTITY_LABEL.coverage, listHref: "/coverages", base: "/coverages", items }]}>
      {children}
    </ListDetailLayout>
  );
}
