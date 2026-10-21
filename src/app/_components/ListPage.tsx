/**
 * L1 조회 화면 하나 (디자인원칙 §2 L1) — 제목 줄 · 필터바 · 표 · 페이저 · 빈 상태를 통째로 그린다.
 *
 * 목록 화면 8개가 같은 조립을 손으로 반복하던 것을 여기로 모았다. 페이지가 하는 일은
 * **무엇을 보일지 기술하는 것**뿐이다 — 데이터를 고르고(`rows`), 컬럼을 적고(`columns`),
 * 빈 상태 문구를 준다. 조립 방식이 바뀌면 이 파일 하나만 고친다.
 *
 * 컬럼을 강제하지 않는다. §2 L1 은 「1열은 항상 코드」를 정했지만 상품 마스터에는 코드가
 * 없다 — **도메인에 없는 값을 화면이 지어내지 않는다**(작업지시). 그래서 낼 수 있는 컬럼만
 * 각 화면이 적고, 이 컴포넌트는 그것을 같은 모양으로 그리는 데까지만 관여한다.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { ErrorBanner } from "./ErrorBanner";
import { ColumnFilter, ListFilterBar, type ColumnFilterSpec } from "./ListFilters";
import { ListShell } from "./ListShell";
import { IconPlus } from "./icons";
import { AuditCell, IdentCell } from "./ListCells";
import { MoreMenu, type MoreMenuItem } from "./MoreMenu";
import { groupSpans, latestAudit, todayInSeoul, type AuditStamp } from "../_lib/list";
import { FIELD_LABEL } from "../_lib/labels";

/** 컬럼 폭은 이름으로 고른다 — 화면마다 `col-fixed-md` 를 외우지 않게. */
const WIDTH_CLASS = {
  code: "col-code",
  flex: "col-flex",
  /** 코드 · 이름 두 줄 칸이 가변 열이 아닐 때(담보속성 — 남는 폭은 값 이름이 먹는다). */
  ident: "col-ident",
  sm: "col-fixed-sm",
  md: "col-fixed-md",
  num: "col-num",
  act: "col-act",
  values: "col-values",
} as const;

export interface ListColumn<T> {
  /** 헤더 이름. `filter` 를 주면 그 자리에 필터 드롭다운이 서므로 생략한다. */
  header?: ReactNode;
  /** 이 컬럼 헤더가 곧 필터 — 거를 수 있는 것과 보이는 것을 어긋나지 않게 (§2 L1). */
  filter?: ColumnFilterSpec;
  /** 기본은 남는 폭을 먹는 `flex`. 남는 폭은 한 컬럼만 먹어야 한다 (§2 L1). */
  width?: keyof typeof WIDTH_CLASS;
  /** 코드 · 날짜처럼 세로줄이 맞아야 하는 칸. */
  mono?: boolean;
  /** 짧은 값이 「비갱\n신형」처럼 쪼개지지 않게 — 줄바꿈 없이 한 줄. */
  nowrap?: boolean;
  /**
   * 묶음 칸 — 표에 `groupKey` 가 있으면 같은 대상이 이어지는 행들에 한 번만 선다(rowSpan, 2026-10-21).
   * 칸 내용은 `groupCell(묶인 행들)`, 없으면 첫 행의 `cell`.
   */
  grouped?: boolean;
  groupCell?: (rows: readonly T[]) => ReactNode;
  cell: (row: T) => ReactNode;
}

function cellClass<T>(column: ListColumn<T>, grouped = false): string {
  return [WIDTH_CLASS[column.width ?? "flex"], column.mono ? "ts-mono" : null, column.nowrap ? "ts-nowrap" : null, grouped ? "ts-group-cell" : null]
    .filter(Boolean)
    .join(" ");
}

