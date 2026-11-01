"use client";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { EnumDef } from "@/domain/catalog";
import type { FieldType, Value } from "@/domain/types";

export function DefaultValueInput({ type, value, onChange, enums, disabled }: { type: FieldType; value: Value | undefined; onChange: (value: Value | undefined) => void; enums: readonly EnumDef[]; disabled?: boolean }) {
  const item = "enumCode" in type ? enums.find((entry) => entry.code === type.enumCode) : undefined;
  switch (type.kind) {
    case "string": return <Input type="text" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} disabled={disabled} className="ts-field-direct" />;
    case "number": return <Input type="number" value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} disabled={disabled} className="ts-field-direct col-num text-right" />;
    case "boolean": return <NativeSelect value={value === undefined ? "" : value ? "true" : "false"} onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value === "true")} disabled={disabled} className="ts-field-direct"><option value="">없음</option><option value="true">예</option><option value="false">아니오</option></NativeSelect>;
    case "date": return <Input type="date" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} disabled={disabled} className="ts-field-direct" />;
    case "enum": return <NativeSelect value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} disabled={disabled} className="ts-field-direct"><option value="">없음</option>{item?.values.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</NativeSelect>;
    case "list<enum>": return <NativeSelect multiple value={Array.isArray(value) ? (value as string[]) : []} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))} disabled={disabled} className="ts-field-direct h-auto py-1">{item?.values.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</NativeSelect>;
    // table 기본값 입력은 아직 없다 — 후속 태스크가 채운다. 기본값을 고를 수 있는 타입에 table 은 없다 (labels.ts SELECTABLE_TYPE_KINDS).
    case "table": return null;
  }
}
