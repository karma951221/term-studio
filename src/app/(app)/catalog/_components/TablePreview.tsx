"use client";

/**
 * 표 구분자 상세 — 견본 미리보기 + 문구 템플릿 (기능/구분자 §4.5). 읽기 전용이라 편집 · 저장이 없다.
 *
 * 견본 표는 조립과 같은 펼침(`renderDynTableSample` · `renderDynTableFixedSample`)으로 그린다. 칸을 누르면 그 칸을 만든 문구 템플릿 줄이 강조된다.
 * 시스템 인자(갱신형 · 단서문구)는 견본이 정한 값으로 댄다 — 「갱신형 담보」 견본이면 최초계약일, 그 밖은 계약일 · 단서문구 없음.
 */
import { useMemo, useState } from "react";

import type { EnumDef } from "@/domain/catalog/types";
import { renderDynTableFixedSample } from "@/domain/dyntable/fixedSample";
import type { DynTableRegion } from "@/domain/dyntable/regions";
import { renderDynTableSample } from "@/domain/dyntable/sampleView";
import { DYN_TABLE_SAMPLES, dynTableSample, sampleArgValues, sampleDescription } from "@/domain/dyntable/samples";
import { findTableDiscriminator, templateText } from "@/domain/dyntable/system";

import { FixedSampleView, REGION_LABEL, SampleTable } from "./SampleTable";

export function TablePreview({ code, enums }: { code: string; enums: readonly EnumDef[] }) {
  const system = findTableDiscriminator(code);
  const [sampleId, setSampleId] = useState<string>(DYN_TABLE_SAMPLES[0].id);
  const [selected, setSelected] = useState<DynTableRegion>();
  const [hovered, setHovered] = useState<DynTableRegion>();
  const enumDefs = useMemo(() => new Map(enums.map((e) => [e.code, e] as const)), [enums]);
  const sample = dynTableSample(sampleId);
  const table = system?.table;
  const view = useMemo(() => (table ? renderDynTableSample(table, sample.benefits, sampleArgValues(table.params, sample, enumDefs), enumDefs) : undefined), [table, sample, enumDefs]);
  const fixedView = useMemo(() => (table?.fixed ? renderDynTableFixedSample(table, sampleArgValues(table.params, sample, enumDefs), enumDefs) : undefined), [table, sample, enumDefs]);
  if (!system || !table || !view) return null;
  const pick = (r: DynTableRegion) => setSelected((cur) => (cur === r ? undefined : r));
  const split = system.variant === "general";
  const lines: [DynTableRegion, string][] = [
    ...(table.fixed ? ([["benefitHeader", templateText(table.fixed.benefitHeader)], ["caption", templateText(table.fixed.caption)]] as [DynTableRegion, string][]) : ([["corner", table.rowHeader]] as [DynTableRegion, string][])),
    ...(split
      ? ([
          ["first", templateText(table.headers.first)],
          ["middle", templateText(table.headers.middle)],
          ["last", templateText(table.headers.last)],
        ] as [DynTableRegion, string][])
      : []),
    ["single", templateText(table.headers.single)],
    ["cell", templateText(table.cell)],
  ];
  return (
    <div className="ts-dyn-layout">
      <div>
        {fixedView ? (
          <FixedSampleView view={fixedView} selected={selected} hovered={hovered} onSelect={pick} onHover={setHovered} />
        ) : (
          <SampleTable sample={sample} description={sampleDescription(sample, table)} onSample={setSampleId} view={view} selected={selected} hovered={hovered} onSelect={pick} onHover={setHovered} />
        )}
      </div>
      <section className="ts-dyn-panel" aria-label="문구 템플릿">
        <dl className="ts-table-disc-templates">
          {lines.map(([region, text]) => (
            <div key={region} data-region={region} className={region === selected ? "is-on" : region === hovered ? "is-hover" : undefined}>
              <dt>{REGION_LABEL[region]}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
        <p className="ts-muted">〔(최초)계약일〕 = 그 상품담보가 갱신형이면 최초계약일, 아니면 계약일 · {"{단서문구}"} = 담보 특성 「단서문구」(없으면 꼬리 없음) · 〔해당보장의 〕 = 세부보장이 둘 이상일 때.</p>
      </section>
    </div>
  );
}
