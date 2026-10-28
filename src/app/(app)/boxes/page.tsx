/**
 * 박스 조회 (L1) — 정적 마스터 › 박스 (기능/박스 §4.1). 별표 목록과 같은 모양이다 — 화면은 컬럼만 적고 조립은 ListPage.
 * 목록의 일은 찾아서 들어가는 것이다 — 고치기 · 삭제는 상세(L2)에서.
 * 컬럼은 박스(1줄째 【제목】(상세로) · 2줄째 코드) · 최종수정(일자 · 수정자) — 박스 이름 칸은 없다, 제목이 곧 이름 (2026-10-21, 기능/박스 §3.1).
 * 제목 없는 박스는 「(제목 없음) 본문 앞머리」. 검색은 코드 · 제목 · 본문을 본다.
 */
import { EmptyState } from "@/app/_components/EmptyState";
import { ListPage, auditCol, identCol, type ListColumn } from "@/app/_components/ListPage";
import { includesQuery, paginate } from "@/app/_lib/list";
import { BOX_BODY_LABEL, ENTITY_LABEL, FIELD_LABEL, newLabel, searchPlaceholder } from "@/app/_lib/labels";
import { boxLabel, boxSearchTexts, type Box } from "@/domain/document";
import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface SearchParams {
  error?: string;
  q?: string;
  page?: string;
}

export default async function BoxesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const services = getServices();
  const [list, audits, users] = await Promise.all([services.document.listBoxes(), services.document.boxAudits(), services.auth.listUsers()]);
  const userName = new Map(users.map((u) => [u.id, u.name] as const));

  const q = (sp.q ?? "").trim();
  const filtered = list.filter((x) => includesQuery(q, boxSearchTexts(x)));
  const { rows, total, page } = paginate(filtered, sp.page, PAGE_SIZE);

  const columns: readonly ListColumn<Box>[] = [
    identCol(ENTITY_LABEL.box, (x) => ({ code: x.code, name: boxLabel(x) }), (x) => `/boxes/${encodeURIComponent(x.code)}`),
    auditCol((x) => audits.get(x.code), userName),
  ];

  return (
    <ListPage
      title={ENTITY_LABEL.box}
      create={{ href: "/boxes/new", label: newLabel(ENTITY_LABEL.box) }}
      search={{ placeholder: searchPlaceholder(FIELD_LABEL.code, FIELD_LABEL.title, BOX_BODY_LABEL) }}
      columns={columns}
      rows={rows}
      rowKey={(x) => x.code}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      basePath="/boxes"
      query={{ q }}
      error={sp.error}
      empty={
        list.length === 0 ? (
          <EmptyState what="박스는 놓인 자리에 내용이 그대로 들어가는 고정 글이다." example="【보험연도】 보험연도란 계약일부터 1년 단위로 …" actionHref="/boxes/new" actionLabel="새 박스 만들기" />
        ) : (
          <p className="ts-empty-what">이 조건에 맞는 박스가 없습니다.</p>
        )
      }
    />
  );
}
