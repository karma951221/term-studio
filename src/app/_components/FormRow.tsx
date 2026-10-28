/**
 * 2열 필드 한 줄 — 라벨 좌측 고정폭, 값 우측 (디자인원칙 §2 L2).
 *
 * 생성 화면마다 같은 마크업을 적던 것을 모았다. 라벨을 값 위에 두지 않는다 —
 * 세로 길이가 두 배가 되고 「한눈에」가 깨진다.
 * 사용법 · 개념 설명은 `info` — 라벨 옆 ⓘ 툴팁. 칸 아래 상시 회색 설명문을 두지 않는다 (디자인원칙 §1.10, 2026-10-29).
 */
import type { ReactNode } from "react";

import { ACTION_LABEL } from "@/app/_lib/labels";

import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { HeadActions, HeadButton } from "./HeadActions";
import { InfoTip } from "./InfoTip";

export function FormRow({ label, htmlFor, info, children }: { label: string; htmlFor?: string; info?: string; children: ReactNode }) {
  return (
    <div className="ts-form-row">
      <FormLabel htmlFor={htmlFor} info={info}>
        {label}
      </FormLabel>
      <div className="ts-form-control">{children}</div>
    </div>
  );
}

/**
 * 폼 라벨 + 설명 ⓘ. ⓘ 는 `<label>` 밖에 둔다 — 안에 두면 입력칸의 접근성 이름에 설명문이 섞인다.
 * `htmlFor` 가 없으면(라디오 묶음처럼 라벨이 가리킬 칸이 하나가 아니면) 글자만.
 */
export function FormLabel({ htmlFor, id, info, children }: { htmlFor?: string; id?: string; info?: string; children: ReactNode }) {
  const tip = info ? <InfoTip text={info} /> : null;
  if (!htmlFor) {
    return (
      <span className="ts-form-label" id={id}>
        {children}
        {tip}
      </span>
    );
  }
  if (!tip) {
    return (
      <label className="ts-form-label" htmlFor={htmlFor} id={id}>
        {children}
      </label>
    );
  }
  return (
    <span className="ts-form-label">
      <label htmlFor={htmlFor} id={id}>
        {children}
      </label>
      {tip}
    </span>
  );
}

/** 생성 화면의 머리 — 제목과 「생성」을 한 줄에. 조작을 화면 하단에 두지 않는다 (§2 L2). */
export function CreateHead({
  title,
  formId,
  label = ACTION_LABEL.create,
  path,
  banner,
  actions,
}: {
  title: string;
  formId: string;
  label?: string;
  /** 이 화면 위의 경로 — 「구분자 › 새 구분자」 의 앞 마디 (디자인원칙 §1.7). */
  path: readonly Crumb[];
  banner?: ReactNode;
  /** 제출 버튼 왼쪽의 화면별 조작 — 구분자 생성의 「검사」 (저장의 일부인 것만). */
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="ts-edit-head">
        <Breadcrumb items={[...path, { label: title }]} />
        <HeadActions>
          {actions}
          <HeadButton type="submit" form={formId} primary>
            {label}
          </HeadButton>
        </HeadActions>
      </div>
      {banner}
    </>
  );
}
