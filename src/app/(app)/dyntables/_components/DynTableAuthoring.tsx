"use client";

/**
 * 동적표 에디터 — `/dyntables/new`(생성) · `/dyntables/<code>`(상세) 한 벌 (기능/동적표 §4.2).
 *
 * 위→아래 세 섹션 (2026-10-21) — **기본**(코드 · 동적표명) → **인자**(읽기 전용 표 `ParamsTable` — 값은 사용처가 정한다, 편집 모드에서도 고치지 않는다)
 * → **구조**(2단: 왼쪽 미리보기 `SampleTable` — 시스템 견본을 골라 조립과 같은 펼침으로 늘 그린다, 오른쪽이 길어도 화면 안에 머문다 ·
 * 오른쪽 영역별 템플릿 — 행 머리(시스템) · 구분 칸 머리글 · 열 머리글 네 줄 · 셀 템플릿).
 * 표 모양은 머리글 구조가 정한다(`tableShape` — 첫 · 가운데 · 마지막을 모두 비우면 열 하나). 읽기 모드의 단일형은 단일 열 줄만 보인다.
 * 2단은 본문 폭 기준(컨테이너 쿼리) — 아주 좁을 때(400px 미만)만 세로로 쌓인다.
 * 템플릿 줄마다 `TemplateEditor`(문면 인라인 편집기) — 그 줄에서 쓸 수 있는 표 슬롯(`DYN_TABLE_ALLOWED_SLOTS`)과 인자 슬롯 · 조건을 넣는다.
 * 칸 ↔ 필드: 표 칸을 누르면 그 칸을 만든 영역의 칸 전부 + 오른쪽 그 필드가 강조되고(다시 누르면 풀림) 필드로 스크롤한다. 필드에 들어가면(포커스 · 클릭) 표의 그 영역이 칠해진다.
 * 견본에 없는 영역의 필드는 흐리게 + 「이 견본엔 없음」. 편집 중에는 편집본으로 그려 저장 전에 바로 보인다.
 *
 * 저장 한 번: 상세는 읽기로 시작 → `편집` → 이름 · 템플릿이 함께 수정 가능 → `저장`(한 트랜잭션, 검사 §3.6). 거부면 편집 유지 + 그 칸(인자 · 템플릿 줄) 아래 사유.
 * 생성은 처음부터 편집 중이고, 저장하는 순간 만들어진다. 견본은 시스템 고정이라 저장하지 않는다.
 */
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { DiscardDialog } from "@/app/_components/EditShell";
import { useItemEdit, useRestoredDraft } from "@/app/_components/ListDetailLayout";
import { IconClose } from "@/app/_components/icons";
import { InfoTip } from "@/app/_components/InfoTip";
import { MoreMenu } from "@/app/_components/MoreMenu";
import { HeadActions, HeadButton, HeadIconButton } from "@/app/_components/HeadActions";
import { ENTITY_LABEL, NAME_LABEL, newLabel } from "@/app/_lib/labels";
import { enumDefsOf } from "@/app/(app)/functions/_components/locals";
import { paramEntries } from "@/app/(app)/functions/_components/params";
import type { Inline } from "@/domain/clause/nodes";
import { formatCoordinate } from "@/domain/coordinate";
import { renderDynTableFixedSample } from "@/domain/dyntable/fixedSample";
import type { DynTableRegion } from "@/domain/dyntable/regions";
import { renderDynTableSample } from "@/domain/dyntable/sampleView";
import { DYN_TABLE_SAMPLES, dynTableSample, sampleArgValues, sampleDescription } from "@/domain/dyntable/samples";
import { TABLE_SHAPE_LINE, tableShape } from "@/domain/dyntable/shape";
import { allowedCellSlots, defaultAmountCellTemplate, defaultCellTemplate, defaultFixed, DYN_TABLE_ALLOWED_SLOTS, DYN_TABLE_SLOTS, type DynTableHeaders, type DynTableTemplateKey, type NewDynTable } from "@/domain/dyntable/types";
import type { Impact, Issue } from "@/domain/types";

