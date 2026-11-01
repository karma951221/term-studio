export interface CatalogEditData extends Record<string, unknown> {
  label: string;
  description: string;
  expression: string;
  /** 명시 결과 타입 (기능/구분자 §3.1) — 폼 모양 그대로. `resultTypeKind === ""` 는 비어 있음(필수라 저장이 거부된다). `lib.resultTypeFromForm` 이 도메인 타입으로 되돌린다. */
  resultTypeKind: string;
  resultTypeMulti: boolean;
  resultTypeEnum: string;
  /** 준용예외 구분자의 후보 조 (결과 타입 「조 참조 목록」만 — ADR-0098 결정 1). 다른 구분자는 빈 목록. */
  candidates?: string[];
}
