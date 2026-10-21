-- 동적표 열 기준(dyn_tables.column_basis) 폐지 (기능/동적표 §3.2 · §6.2, 2026-10-21).
-- 표 모양은 머리글 구조가 정한다 — 첫 · 가운데 · 마지막 열 머리글을 모두 비우면 감액이 있어도 늘 열 하나(단일형),
-- 셋을 채우면 감액 경계 합집합으로 열을 나눈다(감액 구간형).
-- ① 열 기준 「없음」이던 정의는 첫 · 가운데 · 마지막을 비운다 — 「없음」에서는 쓰이지 않던 머리글이라 펼친 표는 그대로다(단일형이 된다).
-- ② 컬럼을 지운다. 다시 돌려도 같다(멱등) — 컬럼이 없으면 ①을 건너뛴다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dyn_tables' AND column_name = 'column_basis') THEN
    UPDATE "dyn_tables"
      SET "headers" = jsonb_set(jsonb_set(jsonb_set("headers", '{first}', '[]'::jsonb), '{middle}', '[]'::jsonb), '{last}', '[]'::jsonb)
      WHERE "column_basis" = 'none';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "dyn_tables" DROP COLUMN IF EXISTS "column_basis";
