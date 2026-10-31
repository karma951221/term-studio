"use client";

/**
 * `grid` 필드(정액표 격자) 입력 — 기능/담보 §3.4 「정액표」: 글자 열(개수 · 머리 이름 사용자 정의) + 행(치료항목 한 줄) + 가입금액별 정액(원).
 * 초안이 곧 값(`FixedGrid`)이다 — 검사(공란 · 열 수 · 정수)는 `formReducer`(validateSlotValue) 몫.
 * 조작: 글자 열 머리 타이핑 · 열 ⊕/⊖ · 가입금액 열 ⊕(금액 입력)/⊖ · 행 ⊕/⊖ · 셀 타이핑. 입력 자리(담보 상세 카드 / 문면 모달)는 미결 — 지금은 담보 상세의 급부 카드다.
 */
import { useState } from "react";

import { isFixedGrid, type FixedGrid } from "@/domain/types";

import type { InputProps } from "./inputTypes";

function gridOf(field: InputProps["field"]): FixedGrid {
  const d = field.draft;
  return isFixedGrid(d) ? d : { columns: [], rows: [] };
}

const amountKeysOf = (g: FixedGrid): string[] => [...new Set(g.rows.flatMap((r) => Object.keys(r.amounts)))].sort((a, b) => Number(a) - Number(b));

export function GridInput({ id, field, onEdit, name }: InputProps) {
  const grid = gridOf(field);
  const amountKeys = amountKeysOf(grid);
  const [newAmount, setNewAmount] = useState("");
  const set = (next: FixedGrid) => onEdit(next);
  const setColumn = (c: number, label: string) => set({ ...grid, columns: grid.columns.map((x, i) => (i === c ? label : x)) });
  const addColumn = () => set({ columns: [...grid.columns, ""], rows: grid.rows.map((r) => ({ ...r, cells: [...r.cells, ""] })) });
  const removeColumn = (c: number) => set({ columns: grid.columns.filter((_, i) => i !== c), rows: grid.rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== c) })) });
  const addRow = () => set({ ...grid, rows: [...grid.rows, { cells: grid.columns.map(() => ""), amounts: Object.fromEntries(amountKeys.map((k) => [k, 0])) }] });
  const removeRow = (r: number) => set({ ...grid, rows: grid.rows.filter((_, i) => i !== r) });
  const setCell = (r: number, c: number, text: string) => set({ ...grid, rows: grid.rows.map((row, i) => (i === r ? { ...row, cells: row.cells.map((x, j) => (j === c ? text : x)) } : row)) });
  const setAmount = (r: number, key: string, text: string) => {
    const n = text.trim() === "" ? Number.NaN : Number(text.replace(/,/g, ""));
    set({ ...grid, rows: grid.rows.map((row, i) => (i === r ? { ...row, amounts: { ...row.amounts, [key]: Number.isFinite(n) ? n : Number.NaN } } : row)) });
  };
  const addAmount = () => {
    const n = Number(newAmount.replace(/,/g, "").trim());
    if (!Number.isInteger(n) || n < 1 || amountKeys.includes(String(n))) return;
    set({ ...grid, rows: grid.rows.map((row) => ({ ...row, amounts: { ...row.amounts, [String(n)]: 0 } })) });
    setNewAmount("");
  };
  const removeAmount = (key: string) =>
    set({
      ...grid,
      rows: grid.rows.map((row) => {
        const amounts = { ...row.amounts };
        delete amounts[key];
        return { ...row, amounts };
      }),
    });
  const base = name ?? field.view.path;

  return (
    <div className="ts-grid-input" aria-labelledby={`${id}-label`}>
      <table>
        <thead>
          <tr>
            {grid.columns.map((label, c) => (
              <th key={c}>
                <input type="text" name={`${base}[columns][${c}]`} value={label} onChange={(e) => setColumn(c, e.target.value)} aria-label={`${c + 1}째 글자 열 머리`} placeholder="열 머리" />
                <button type="button" onClick={() => removeColumn(c)} aria-label={`${c + 1}째 글자 열 삭제`}>
                  ⊖
                </button>
              </th>
            ))}
            {amountKeys.map((key) => (
              <th key={key} className="ts-grid-amount-head">
                가입금액 {Number(key).toLocaleString("ko-KR")}원
                <button type="button" onClick={() => removeAmount(key)} aria-label={`가입금액 ${key} 열 삭제`}>
                  ⊖
                </button>
              </th>
            ))}
            <th aria-label="행 삭제" />
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, r) => (
            <tr key={r}>
              {grid.columns.map((_, c) => (
                <td key={c}>
                  <input type="text" name={`${base}[rows][${r}][cells][${c}]`} value={row.cells[c] ?? ""} onChange={(e) => setCell(r, c, e.target.value)} aria-label={`${r + 1}행 ${grid.columns[c] || `${c + 1}째 글자 칸`}`} />
                </td>
              ))}
              {amountKeys.map((key) => (
                <td key={key}>
                  <input type="text" inputMode="numeric" name={`${base}[rows][${r}][amounts][${key}]`} value={Number.isFinite(row.amounts[key]) ? String(row.amounts[key]) : ""} onChange={(e) => setAmount(r, key, e.target.value)} aria-label={`${r + 1}행 가입금액 ${key} 정액`} />
                </td>
              ))}
              <td>
                <button type="button" onClick={() => removeRow(r)} aria-label={`${r + 1}행 삭제`}>
                  ⊖
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ts-grid-input-actions">
        <button type="button" onClick={addRow}>
          + 행
        </button>
        <button type="button" onClick={addColumn}>
          + 글자 열
        </button>
        <span className="ts-grid-amount-add">
          <input type="text" inputMode="numeric" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} aria-label="더할 가입금액(원)" placeholder="가입금액(원)" />
          <button type="button" onClick={addAmount}>
            + 가입금액 열
          </button>
        </span>
      </div>
      <p className="ts-muted">정액은 원 단위 정수. 가입금액 열마다 모든 행을 채운다(공란은 저장하지 않는다). 표기(5만원 · 2만 5천원)는 조립이 한다.</p>
    </div>
  );
}
