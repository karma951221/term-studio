-- 정액형 동적표 (기능/동적표 §3.7 — 통합치료비, 2026-10-31 사용자 결정).
-- 동적표 정의에 정액형 칸 { caption, benefitHeader }(인라인 노드 둘)를 더한다 — 있으면 정액형(행 · 정액은 급부 「정액표」 특성 · 가입금액마다 캡션 + 표), null 이면 감액(비율) 표.
-- 기존 정의는 전부 감액 표라 null 그대로. 다시 돌려도 같다(멱등).
ALTER TABLE "dyn_tables" ADD COLUMN IF NOT EXISTS "fixed" jsonb;
