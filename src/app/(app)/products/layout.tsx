/**
 * 상품의 목록 → 상세 한 화면 (ADR-0094) — 상세가 열리면 목록이 왼쪽 패널로 줄고 고른 항목이 탭으로 쌓인다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().product.listProducts()).map((p) => ({ key: p.id, name: p.name, href: `/products/${p.id}` }));
  return (
    <ListDetailLayout menus={[{ id: "products", title: ENTITY_LABEL.product, listHref: "/products", base: "/products", items }]}>
      {children}
    </ListDetailLayout>
  );
}
