"use client";

/**
 * 동적표 에디터 — `/dyntables/new`(생성) · `/dyntables/<code>`(상세) 한 벌 (기능/동적표 §4.2).
 *
 * 2단 — 왼쪽 견본 표(`SampleTable` — 시스템 견본을 골라 조립과 같은 펼침으로 늘 그린다), 오른쪽 템플릿 패널(기본정보 · 열 기준 · 인자(`ParamsPane`) ·
 * 행 머리(시스템) · 구분 칸 머리글 · 열 머리글 네 줄 · 셀 템플릿). 좁으면 세로로 쌓인다.
 * 템플릿 줄마다 `TemplateEditor`(문면 인라인 편집기) — 그 줄에서 쓸 수 있는 표 슬롯(`DYN_TABLE_ALLOWED_SLOTS`)과 인자 슬롯 · 조건을 넣는다.
 * 칸 ↔ 필드: 표 칸을 누르면 그 칸을 만든 영역의 칸 전부 + 오른쪽 그 필드가 강조되고(다시 누르면 풀림) 필드로 스크롤한다. 필드에 들어가면(포커스 · 클릭) 표의 그 영역이 칠해진다.
 * 견본에 없는 영역의 필드는 흐리게 + 「이 견본엔 없음」. 편집 중에는 편집본으로 그려 저장 전에 바로 보인다.
 *
 * 저장 한 번: 상세는 읽기로 시작 → `편집` → 칸 전부가 함께 수정 가능 → `저장`(한 트랜잭션, 검사 §3.6). 거부면 편집 유지 + 그 칸(인자 · 템플릿 줄) 아래 사유.
 * 생성은 처음부터 편집 중이고, 저장하는 순간 만들어진다. 견본은 시스템 고정이라 저장하지 않는다.
 */
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { DiscardDialog } from "@/app/_components/EditShell";
import { IconButton, IconClose } from "@/app/_components/icons";
import { InfoTip } from "@/app/_components/InfoTip";
import { MoreMenu } from "@/app/_components/MoreMenu";
import { ENTITY_LABEL, NAME_LABEL, newLabel } from "@/app/_lib/labels";
import { enumDefsOf } from "@/app/(app)/functions/_components/locals";
import { paramEntries } from "@/app/(app)/functions/_components/params";
import { ParamsPane } from "@/app/(app)/functions/_components/ParamsPane";
import type { ParamDef } from "@/domain/clause";
import type { Inline } from "@/domain/clause/nodes";
import { formatCoordinate } from "@/domain/coordinate";
import type { DynTableRegion } from "@/domain/dyntable/regions";
import { renderDynTableSample } from "@/domain/dyntable/sampleView";
import { DYN_TABLE_SAMPLES, dynTableSample, sampleArgValues } from "@/domain/dyntable/samples";
import { DYN_TABLE_ALLOWED_SLOTS, type ColumnBasis, type DynTableHeaders, type DynTableTemplateKey, type NewDynTable } from "@/domain/dyntable/types";
import type { Impact, Issue } from "@/domain/types";

import { createDynTableAction, removeDynTableAction, saveDynTableAction } from "../actions";
import type { DynTableEditorData } from "../editorData";
import { COLUMN_BASIS_OPTIONS } from "./basis";
import { REGION_LABEL, SampleTable } from "./SampleTable";
import { TemplateEditor } from "./TemplateEditor";

export interface DynTableAuthoringProps {
  /** 없으면 생성 화면(`/dyntables/new`). */
  code?: string;
  table: NewDynTable;
  data: DynTableEditorData;
}

type Banner = { message: string; issues?: readonly Issue[] };

const HEADER_ROWS: readonly { key: keyof DynTableHeaders; hint: string }[] = [
  { key: "first", hint: "{경계} = 첫 구간의 끝 · 열이 둘 이상일 때 첫 열" },
  { key: "middle", hint: "{앞경계} = 구간의 시작 · {경계} = 구간의 끝 · 열이 셋 이상일 때 가운데 열마다" },
  { key: "last", hint: "{경계} = 마지막 경계 · 열이 둘 이상일 때 마지막 열" },
  { key: "single", hint: "감액이 없어 열이 하나일 때(열 기준 「없음」 포함)" },
];

interface RegionFieldProps {
  region: DynTableRegion;
  on: boolean;
  absent: boolean;
  onActivate: () => void;
  /** 라벨이 가리킬 입력 id — 없으면 글 라벨. */
  labelFor?: string | undefined;
  /** 라벨 오른쪽 작은 표시(「시스템」). */
  badge?: string;
  sub?: string;
  children: ReactNode;
}