export function ListPage<T>({
  title,
  heading: headingKind = "page",
  create,
  search,
  filters = [],
  columns,
  rows,
  rowKey,
  groupKey,
  total,
  page,
  pageSize,
  basePath,
  query,
  pageParam,
  empty,
  error,
  children,
}: {
  title: ReactNode;
  /**
   * 제목의 급. `page` 는 화면 제목(h1). 한 화면에 목록이 여럿이면 `section` — 위에 괘선을 그어
   * 구획을 만든다(문면). 탭이 이미 구획을 만든 자리는 `sub` — 괘선 없이 작은 제목만(유형).
   */
  heading?: "page" | "section" | "sub";
  /** 제목 줄 오른쪽 `+` 아이콘 버튼. 없으면 안 그린다. `menu` 를 주면 누를 때 고를 것(유형 등)을 작은 메뉴로 띄운다. */
  create?: { href: string; label: string } | { label: string; menu: MoreMenuItem[] };
  /** 검색창 안내 문구. 없으면 필터바 자체를 안 그린다. */
  search?: { placeholder: string; queryKey?: string };
  filters?: readonly ColumnFilterSpec[];
  columns: readonly ListColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /**
   * 한 대상이 여러 행에 걸치는 표(담보속성 — 한 행 = 값 하나)의 묶음 키. 주면 `grouped` 컬럼이 묶음마다 한 번만 서고,
   * 괘선은 묶음 사이에만 긋는다. 보이는 행만 묶는다 — 페이지 경계에 걸리면 다음 페이지에서 다시 선다 (§2 L1, 2026-10-21).
   */
  groupKey?: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  query?: Record<string, string | undefined>;
  pageParam?: string;
  empty?: ReactNode;
  error?: string;
  /** 표 아래 붙는 것 — 별표의 삭제 확인처럼 목록에 딸린 조각. */
  children?: ReactNode;
}) {
  const heading = (
    <div className="ts-list-head">
      {headingKind === "page" ? <h1 className="ts-h1">{title}</h1> : <h2 className={headingKind === "section" ? "ts-h2" : "ts-list-title"}>{title}</h2>}
      {create && "menu" in create ? (
        <MoreMenu label={create.label} items={create.menu} trigger={<IconPlus />} buttonClassName="ts-iconbtn" />
      ) : create ? (
        <Link href={create.href} className="ts-iconbtn" title={create.label} aria-label={create.label}>
          <IconPlus />
        </Link>
      ) : null}
    </div>
  );

  const spans = groupKey ? groupSpans(rows.map(groupKey)) : undefined;

  return (
    <div>
      <ErrorBanner message={error} />
      <ListShell
        heading={heading}
        {...(search
          ? {
              filters: (
                <ListFilterBar
                  placeholder={search.placeholder}
                  filters={filters}
                  today={todayInSeoul()}
                  {...(search.queryKey ? { queryKey: search.queryKey } : {})}
                />
              ),
              interactiveFilters: true,
            }
          : {})}
        total={total}
        page={page}
        pageSize={pageSize}
        basePath={basePath}
        {...(query ? { query } : {})}
        {...(pageParam ? { pageParam } : {})}
        {...(empty !== undefined ? { empty } : {})}
      >
        <table className="ts-table">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index} className={WIDTH_CLASS[column.width ?? "flex"]}>
                  {column.filter ? <ColumnFilter spec={column.filter} /> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const span = spans ? spans[i]! : 1;
              const groupRows = spans && span > 0 ? rows.slice(i, i + span) : [row];
              // 묶음 안의 행(다음 행이 같은 묶음)은 괘선을 긋지 않는다 — 괘선은 묶음 사이에만
              const inner = spans !== undefined && i + 1 < rows.length && spans[i + 1] === 0;
              return (
                <tr key={rowKey(row)} className={inner ? "ts-group-inner" : undefined}>
                  {columns.map((column, index) => {
                    if (!spans || !column.grouped) {
                      return (
                        <td key={index} className={cellClass(column)}>
                          {column.cell(row)}
                        </td>
                      );
                    }
                    if (span === 0) return null;
                    return (
                      <td key={index} className={cellClass(column, true)} rowSpan={span > 1 ? span : undefined}>
                        {column.groupCell ? column.groupCell(groupRows) : column.cell(row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListShell>
      {children}
    </div>
  );
}

/* ── 되풀이되는 컬럼 ──────────────────────────────────────────────────────── */

/**
 * 조회 대상의 코드 · 이름을 한 열 두 줄로 (§2 L1, 2026-10-21) — 1줄째 코드(mono · 옅은 색), 2줄째 이름(상세로).
 * 머리글은 대상 이름 하나(「담보속성」). 기본은 남는 폭을 먹는 가변 열이다.
 */
export function identCol<T>(
  header: string,
  get: (row: T) => { code: string; name: string },
  href: (row: T) => string,
  options: { width?: "flex" | "ident"; grouped?: boolean } = {},
): ListColumn<T> {
  return {
    header,
    width: options.width ?? "flex",
    ...(options.grouped ? { grouped: true } : {}),
    cell: (row) => {
      const { code, name } = get(row);
      return <IdentCell code={code} name={name} href={href(row)} />;
    },
  };
}

/** 이름만 있는 대상(상품 · 약관 템플릿)의 상세로 들어가는 이름 칸 — 남는 폭을 먹는 단 하나의 컬럼. */
export function nameCol<T>(header: string, get: (row: T) => string, href: (row: T) => string): ListColumn<T> {
  return { header, width: "flex", cell: (row) => <Link href={href(row)}>{get(row)}</Link> };
}

/**
 * 「최종수정」 한 열 두 줄 (§2 L1, 2026-10-21) — 1줄째 수정일자, 2줄째 수정자(id 를 표시명으로, §9.4).
 * `names` 를 안 주면 날짜 한 줄(수정자가 스키마에 없는 대상). 묶음 칸이면 묶인 행들 중 가장 최근 것 하나.
 */
export function auditCol<T>(
  get: (row: T) => AuditStamp | undefined,
  names?: ReadonlyMap<string, string>,
  options: { grouped?: boolean } = {},
): ListColumn<T> {
  return {
    header: FIELD_LABEL.updatedAt,
    width: "md",
    nowrap: true,
    ...(options.grouped ? { grouped: true } : {}),
    groupCell: (rows) => <AuditCell audit={latestAudit(rows.map(get))} {...(names ? { names } : {})} />,
    cell: (row) => <AuditCell audit={get(row)} {...(names ? { names } : {})} />,
  };
}
