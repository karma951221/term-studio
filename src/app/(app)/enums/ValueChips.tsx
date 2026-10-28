"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { fitChipCount } from "./value-chips";

const GAP = 4; // .ts-enum-chips 의 gap
const MORE = 36; // .ts-enum-chips > .ts-chip-more 의 min-width

/**
 * 목록의 값 칩 (기능/열거형 §4.1) — 값 열이 남는 폭을 먹고, 칩은 글자를 자르지 않고 한 줄에 들어가는 만큼만 보인 뒤 나머지는 「+N」.
 * 칸 폭이 바뀌면 다시 센다. 넘친 칩은 자리만 빼고(측정용) 보이지 않는다. 전체 값은 title 로.
 */
export function ValueChips({ labels }: { labels: readonly string[] }) {
  const box = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(labels.length);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const chips = [...el.querySelectorAll<HTMLElement>(":scope > .ts-chip")];
      // 줄어든 칩도 제 폭으로 — scrollWidth(글자 + 안쪽 여백) + 테두리
      const widths = chips.map((chip) => chip.scrollWidth + chip.offsetWidth - chip.clientWidth);
      setShown(fitChipCount(widths, el.clientWidth, { gap: GAP, more: MORE }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [labels]);

  const rest = labels.length - shown;
  return <span ref={box} className="ts-enum-chips" title={labels.join(", ")}>
    {labels.map((label, index) => <span key={index} className={`ts-chip${index >= shown ? " is-overflow" : ""}`} aria-hidden={index >= shown || undefined}>{label}</span>)}
    {rest > 0 ? <span className="ts-chip-more" aria-label={`외 ${rest}개`}>+{rest}</span> : null}
  </span>;
}
