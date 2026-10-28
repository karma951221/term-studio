/**
 * 정적 마스터 박스 한 개의 읽기 표시 — 머리 띠 「박스 · 코드」 + 본문 줄 (최종 결정 9 · 기능/박스 §4.4).
 * 제목은 목록 이름이라 그리지 않는다 — 찍히는 【…】 머리는 본문 첫 줄이고 굵게 그린다(2026-10-28).
 * 문면 편집기 · 함수조항 모델 · 상품 템플릿 원문이 박스 참조를 같은 모양으로 그린다. 내용은 박스 화면에서만 고친다.
 */
import Link from "next/link";

import { boxLabel, isBoxHeadingLine, type Box } from "@/domain/document/box";
import type { Code } from "@/domain/types";

export function BoxView({ code, box, link = true }: { code: Code; box: Box | undefined; link?: boolean }) {
  if (!box) {
    return (
      <aside className="ts-doc-box" data-box={code}>
        <p className="ts-doc-box-title">【박스 {code}】</p>
        <p className="ts-doc-box-line ts-muted">{code} — 없는 박스다(깨진 참조).</p>
      </aside>
    );
  }
  return (
    <aside className="ts-doc-box" data-box={code} aria-label={`박스 ${boxLabel(box)}`}>
      <p className="ts-doc-box-ref ts-muted">
        박스 · {link ? <Link href={`/boxes/${encodeURIComponent(code)}`} className="ts-mono">{code}</Link> : <span className="ts-mono">{code}</span>}
      </p>
      <BoxLines lines={box.lines} />
    </aside>
  );
}

/** 박스 본문 줄 — 줄 전체가 【…】인 머리 줄은 굵게 (출력 · 편집기 · 박스 화면이 같은 모양). */
export function BoxLines({ lines }: { lines: readonly string[] }) {
  return lines.map((line, i) => (
    <p key={i} className={isBoxHeadingLine(line) ? "ts-doc-box-line ts-doc-box-heading" : "ts-doc-box-line"}>
      {line}
    </p>
  ));
}
