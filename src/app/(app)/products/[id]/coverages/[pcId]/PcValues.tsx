"use client";

/**
 * 상품담보 값 — 읽기 / 편집 · 저장 하나 (기능/상품 §4.8, M12 재작성 2026-10-27).
 *
 * - 읽기로 시작한다. `편집` → 같은 자리 `[취소] [저장]`(`ProductEditButtons`). 저장 하나 = 한 트랜잭션(`saveSnapshotAction`) — 노드마다 폼 · 저장은 없다.
 * - 값은 담보 상세의 중첩 카드(`Card`)를 그대로 쓴다 — 늘 `editing={false}` 라 구조 조작(⊕⊖ · 이름 · 순서 · 담보분류)이 없다.
 * - 편집 모드 조작 = 값 입력 · 칸의 값 비우기 · 가져오기(마스터와 다른 칸만) · 급부의 「특성 ⊕」/⊖ · 「마스터에는 {특성} 있음 · 가져오기」 · 「지급률 ⊕」.
 *   전부 `formReducer` 액션이고 초안(노드 id → FormState)은 여기 한곳에 있다(`lib.ts`).
 * - 특성을 떼는 저장은 서버가 1차로 영향을 돌려준다 → `SaveConfirmDialog` 「특성 해제 · {급부명} — 사라질 값」 → 확인하면 저장. 역할 관문은 없다.
 * - 경로 링크 · 「담보 마스터」 링크는 고친 것이 있으면 「고친 내용을 버립니까?」를 거친다.
 */
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";

import { Card } from "@/app/(app)/coverages/[id]/CoverageCards";
import { Breadcrumb } from "@/app/_components/Breadcrumb";
import { ENTITY_LABEL } from "@/app/_lib/labels";
import { PAY_RATE_PATH } from "@/domain/master";
import type { Impact, Issue } from "@/domain/types";
import { formReducer, StructForm, type FormAction } from "@/forms";

import { saveSnapshotAction } from "../../../actions";
import { ProductEditButtons, useProductEdit } from "../../_components/ProductEdit";
import { SaveConfirmDialog } from "../../_components/SaveConfirmDialog";
import { initSnapshotDraft, issuesOfOwner, snapshotDraftDirty, snapshotWritesOf, type SnapshotDraft, type SnapshotOwnerModel } from "./lib";

export interface PcTreeNode {
  id: string;
  key: string;
  name: string;
}
export interface PcTree {
  id: string;
  name: string;
  subCoverages: (PcTreeNode & { benefits: PcTreeNode[] })[];
}

