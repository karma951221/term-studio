"use client";

/**
 * 동적표 상세 왼쪽 — 견본 드롭다운 + 고른 견본으로 펼친 표 (기능/동적표 §4.2 「견본 표」).
 *
 * 표는 `renderDynTableSample`(조립과 같은 `expandDynTable`)이 낸 칸을 그대로 그린다 — 칸마다 그 칸을 만든 영역(`data-region`)이 붙는다.
 * 칸은 버튼이다(키보드로 고른다): 누르면 같은 영역 칸 전부와 오른쪽 그 필드가 강조되고, 다시 누르면 풀린다. 마우스를 올리면 옅게 미리 칠한다.
 * 자리표시자에 들어간 값은 굵은 밑줄, 조건이 고른 글은 점선. 강조는 색 + 안쪽 띠 + 굵기.
 */
import type { CSSProperties } from "react";

import { DYN_TABLE_FIXED_SAMPLE, type DynTableFixedSampleView } from "@/domain/dyntable/fixedSample";
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
  benefitHeader: "급부 머리글",
  caption: "캡션",
  textHeader: "글자 열 머리",
  textCell: "글자 칸",
};

export interface SampleTableProps {
  sample: DynTableSample;
  /** 견본 설명 — 정의 모양별(`sampleDescription`). */
  description: string;
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

export function SampleTable({ sample, description, onSample, view, selected, hovered, onSelect, onHover }: SampleTableProps) {
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
      <p className="ts-muted ts-dyn-sample-desc">{description}</p>
      <div className="ts-dyn-table-wrap" onMouseLeave={() => onHover(undefined)}>
        <table className="ts-dyn-table" style={{ "--dyn-cols": view.header.length } as CSSProperties} aria-label={`견본 「${sample.label}」으로 펼친 표`}>
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

export interface FixedSampleViewProps {
  view: DynTableFixedSampleView;
  selected?: DynTableRegion;
  hovered?: DynTableRegion;
  onSelect: (region: DynTableRegion) => void;
  onHover: (region: DynTableRegion | undefined) => void;
}

/** 정액형 정의의 견본 — 통합치료비 꼴 견본 하나(고정)를 급부 머리글 · 캡션 · 표 블록으로 그린다 (기능/동적표 §3.7 · §4.2). 칸 조작은 감액 표 견본과 같다. */
export function FixedSampleView({ view, selected, hovered, onSelect, onHover }: FixedSampleViewProps) {
  const button = (c: SampleCell) => {
    const on = c.region === selected;
    return (
      <button type="button" className="ts-dyn-cellbtn" aria-pressed={on} title={`${REGION_LABEL[c.region]} — 누르면 오른쪽 필드가 강조된다`} onClick={() => onSelect(c.region)}>
        <CellText cell={c} />
      </button>
    );
  };
  const cls = (c: SampleCell) => [c.region === selected ? "is-on" : "", c.region !== selected && c.region === hovered ? "is-hover" : ""].filter(Boolean).join(" ") || undefined;
  const props = (c: SampleCell) => ({ "data-region": c.region, className: cls(c), onMouseEnter: () => onHover(c.region) });
  return (
    <section className="ts-dyn-sample" aria-label="견본 표">
      <div className="ts-dyn-sample-pick">
        <span className="ts-form-label">견본</span>
        <span>{DYN_TABLE_FIXED_SAMPLE.label}</span>
      </div>
      <p className="ts-muted ts-dyn-sample-desc">{DYN_TABLE_FIXED_SAMPLE.description}</p>
      <div className="ts-dyn-table-wrap ts-dyn-fixed-wrap" onMouseLeave={() => onHover(undefined)}>
        {view.blocks.map((b, i) => {
          if (b.kind !== "table") {
            const p = props(b.cell);
            return (
              <p key={i} data-region={p["data-region"]} className={`ts-dyn-line is-${b.kind}${p.className ? ` ${p.className}` : ""}`} onMouseEnter={p.onMouseEnter}>
                {button(b.cell)}
              </p>
            );
          }
          return (
            <table key={i} className="ts-dyn-table" style={{ "--dyn-cols": b.header.length } as CSSProperties}>
              <thead>
                <tr>
                  {b.header.map((c, j) => (
                    <th key={j} {...props(c)} scope="col">
                      {button(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.cells.map((c, j) => {
                      const span = r.spans?.[j] ?? 1;
                      if (span === 0) return null;
                      return (
                        <td key={j} {...props(c)} rowSpan={span > 1 ? span : undefined}>
                          {button(c)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
      <p className="ts-muted ts-dyn-sample-hint">
        칸을 누르면 그 칸을 만든 필드가 오른쪽에서 강조된다. 글자 열 머리 · 글자 칸은 급부의 정액표가 정한다(시스템). <span className="ts-dyn-v">굵은 밑줄</span> = 자리표시자에 들어간 값, <span className="ts-dyn-c">점선</span> = 인자 · 조건에 따라 바뀌는 글.
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
