"use client";

import { BoxView } from "@/app/_components/BoxView";
import { EditShell, Field, useEditField } from "@/app/_components/EditShell";
import { BOX_BODY_LABEL, ENTITY_LABEL, FIELD_LABEL } from "@/app/_lib/labels";
import { Textarea } from "@/components/ui/textarea";
import { boxLabel, boxLinesFromText, boxLinesText, type Box } from "@/domain/document/box";

import { removeBoxEditAction, saveBoxEditAction } from "../edit-actions";
import type { BoxEditData } from "../edit-types";

/**
 * 본문(줄) 칸 — 읽기면 박스 그대로(출력 모양), 편집이면 여러 줄 글(한 줄 = 박스의 한 줄).
 * 편집 칸은 제목 칸과 같은 밑줄 입력(Textarea) · 값 열 전폭이고 높이는 내용을 따라 늘어난다.
 * 약관에 찍히는 【…】 머리는 이 칸 첫 줄에 적는다 — 제목은 목록 이름이다 (기능/박스 §3.1, 2026-10-28).
 */
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
        <Textarea id="box-lines-edit" aria-label={BOX_BODY_LABEL} value={lines.value} onChange={(event) => lines.setValue(event.target.value)} rows={3} className="ts-field-direct ts-box-lines-edit" placeholder={"【머리】 — 약관에 찍을 머리는 첫 줄에\n한 줄이 박스의 한 줄이다"} />
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
        {/* 제목은 목록 · 고르기에서 박스를 부르는 이름일 뿐 — 출력에 찍히지 않는다. 【】 머리는 본문에 (기능/박스 §3.1, 2026-10-28). */}
        <Field name="title" label={FIELD_LABEL.title} info="목록 · 고르기에서 박스를 부르는 이름이다 — 약관에 찍히지 않는다. 【】 없이 적고, 찍을 【…】 머리는 본문 첫 줄에 적는다. 비워도 된다." />
        <LinesField code={box.code} />
      </div>
    </EditShell>
  );
}