/** 템플릿 필드 하나 — 영역 색 점 + 라벨, 강조면 왼쪽 띠 · 라벨 색 · 굵기. 포커스 · 클릭이 표의 그 영역을 칠한다. */
function RegionField({ region, on, absent, onActivate, labelFor, badge, sub, children }: RegionFieldProps) {
  const label = REGION_LABEL[region];
  return (
    <div className={`ts-dyn-field${on ? " is-on" : ""}${absent ? " is-absent" : ""}`} data-region={region} data-dyn-field={region} onFocusCapture={onActivate} onClick={onActivate}>
      <div className="ts-dyn-field-label">
        <span className="ts-dyn-dot" aria-hidden="true" />
        {labelFor ? <label htmlFor={labelFor}>{label}</label> : <span>{label}</span>}
        {absent && <span className="ts-dyn-field-na">이 견본엔 없음</span>}
        {badge && <span className="ts-dyn-field-na">{badge}</span>}
      </div>
      {children}
      {sub && <p className="ts-dyn-field-sub">{sub}</p>}
    </div>
  );
}

const PARAM_NOTE = "템플릿이 arg.<이름> 으로 읽는 값 인자 — 사용처(담보약관)가 넣는 자리에서 구분자 · 상수를 댄다. 조 참조 인자는 둘 수 없다.";

/** 저장 거부 사유를 칸별로 — `refPath` 가 가리키는 자리(인자 · 템플릿 줄 · 이름)로 모은다. 자리를 모르면 배너. */
function placeIssues(issues: readonly Issue[]): { label?: string; params?: string; templates: Partial<Record<DynTableTemplateKey, string>>; rest: Issue[] } {
  const out: ReturnType<typeof placeIssues> = { templates: {}, rest: [] };
  const join = (prev: string | undefined, m: string) => (prev ? `${prev} · ${m}` : m);
  for (const i of issues) {
    const p = i.at.refPath ?? "";
    if (p === "label") out.label = join(out.label, i.message);
    else if (p.startsWith("arg.") || p === "params") out.params = join(out.params, i.message);
    else if (p === "cell") out.templates.cell = join(out.templates.cell, i.message);
    else if (p.startsWith("headers.")) {
      const k = p.slice("headers.".length) as keyof DynTableHeaders;
      out.templates[k] = join(out.templates[k], i.message);
    } else out.rest.push(i);
  }
  return out;
}

