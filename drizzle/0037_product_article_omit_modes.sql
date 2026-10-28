-- 상품 조 생략 기준 (ADR-0093, 2026-10-27) — 보통약관 템플릿 조의 생략 기준(같을 때만 · 포함하면 생략)을 상품이 조 단위로 바꾼 자리.
-- 조 노출 표(product_hidden_articles)와 같은 모양 — 상품 × 조 id(text) 한 행. 템플릿과 다른 값만 행으로 둔다(없으면 템플릿대로).
CREATE TABLE "product_article_omit_modes" (
	"product_id" uuid NOT NULL,
	"article_id" text NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "product_article_omit_modes_product_id_article_id_pk" PRIMARY KEY("product_id","article_id")
);
--> statement-breakpoint
ALTER TABLE "product_article_omit_modes" ADD CONSTRAINT "product_article_omit_modes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;