"use client";

/**
 * `table` 필드 입력 — 첫 행 머리글 · 셀 타이핑 · 엑셀 붙여넣기(줄 → 행 · 탭 → 열) · 행 추가/삭제 (기능/담보 §3.4).
 * 초안은 셀 원문(`TableDraft`)이고 파싱 · 검사는 `formReducer`(parseTableDraft · validateSlotValue) 몫이다.
 * `enum` 열(감액기간)은 셀이 열거값 고르기(`<select>`) — 초안은 값 코드, 붙여넣은 표시 글자는 파서가 코드로 푼다 (2026-10-31).
 */
import type { ClipboardEvent } from "react";

import { IconButton, IconMinusCircle } from "@/app/_components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPeriod, parseCell, pasteToDraft, type TableDraft } from "@/domain/master";
import type { TableColumn } from "@/domain/types";

import type { InputProps } from "./inputTypes";

function draftOf(field: InputProps["field"]): TableDraft {
  const d = field.draft;
  return Array.isArray(d) && (d.length === 0 || Array.isArray(d[0])) ? (d as TableDraft) : [];
}

/** 셀 옆 해석 힌트 — period 는 `1Y` 아래 「1년」. */
function hint(col: TableColumn, text: string): string | undefined {
  if (col.type !== "period" || text.trim() === "") return undefined;
  const v = parseCell("period", text);
  return typeof v === "number" ? formatPeriod(v) : "?";
}

export function TableInput({ id, field, onEdit, name }: InputProps) {
  const type = field.view.type;
  if (type.kind !== "table") return null;
  const columns = type.columns;
  const rows = draftOf(field);
  const set = (next: TableDraft) => onEdit(next);
  const edit = (r: number, c: number, text: string) => {
    const next = rows.map((row) => [...row]);
    while (next[r].length < columns.length) next[r].push("");
    next[r][c] = text;
    set(next);
  };
  const onPaste = (r: number, c: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // 셀 하나는 기본 붙여넣기
    e.preventDefault();
    const pasted = pasteToDraft(columns, text);
    const next = rows.map((row) => [...row]);
    pasted.forEach((prow, i) => {
      const target = r + i;
      while (next.length <= target) next.push(columns.map(() => ""));
      prow.forEach((cell, j) => {
        if (c + j < columns.length) next[target][c + j] = cell;
      });
    });
    set(next);
  };
  const addRow = () => set([...rows, columns.map(() => "")]);
  const removeRow = (r: number) => set(rows.filter((_, i) => i !== r));

  return (
    <div className="ts-table-input" aria-labelledby={`${id}-label`}>
      <Table className="w-auto">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className="border border-border">
                {col.label}
              </TableHead>
            ))}
            <TableHead aria-label="행 삭제" className="border border-border" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, r) => (
            <TableRow key={r}>
              {columns.map((col, c) => {
                const text = row[c] ?? "";
                const h = hint(col, text);
                const options = col.type === "enum" ? (field.view.columnEnums?.[col.key]?.options ?? []) : undefined;
                const inputName = `${name ?? field.view.path}[${r}][${col.key}]`;
                return (
                  <TableCell key={col.key} className="border border-border">
                    {options ? (
                      <NativeSelect className="w-auto min-w-28" name={inputName} value={text} onChange={(e) => edit(r, c, e.target.value)} aria-label={`${r + 1}행 ${col.label}`}>
                        <option value="">— 고르세요 —</option>
                        {options.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                        {text !== "" && !options.some((o) => o.code === text) && <option value={text}>{`없는 값 ${text}`}</option>}
                      </NativeSelect>
                    ) : (
                      <Input type="text" className="w-24" name={inputName} value={text} onChange={(e) => edit(r, c, e.target.value)} onPaste={onPaste(r, c)} aria-label={`${r + 1}행 ${col.label}`} />
                    )}
                    {h && <span className="ts-muted ml-1 text-[0.85em]">{h}</span>}
                  </TableCell>
                );
              })}
              <TableCell className="border border-border">
                <IconButton size="sm" danger icon={<IconMinusCircle />} label={`${r + 1}행 삭제`} onClick={() => removeRow(r)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button type="button" className="mt-1" onClick={addRow}>
        + 행
      </Button>
      <p className="ts-muted">{columns.some((c) => c.type === "period") ? "셀에 포커스를 두고 붙여넣으면 줄은 행, 탭은 열로 들어간다. 기간은 3M · 1Y." : "셀에 포커스를 두고 붙여넣으면 줄은 행, 탭은 열로 들어간다. 고르는 칸은 표시 글자(1년)로 맞춘다."}</p>
    </div>
  );
}
