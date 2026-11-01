/**
 * 판정 변화 묶음 (ADR-0082 결정 11 · 기능/상품 §3.8) — 저장 확인 모달 안의 줄. 상품담보 탭 저장이 판정 · 잠금을 바꿀 때 ·
 * 보통약관 탭 저장이 특약 조 판정을 바꿀 때(ADR-0093) · 담보약관 · 보통약관 템플릿 저장이 그 문서를 쓰는 상품의 판정을 바꿀 때(상품마다 한 묶음).
 * 막지 않는다(확인하면 저장). 줄의 조 이름은 템플릿 번호 「제N조(제목)」(목차와 같은 표기). `<ul>` 안에 `<li>` 묶음으로 넣는다.
 */
import type { JudgmentImpact } from "@/domain/types";

export function JudgmentLines({ judgment }: { judgment: JudgmentImpact }) {
  const groups: { title: string; lines: string[] }[] = [
    { title: "판정이 바뀌는 조", lines: judgment.verdicts.map((v) => `${v.label} — ${v.before} → ${v.after}`) },
    { title: "회색이 되는 사본", lines: judgment.grayed.map((g) => `${g.label} — 사본이 쓰이지 않습니다(지우지 않는다)`) },
    { title: "다시 쓰이는 사본", lines: judgment.revived.map((g) => `${g.label} — 사본이 다시 쓰입니다`) },
    { title: "깨지는 참조", lines: judgment.brokenRefs.map((b) => `${b.label} — ${b.message}`) },
    // 보통약관 탭 저장이 조 생략 기준을 바꿀 때 (ADR-0093 결정 6) — 줄 이름은 「상품담보명 › 조 명」
    { title: "특약 조 판정이 바뀌는 조", lines: (judgment.specials ?? []).map((v) => `${v.label} — ${v.before} → ${v.after}`) },
    // 준용예외 (ADR-0098 결정 7) — 「상품 · 특약 — 준용예외에 제N조 추가 / 빠짐」
    { title: "준용예외가 바뀌는 특약", lines: (judgment.exclusions ?? []).map((x) => `${x.label} — 준용예외에 ${[x.added.length ? `${x.added.map((a) => a.label).join(", ")} 추가` : "", x.removed.length ? `${x.removed.map((r) => r.label).join(", ")} 빠짐` : ""].filter(Boolean).join(" · ")}`) },
  ];
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g) => (
      <li key={g.title} className="ts-confirm-group">
        <span className="ts-confirm-group-title">{g.title}</span>
        <ul>
          {g.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </li>
    ));
}

