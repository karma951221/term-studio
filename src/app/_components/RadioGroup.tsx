"use client";

/**
 * 라디오 묶음 — 짧은 선택지는 가로로 한 줄 (디자인원칙 §1.10, 2026-10-29).
 *
 * 옵션의 뜻풀이(hint)는 그 옵션 이름 옆 ⓘ 툴팁 — 상시 회색 설명문은 화면을 어지럽힌다 (2026-10-29, 전에는 고른 옵션의 hint 를 아래에 붙였다).
 *
 * 제어형(EditShell 의 Field)과 비제어형(서버 액션에 formData 로 실려 가는 생성 폼)을 같이 받는다.
 * 어느 쪽이든 `name`·`value` 를 단 진짜 input 이라 폼 제출에 그대로 실린다.
 */
import { Fragment, useState, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { InfoTip } from "./InfoTip";

/** 네이티브 라디오에 위젯 모양만 — 폼 제출 · 키보드 · E2E 가 그대로다. 라벨(<label>) 안에서 쓴다. */
export function RadioDot({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="radio"
      data-slot="radio-native"
      className={cn("relative size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-card outline-none transition-colors duration-150 checked:border-mark checked:before:absolute checked:before:inset-[3px] checked:before:rounded-full checked:before:bg-mark focus-visible:ring-[3px] focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60", className)}
      {...props}
    />
  );
}

export interface RadioOption {
  value: string | boolean;
  label: string;
  hint?: string;
}

export function RadioGroup({
  name,
  label,
  options,
  value,
  defaultValue,
  onChange,
  disabled,
}: {
  name: string;
  /** radiogroup 의 접근성 이름 — 보이는 라벨은 바깥(ts-form-row)이 그린다. */
  label: string;
  options: readonly RadioOption[];
  /** 제어형 — 바깥이 값을 쥘 때. */
  value?: string | boolean;
  /** 비제어형 초기값. */
  defaultValue?: string | boolean;
  onChange?: (value: string | boolean) => void;
  /** 고를 수 없는 자리 — 값은 보이되 조작은 막는다 (함수조항 유형처럼 등록 뒤 안 바뀌는 값). */
  disabled?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value !== undefined ? value : inner;

  return (
    <div className="ts-form-radios" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <Fragment key={String(option.value)}>
          <label className="ts-form-radio">
            <RadioDot
              name={name}
              value={String(option.value)}
              checked={current === option.value}
              disabled={disabled}
              onChange={() => {
                setInner(option.value);
                onChange?.(option.value);
              }}
            />
            {option.label}
          </label>
          {/* 라벨 밖 — 안에 두면 라디오의 접근성 이름에 뜻풀이가 섞인다 */}
          {option.hint ? <InfoTip text={option.hint} /> : null}
        </Fragment>
      ))}
    </div>
  );
}