export function DynTableAuthoring(props: DynTableAuthoringProps) {
  const { code, data } = props;
  const isNew = code === undefined;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState<NewDynTable>(props.table);
  const [banner, setBanner] = useState<Banner>();
  const [placed, setPlaced] = useState<ReturnType<typeof placeIssues>>();
  const [discard, setDiscard] = useState<{ go: () => void }>();
  const [removal, setRemoval] = useState<Impact>();
  const [sampleId, setSampleId] = useState<string>(DYN_TABLE_SAMPLES[0].id);
  const [selected, setSelected] = useState<DynTableRegion>();
  const [hovered, setHovered] = useState<DynTableRegion>();

  const shown = editing ? draft : props.table;
  const dirty = editing && (isNew ? draft.label.trim() !== "" || draft.params.length > 0 || JSON.stringify(draft) !== JSON.stringify(props.table) : JSON.stringify(draft) !== JSON.stringify(props.table));

  const patch = (next: Partial<NewDynTable>) => setDraft((d) => ({ ...d, ...next }));
  const setHeader = (key: keyof DynTableHeaders, inlines: Inline[]) => setDraft((d) => ({ ...d, headers: { ...d.headers, [key]: inlines } }));

  /** 조건 · 슬롯 문맥 — 변수는 인자 칸뿐(§3.1 — 구분자 · 세목 · 담보속성은 인자로 받아 연결한다). */
  const condition = useMemo(() => ({ ...data.condition, discriminators: paramEntries(shown.params, data.enums), attributes: [], quick: [] }), [data.condition, data.enums, shown.params]);
  const enumDefs = useMemo(() => enumDefsOf(data.enums), [data.enums]);

  // 견본 표 — 편집 중이면 편집본으로(저장 전에 바로 보인다)
  const sample = dynTableSample(sampleId);
  const view = useMemo(() => renderDynTableSample(shown, sample.benefits, sampleArgValues(shown.params, sample, enumDefs), enumDefs), [shown, sample, enumDefs]);
  const fieldState = (region: DynTableRegion) => ({ on: selected === region, absent: region !== "row" && !view.regions.includes(region), onActivate: () => setSelected(region) });
  const pickFromTable = (region: DynTableRegion) => {
    const next = selected === region ? undefined : region;
    setSelected(next);
    if (next) document.querySelector(`[data-dyn-field="${next}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const startEdit = () => {
    setDraft(props.table);
    setEditing(true);
    setBanner(undefined);
    setPlaced(undefined);
  };
  const endEdit = () => {
    setEditing(false);
    setBanner(undefined);
    setPlaced(undefined);
  };

  const save = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const payload: NewDynTable = { ...draft, label: draft.label.trim(), params: draft.params.map((p) => ({ ...p, name: p.name.trim() })), rowHeader: draft.rowHeader.trim() || "구 분" };
    startTransition(async () => {
      const out = isNew ? await createDynTableAction(payload) : await saveDynTableAction(code, payload);
      if (!out.ok) {
        const at = placeIssues(out.issues ?? []);
        setPlaced(at);
        setBanner({ message: `저장하지 못했다 — ${out.message}`, ...(at.rest.length > 0 ? { issues: at.rest } : {}) });
        return;
      }
      if (isNew) {
        setEditing(false);
        router.push(`/dyntables/${out.code}`);
        return;
      }
      endEdit();
      if (out.recheck) setBanner({ message: `저장했다 — 사용처 ${out.recheck}곳에 다시 볼 문제가 있다 (관계정보에서 확인)` });
      router.refresh();
    });
  };

  const remove = (confirm = false) => {
    if (!code) return;
    startTransition(async () => {
      const out = await removeDynTableAction(code, confirm);
      if (out.ok === true) return router.push("/dyntables");
      if (out.ok === "confirm") return setRemoval(out.impact);
      setRemoval(undefined);
      setBanner({ message: out.message });
    });
  };

  const leave = (go: () => void) => (dirty ? setDiscard({ go }) : go());

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // 화면을 떠나는 링크(내비 등)는 고친 것이 있으면 확인을 거친다 — 함수조항 · 문면 저작 화면과 같다
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      const href = url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
      setDiscard({ go: () => (url.origin === window.location.origin ? router.push(href) : window.location.assign(href)) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, router]);

  const name = isNew ? draft.label.trim() || newLabel(ENTITY_LABEL.dynTable) : props.table.label;
  const rows = shown.columnBasis === "none" ? HEADER_ROWS.filter((r) => r.key === "single") : HEADER_ROWS;

  return (
    <div className="ts-l3 is-clause" aria-busy={pending || undefined}>
      <div className="ts-l3-bar">
        <Breadcrumb items={[{ label: ENTITY_LABEL.dynTable, href: "/dyntables" }, { label: name }]} guard={editing ? leave : undefined} />
        {editing && <span className="ts-l3-dirty">{isNew ? "새 동적표 — 저장하면 만들어진다" : dirty ? "편집 중 · 저장해야 반영" : "편집 중"}</span>}
        <span className="ts-l3-bar-actions">
          {!isNew && <MoreMenu items={[{ label: "동적표 삭제", danger: true, onSelect: () => (editing ? setBanner({ message: "저장하거나 취소한 뒤 삭제한다" }) : remove(false)) }]} />}
          {editing ? (
            <>
              <IconButton icon={<IconClose />} label={isNew ? "만들기 취소 — 동적표 목록으로" : "편집 취소 — 고친 내용을 버리고 읽기 모드로"} disabled={pending} onClick={() => leave(isNew ? () => router.push("/dyntables") : endEdit)} />
              <button type="button" className="primary" disabled={pending || (!isNew && !dirty)} onClick={save}>
                {pending ? "저장 중…" : "저장"}
              </button>
            </>
          ) : (
            <button type="button" onClick={startEdit} disabled={pending}>
              편집
            </button>
          )}
        </span>
      </div>

      <div className="ts-l3-body ts-clause-page">
        {banner && (
          <div className="ts-error-banner" role="alert">
            <p>{banner.message}</p>
            {banner.issues && banner.issues.length > 0 && (
              <ul className="ts-issues">
                {banner.issues.map((i, k) => (
                  <li key={k}>{i.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="ts-dyn-layout">
          <SampleTable sample={sample} onSample={setSampleId} view={view} selected={selected} hovered={hovered} onSelect={pickFromTable} onHover={setHovered} />

          <div className="ts-dyn-panel" aria-label="템플릿">
            <section className="ts-basics" aria-label="동적표 기본정보">
              {!isNew && (
                <div className="ts-form-row">
                  <span className="ts-form-label">코드</span>
                  <span className="ts-clause-meta-value ts-mono">{code}</span>
                </div>
              )}
              <div className="ts-form-row">
                <label htmlFor="dyn-label">{NAME_LABEL.dynTable}</label>
                {editing ? (
                  <input id="dyn-label" className="ts-field-direct" value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder="예: 감액 지급금액 표" autoFocus={isNew} aria-invalid={placed?.label ? true : undefined} />
                ) : (
                  <span className="ts-clause-meta-value">{props.table.label}</span>
                )}
              </div>
              {placed?.label && (
                <p className="ts-form-error" role="alert">
                  {placed.label}
                </p>
              )}
              <div className="ts-form-row">
                <span className="ts-form-label">열 기준</span>
                {editing ? (
                  <div className="ts-clause-mode" role="radiogroup" aria-label="열 기준">
                    {COLUMN_BASIS_OPTIONS.map((o) => (
                      <label key={o.value} className={`ts-clause-mode-option${shown.columnBasis === o.value ? " is-on" : ""}`}>
                        <input type="radio" name="dyn-basis" value={o.value} checked={shown.columnBasis === o.value} onChange={() => patch({ columnBasis: o.value as ColumnBasis })} />
                        <span className="ts-clause-mode-name">{o.label}</span>
                        <span className="ts-clause-mode-hint">{o.hint}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="ts-clause-meta-value">{COLUMN_BASIS_OPTIONS.find((o) => o.value === shown.columnBasis)?.label}</span>
                )}
              </div>
            </section>

            <ParamsPane params={shown.params} editing={editing} onChange={(next: ParamDef[]) => patch({ params: next })} discriminators={data.condition.discriminators} enums={data.enums} forms={data.planForms} />
            {placed?.params && (
              <p className="ts-form-error" role="alert">
                {placed.params}
              </p>
            )}
            <p className="ts-muted ts-clause-sec-note">{PARAM_NOTE}</p>

            <section aria-label="행">
              <h2 className="ts-clause-sec">행</h2>
              <RegionField region="row" {...fieldState("row")} badge="시스템">
                <p className="ts-dyn-field-static">급부명 — 급부마다 한 행(같은 급부명은 열마다 비율이 같을 때 한 행). 모델링하지 않는다.</p>
              </RegionField>
            </section>

            <section aria-label="머리글">
              <h2 className="ts-clause-sec">
                머리글
                <InfoTip text="열 하나면 단일 열, 둘이면 첫 + 마지막, 셋 이상이면 첫 + 가운데(열마다) + 마지막. 슬롯 {경계} · {앞경계} 는 펼칠 때 기간 글로 바뀐다." />
              </h2>
              <RegionField region="corner" {...fieldState("corner")} labelFor={editing ? "dyn-rowheader" : undefined}>
                {editing ? <input id="dyn-rowheader" className="ts-field-direct" value={draft.rowHeader} onChange={(e) => patch({ rowHeader: e.target.value })} placeholder="구 분" /> : <span className="ts-clause-meta-value">{props.table.rowHeader}</span>}
              </RegionField>
              {rows.map((r) => (
                <RegionField key={r.key} region={r.key} {...fieldState(r.key)} sub={r.hint}>
                  <TemplateEditor id={`dyn-h-${r.key}`} value={shown.headers[r.key]} onChange={(next) => setHeader(r.key, next)} editing={editing} condition={condition} slots={DYN_TABLE_ALLOWED_SLOTS[r.key]} placeholder={`${REGION_LABEL[r.key]} 머리글`} {...(placed?.templates[r.key] ? { error: placed.templates[r.key] } : {})} />
                </RegionField>
              ))}
            </section>

            <section aria-label="본문">
              <h2 className="ts-clause-sec">본문</h2>
              <RegionField region="cell" {...fieldState("cell")} sub="{비율} = 급부 지급률 × 감액 지급률. 세부보장이 둘 이상일 때만 붙일 글은 조건 count(builtin.subCoverage.name) >= 2 로.">
                <TemplateEditor id="dyn-cell" value={shown.cell} onChange={(next) => patch({ cell: next })} editing={editing} condition={condition} slots={DYN_TABLE_ALLOWED_SLOTS.cell} placeholder="셀 템플릿" {...(placed?.templates.cell ? { error: placed.templates.cell } : {})} />
              </RegionField>
            </section>
          </div>
        </div>
      </div>

      {discard ? (
        <DiscardDialog
          onStay={() => setDiscard(undefined)}
          onDiscard={() => {
            const { go } = discard;
            setDiscard(undefined);
            endEdit();
            go();
          }}
        />
      ) : null}
      {removal ? (
        <dialog open className="ts-dialog">
          <p className="ts-confirm-title">
            {props.table.label} 삭제 — 사용처 {removal.brokenRefs.length}건의 참조가 깨진다
          </p>
          {removal.brokenRefs.length > 0 && (
            <ul className="ts-confirm-loss">
              {removal.brokenRefs.map((c, i) => (
                <li key={i}>{formatCoordinate(c, { source: true })}</li>
              ))}
            </ul>
          )}
          <div className="ts-confirm-actions">
            <button type="button" onClick={() => setRemoval(undefined)} disabled={pending}>
              취소
            </button>
            <button type="button" className="danger" onClick={() => remove(true)} disabled={pending}>
              {props.table.label} 삭제
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
