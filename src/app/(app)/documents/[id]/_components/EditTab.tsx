"use client";

/**
 * 우측 패널 「편집」 탭 (2026-10-21, 기능/문면 §4.3) — 본문에서 고른 것의 고치기 폼 · 툴바 넣기 폼. 예전 본문 위 팝업 자리.
 *
 * - 고른 것이 없으면 안내 한 줄.
 * - 탭 맨 아래 고정 줄 〔되돌리기 · 적용〕(넣기 폼이면 〔되돌리기 · 넣기〕) — 고친 것이 없으면 둘 다 꺼진다(넣기는 처음 값으로도 넣는다).
 *   적용은 편집본에만(저장은 바의 `저장` 한 번, ADR-0074). 되돌리기는 폼을 처음 값으로 다시 그린다.
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import type { EditOp } from "@/domain/document";

import { alwaysSubmittable, submitLabel, type GuardChoice } from "./editTabRules";
import type { PopupSpec } from "./menus";
import { PopupHost, type PopupEnv } from "./Popups";

export const EDIT_FORM_ID = "ts-edit-form";

export const EDIT_TAB_EMPTY = "본문에서 함수조항 · 조 참조 · 조건식 · 동적표를 고르면 여기서 고칩니다.";

export function EditTab({
  env,
  spec,
  formKey,
  dirty,
  onDirty,
  onApplied,
  onRevert,
  onClear,
}: {
  env: PopupEnv;
  /** 지금 폼 — 없으면 빈 상태. */
  spec?: PopupSpec;
  /** 폼을 처음 값으로 다시 그릴 열쇠(되돌리기 · 적용 뒤 · 새로 고름). */
  formKey: number;
  dirty: boolean;
  onDirty: (dirty: boolean) => void;
  onApplied: (ops: readonly EditOp[]) => void;
  onRevert: () => void;
  onClear: () => void;
}) {
  if (!spec) return <p className="ts-edit-empty">{EDIT_TAB_EMPTY}</p>;
  return (
    <div className="ts-edit-tab">
      <div className="ts-edit-body">
        <PopupHost key={formKey} env={env} spec={spec} anchor={{ x: 0, y: 0 }} onClose={onClear} panel={{ formId: EDIT_FORM_ID, onApplied, onDirty }} />
      </div>
      <div className="ts-edit-foot">
        <button type="button" disabled={!dirty} onClick={onRevert}>
          되돌리기
        </button>
        <button type="submit" form={EDIT_FORM_ID} className="primary" disabled={!dirty && !alwaysSubmittable(spec)}>
          {submitLabel(spec)}
        </button>
      </div>
    </div>
  );
}

/** 미적용 확인 카드 — 편집 탭에 적용하지 않은 변경이 있는 채 다른 것을 고르거나 저장 · ✕ · 경로 링크를 눌렀다. 가운데 카드(디자인원칙 확인 카드). */
export function PendingCard({ onChoose }: { onChoose: (choice: GuardChoice) => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onChoose("stay");
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogTitle className="ts-confirm-title">적용하지 않은 변경이 있습니다</DialogTitle>
        <DialogDescription className="ts-confirm-body">편집 탭에서 고친 것을 편집본에 적용할까요? 버리면 폼이 처음 값으로 돌아간다.</DialogDescription>
        <DialogFooter className="ts-confirm-actions">
          <Button variant="default" onClick={() => onChoose("stay")}>
            돌아가기
          </Button>
          <Button variant="destructive" onClick={() => onChoose("discard")}>
            버리기
          </Button>
          <Button variant="primary" autoFocus onClick={() => onChoose("apply")}>
            적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
