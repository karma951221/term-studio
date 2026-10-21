/**
 * 동적표 인자 — 읽기 전용 표 (기능/동적표 §4.2 「인자」, 2026-10-21 사용자 결정).
 *
 * 인자 값은 사용처(담보약관)에서 정해진다 — 상세에서는 고치지 않는다(편집 모드에서도 추가 · 수정 · 기본 연결 변경 없음).
 * 머리글 있는 표: 이름 · 타입 · 값을 대는 곳(「담보약관에서 연결」 + 기본 연결이 있으면 그 값) · 쓰이는 곳(그 인자를 읽는 템플릿 영역).
 * 인자가 없으면 「인자 없음」 한 줄.
 */
import type { CtxDiscriminator } from "@/app/(app)/documents/[id]/_components/condition/types";
import { bindingLabel, typeLabel, type EnumChoice, type PlanFormChoice } from "@/app/(app)/functions/_components/params";
import type { ParamDef } from "@/domain/clause";
import { paramUsage } from "@/domain/dyntable/regions";
import type { NewDynTable } from "@/domain/dyntable/types";

import { REGION_LABEL } from "./SampleTable";

export interface ParamsTableProps {
  table: Pick<NewDynTable, "params" | "headers" | "cell">;
  discriminators: readonly CtxDiscriminator[];
  enums: readonly EnumChoice[];
  forms: readonly PlanFormChoice[];
}

const SOURCE = "담보약관에서 연결";

function sourceText(p: ParamDef, props: ParamsTableProps): string {
  if (!p.default) return SOURCE;
  return `${SOURCE} · 기본 연결 ${bindingLabel(p.default, p.type, props.discriminators, props.enums, props.forms)}`;
}

export function ParamsTable(props: ParamsTableProps) {
  const { table, enums, forms } = props;
  if (table.params.length === 0) return <p className="ts-muted ts-dyn-params-none">인자 없음</p>;
  const usage = paramUsage(table);
  return (
    <div className="ts-dyn-params-wrap">
      <table className="ts-table ts-dyn-params-table" aria-label="인자 목록">
        <thead>
          <tr>
            <th scope="col">이름</th>
            <th scope="col">타입</th>
            <th scope="col">값을 대는 곳</th>
            <th scope="col">쓰이는 곳</th>
          </tr>
        </thead>
        <tbody>
          {table.params.map((p) => {
            const used = usage[p.name] ?? [];
            return (
              <tr key={p.name}>
                <th scope="row" className="ts-mono">
                  {p.name}
                </th>
                <td>{typeLabel(p.type, enums, forms)}</td>
                <td>{sourceText(p, props)}</td>
                <td className={used.length === 0 ? "ts-muted" : undefined}>{used.length === 0 ? "쓰이지 않음" : used.map((k) => REGION_LABEL[k]).join(" · ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
