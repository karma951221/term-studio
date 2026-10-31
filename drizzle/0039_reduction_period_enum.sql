-- 감액 경계 = 열거형 「감액기간」 값 (기능/담보 §3.4 · 기능/동적표 §3.2 · 기능/열거형 §3.1, 2026-10-31 사용자 결정).
-- 감액 구간표(reduction.periods)의 기간 칸이 개월 정수에서 열거형 「감액기간」(E0010 — 시드 90일 V01 · 180일 V02 · 1년 V03 · 2년 V04)의 값 코드가 된다.
-- ① 옮길 열거값이 없는 개월 수(18 등)가 섞인 구간 값 행은 지운다 — 감액 폼의 다른 칸(이후 지급률 · 신규계약만)이 남아 폼은 열린 채 구간이 미입력으로 드러난다(조용히 바꾸지 않는다, 0030 과 같은 뜻).
-- ② 남은 값 행의 개월 수를 시드 열거값으로 옮긴다 — 3 → V01 · 6 → V02 · 12 → V03 · 24 → V04. 시드 담보에는 감액 값이 없다(테스트 픽스처뿐).
-- 열거형 E0010 자체는 데이터라 시드(`src/db/seed/data/enums.json` — `loadEnums`)가 만든다. 다시 돌려도 같다(멱등 — 이미 코드인 값은 건드리지 않는다).
DELETE FROM "entity_values"
  WHERE "field_path" = 'reduction.periods'
    AND (jsonb_typeof("value") <> 'array'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements("value") AS row
        WHERE jsonb_typeof(row -> 'end') = 'number' AND (row ->> 'end')::numeric NOT IN (3, 6, 12, 24)
      ));
--> statement-breakpoint
UPDATE "entity_values"
  SET "value" = (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN jsonb_typeof(row -> 'end') = 'number' THEN jsonb_set(row, '{end}', to_jsonb(
          CASE (row ->> 'end')::numeric WHEN 3 THEN 'V01' WHEN 6 THEN 'V02' WHEN 12 THEN 'V03' ELSE 'V04' END))
        ELSE row
      END), '[]'::jsonb)
    FROM jsonb_array_elements("value") AS row
  )
  WHERE "field_path" = 'reduction.periods' AND jsonb_typeof("value") = 'array'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements("value") AS row WHERE jsonb_typeof(row -> 'end') = 'number');
