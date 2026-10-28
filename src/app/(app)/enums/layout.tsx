/**
 * 열거형의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function EnumsLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().catalog.listEnums()).map((e) => ({ key: e.code, code: e.code, name: e.label, href: `/enums/${e.code}` }));
  return (
    <ListDetailLayout menus={[{ id: "enums", title: ENTITY_LABEL.enum, listHref: "/enums", base: "/enums", items }]}>
      {children}
    </ListDetailLayout>
  );
}
