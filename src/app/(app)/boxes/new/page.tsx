/** 새 박스 (생성) — 다른 생성 화면과 같은 폼 패턴 (기능/박스 §4.2). 코드는 받지 않는다 (시스템 채번). 칸은 제목 · 본문 — 박스 이름 칸은 없다 (2026-10-21). */
import { CreateHead, FormRow } from "@/app/_components/FormRow";
import { ErrorBanner } from "@/app/_components/ErrorBanner";
import { BOX_BODY_LABEL, ENTITY_LABEL, FIELD_LABEL, newLabel } from "@/app/_lib/labels";
import { Textarea } from "@/components/ui/textarea";

import { createBoxAction } from "../actions";

export const dynamic = "force-dynamic";

const FORM_ID = "create-box";

export default async function NewBoxPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div>
      <CreateHead title={newLabel(ENTITY_LABEL.box)} formId={FORM_ID} path={[{ label: ENTITY_LABEL.box, href: "/boxes" }]} banner={<ErrorBanner message={error} />} />
      <form id={FORM_ID} action={createBoxAction} className="ts-create-form">
        <FormRow label={FIELD_LABEL.title} htmlFor="box-title">
          <input id="box-title" type="text" name="title" autoFocus placeholder="예: 보험연도 — 목록에 보이는 이름 (【】 없이 · 비워도 된다)" />
        </FormRow>
        <FormRow label={BOX_BODY_LABEL} htmlFor="box-lines">
          <Textarea id="box-lines" name="lines" rows={3} required className="ts-field-direct ts-box-lines-edit" placeholder={"한 줄이 박스의 한 줄이다 — 약관에 찍을 【…】 머리는 첫 줄에\n예: 【보험연도】\n보험연도란 계약일부터 1년 단위로 …"} />
        </FormRow>
      </form>
      <p className="ts-form-hint">제목은 목록 · 고르기에서 박스를 부르는 이름일 뿐 약관에 찍히지 않는다 — 【】 없이 적고, 찍을 【…】 머리는 본문 첫 줄에 적는다. 같은 제목이 여럿이어도 된다(코드로 가른다). 코드는 시스템이 BX000001 부터 붙이고, 등록 뒤에는 바뀌지 않는다. 박스 안에는 조 참조 · 슬롯을 두지 않는다 — 고정 글이다.</p>
    </div>
  );
}
