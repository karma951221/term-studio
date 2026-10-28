-- 상품특성의 세부 고지유형 칸 삭제 (기능/상품 §3.1 · §6.2, 2026-10-29 사용자 결정).
-- 약관만 다루므로 PV 연동용 세부 유형(간편심사구분 · 간편심사유형 · 건강고지유형)까지 모델링하지 않는다 —
-- 간편심사 · 건강고지 상품은 담보명 접사(feature.notice_affix, 상품담보명 규칙의 「[고지 접사]」 칩)만 받는다.
-- 0022 · 0033 과 같은 뜻으로 값 행을 지운다. 열거형 E0003 · E0004 · E0006 은 데이터라 시드에서만 뺐다 — 기존 DB 는 남아도 쓰는 칸이 없다.
-- 다시 돌려도 같다(멱등).
DELETE FROM "entity_values" WHERE "field_path" IN ('feature.review_scope', 'feature.review_type', 'feature.notice_type');
