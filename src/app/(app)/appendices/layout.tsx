/**
 * 별표의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function AppendicesLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().document.listAppendices()).map((a) => ({ key: a.code, code: a.code, name: a.name, href: `/appendices/${encodeURIComponent(a.code)}` }));
  return (
    <ListDetailLayout menus={[{ id: "appendices", title: ENTITY_LABEL.appendix, listHref: "/appendices", base: "/appendices", items }]}>
      {children}
    </ListDetailLayout>
  );
}
