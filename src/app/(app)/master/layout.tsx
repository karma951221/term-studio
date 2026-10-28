/**
 * 폼의 목록 → 상세 한 화면 (ADR-0094) — 항목 탭은 폼이다. 필드 상세(`/master/폼키.필드키`)는 그 폼 탭의 상세2.
 * 폼은 코드에 산다(`MASTER`) — DB 를 읽지 않는다.
 */
import { ListDetailLayout } from "@/app/_components/ListDetailLayout";
import { FORMS_MENU } from "@/app/_lib/menu";
import { MASTER } from "@/domain/master";

import { formHref } from "./lib";

const ITEMS = MASTER.map((f) => ({ key: f.key, code: f.key, name: f.label, href: formHref(f.key) }));

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return (
    <ListDetailLayout menus={[{ id: "master", title: FORMS_MENU.label, listHref: FORMS_MENU.href, base: FORMS_MENU.href, exclude: ["enums"], keySeparator: ".", items: ITEMS }]}>
      {children}
    </ListDetailLayout>
  );
}
