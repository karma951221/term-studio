"use client";

/**
 * 특별약관 탭 오른쪽 패널 — 머리는 「미리보기」 + 고른 담보의 **상품담보 드롭다운**(개수), 아래는 고른 한 건의 조립 결과 (기능/상품 §4.7).
 *
 * 서버(`SpecialPreviewTab`)가 그 담보의 상품담보마다 결과를 미리 그려 `panes` 로 넘기고, 여기서는 고른 한 건만 붙인다.
 * 드롭다운을 바꿔도 서버를 다시 부르지 않는다 — 가운데(담보 모델)는 그대로 있고, 주소는 `replaceState` 로 `&pc=` 만 맞춘다
 * (보통약관 목차와 같은 방식). 서버가 다른 상품담보로 다시 그려 보내면 그것을 따른다.
 *
 * 출처 패널 (기능/조립산출 §4.2): 결과의 조를 누르면 이 패널 오른쪽에 고정 패널이 네 번째 칸으로 선다 — URL `&article=<조>`(`pc` 는 고른 상품담보 그대로).
 * 패널은 그 상품담보를 고르고 있을 때만 선다 — 선택기로 바꾸면 주소도 패널 없이 바뀐다.
 */
import { Fragment, useState, type ReactNode } from "react";

import { panelKey, PanelClicks, usePanelNav, type ScreenPanel } from "@/app/_components/sourcePanel/PanelHost";
import { SourcePanel } from "@/app/_components/sourcePanel/SourcePanel";
import type { Id } from "@/domain/types";

import { specialPreviewPath } from "../../lib";

export interface SpecialCoveragePane {
  /** 상품담보 id. */
  id: Id;
  /** 상품담보명 — 선택기 · 패널 제목. */
  name: string;
  body: ReactNode;
}

export function SpecialCoveragePanes({ productId, panes, initialId, panel }: { productId: Id; panes: readonly SpecialCoveragePane[]; initialId: Id; panel?: ScreenPanel }) {
  const go = usePanelNav({ own: ["pc"] });
  const [current, setCurrent] = useState(initialId);
  // 서버가 다른 상품담보로 다시 그렸으면 그것을 따른다 — 렌더 중 상태 맞추기(GeneralPanels 와 같은 패턴)
  const [served, setServed] = useState(initialId);
  if (served !== initialId) {
    setServed(initialId);
    setCurrent(initialId);
  }
  const pane = panes.find((p) => p.id === current) ?? panes[0];
  const target = panel?.state.target;
  const open = panel?.content && target?.document === "special" && target.productCoverageId === pane?.id ? panel.content : undefined;
  const showOmitted = panel?.state.showOmitted ?? true;
  return (
    <>
    <section className="ts-terms-panel" aria-label="미리보기">
      <div className="ts-terms-panel-head">
        <h3 className="ts-terms-panel-title">미리보기</h3>
        <select
          className="ts-special-pc-select"
          aria-label="상품담보"
          value={pane?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            setCurrent(id);
            globalThis.window?.history.replaceState(null, "", specialPreviewPath(productId, id));
          }}
        >
          {panes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="ts-dim">상품담보 {panes.length}</span>
      </div>
      {pane && (
        <PanelClicks onPick={(hit) => go({ ...hit, showOmitted })}>
          <Fragment key={pane.id}>{pane.body}</Fragment>
        </PanelClicks>
      )}
    </section>
    {open && panel && <SourcePanel key={panelKey(panel.state)} content={open} {...(panel.state.node ? { focus: panel.state.node } : {})} onClose={() => go({ showOmitted })} />}
    </>
  );
}
