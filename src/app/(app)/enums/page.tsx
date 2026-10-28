/**
 * 열거형 조회 (L1) — 메뉴 「기본정보」 그룹의 첫 항목 「열거형」 `/enums` (기능/열거형 §4.1). 조립은 ListPage 가 한다.
 * 제목은 메뉴 이름 「열거형」, 오른쪽 `+` 는 새 열거형변수.
 */
import { EmptyState } from "@/app/_components/EmptyState";
import { ListPage, auditCol, identCol, type ListColumn } from "@/app/_components/ListPage";
import { includesQuery, paginate } from "@/app/_lib/list";
import { ENTITY_LABEL, FIELD_LABEL, NAME_LABEL, newLabel, searchPlaceholder } from "@/app/_lib/labels";
import { ENUMS_MENU } from "@/app/_lib/menu";
import type { EnumDef } from "@/domain/catalog";
import { getServices } from "@/lib/services";

import { ValueChips } from "./ValueChips";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
// 사용처 열 · 거르기는 두지 않는다 — 사용처는 관계정보 메뉴 (디자인원칙 §11.2, 2026-10-01).
interface Row {
  item: EnumDef;
}

export default async function EnumListPage({ searchParams }: { searchParams: Promise<{ error?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const services = getServices();
  const [enums, audits, users] = await Promise.all([services.catalog.listEnums(), services.catalog.enumAudits(), services.auth.listUsers()]);
  const userName = new Map(users.map((u) => [u.id, u.name] as const));
  const q = (sp.q ?? "").trim();
  const filtered: Row[] = enums.filter((item) => includesQuery(q, [item.code, item.label, ...item.values.map((value) => value.label)])).map((item) => ({ item }));
  const { rows, total, page } = paginate(filtered, sp.page, PAGE_SIZE);

  const columns: readonly ListColumn<Row>[] = [
    // 남는 폭은 값 열이 먹는다 — 이름은 짧고 값은 길다 (담보속성 목록과 같은 배분, §4.1)
    identCol(ENTITY_LABEL.enum, (r) => ({ code: r.item.code, name: r.item.label }), (r) => `/enums/${r.item.code}`, { width: "ident" }),
    { header: FIELD_LABEL.values, cell: (r) => (r.item.values.length === 0 ? <span className="ts-muted">—</span> : <ValueChips labels={[...r.item.values].sort((a, b) => a.order - b.order).map((value) => value.label)} />) },
    auditCol((r) => audits.get(r.item.code), userName),
  ];

  return (
    <ListPage
      title={ENUMS_MENU.label}
      create={{ href: q ? `/enums/new?q=${encodeURIComponent(q)}` : "/enums/new", label: newLabel(ENTITY_LABEL.enum) }}
      search={{ placeholder: searchPlaceholder(FIELD_LABEL.code, NAME_LABEL.enum, FIELD_LABEL.value) }}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.item.code}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      basePath="/enums"
      query={{ q }}
      error={sp.error}
      empty={enums.length === 0 ? <EmptyState what="열거형변수는 목록값 타입이 고르는 값의 정의다." example="심사유형: 일반심사 · 간편심사" actionHref="/enums/new" actionLabel={newLabel(ENTITY_LABEL.enum)} /> : <p className="ts-empty-what">이 조건에 맞는 열거형변수가 없습니다.</p>}
    />
  );
}
