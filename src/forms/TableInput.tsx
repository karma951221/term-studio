"use client";

/**
 * `table` 필드 입력 — 첫 행 머리글 · 셀 타이핑 · 엑셀 붙여넣기(줄 → 행 · 탭 → 열) · 행 추가/삭제 (기능/담보 §3.4).
 * 초안은 셀 원문(`TableDraft`)이고 파싱 · 검사는 `formReducer`(parseTableDraft · validateSlotValue) 몫이다.
 * `enum` 열(감액기간)은 셀이 열거값 고르기(`<select>`) — 초안은 값 코드, 붙여넣은 표시 글자는 파서가 코드로 푼다 (2026-10-31).
 * 칩이 있는 글 열(체증 구분의 「(최초)계약일」)은 표 위에 글자 버튼 — 누르면 그 열에서 마지막으로 커서를 둔 칸의 커서 자리에 칩 글이 들어간다.
 * 커서를 둔 칸이 없으면 그 열의 마지막 행 끝에(행이 없으면 새 행) 붙인다 (기능/담보 §3.4, 2026-11-01).
 */
import { useRef, type ClipboardEvent } from "react";

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
  // 칩 — 그 열에서 마지막으로 커서를 둔 칸(행 · 열 · 커서 자리)
  const caret = useRef<{ r: number; c: number; at: number } | undefined>(undefined);
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
  const remember = (r: number, c: number) => (e: { currentTarget: HTMLInputElement }) => {
    caret.current = { r, c, at: e.currentTarget.selectionStart ?? e.currentTarget.value.length };
  };
  const insertChip = (c: number, text: string) => {
    const next = rows.length > 0 ? rows.map((row) => [...row]) : [columns.map(() => "")];
    const last = caret.current && caret.current.c === c && caret.current.r < next.length ? caret.current : undefined;
    const r = last ? last.r : next.length - 1;
    while (next[r].length < columns.length) next[r].push("");
    const cur = next[r][c] ?? "";
    const at = last ? Math.min(last.at, cur.length) : cur.length;
    next[r][c] = cur.slice(0, at) + text + cur.slice(at);
    caret.current = { r, c, at: at + text.length };
    set(next);
  };
  const chipColumns = columns.flatMap((col, c) => (col.chips ?? []).map((chip) => ({ c, col, chip })));
  const removeRow = (r: number) => set(rows.filter((_, i) => i !== r));

  return (
    <div className="ts-table-input" aria-labelledby={`${id}-label`}>
      {chipColumns.length > 0 && (
        <div className="ts-table-chips">
          {chipColumns.map(({ c, col, chip }) => (
            <button
              key={`${col.key}-${chip.label}`}
              type="button"
              className="ts-table-chip"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertChip(c, chip.text)}
              title={`${col.label} 칸의 커서 자리에 「${chip.label}」 넣기`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            <th aria-label="행 삭제" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {columns.map((col, c) => {
                const text = row[c] ?? "";
                const h = hint(col, text);
                const options = col.type === "enum" ? (field.view.columnEnums?.[col.key]?.options ?? []) : undefined;
                const inputName = `${name ?? field.view.path}[${r}][${col.key}]`;
                return (
                  <td key={col.key}>
                    {options ? (
                      <select name={inputName} value={text} onChange={(e) => edit(r, c, e.target.value)} aria-label={`${r + 1}행 ${col.label}`}>
                        <option value="">— 고르세요 —</option>
                        {options.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                        {text !== "" && !options.some((o) => o.code === text) && <option value={text}>{`없는 값 ${text}`}</option>}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name={inputName}
                        value={text}
                        onChange={(e) => {
                          edit(r, c, e.target.value);
                          remember(r, c)(e);
                        }}
                        onSelect={col.chips ? remember(r, c) : undefined}
                        onPaste={onPaste(r, c)}
                        aria-label={`${r + 1}행 ${col.label}`}
                      />
                    )}
                    {h && <span className="ts-muted ts-table-hint">{h}</span>}
                  </td>
                );
              })}
              <td>
                <button type="button" onClick={() => removeRow(r)} aria-label={`${r + 1}행 삭제`}>
                  ⊖
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow}>
        + 행
      </button>
      <p className="ts-muted">{columns.some((c) => c.type === "period") ? "셀에 포커스를 두고 붙여넣으면 줄은 행, 탭은 열로 들어간다. 기간은 3M · 1Y." : "셀에 포커스를 두고 붙여넣으면 줄은 행, 탭은 열로 들어간다. 고르는 칸은 표시 글자(1년)로 맞춘다."}</p>
    </div>
  );
}
