"use client";

/**
 * 동적표 상세 왼쪽 — 견본 드롭다운 + 고른 견본으로 펼친 표 (기능/동적표 §4.2 「견본 표」).
 *
 * 표는 `renderDynTableSample`(조립과 같은 `expandDynTable`)이 낸 칸을 그대로 그린다 — 칸마다 그 칸을 만든 영역(`data-region`)이 붙는다.
 * 칸은 버튼이다(키보드로 고른다): 누르면 같은 영역 칸 전부와 오른쪽 그 필드가 강조되고, 다시 누르면 풀린다. 마우스를 올리면 옅게 미리 칠한다.
 * 자리표시자에 들어간 값은 굵은 밑줄, 조건이 고른 글은 점선. 강조는 색 + 안쪽 띠 + 굵기.
 */
import type { DynTableRegion } from "@/domain/dyntable/regions";
import type { DynTableSampleView, SampleCell } from "@/domain/dyntable/sampleView";
import { DYN_TABLE_SAMPLES, type DynTableSample } from "@/domain/dyntable/samples";

export const REGION_LABEL: Record<DynTableRegion, string> = {
  row: "행 머리",
  corner: "구분 칸 머리글",
  first: "첫 열",
  middle: "가운데 열",
  last: "마지막 열",
  single: "단일 열",
  cell: "셀 템플릿",
};

export interface SampleTableProps {
  sample: DynTableSample;
  onSample: (id: string) => void;
  view: DynTableSampleView;
  selected?: DynTableRegion;
  hovered?: DynTableRegion;
  onSelect: (region: DynTableRegion) => void;
  onHover: (region: DynTableRegion | undefined) => void;
}

function CellText({ cell }: { cell: SampleCell }) {
  return (
    <>
      {cell.parts.map((p, i) => {
        const cls = [p.value ? "ts-dyn-v" : "", p.cond ? "ts-dyn-c" : ""].filter(Boolean).join(" ");
        return cls ? (
          <span key={i} className={cls}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        );
      })}
    </>
  );
}

export function SampleTable({ sample, onSample, view, selected, hovered, onSelect, onHover }: SampleTableProps) {
  const cell = (c: SampleCell, key: number, head: boolean) => {
    const on = c.region === selected;
    const cls = [on ? "is-on" : "", !on && c.region === hovered ? "is-hover" : "", c.region === "row" ? "is-rowhead" : ""].filter(Boolean).join(" ");
    const button = (
      <button type="button" className="ts-dyn-cellbtn" aria-pressed={on} title={`${REGION_LABEL[c.region]} — 누르면 오른쪽 필드가 강조된다`} onClick={() => onSelect(c.region)}>
        <CellText cell={c} />
      </button>
    );
    const props = { "data-region": c.region, className: cls || undefined, onMouseEnter: () => onHover(c.region) };
    return head || c.region === "row" ? (
      <th key={key} {...props} scope={c.region === "row" ? "row" : "col"}>
        {button}
      </th>
    ) : (
      <td key={key} {...props}>
        {button}
      </td>
    );
  };

  return (
    <section className="ts-dyn-sample" aria-label="견본 표">
      <div className="ts-dyn-sample-pick">
        <label htmlFor="dyn-sample" className="ts-form-label">
          견본
        </label>
        <select id="dyn-sample" value={sample.id} onChange={(e) => onSample(e.target.value)}>
          {DYN_TABLE_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="ts-muted ts-dyn-sample-desc">{sample.description}</p>
      <div className="ts-dyn-table-wrap" onMouseLeave={() => onHover(undefined)}>
        <table className="ts-dyn-table" aria-label={`견본 「${sample.label}」으로 펼친 표`}>
          <thead>
            <tr>{view.header.map((c, j) => cell(c, j, true))}</tr>
          </thead>
          <tbody>
            {view.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => cell(c, j, false))}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ts-muted ts-dyn-sample-hint">
        칸을 누르면 그 칸을 만든 필드가 오른쪽에서 강조된다. 오른쪽 필드에 들어가면 표에서 그 영역이 칠해진다. <span className="ts-dyn-v">굵은 밑줄</span> = 자리표시자에 들어간 값,{" "}
        <span className="ts-dyn-c">점선</span> = 인자 · 조건에 따라 바뀌는 글.
      </p>
      {view.issues.length > 0 && (
        <ul className="ts-clause-warnings" aria-label="견본 표 문제">
          {view.issues.map((m) => (
            <li key={m} className="ts-warn">
              {m}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
