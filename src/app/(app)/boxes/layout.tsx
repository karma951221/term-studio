/**
 * 박스의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { boxLabel } from "@/domain/document";
import { getServices } from "@/lib/services";

export default async function BoxesLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().document.listBoxes()).map((x) => ({ key: x.code, code: x.code, name: boxLabel(x), href: `/boxes/${encodeURIComponent(x.code)}` }));
  return (
    <ListDetailLayout menus={[{ id: "boxes", title: ENTITY_LABEL.box, listHref: "/boxes", base: "/boxes", items }]}>
      {children}
    </ListDetailLayout>
  );
}
