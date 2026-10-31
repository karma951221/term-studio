"use client";

/**
 * 담보 상세의 구조 = 중첩 카드 (기능/담보 §3.6 · §4 「상세」) — 담보 카드 ⊃ 세부보장 카드(그리드) ⊃ 급부 카드.
 *
 * - 카드마다 **이름 + 그 노드 레벨의 마스터 값 폼**(StructForm). 담보명은 담보 카드의 이름이다. 필드가 없는 레벨은 이름만.
 *   값 폼은 `flat` — 폼마다 상자를 두르지 않고 필드 행이 카드 본문에 바로 선다(「담보 기본」 상자 없음, 2026-09-27).
 * - **접지 않는다** (2026-09-27) — 모든 카드가 늘 보인다. 세부보장 카드는 담보 카드 안에서 반응형 그리드(넓으면 2열)로 서고,
 *   급부 카드는 제 세부보장 카드 안에 쌓인다.
 * - **라벨 ⊕ → 아래에 박스, 박스 왼쪽 위 ⊖ (2026-10-21)** — 모든 단계에 같은 규칙: 담보 본문의 라벨 행 「세부보장 ⊕」 → 세부보장 박스가 목록 끝에,
 *   세부보장 박스 안 「급부 ⊕」 → 급부 박스, 급부 박스 안 「특성 ⊕」 → 감액 · 면책 메뉴(StructForm). 박스 머리 왼쪽 ⊖(빼기, 마지막 하나면 잠김 · 최소 구조) ·
 *   오른쪽 ↑ ↓(순서) · 이름 인라인. 급부 이름 줄 오른쪽 「지급률 ⊕」(안 적으면 100%). 읽기 모드에는 구조 조작이 하나도 없다.
 * - **담보 본문은 라벨 열 하나** — 「담보」(이름) · 「담보분류」 · 값 폼 행 · 「세부보장 ⊕」가 같은 라벨 열(`ts-form-row`)이라 입력칸이 한 세로줄에서 시작한다.
 *   빈 이름 · 형제 중복은 이름 옆에. 새 카드는 값 폼이 없다 — 저장 뒤에야 값 자리가 생긴다. ⊖ 로 뺀 기존 노드는 초안에서 사라진다(되돌리려면 편집 취소).
 * - **진입 좌표** — 필드 좌표가 있으면 그 행을(StructForm), 없으면 `target` 카드를 스크롤 · 강조한다.
 * - **담보분류** (ADR-0090) — 담보 카드 맨 위 한 줄. 읽기는 값 이름, 편집은 열거형 「담보분류」 값 select(필수 — 「없음」이 없다).
 *   미입력(옛 데이터)은 「—」 + 「고르세요」, 지운 값은 「없는 값 V03」 + 「다른 값을 고르세요」.
 *   값 폼(StructForm)의 필드가 아니라 담보의 뼈대 칸이다 — 스냅샷되지 않는다. 기본 특약 그룹이고, 상품은 사용자 그룹으로만 다르게 묶는다.
 */
import { Fragment, useEffect, useId, useReducer, useRef, type ReactNode } from "react";

import { useEditField } from "@/app/_components/EditShell";
import { InfoTip } from "@/app/_components/InfoTip";
import { IconButton, IconDown, IconMinusCircle, IconPlusCircle, IconUp } from "@/app/_components/icons";
import { NAME_LABEL } from "@/app/_lib/labels";
import { draftNodeKeys, structureIssues, structureRemovals, type StructureDraftBenefit, type StructureDraftSub, type StructureSavedSub } from "@/domain/coverage";
import { PAY_RATE_PATH } from "@/domain/master";
import { StructForm, type FormModel, type Submission } from "@/forms";

import { formKeyOf, formSessionReducer, initFormSession } from "./value-drafts";

export const MIN_STRUCTURE = "최소 구조 — 세부보장 1개 · 급부 1개는 있어야 한다";