export function PcValues({ productId, productName, productHref, coverageId, coverageName, tree, owners, missing }: {
  /** 미입력 목록 섹션 — 머리와 값 사이 (서버가 그린다). */
  missing?: ReactNode;
  productId: string;
  productName: string;
  /** 경로의 상품 마디 — 상품담보 탭. */
  productHref: string;
  coverageId: string;
  coverageName: string;
  tree: PcTree;
  /** 노드마다 값 폼 모델(저장값 + 마스터 값). 필드가 없는 레벨은 빠져도 된다. */
  owners: SnapshotOwnerModel[];
}) {
  const { editing, pending, register, leave, save: requestSave } = useProductEdit();
  const router = useRouter();
  const [draft, setDraft] = useState<SnapshotDraft>(() => initSnapshotDraft(owners));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Impact>();

  const reset = () => {
    setDraft(initSnapshotDraft(owners));
    setIssues([]);
    setError("");
    setConfirmation(undefined);
  };
  const submit = async (confirmed: boolean): Promise<"done" | "stay"> => {
    const { writes, invalid } = snapshotWritesOf(owners, draft);
    if (invalid) {
      setError("값을 해석할 수 없는 칸이 있습니다. 표시된 칸을 고쳐 주세요.");
      return "stay";
    }
    if (writes.length === 0) return "done";
    try {
      const r = await saveSnapshotAction(productId, tree.id, writes, confirmed);
      if (r.ok === "confirm") {
        setConfirmation(r.impact);
        setError("");
        return "stay";
      }
      if (r.ok === false) {
        setIssues(r.issues);
        setError(r.message);
        setConfirmation(undefined);
        return "stay";
      }
      setIssues([]);
      setError("");
      setConfirmation(undefined);
      return "done";
    } catch {
      setError("저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.");
      return "stay";
    }
  };
  // 매 렌더 등록 — 손잡이가 최신 초안을 닫아 두도록
  useEffect(() => {
    register({ begin: reset, cancel: reset, save: submit, dirty: () => snapshotDraftDirty(owners, draft) });
    return () => register(null);
  });

  const modelOf = (id: string) => owners.find((o) => o.owner.id === id)?.model;
  const dispatchOf = (id: string) => (action: FormAction) => setDraft((current) => (current[id] ? { ...current, [id]: formReducer(current[id], action) } : current));
  /** 노드의 값 폼 — 미입력 목록의 「고치러 가기」 앵커(`#own-<id>-values`) 자리. 필드가 없는 레벨은 폼 자리가 없다. */
  const form = (id: string, frame?: Parameters<typeof StructForm>[0]["frame"]) => {
    const model = modelOf(id);
    const state = draft[id];
    if (!model || !state || model.fields.length === 0) return null;
    return (
      <StructForm
        model={model}
        state={state}
        dispatch={dispatchOf(id)}
        embedded
        flat
        readOnly={!editing}
        valueCommands
        issues={issuesOfOwner(issues, id)}
        {...(frame ? { frame, headPaths: [PAY_RATE_PATH] } : {})}
      />
    );
  };
  const anchored = (id: string, node: ReactNode) => (node ? <div id={`own-${id}-values`}>{node}</div> : null);
  const noop = () => {};

  return (
    <>
      <div className="ts-page-head">
        <Breadcrumb items={[{ label: ENTITY_LABEL.product, href: "/products" }, { label: productName, href: productHref }, { label: tree.name }]} guard={leave} />
        <ProductEditButtons />
      </div>
      <p className="ts-muted">
        담보 마스터:{" "}
        <a
          href={`/coverages/${coverageId}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            leave(() => router.push(`/coverages/${coverageId}`));
          }}
        >
          {coverageName}
        </a>
      </p>
      {error && (
        <p role="alert" className="ts-error-banner">
          {error}
        </p>
      )}
      {missing}
      {confirmation && <SaveConfirmDialog impact={confirmation} pending={pending} onCancel={() => setConfirmation(undefined)} onConfirm={() => requestSave(true)} />}

      {/* 담보 ⊃ 세부보장(그리드) ⊃ 급부 — 담보 상세와 같은 중첩 카드 (기능/담보 §3.6). 구조 조작은 없다 */}
      <Card
        editing={false}
        level="coverage"
        nodeKey={`coverage:${tree.id}`}
        name={tree.name}
        onName={noop}
        isTarget={false}
        scrollToCard={false}
        body={
          <>
            {anchored(tree.id, form(tree.id))}
            <div className="ts-cov-grid">
              {tree.subCoverages.map((s) => (
                <Card
                  key={s.id}
                  editing={false}
                  level="subCoverage"
                  nodeKey={`subCoverage:${s.id}`}
                  treeKey={s.key}
                  name={s.name}
                  onName={noop}
                  isTarget={false}
                  scrollToCard={false}
                  body={
                    <>
                      {anchored(s.id, form(s.id))}
                      <div className="ts-cov-benefits">
                        {s.benefits.map((b) => {
                          const card = (body: ReactNode, headExtra?: ReactNode) => (
                            <Card key={b.id} editing={false} level="benefit" nodeKey={`benefit:${b.id}`} treeKey={b.key} name={b.name} onName={noop} isTarget={false} scrollToCard={false} body={body} headExtra={headExtra} />
                          );
                          // 급부 값 폼은 카드 틀째 그린다 — 지급률이 이름 줄 오른쪽(머리 줄)에 선다 (담보 상세와 같다)
                          const framed = form(b.id, ({ head, body }) => card(<div id={`own-${b.id}-values`}>{body}</div>, head));
                          return framed ? <Fragment key={b.id}>{framed}</Fragment> : card(null);
                        })}
                      </div>
                    </>
                  }
                />
              ))}
            </div>
          </>
        }
      />
    </>
  );
}
