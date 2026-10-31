-- 급부명은 선택 값 — 비면 어디서나 세부보장명으로 읽는다 (기능/담보 §3.1, 2026-10-31 사용자 결정).
-- 형제 유일 인덱스는 적힌 이름끼리만 본다 — 빈 급부명이 한 세부보장 아래 여럿이어도 된다. 데이터는 바꾸지 않는다. 다시 돌려도 같다(멱등).
DROP INDEX IF EXISTS "benefits_sibling_name";
--> statement-breakpoint
CREATE UNIQUE INDEX "benefits_sibling_name" ON "benefits" USING btree ("sub_coverage_id","name") WHERE "name" <> '';