import { createDynTableAction, removeDynTableAction, saveDynTableAction } from "../actions";
import type { DynTableEditorData } from "../editorData";
import { ParamsTable } from "./ParamsTable";
import { FixedSampleView, REGION_LABEL, SampleTable } from "./SampleTable";
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
  { key: "single", hint: "열이 하나일 때 — 감액 없는 담보, 또는 첫 · 가운데 · 마지막을 모두 비운 정의(늘 열 하나)" },
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

const PARAM_NOTE = "템플릿이 arg.<이름> 으로 읽는 값 인자 — 시스템이 정하고, 값은 사용처(담보약관)가 넣는 자리에서 구분자 · 상수로 댄다. 여기서는 고치지 않는다.";

const FIXED_NOTE = "정액형 표(통합치료비) — 행 · 정액은 담보의 급부 「정액표」 특성에서, 가입금액은 상품담보의 「가입금액」에서 읽는다. 정액표 급부마다(둘 이상이면 급부 머리글) 운영 가입금액(오름차순)마다 캡션 + 표를 찍고, 지급금액 열은 그 급부 하나의 감액으로 나눈다. 셀 = 정액 × 감액비율(지급률은 곱하지 않는다).";

const HEADER_NOTE = "표 모양은 머리글이 정한다 — 첫 · 가운데 · 마지막 열을 모두 채우면 감액 구간으로 열을 나누고(열 하나면 단일, 둘이면 첫 + 마지막, 셋 이상이면 첫 + 가운데(열마다) + 마지막), 셋 다 비우면 감액이 있어도 늘 열 하나(단일 열, 비율 = 지급률). 일부만 채우면 저장할 수 없다. 슬롯 {경계} · {앞경계} 는 펼칠 때 기간 글로 바뀐다.";

