import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { nodeBuilders, numberTree, referenceTargetIndex, sequentialIds } from "@/domain/document";

import { RefTargetTree } from "./RefTargetTree";

describe("화면의 코드 표시 — 대상 고르기 줄 끝 (ADR-0072 · 기능/문면 §6.2)", () => {
  it("대상 고르기 줄 끝에 흐린 글씨 「P0200 · 호」 — 조 줄에는 없다", () => {
    const b = nodeBuilders(sequentialIds("t"));
    const item = b.item([b.text("호")]);
    item.code = "P0200";
    const para = b.paragraph([b.text("항")], [item]);
    para.code = "P0100";
    const doc = b.document("d", [b.article("조", [para])]);
    const index = referenceTargetIndex(doc, numberTree(doc));
    // 고른 대상의 조상이 펴져 있어 항 · 호 줄이 그려진다
    const html = renderToStaticMarkup(<RefTargetTree id="t" scopes={[{ key: "self", index }]} defaultSelected={[item.id]} />);
    expect(html).toContain('<span class="ts-ref-code">P0100 · 항</span>');
    expect(html).toContain('<span class="ts-ref-code">P0200 · 호</span>');
    expect(html.match(/ts-ref-code/g)).toHaveLength(2);
  });
});

describe("고른 대상 칩 (2026-10-29) — 트리 위에 고른 것을 한 줄로, ✕ 로 뺀다", () => {
  it("고른 대상마다 칩 하나 · 표기는 칩과 같은 말 · 빼기 버튼", () => {
    const b = nodeBuilders(sequentialIds("t"));
    const p1 = b.paragraph([b.text("첫 항")]);
    const p2 = b.paragraph([b.text("둘째 항")]);
    const doc = b.document("d", [b.article("보험금의 지급사유", [p1, p2])]);
    const index = referenceTargetIndex(doc, numberTree(doc));
    const html = renderToStaticMarkup(<RefTargetTree id="t" scopes={[{ key: "self", index }]} defaultSelected={[p2.id]} />);
    expect(html).toContain('<ul class="ts-ref-chips" aria-label="고른 대상">');
    expect(html).toContain('<span class="ts-ref-chip-text">제1조(보험금의 지급사유) 제2항</span>');
    expect(html).toContain('aria-label="제1조(보험금의 지급사유) 제2항 빼기"');
    expect(html.match(/class="ts-ref-chip"/g)).toHaveLength(1);
  });

  it("아무것도 안 골랐으면 칩 줄이 없다", () => {
    const b = nodeBuilders(sequentialIds("t"));
    const doc = b.document("d", [b.article("조", [b.paragraph([b.text("항")])])]);
    const index = referenceTargetIndex(doc, numberTree(doc));
    expect(renderToStaticMarkup(<RefTargetTree id="t" scopes={[{ key: "self", index }]} defaultSelected={[]} />)).not.toContain("ts-ref-chips");
  });
});
