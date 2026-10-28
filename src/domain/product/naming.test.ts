import { describe, expect, it } from "vitest";

import { NOTICE_AFFIX_CHIP, defaultCoverageName, displayNamingTemplate, missingTemplateKinds } from "./naming";
import type { AttributeKind } from "./types";

const renewal: AttributeKind = {
  code: "A0001",
  label: "갱신유형",
  order: 9,
  values: [
    { code: "1", label: "비갱신형", fragment: "" },
    { code: "2", label: "갱신형", fragment: "갱신형" },
  ],
};
const addon: AttributeKind = {
  code: "A0002",
  label: "부가유형",
  order: 0,
  values: [
    { code: "1", label: "기본", fragment: "" },
    { code: "2", label: "추가", fragment: "추가" },
  ],
};
const kinds = [renewal, addon];

const template = "[A0001] [담보명] [A0002]";

describe("3차 S2 — 전역 명명 템플릿", () => {
  it("속성 조각과 담보명을 템플릿 칩 위치에 치환한다", () => {
    const name = defaultCoverageName(
      "일반상해사망",
      [
        { kindCode: "A0002", valueCode: "2" },
        { kindCode: "A0001", valueCode: "2" },
      ],
      kinds,
      template,
    );
    expect(name).toBe("갱신형 일반상해사망 추가");
  });

  it("빈 조각은 빈 문자열로 치환하고 결과 공백을 한 칸으로 정리한다", () => {
    expect(defaultCoverageName("일반상해사망", [], kinds, template)).toBe("일반상해사망");
    expect(
      defaultCoverageName(
        "일반상해사망",
        [
          { kindCode: "A0001", valueCode: "1" },
          { kindCode: "A0002", valueCode: "1" },
        ],
        kinds,
        template,
      ),
    ).toBe("일반상해사망");
  });

  it("종류 order와 무관하게 템플릿 순서와 리터럴 문자를 보존한다", () => {
    const name = defaultCoverageName(
      "골절수술비Ⅱ보장",
      [
        { kindCode: "A0001", valueCode: "2" },
        { kindCode: "A0002", valueCode: "2" },
      ],
      kinds,
      "[담보명][A0002] / [A0001]",
    );
    expect(name).toBe("골절수술비Ⅱ보장추가 / 갱신형");
  });

  it("미사용 종류·카탈로그에 없는 종류와 값은 빈 문자열로 치환한다", () => {
    expect(defaultCoverageName(" 일반상해사망 ", [{ kindCode: "A0009", valueCode: "1" }], kinds, template)).toBe("일반상해사망");
    expect(defaultCoverageName("일반상해사망", [{ kindCode: "A0001", valueCode: "9" }], kinds, template)).toBe("일반상해사망");
  });

  it("템플릿에 칩이 없는 속성 종류를 찾는다", () => {
    expect(missingTemplateKinds(kinds, "[담보명] [A0002]").map((kind) => kind.code)).toEqual(["A0001"]);
  });
});

describe("[고지 접사] 칩 — 상품의 담보명 접사 (2026-10-29 사용자 결정, 기능/상품 §3.1)", () => {
  const template = `[담보명] [${NOTICE_AFFIX_CHIP}]`;
  it("상품 사실의 접사를 칩 자리에 넣는다", () => {
    expect(defaultCoverageName("일반상해사망", [], kinds, template, { noticeAffix: "(통합간편심사형)" })).toBe("일반상해사망 (통합간편심사형)");
  });
  it("접사가 없으면 칩은 빈 글자 — 남는 공백은 접는다", () => {
    expect(defaultCoverageName("일반상해사망", [], kinds, template, { noticeAffix: "" })).toBe("일반상해사망");
    expect(defaultCoverageName("일반상해사망", [], kinds, template)).toBe("일반상해사망");
  });
  it("편집기 안내는 칩을 그대로 둔다", () => {
    expect(displayNamingTemplate(template, kinds)).toBe(template);
  });
});
