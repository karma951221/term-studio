-- 마스터 필드 pay.exempt(면책여부) 삭제 (기능/담보 §3.3 · §6.2, 2026-10-21).
-- 면책 여부는 급부에 면책 특성(여는 폼 `exemption`)이 붙었는지로만 정한다 — 같은 뜻의 boolean 칸이 따로 있으면 둘이 어긋난다.
-- 0016(pay.first_only)과 같은 뜻으로 값 행도 지운다 — 담보 마스터(benefit)와 상품담보 스냅샷(productBenefit) 모두. 다시 돌려도 같다(멱등).
-- 이 경로를 읽는 구분자 식은 건드리지 않는다 — 식 검사가 없는 경로(brokenRef)로 알려 주므로 사람이 `exist(exemption.months)` 류로 고친다.
DELETE FROM "entity_values" WHERE "field_path" = 'pay.exempt';