const LEVEL_LABEL = { coverage: "담보", subCoverage: "세부보장", benefit: "급부" } as const;
type Level = keyof typeof LEVEL_LABEL;

function moved<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

interface SiblingControls {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

/**
 * 노드 카드 하나 — 담보 상세와 상품담보 값 화면(기능/상품 §4.8)이 함께 쓴다. 상품담보 값 화면은 늘 `editing={false}` 로 부른다 —
 * 이름 · 순서 · ⊖ 같은 구조 조작이 없다(구조는 마스터, 기능/상품 §3.3).
 */
export function Card({ editing, level, nodeKey, treeKey, name, fallbackName, onName, issue, sibling, isTarget, scrollToCard, children, body, headExtra }: {
  editing: boolean;
  level: Level;
  nodeKey: string;
  /** 노드 키(ADR-0087) — 머리 라벨 「세부보장 01」. `nodeKey` 는 행 열쇠 `<level>:<id>` 라 이름을 달리 둔다. */
  treeKey?: string;
  name: string;
  /** 급부만 — 급부명이 비면 읽는 이름(세부보장명). 읽기는 흐리게, 편집은 placeholder (기능/담보 §3.1, 2026-10-31). */
  fallbackName?: string;
  onName: (value: string) => void;
  issue?: string;
  sibling?: SiblingControls;
  isTarget: boolean;
  scrollToCard: boolean;
  /** 이름 줄 아래 한 줄 알림 (담보명의 담보속성 값 경고 · 삭제 예고). */
  children?: ReactNode;
  /** 값 폼 + 자식 카드. */
  body: ReactNode;
  /** 머리 줄 오른쪽 — 급부의 「지급률 ⊕」(StructForm `frame`). */
  headExtra?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isTarget && scrollToCard) ref.current?.scrollIntoView?.({ block: "start" });
  }, [isTarget, scrollToCard]);

  const what = LEVEL_LABEL[level];
  const inherited = name.trim() === "" && fallbackName !== undefined && fallbackName.trim() !== "";
  const shown = name.trim() || (inherited ? fallbackName!.trim() : what);
  const ariaName = level === "coverage" ? NAME_LABEL.coverage : `${what}명 · ${treeKey ?? ""}`;
  if (level === "coverage") {
    // 담보 카드 — 머리 줄 대신 본문 첫 행 「담보 [이름]」: 담보분류 · 값 폼 행과 같은 라벨 열에 선다 (2026-10-21)
    return (
      <section ref={ref} className={`ts-cov-card${isTarget ? " is-target" : ""}`} data-level={level} data-node={nodeKey} aria-label={`${what} ${shown}`}>
        <div className="ts-cov-card-body">
          <div className="ts-form-row ts-cov-name-row">
            <span className="ts-form-label-cell">
              <span className="ts-form-label">{what}</span>
            </span>
            <div className="ts-form-control">
              {editing ? (
                <input value={name} onChange={(e) => onName(e.target.value)} className="ts-field-direct ts-cov-card-input" aria-label={ariaName} aria-invalid={issue ? true : undefined} />
              ) : (
                <span className="ts-cov-card-name">{name}</span>
              )}
              {editing && issue ? <span className="ts-form-error ts-tree-issue">{issue}</span> : null}
            </div>
          </div>
          {children}
          {body}
        </div>
      </section>
    );
  }
  return (
    <section ref={ref} className={`ts-cov-card${isTarget ? " is-target" : ""}`} data-level={level} data-node={nodeKey} aria-label={`${what} ${shown}`}>
      <div className="ts-cov-card-head">
        {editing && sibling ? (
          <IconButton className="ts-cov-remove" icon={<IconMinusCircle />} label={sibling.count <= 1 ? MIN_STRUCTURE : `${shown} 빼기`} danger disabled={sibling.count <= 1} onClick={sibling.onRemove} />
        ) : null}
        <span className="ts-cov-card-level">{treeKey ? `${what} ${treeKey}` : what}</span>
        {editing ? (
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            className="ts-field-direct ts-cov-card-input"
            aria-label={ariaName}
            aria-invalid={issue ? true : undefined}
            autoFocus={name === "" && fallbackName === undefined}
            placeholder={fallbackName !== undefined ? `비우면 세부보장명 (${fallbackName.trim() || "세부보장"})` : undefined}
          />
        ) : inherited ? (
          <span className="ts-cov-card-name ts-cov-name-inherited" title="급부명이 비어 세부보장명으로 읽는다">
            {fallbackName!.trim()}
          </span>
        ) : (
          <span className="ts-cov-card-name">{name}</span>
        )}
        {editing && issue ? <span className="ts-form-error ts-tree-issue">{issue}</span> : null}
        {headExtra ? <span className="ts-cov-head-extra">{headExtra}</span> : null}
        {editing && sibling && sibling.count > 1 ? (
          <span className="ts-row-actions">
            <IconButton icon={<IconUp />} label={`${shown} 위로`} disabled={sibling.index === 0} onClick={() => sibling.onMove(-1)} />
            <IconButton icon={<IconDown />} label={`${shown} 아래로`} disabled={sibling.index === sibling.count - 1} onClick={() => sibling.onMove(1)} />
          </span>
        ) : null}
      </div>
      {children}
      <div className="ts-cov-card-body">{body}</div>
    </section>
  );
}

