-- 표 구분자 (기능/구분자 §3.7, ADR-0099 — 2026-11-01 사용자 결정) — 동적표 정의 객체를 걷어낸다.
-- 지급금액 표는 시스템이 정의하는 표 구분자(코드에 산다 — DB 행이 없다)가 되었다. 코드(DT000001 …)는 그대로 이어 쓴다.
-- 문면의 동적표 참조 dynTableRef{tableCode, bindings} 는 표 구분자 자리 tableRef{code} 가 된다 — 인자 연결은 시스템이 대므로 걷는다.
-- 함수조항 본문 · 상품 조 사본(보통약관 조)에는 동적표 참조가 설 수 없었다 — 담보약관 문서(documents.tree)만 바꾼다.
-- 다시 돌려도 같다(멱등).
CREATE OR REPLACE FUNCTION ts_0042_table_ref(n jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  out jsonb;
BEGIN
  IF jsonb_typeof(n) = 'array' THEN
    SELECT coalesce(jsonb_agg(ts_0042_table_ref(e) ORDER BY i), '[]'::jsonb) INTO out FROM jsonb_array_elements(n) WITH ORDINALITY AS t(e, i);
    RETURN out;
  ELSIF jsonb_typeof(n) = 'object' THEN
    IF n->>'kind' = 'dynTableRef' THEN
      RETURN jsonb_build_object('id', n->'id', 'kind', 'tableRef', 'code', n->'tableCode');
    END IF;
    SELECT coalesce(jsonb_object_agg(key, ts_0042_table_ref(value)), '{}'::jsonb) INTO out FROM jsonb_each(n);
    RETURN out;
  END IF;
  RETURN n;
END
$$;
--> statement-breakpoint
UPDATE "documents" SET "tree" = ts_0042_table_ref("tree") WHERE "tree"::text LIKE '%"dynTableRef"%';
--> statement-breakpoint
DROP FUNCTION ts_0042_table_ref(jsonb);
--> statement-breakpoint
DROP TABLE IF EXISTS "dyn_tables";
--> statement-breakpoint
DELETE FROM "code_sequences" WHERE "kind" = 'dynTable';
