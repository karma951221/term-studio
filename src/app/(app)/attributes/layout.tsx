/**
 * 담보속성 — 전체 목록에는 하위 탭(담보속성 유형 · 상품담보명 규칙)이 서고, 유형 상세는 목록 → 상세 한 화면이다 (ADR-0094).
 * 상품담보명 규칙(`/attributes/template`)은 하위 탭 화면이라 항목이 아니다 — 목록 그대로.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { NavLink } from "@/app/_components/NavLink";
import { ENTITY_LABEL, FIELD_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

export default async function AttributesLayout({ children }: { children: React.ReactNode }) {
  const items = (await getServices().product.listAttributeKinds()).map((k) => ({ key: k.code, code: k.code, name: k.label, href: `/attributes/${k.code}` }));
  return (
    <ListDetailLayout
      menus={[{ id: "attributes", title: ENTITY_LABEL.attribute, listHref: "/attributes", base: "/attributes", exclude: ["template"], items }]}
      listHead={
        <div className="ts-types-head">
          <h1 className="ts-h1">{ENTITY_LABEL.attribute}</h1>
          <nav className="ts-subtabs" aria-label={`${ENTITY_LABEL.attribute} 하위 탭`}>
            <NavLink href="/attributes" label={FIELD_LABEL.type} excludePrefix="/attributes/template" />
            <NavLink href="/attributes/template" label={ENTITY_LABEL.namingTemplate} />
          </nav>
        </div>
      }
    >
      {children}
    </ListDetailLayout>
  );
}