/** 라벨 행 「{라벨} ⊕」 — 누르면 그 아래 목록 끝에 박스가 생긴다 (편집 모드만, 2026-10-21). */
function AddRow({ label, addLabel, onAdd }: { label: string; addLabel: string; onAdd: () => void }) {
  return (
    <div className="ts-form-row ts-cov-add-row">
      <span className="ts-form-label-cell">
        <span className="ts-form-label">{label}</span>
        <IconButton className="ts-label-add" icon={<IconPlusCircle />} label={addLabel} onClick={onAdd} />
      </span>
    </div>
  );
}

/** 담보분류 고르기의 선택지 — 열거형 「담보분류」(E0009)의 값, 순서 = 기본 그룹 순서. */
export interface CategoryOption {
  code: string;
  label: string;
}

/** 담보 카드의 「담보분류」 한 줄 — 값 폼의 행과 같은 모양(`ts-form-row`). 빈 문자열 = 미입력(옛 데이터 — 저장은 거부된다). */
function CategoryRow({ editing, value, options, onChange }: { editing: boolean; value: string; options: readonly CategoryOption[]; onChange: (code: string) => void }) {
  const id = useId();
  // 지운 값(열거형에 없는 코드)은 이름을 지어내지 않는다 — 「없는 값 V03」, 다른 값을 고르면 풀린다
  const missing = value !== "" && !options.some((o) => o.code === value);
  const label = value === "" ? undefined : missing ? `없는 값 ${value}` : options.find((o) => o.code === value)?.label;
  return (
    <div className="ts-form-group">
      <div className="ts-form-row" data-path="category">
        <span className="ts-form-label-cell">
          <label className="ts-form-label" htmlFor={id}>
            담보분류
          </label>
          <InfoTip text="기본 특약 그룹 — 상품에서 다른 그룹에 넣을 수 있다. 그룹 제목은 열거형 「담보분류」 값의 「그룹 제목」이다." />
        </span>
        <div className="ts-form-control">
          {editing ? (
            <select id={id} className="ts-field-direct" aria-label="담보분류" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={value === "" || missing ? true : undefined}>
              {value === "" && <option value="">— 고르세요 —</option>}
              {missing && <option value={value}>{label}</option>}
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <span id={id}>{label ?? <span className="ts-muted">—</span>}</span>
          )}
          {editing && value === "" && <span className="ts-form-error">담보분류를 고르세요</span>}
          {missing && <span className="ts-form-error">열거형 「담보분류」에서 지워진 값입니다 — 다른 값을 고르세요</span>}
        </div>
      </div>
    </div>
  );
}

