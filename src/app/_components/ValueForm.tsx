"use client";

/**
 * StructForm 을 서버 액션에 연결하는 얇은 클라이언트 래퍼.
 * StructForm 은 `onSubmit(submission)` 을 직접(폼 action 이 아니라 이벤트로) 부르므로,
 * 서버 액션을 이벤트 핸들러로 호출하는 패턴(Next.js 「Event Handlers」)을 쓴다.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { PAY_RATE_PATH } from "@/domain/master";
import type { Issue } from "@/domain/types";
import { StructForm, type FormModel, type Submission } from "@/forms";

export interface ActionOutcome {
  ok: boolean;
  issues?: Issue[];
}

export function ValueForm({
  model,
  action,
  submitLabel,
  showCodes,
  highlightPath,
  flat,
  cardHead,
}: {
  model: FormModel;
  /** 저장 서버 액션 — 실패하면 issues 를 실어 돌려준다. */
  action: (submission: Submission) => Promise<ActionOutcome>;
  submitLabel?: string;
  /** 관리자 — 필드 라벨 옆 ⓘ 코드 링크(tooltip `폼키.필드키`, StructForm 에 그대로 넘긴다). */
  showCodes?: boolean;
  /** `?field=` 로 들어온 강조 경로 (StructForm 에 그대로 넘긴다). */
  highlightPath?: string;
  /** 노드 카드 안에 얹힌 폼 — 폼 상자 없이 필드 행을 바로 (StructForm 에 그대로 넘긴다). */
  flat?: boolean;
  /**
   * 노드 카드 머리 줄(레벨 라벨 · 이름) — 주면 카드 머리 · 본문째 그리고, 급부의 지급률을 머리 줄 오른쪽 「지급률 ⊕」로 둔다
   * (상품담보 값 화면 — 담보 상세와 같은 급부 카드, 기능/담보 §3.6 · 2026-10-21).
   */
  cardHead?: ReactNode;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <StructForm
      model={model}
      pending={pending}
      issues={issues}
      submitLabel={submitLabel}
      showCodes={showCodes}
      highlightPath={highlightPath}
      flat={flat}
      {...(cardHead !== undefined
        ? {
            headPaths: [PAY_RATE_PATH],
            frame: ({ head, body }: { head: ReactNode; body: ReactNode }) => (
              <>
                <div className="ts-cov-card-head">
                  {cardHead}
                  {head ? <span className="ts-cov-head-extra">{head}</span> : null}
                </div>
                <div className="ts-cov-card-body">{body}</div>
              </>
            ),
          }
        : {})}
      onSubmit={(submission) => {
        startTransition(async () => {
          const r = await action(submission);
          if (!r.ok) {
            setIssues(r.issues ?? []);
          } else {
            setIssues([]);
            router.refresh();
          }
        });
      }}
    />
  );
}
