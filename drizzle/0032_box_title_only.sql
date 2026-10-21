-- 박스 이름 폐지 — 제목이 곧 이름 (기능/박스 §3.1, 2026-10-21).
-- 사용자 결정: 「박스 이름과 제목을 분리할 필요가 있어? 제목에 【】를 붙인 게 다잖아.」
--
-- 옮길 값은 없다 — 제목 칸이 이미 괄호 없는 제목을 들고 있다(시드 792건 모두 이름 = 「【제목】」 + 구분용 꼬리, 또는 제목 없는 박스는 「박스 — 첫 줄 앞머리」).
-- 이름의 꼬리(「(알파Plus)」 · 「— 청약서에서」 · 순번)는 같은 제목을 가르던 것이라 버린다 — 이제 코드 · 본문 앞머리로 가른다.
-- 제목 없는 박스는 제목 없는 채로 둔다 — 이름을 제목으로 올리면 출력에 없던 【】 머리 줄이 생긴다.
-- 통째로 【…】에 싸인 제목은 벗긴다(표시 · 출력이 【】를 붙이므로 이중으로 감싸지 않게). 두 번 돌려도 같다.
UPDATE "boxes" SET "title" = btrim(substr(btrim("title"), 2, char_length(btrim("title")) - 2))
WHERE btrim("title") ~ '^【[^【】]*】$';--> statement-breakpoint
ALTER TABLE "boxes" DROP CONSTRAINT IF EXISTS "boxes_name_unique";--> statement-breakpoint
ALTER TABLE "boxes" DROP COLUMN IF EXISTS "name";