export function CoverageCards({ coverageKey, formByNode, original, attributeValueLabels, target, highlightPath, showCodes, categories }: {
  /** 담보 자신의 노드 키 (`encodeNodeKey("coverage", id)`). */
  coverageKey: string;
  formByNode: Record<string, FormModel>;
  /** 저장된 원본 구조 — 「저장 시 삭제 N개」 셈. */
  original: StructureSavedSub[];
  attributeValueLabels: string[];
  target?: string;
  highlightPath?: string;
  showCodes?: boolean;
  /** 열거형 「담보분류」의 값 — 주면 담보 카드 맨 위에 담보분류 칸이 선다 (ADR-0090). */
  categories?: readonly CategoryOption[];
}) {
  const label = useEditField<string>("label");
  const category = useEditField<string | undefined>("category");
  const structure = useEditField<StructureDraftSub[]>("structure");
  const values = useEditField<Record<string, Submission>>("values");
  const editing = label.mode === "edit";

  // 폼 인스턴스 세대 — 취소하면 모든 폼을 새로 띄워 저장값을 보인다 (`value-drafts.ts`). 렌더 중 상태 조정 (StructForm 의 지문 reset 과 같은 패턴).
  const [session, dispatchSession] = useReducer(formSessionReducer, values.mode, initFormSession);
  if (session.mode !== values.mode) dispatchSession({ mode: values.mode, values: values.value });

  const nextKey = useRef(0);
  const fresh = (prefix: string) => `new:${prefix}${nextKey.current++}`;
  const subs = structure.value;
  const treeKeys = draftNodeKeys(subs);
  const update = (next: StructureDraftSub[]) => structure.setValue(next);
  const updateSub = (key: string, change: (sub: StructureDraftSub) => StructureDraftSub) => update(subs.map((sub) => (sub.key === key ? change(sub) : sub)));
  const addSub = () => update([...subs, { key: fresh("s"), name: "", benefits: [{ key: fresh("b"), name: "" }] }]);
  const addBenefit = (subKey: string) => updateSub(subKey, (sub) => ({ ...sub, benefits: [...sub.benefits, { key: fresh("b"), name: "" }] }));

  const issues = editing ? structureIssues(subs) : [];
  const issueOf = (key: string) => issues.find((i) => i.key === key)?.message;
  const removed = editing ? structureRemovals(original, subs).length : 0;

  // Q-C — 담보속성은 상품에 탑재할 때 정한다. 경고까지만 하고 저장은 막지 않는다 (거부 아님).
  // 「기본계약」이 「기본」에 먼저 걸리지 않게 긴 값부터 본다. 이름을 고치는 자리에서만 띄운다.
  const hit = editing
    ? [...attributeValueLabels].sort((a, b) => b.length - a.length).find((value) => value && label.value.includes(value))
    : undefined;

  /** 노드의 값 폼 — 저장된 노드만. 필드가 없는 레벨은 폼 자리가 없다. */
  const NEW_NOTE = <p className="ts-muted ts-cov-card-note">새 카드 — 값은 저장한 뒤 입력한다.</p>;
  const formOf = (key: string, isNew: boolean): ReactNode => {
    if (isNew) return NEW_NOTE;
    const form = formByNode[key];
    if (!form || form.fields.length === 0) return null;
    return structForm(key, form);
  };
  const structForm = (key: string, form: FormModel, frame?: (parts: { head: ReactNode; body: ReactNode }) => ReactNode): ReactNode => (
    <StructForm
      key={formKeyOf(session, key)}
      model={form}
      embedded
      flat
      readOnly={!editing}
      showCodes={showCodes}
      highlightPath={key === target ? highlightPath : undefined}
      onChange={(submission) => values.update((current) => ({ ...current, [key]: submission }))}
      {...(frame ? { frame, headPaths: [PAY_RATE_PATH] } : {})}
    />
  );

  const scrollToCard = !highlightPath;

  const benefitCard = (sub: StructureDraftSub, benefit: StructureDraftBenefit, benefitIndex: number) => {
    const card = (body: ReactNode, headExtra?: ReactNode) => (
      <Card
        key={benefit.key}
        editing={editing}
        level="benefit"
        nodeKey={benefit.key}
        treeKey={treeKeys.get(benefit.key)}
        name={benefit.name}
        fallbackName={sub.name}
        onName={(name) => updateSub(sub.key, (s) => ({ ...s, benefits: s.benefits.map((b) => (b.key === benefit.key ? { ...b, name } : b)) }))}
        issue={issueOf(benefit.key)}
        sibling={{
          index: benefitIndex,
          count: sub.benefits.length,
          onMove: (delta) => updateSub(sub.key, (s) => ({ ...s, benefits: moved(s.benefits, benefitIndex, delta) })),
          onRemove: () => updateSub(sub.key, (s) => ({ ...s, benefits: s.benefits.filter((b) => b.key !== benefit.key) })),
        }}
        isTarget={benefit.key === target}
        scrollToCard={scrollToCard}
        body={body}
        headExtra={headExtra}
      />
    );
    // 급부 값 폼은 카드 틀째 그린다 — 지급률이 이름 줄 오른쪽(머리 줄)에 선다 (2026-10-21)
    const form = benefit.id ? formByNode[benefit.key] : undefined;
    if (!benefit.id) return card(NEW_NOTE);
    if (!form || form.fields.length === 0) return card(null);
    return <Fragment key={benefit.key}>{structForm(benefit.key, form, ({ head, body }) => card(body, head))}</Fragment>;
  };

  const subCard = (sub: StructureDraftSub, subIndex: number) => (
    <Card
      key={sub.key}
      editing={editing}
      level="subCoverage"
      nodeKey={sub.key}
      treeKey={treeKeys.get(sub.key)}
      name={sub.name}
      onName={(name) => updateSub(sub.key, (s) => ({ ...s, name }))}
      issue={issueOf(sub.key)}
      sibling={{ index: subIndex, count: subs.length, onMove: (delta) => update(moved(subs, subIndex, delta)), onRemove: () => update(subs.filter((s) => s.key !== sub.key)) }}
      isTarget={sub.key === target}
      scrollToCard={scrollToCard}
      body={
        <>
          {formOf(sub.key, !sub.id)}
          {editing ? <AddRow label="급부" addLabel={`${sub.name.trim() || "세부보장"}에 급부 추가`} onAdd={() => addBenefit(sub.key)} /> : null}
          <div className="ts-cov-benefits">{sub.benefits.map((benefit, benefitIndex) => benefitCard(sub, benefit, benefitIndex))}</div>
        </>
      }
    />
  );

  return (
    <Card
      editing={editing}
      level="coverage"
      nodeKey={coverageKey}
      name={label.value}
      onName={label.setValue}
      isTarget={coverageKey === target}
      scrollToCard={scrollToCard}
      body={
        <>
          {categories && <CategoryRow editing={editing} value={category.value ?? ""} options={categories} onChange={category.setValue} />}
          {formOf(coverageKey, false)}
          {editing ? <AddRow label="세부보장" addLabel="세부보장 추가" onAdd={addSub} /> : null}
          <div className="ts-cov-grid">{subs.map(subCard)}</div>
        </>
      }
    >
      {hit ? <p className="ts-warn">담보명에 담보속성 값이 들어 있다 — 「{hit}」. 담보속성은 상품에 탑재할 때 정하므로 담보명에서 빼는 것이 좋다.</p> : null}
      {removed > 0 ? <p className="ts-warn">저장 시 삭제 {removed}개 — 영향을 확인한 뒤 저장된다 (관리자).</p> : null}
    </Card>
  );
}
