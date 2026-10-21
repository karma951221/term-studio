-- 보험금명(coverage_basic.claim_name)과 그 투영 구분자 「담보명」(D0001) 삭제 (ADR-0091, 2026-10-21).
--
-- 담보약관 템플릿은 담보 하나가 한 벌 소유라 「…을 사망보험금으로 지급합니다」의 보험금 이름은 그 담보약관에 글자로 쓴다.
-- ① 함수조항 인자의 기본 연결이 D0001 이면 기본 연결을 지우고(요구 구분자에서도 뺀다)
-- ② 담보약관(documents.kind = 'special')마다 그 담보의 보험금명 값으로 — D0001 슬롯은 같은 id 의 글 노드, 그 함수조항의 쓰임은
--    연결이 없거나 D0001 을 가리키면 상수 연결. 바뀐 문서는 판을 1 올린다(ADR-0074).
--    보험금명 값이 없는 담보 · 보통약관 · 상품 조 사본은 바꿀 글자를 몰라 그대로 둔다 — 없는 구분자(brokenRef) · 연결 없음(argUnbound)으로 드러난다.
-- ③ 보험금명 값 행(담보 마스터 · 상품담보 스냅샷)과 구분자 D0001(식이 coverage_basic.claim_name 인 것만)을 지운다.
-- 다시 돌려도 같다(멱등) — 두 번째에는 D0001 이 남은 자리만 다시 보고, 값이 없어 아무것도 바꾸지 않는다.
CREATE OR REPLACE FUNCTION "ts_0034_inline"(node jsonb, claim text, params jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE result jsonb; b jsonb; name text;
BEGIN
  IF jsonb_typeof(node) = 'array' THEN
    RETURN coalesce((SELECT jsonb_agg("ts_0034_inline"(e, claim, params) ORDER BY i) FROM jsonb_array_elements(node) WITH ORDINALITY AS t(e, i)), '[]'::jsonb);
  END IF;
  IF jsonb_typeof(node) <> 'object' THEN
    RETURN node;
  END IF;
  IF node->>'kind' = 'slot' AND node->>'ref' = 'D0001' THEN
    RETURN jsonb_build_object('id', node->'id', 'kind', 'text', 'text', claim);
  END IF;
  result := coalesce((SELECT jsonb_object_agg(k, "ts_0034_inline"(v, claim, params)) FROM jsonb_each(node) AS e(k, v)), '{}'::jsonb);
  IF result ? 'clauseCode' AND params ? (result->>'clauseCode') THEN
    b := coalesce(result->'bindings', '{}'::jsonb);
    FOR name IN SELECT jsonb_array_elements_text(params->(result->>'clauseCode')) LOOP
      IF NOT b ? name OR (b->name->>'kind' = 'discriminator' AND b->name->>'code' = 'D0001' AND NOT b->name ? 'node') THEN
        b := b || jsonb_build_object(name, jsonb_build_object('kind', 'const', 'value', claim));
      END IF;
    END LOOP;
    result := result || jsonb_build_object('bindings', b);
  END IF;
  RETURN result;
END $$;
--> statement-breakpoint
DO $$
DECLARE d record; claim_params jsonb; claim text; t jsonb;
BEGIN
  -- ① 보험금명을 기본 연결로 받던 인자 — 함수조항 코드 → 인자 이름들
  SELECT coalesce(jsonb_object_agg(c."code", names), '{}'::jsonb) INTO claim_params FROM (
    SELECT c."code", jsonb_agg(p->>'name') AS names
      FROM "clauses" c, jsonb_array_elements(c."params") p
     WHERE p->'default'->>'kind' = 'discriminator' AND p->'default'->>'code' = 'D0001' AND NOT (p->'default' ? 'node')
     GROUP BY c."code"
  ) c;
  -- ② 담보약관 — 그 담보의 보험금명 값이 있을 때만
  FOR d IN SELECT "id", "owner_id", "tree" FROM "documents" WHERE "kind" = 'special' LOOP
    SELECT v."value" #>> '{}' INTO claim FROM "entity_values" v
     WHERE v."owner_kind" = 'coverage' AND v."owner_id" = d."owner_id" AND v."field_path" = 'coverage_basic.claim_name';
    IF claim IS NULL THEN CONTINUE; END IF;
    t := "ts_0034_inline"(d."tree", claim, claim_params);
    IF t <> d."tree" THEN
      UPDATE "documents" SET "tree" = t, "version" = "version" + 1 WHERE "id" = d."id";
    END IF;
  END LOOP;
  UPDATE "clauses" c SET
    "params" = (SELECT jsonb_agg(CASE WHEN p->'default'->>'kind' = 'discriminator' AND p->'default'->>'code' = 'D0001' AND NOT (p->'default' ? 'node') THEN p - 'default' ELSE p END ORDER BY i)
                  FROM jsonb_array_elements(c."params") WITH ORDINALITY AS t(p, i)),
    "required_discriminators" = c."required_discriminators" - 'D0001'
   WHERE claim_params ? c."code";
END $$;
--> statement-breakpoint
DROP FUNCTION "ts_0034_inline"(jsonb, text, jsonb);
--> statement-breakpoint
-- ③ 값 행 · 구분자
DELETE FROM "entity_values" WHERE "field_path" = 'coverage_basic.claim_name';
--> statement-breakpoint
DELETE FROM "discriminators" WHERE "code" = 'D0001' AND "expression" = 'coverage_basic.claim_name';
