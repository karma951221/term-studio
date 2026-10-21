"use client";

import { BoxView } from "@/app/_components/BoxView";
import { EditShell, Field, useEditField } from "@/app/_components/EditShell";
import { BOX_BODY_LABEL, ENTITY_LABEL, FIELD_LABEL } from "@/app/_lib/labels";
import { boxHeading, boxLabel, boxLinesFromText, boxLinesText, type Box } from "@/domain/document/box";

import { removeBoxEditAction, saveBoxEditAction } from "../edit-actions";
import type { BoxEditData } from "../edit-types";

/** 본문(줄) 칸 — 읽기면 박스 그대로(미리보기), 편집이면 여러 줄 글(한 줄 = 박스의 한 줄). */
function LinesField({ code }: { code: string }) {
  const title = useEditField<string>("title");
  const lines = useEditField<string>("lines");
  if (lines.mode === "read") {
    return (
      <div className="ts-form-row">
        <label>{BOX_BODY_LABEL}</label>
        <div className="ts-form-control">
          <BoxView code={code} box={{ code, title: title.value, lines: boxLinesFromText(lines.value) }} link={false} />
        </div>
      </div>
    );
  }
  return (
    <div className="ts-form-row">
      <label htmlFor="box-lines-edit">{BOX_BODY_LABEL}</label>
      <div className="ts-form-control">
        <textarea id="box-lines-edit" aria-label={BOX_BODY_LABEL} value={lines.value} onChange={(event) => lines.setValue(event.target.value)} rows={10} className="ts-field-direct" />
      </div>
    </div>
  );
}

export function BoxEditor({ box }: { box: Box }) {
  const data: BoxEditData = { title: box.title, lines: boxLinesText(box.lines) };
  return (
    <EditShell
      initial={data}
      title={boxLabel(box)}
      path={[{ label: ENTITY_LABEL.box, href: "/boxes" }]}
      saveAction={saveBoxEditAction.bind(null, box.code)}
      deleteAction={removeBoxEditAction.bind(null, box.code)}
      deleteLabel={`${boxLabel(box)} 삭제`}
      deleteTooltip={`박스 ${boxLabel(box)}(${box.code}) 삭제 — 템플릿 · 함수조항이 놓고 있으면 그 참조가 깨진다`}
      deleteSuccessHref="/boxes"
    >
      <div className="ts-l2-main">
        {/* 코드는 시스템이 채번하고 등록 뒤에는 바뀌지 않는다 — 읽기 전용 (기능/박스 §3.1). */}
        <div className="ts-form-row">
          <label>{FIELD_LABEL.code}</label>
          <div className="ts-form-control">
            <span className="ts-field-static ts-mono">{box.code}</span>
          </div>
        </div>
        {/* 제목은 【】 없이 적는다 — 읽기에서는 시스템이 감싼 모양(【제목】)으로 보인다 (기능/박스 §3.1, 2026-10-21). */}
        <Field name="title" label={FIELD_LABEL.title} info="【】 없이 적는다 — 화면 · 출력에서 【제목】으로 감싼다. 비워도 된다." readValue={(v) => (typeof v === "string" && v !== "" ? boxHeading(v) : "없음")} />
        <LinesField code={box.code} />
      </div>
    </EditShell>
  );
}
