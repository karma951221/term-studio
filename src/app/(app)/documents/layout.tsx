/**
 * 약관 템플릿의 목록 → 상세 한 화면 (ADR-0094) — 경로 하나(`/documents`)를 두 메뉴(보통약관 · 담보약관 템플릿)가 나눠 쓴다.
 * 상세가 어느 메뉴 것인지는 항목이 든 목록으로, 생성 화면은 `?kind=` 로 가른다. 탭 · 접힘은 메뉴마다 따로 기억한다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { getServices } from "@/lib/services";

import { docListHref } from "./lib";

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const services = getServices();
  const [generals, specials] = await Promise.all([services.document.list("general"), services.document.list("special")]);
  const item = (d: { id: string; title: string }) => ({ key: d.id, name: d.title, href: `/documents/${d.id}` });
  return (
    <ListDetailLayout
      menus={[
        { id: "documents-general", title: ENTITY_LABEL.generalTemplate, listHref: docListHref("general"), base: "/documents", items: generals.map(item) },
        { id: "documents-coverage", title: ENTITY_LABEL.coverageTemplate, listHref: docListHref("coverage"), base: "/documents", newQuery: { kind: "coverage" }, items: specials.map(item) },
      ]}
    >
      {children}
    </ListDetailLayout>
  );
}