/** 저장 거부 사유를 칸별로 — `refPath` 가 가리키는 자리(인자 · 템플릿 줄 · 이름)로 모은다. 자리를 모르면 배너. */
function placeIssues(issues: readonly Issue[]): { label?: string; params?: string; templates: Partial<Record<DynTableTemplateKey, string>>; rest: Issue[] } {
  const out: ReturnType<typeof placeIssues> = { templates: {}, rest: [] };
  const join = (prev: string | undefined, m: string) => (prev ? `${prev} · ${m}` : m);
  for (const i of issues) {
    const p = i.at.refPath ?? "";
    if (p === "label") out.label = join(out.label, i.message);
    else if (p.startsWith("arg.") || p === "params") out.params = join(out.params, i.message);
    else if (p === "cell") out.templates.cell = join(out.templates.cell, i.message);
    else if (p === "fixed.caption") out.templates.caption = join(out.templates.caption, i.message);
    else if (p === "fixed.benefitHeader") out.templates.benefitHeader = join(out.templates.benefitHeader, i.message);
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

  // 다른 항목 탭에 갔다 돌아왔으면 맡겨 둔 편집본으로 편집을 잇는다 (ADR-0094)
  const restored = useRestoredDraft<{ draft: NewDynTable }>("dyntable");
  const [editing, setEditing] = useState(isNew || restored !== undefined);
  const [draft, setDraft] = useState<NewDynTable>(restored?.draft ?? props.table);
  const [banner, setBanner] = useState<Banner>();
  const [placed, setPlaced] = useState<ReturnType<typeof placeIssues>>();
  const [discard, setDiscard] = useState<{ go: () => void }>();
  const [removal, setRemoval] = useState<Impact>();
  const [sampleId, setSampleId] = useState<string>(DYN_TABLE_SAMPLES[0].id);
  const [selected, setSelected] = useState<DynTableRegion>();
  const [hovered, setHovered] = useState<DynTableRegion>();

  const shown = editing ? draft : props.table;
  const dirty = editing && (isNew ? draft.label.trim() !== "" || JSON.stringify(draft) !== JSON.stringify(props.table) : JSON.stringify(draft) !== JSON.stringify(props.table));

  // 편집은 한 항목 탭만 (ADR-0094)
  const itemEdit = useItemEdit({ part: "dyntable", editing: editing && !isNew, dirty, snapshot: () => ({ draft }) });

  const patch = (next: Partial<NewDynTable>) => setDraft((d) => ({ ...d, ...next }));
  const setHeader = (key: keyof DynTableHeaders, inlines: Inline[]) => setDraft((d) => ({ ...d, headers: { ...d.headers, [key]: inlines } }));
  const setFixed = (key: "caption" | "benefitHeader", inlines: Inline[]) => setDraft((d) => (d.fixed ? { ...d, fixed: { ...d.fixed, [key]: inlines } } : d));
  /** 정액형 ↔ 감액 표 — 켜면 캡션 · 급부 머리글 기본 템플릿이 생기고 셀의 {비율} 은 {금액} 으로(끄면 반대로). 다른 템플릿은 그대로. */
  const setKind = (fixed: boolean) =>
    setDraft((d) => {
      const slot = (ref: string, to: string): Inline[] => d.cell.map((n) => (n.kind === "slot" && n.ref === ref ? { ...n, ref: to } : n));
      if (fixed) {
        const { fixed: _was, ...rest } = d;
        void _was;
        return { ...rest, fixed: d.fixed ?? defaultFixed(), cell: d.cell.some((n) => n.kind === "slot" && n.ref === DYN_TABLE_SLOTS.rate) ? slot(DYN_TABLE_SLOTS.rate, DYN_TABLE_SLOTS.amount) : d.cell.length === 0 ? defaultAmountCellTemplate() : d.cell };
      }
      const { fixed: _gone, ...rest } = d;
      void _gone;
      return { ...rest, cell: d.cell.some((n) => n.kind === "slot" && n.ref === DYN_TABLE_SLOTS.amount) ? slot(DYN_TABLE_SLOTS.amount, DYN_TABLE_SLOTS.rate) : d.cell.length === 0 ? defaultCellTemplate() : d.cell };
    });

  /** 조건 · 슬롯 문맥 — 변수는 인자 칸뿐(§3.1 — 구분자 · 세목 · 담보속성은 인자로 받아 연결한다). */
  const condition = useMemo(() => ({ ...data.condition, discriminators: paramEntries(shown.params, data.enums), attributes: [], quick: [] }), [data.condition, data.enums, shown.params]);
  const enumDefs = useMemo(() => enumDefsOf(data.enums), [data.enums]);

  // 견본 표 — 편집 중이면 편집본으로(저장 전에 바로 보인다). 정액형이면 통합치료비 꼴 고정 견본
  const sample = dynTableSample(sampleId);
  const isFixed = shown.fixed !== undefined;
  const view = useMemo(() => renderDynTableSample(shown, sample.benefits, sampleArgValues(shown.params, sample, enumDefs), enumDefs), [shown, sample, enumDefs]);
  const fixedView = useMemo(() => (isFixed ? renderDynTableFixedSample(shown, sampleArgValues(shown.params, sample, enumDefs), enumDefs) : undefined), [isFixed, shown, sample, enumDefs]);
  const usedRegions = fixedView ? fixedView.regions : view.regions;
  const fieldState = (region: DynTableRegion) => ({ on: selected === region, absent: region !== "row" && !usedRegions.includes(region), onActivate: () => setSelected(region) });
  const pickFromTable = (region: DynTableRegion) => {
    const next = selected === region ? undefined : region;
    setSelected(next);
    if (next) document.querySelector(`[data-dyn-field="${next}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const startEdit = () => {
    if (!itemEdit.allowEdit()) return;
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
    const payload: NewDynTable = { ...draft, label: draft.label.trim(), rowHeader: draft.rowHeader.trim() || "구 분" };
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
      // 항목 탭 · 목록 패널 — 떠나는 것이 아니다, 편집본이 남는다 (ADR-0094)
      if (anchor.closest("[data-ld-keep]")) return;
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
  // 편집 중엔 네 줄 모두(비우고 채워 모양을 바꾼다). 읽기 모드의 단일형은 단일 열 줄만
  const rows = !editing && tableShape(shown.headers) === "single" ? HEADER_ROWS.filter((r) => r.key === "single") : HEADER_ROWS;

  return (
    <div className="ts-l3 is-clause" aria-busy={pending || undefined}>
      <div className="ts-l3-bar">
        <Breadcrumb items={[{ label: ENTITY_LABEL.dynTable, href: "/dyntables" }, { label: name }]} guard={editing ? leave : undefined} />
        {editing && <span className="ts-l3-dirty">{isNew ? "새 동적표 — 저장하면 만들어진다" : dirty ? "편집 중 · 저장해야 반영" : "편집 중"}</span>}
        <HeadActions>
          {!isNew && <MoreMenu items={[{ label: "동적표 삭제", danger: true, onSelect: () => (editing ? setBanner({ message: "저장하거나 취소한 뒤 삭제한다" }) : remove(false)) }]} />}
          {editing ? (
            <>
              <HeadIconButton icon={<IconClose />} label={isNew ? "만들기 취소 — 동적표 목록으로" : "편집 취소 — 고친 내용을 버리고 읽기 모드로"} disabled={pending} onClick={() => leave(isNew ? () => router.push("/dyntables") : endEdit)} />
              <HeadButton primary disabled={pending || (!isNew && !dirty)} onClick={save}>
                {pending ? "저장 중…" : "저장"}
              </HeadButton>
            </>
          ) : (
            <HeadButton onClick={startEdit} disabled={pending}>
              편집
            </HeadButton>
          )}
        </HeadActions>
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
        <div className="ts-dyn-page">
          <section className="ts-dyn-section" aria-labelledby="dyn-sec-basic">
            <h2 id="dyn-sec-basic" className="ts-dyn-section-title">
              기본
            </h2>
            <div className="ts-dyn-basics">
              {!isNew && (
                <div className="ts-dyn-basic">
                  <span className="ts-form-label">코드</span>
                  <span className="ts-clause-meta-value ts-mono">{code}</span>
                </div>
              )}
              <div className="ts-dyn-basic is-name">
                <label htmlFor="dyn-label" className="ts-form-label">
                  {NAME_LABEL.dynTable}
                </label>
                {editing ? (
                  <input id="dyn-label" className="ts-field-direct" value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder="예: 감액 지급금액 표" autoFocus={isNew} aria-invalid={placed?.label ? true : undefined} />
                ) : (
                  <span className="ts-clause-meta-value">{props.table.label}</span>
                )}
              </div>
              {placed?.label && (
                <p className="ts-form-error ts-dyn-basics-error" role="alert">
                  {placed.label}
                </p>
              )}
            </div>
          </section>

          <section className="ts-dyn-section" aria-labelledby="dyn-sec-params">
            <h2 id="dyn-sec-params" className="ts-dyn-section-title">
              인자
              <InfoTip text={PARAM_NOTE} />
            </h2>
            <ParamsTable table={shown} discriminators={data.condition.discriminators} enums={data.enums} forms={data.planForms} />
            {placed?.params && (
              <p className="ts-form-error" role="alert">
                {placed.params}
              </p>
            )}
          </section>

          <section className="ts-dyn-section" aria-labelledby="dyn-sec-structure">
            <h2 id="dyn-sec-structure" className="ts-dyn-section-title">
              구조
            </h2>
            <p className="ts-muted ts-dyn-shape-line" data-testid="dyn-shape-line">
              {isFixed ? `정액형 표 · ${TABLE_SHAPE_LINE[tableShape(shown.headers)]}` : TABLE_SHAPE_LINE[tableShape(shown.headers)]}
            </p>
            {editing && (
              <label className="ts-dyn-kind-toggle">
                <input type="checkbox" checked={isFixed} onChange={(e) => setKind(e.target.checked)} aria-label="정액형 표" /> 정액형 표(통합치료비) — 행 · 정액을 급부의 정액표에서 읽고 가입금액마다 표를 찍는다
                <InfoTip text={FIXED_NOTE} />
              </label>
            )}
            <div className="ts-dyn-layout">
              {fixedView ? (
                <FixedSampleView view={fixedView} selected={selected} hovered={hovered} onSelect={pickFromTable} onHover={setHovered} />
              ) : (
                <SampleTable sample={sample} description={sampleDescription(sample, shown)} onSample={setSampleId} view={view} selected={selected} hovered={hovered} onSelect={pickFromTable} onHover={setHovered} />
              )}

              <div className="ts-dyn-panel" aria-label="템플릿">
                <section aria-label="행">
                  <h3 className="ts-clause-sec">행</h3>
                  {isFixed ? (
                    <>
                      <RegionField region="benefitHeader" {...fieldState("benefitHeader")} sub="{번호} · {급부명} — 정액표가 있는 급부가 둘 이상일 때만 급부마다 표 위에 찍는다">
                        <TemplateEditor id="dyn-f-benefitHeader" value={shown.fixed?.benefitHeader ?? []} onChange={(next) => setFixed("benefitHeader", next)} editing={editing} condition={condition} slots={DYN_TABLE_ALLOWED_SLOTS.benefitHeader} placeholder="급부 머리글" {...(placed?.templates.benefitHeader ? { error: placed.templates.benefitHeader } : {})} />
                      </RegionField>
                      <RegionField region="caption" {...fieldState("caption")} sub="{가입금액} — 운영 가입금액마다 표 바로 위에 찍는다 (오름차순)">
                        <TemplateEditor id="dyn-f-caption" value={shown.fixed?.caption ?? []} onChange={(next) => setFixed("caption", next)} editing={editing} condition={condition} slots={DYN_TABLE_ALLOWED_SLOTS.caption} placeholder="캡션" {...(placed?.templates.caption ? { error: placed.templates.caption } : {})} />
                      </RegionField>
                      <RegionField region="textCell" {...fieldState("textCell")} badge="시스템">
                        <p className="ts-dyn-field-static">정액표의 행(치료항목 한 줄) — 급부의 정액표가 정한다. 첫 글자 열은 위아래로 연속한 같은 값을 합친다.</p>
                      </RegionField>
                    </>
                  ) : (
                    <RegionField region="row" {...fieldState("row")} badge="시스템">
                      <p className="ts-dyn-field-static">급부명 — 급부마다 한 행(같은 급부명은 열마다 비율이 같을 때 한 행). 모델링하지 않는다.</p>
                    </RegionField>
                  )}
                </section>

                <section aria-label="머리글">
                  <h3 className="ts-clause-sec">
                    머리글
                    <InfoTip text={HEADER_NOTE} />
                  </h3>
                  {isFixed ? (
                    <RegionField region="textHeader" {...fieldState("textHeader")} badge="시스템">
                      <p className="ts-dyn-field-static">글자 열 머리(분류 · 치료항목 · 지급횟수 …) — 급부의 정액표가 정한다.</p>
                    </RegionField>
                  ) : (
                    <RegionField region="corner" {...fieldState("corner")} labelFor={editing ? "dyn-rowheader" : undefined}>
                      {editing ? <input id="dyn-rowheader" className="ts-field-direct" value={draft.rowHeader} onChange={(e) => patch({ rowHeader: e.target.value })} placeholder="구 분" /> : <span className="ts-clause-meta-value">{props.table.rowHeader}</span>}
                    </RegionField>
                  )}
                  {rows.map((r) => (
                    <RegionField key={r.key} region={r.key} {...fieldState(r.key)} sub={r.hint}>
                      <TemplateEditor id={`dyn-h-${r.key}`} value={shown.headers[r.key]} onChange={(next) => setHeader(r.key, next)} editing={editing} condition={condition} slots={DYN_TABLE_ALLOWED_SLOTS[r.key]} placeholder={`${REGION_LABEL[r.key]} 머리글`} {...(placed?.templates[r.key] ? { error: placed.templates[r.key] } : {})} />
                    </RegionField>
                  ))}
                </section>

                <section aria-label="본문">
                  <h3 className="ts-clause-sec">본문</h3>
                  <RegionField region="cell" {...fieldState("cell")} sub={isFixed ? "{금액} = 정액 × 감액비율 (원 단위 반올림 없음 · 지급률은 곱하지 않는다). 표기는 5만원 · 2만 5천원 · 1,000만원." : "{비율} = 급부 지급률 × 감액 지급률. 세부보장이 둘 이상일 때만 붙일 글은 조건 count(builtin.subCoverage.name) >= 2 로."}>
                    <TemplateEditor id="dyn-cell" value={shown.cell} onChange={(next) => patch({ cell: next })} editing={editing} condition={condition} slots={allowedCellSlots(shown)} placeholder="셀 템플릿" {...(placed?.templates.cell ? { error: placed.templates.cell } : {})} />
                  </RegionField>
                </section>
              </div>
            </div>
          </section>
        </div>
      </div>

      {discard ? (
        <DiscardDialog
          onStay={() => setDiscard(undefined)}
          onDiscard={() => {
            const { go } = discard;
            setDiscard(undefined);
            itemEdit.release();
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
