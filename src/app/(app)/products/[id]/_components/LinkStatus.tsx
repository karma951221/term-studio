"use client";

/**
 * 「조연결 현황」 — 보통약관 탭 안 패널 (기능/상품 §3.12 · §4.6, 2026-10-17 확정). 위 한 줄의 `[조연결 현황]` 이 펴고 접는다(읽기 · 편집 모두).
 *
 * - 행 = 판정 대상 템플릿 조 + 준용하기 옵션 조(연결 0 이어도) + 정적으로만 연결한 조, 열 = 블록(대치 형태면 기본계약 담보 한 열),
 *   칸 = 연결한 블록 조 · 빈칸(연결 안 함) · 「연결했지만 조건으로 빠짐」(빈칸과 섞지 않는다), 행 끝 = 판정 결과 · k/N (+ 일부 연결 경고).
 *   표 모델은 서버가 `verdictView.linkMatrix` 로 만든다 — 여기는 그리기만.
 * - 빈칸을 누르면 그 담보의 담보약관(담보 문면 편집기)으로 간다 — 편집 중 고친 것이 있으면 「고친 내용을 버립니까?」(`leave`).
 * - 저장하지 않는 계산값이다 — 저장된 조립 기준(편집 중 초안은 반영하지 않는다).
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { InfoTip } from "@/app/_components/InfoTip";

import { JOIN_MODE_LABEL, type LinkColumn, type LinkRow } from "../../verdictView";
import { useProductEdit } from "./ProductEdit";
import { PartialLinkIcon } from "./VerdictMarks";
import { Button } from "@/components/ui/button";

const LinkStatusContext = createContext<{ open: boolean; toggle: () => void } | null>(null);

export function LinkStatusProvider({ initialOpen = false, children }: { /** 렌더 검사용 — 편 채로 시작. */ initialOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  return <LinkStatusContext.Provider value={{ open, toggle: () => setOpen((v) => !v) }}>{children}</LinkStatusContext.Provider>;
}

/** 위 한 줄의 `[조연결 현황]` — 누르면 펴고 다시 누르면 접는다. */
export function LinkStatusButton() {
  const ctx = useContext(LinkStatusContext);
  if (!ctx) return null;
  return (
    <Button type="button" className="ts-terms-template-change" aria-expanded={ctx.open} aria-controls="ts-link-status" onClick={ctx.toggle}>
      조연결 현황
    </Button>
  );
}

export function LinkStatusPanel({ columns, rows, sectioned }: { columns: readonly LinkColumn[]; rows: readonly LinkRow[]; sectioned: boolean }) {
  const ctx = useContext(LinkStatusContext);
  const { leave } = useProductEdit();
  const router = useRouter();
  if (!ctx?.open) return null;
  const go = (href: string) => leave(() => router.push(href));
  return (
    <section id="ts-link-status" className="ts-section ts-link-status" aria-label="조연결 현황">
      <div className="ts-terms-panel-head">
        조연결 현황
        <InfoTip text="이 상품의 블록(대치 형태면 기본계약)이 템플릿 조마다 조연결했는가 — 저장된 조립 기준. 정적으로 연결했지만 이 상품에서 조건으로 빠진 칸은 따로 표시한다. 빈칸을 누르면 그 담보의 담보약관으로 간다." />
      </div>
      {rows.length === 0 ? (
        <p className="ts-muted">조연결한 템플릿 조도, 준용하기 옵션을 둔 조도 없다.</p>
      ) : (
        <div className="ts-table-wrap">
          <table className="ts-table ts-link-status-table">
            <thead>
              <tr>
                <th scope="col">템플릿 조</th>
                <th scope="col">준용하기</th>
                {columns.map((c) => (
                  <th key={c.productCoverageId} scope="col">
                    {c.head ? `${c.head} ` : ""}
                    {c.name}
                  </th>
                ))}
                <th scope="col">{sectioned ? "판정" : "대치"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.articleId}>
                  <th scope="row">{r.label}</th>
                  <td className={r.option === "none" ? "ts-muted" : undefined}>{JOIN_MODE_LABEL[r.option]}</td>
                  {r.cells.map((cell, i) => {
                    const column = columns[i]!;
                    if (cell.kind === "linked") return <td key={column.productCoverageId}>{cell.label ?? "연결"}</td>;
                    if (cell.kind === "excluded")
                      return (
                        <td key={column.productCoverageId} className="ts-link-excluded" title={cell.label ? `정적 연결 — ${cell.label}` : undefined}>
                          연결했지만 조건으로 빠짐
                        </td>
                      );
                    const href = column.documentId ? `/documents/${column.documentId}` : undefined;
                    return (
                      <td key={column.productCoverageId} className="ts-link-none">
                        {href ? (
                          <a
                            href={href}
                            title={`「${column.name}」의 담보약관에서 조연결한다`}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                              e.preventDefault();
                              go(href);
                            }}
                          >
                            연결 안 함
                          </a>
                        ) : (
                          <span className="ts-muted">연결 안 함</span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {r.result}
                    {r.count ? ` ${r.count}` : ""}
                    {r.warning && <PartialLinkIcon warning={r.warning} label={r.label} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
