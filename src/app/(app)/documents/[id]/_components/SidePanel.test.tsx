import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DraftIssues, SidePanel } from "./SidePanel";

describe("검증 줄의 「코드 수정」 — 이동 충돌 · 형식 오류 자리 (ADR-0072 결정 5)", () => {
  it("코드 오류가 난 자리에만 「코드 수정」, 「고칠 자리로」는 줄마다", () => {
    const issues = [
      { kind: "structure" as const, message: "코드 P0100 가 같은 조의 다른 항 · 호 · 목과 겹칩니다 (추천 P0300)", at: { nodePath: ["a", "p2"] } },
      { kind: "structure" as const, message: "다른 오류", at: { nodePath: ["a", "p3"] } },
    ];
    const html = renderToStaticMarkup(<DraftIssues go={() => undefined} issues={issues} fixCode={{ ids: new Set(["p2"]), open: () => undefined }} />);
    expect(html.match(/코드 수정/g)).toHaveLength(1);
    expect(html.match(/고칠 자리로/g)).toHaveLength(2);
  });

  it("읽기 모드(fixCode 없음)에는 없다", () => {
    const html = renderToStaticMarkup(<DraftIssues go={() => undefined} issues={[{ kind: "structure", message: "겹칩니다", at: { nodePath: ["p2"] } }]} />);
    expect(html).not.toContain("코드 수정");
  });
});

describe("편집 탭 (2026-10-21) — 편집 모드에만 탭 줄 맨 앞, 미적용이면 점", () => {
  const data = { issues: [], documentTitle: "t", generalProposed: false, preview: <p>미리</p>, go: () => undefined };
  it("읽기 모드엔 편집 탭이 없다", () => {
    const html = renderToStaticMarkup(<SidePanel docKind="general" editing={false} data={data} tab="preview" onTab={() => undefined} />);
    expect(html).not.toContain("ts-side-tab-edit");
  });
  it("편집 모드면 맨 앞에 편집 탭 · 그 안에 폼, 고친 것이 있으면 점", () => {
    const html = renderToStaticMarkup(<SidePanel docKind="general" editing data={data} tab="edit" onTab={() => undefined} edit={{ content: <p>폼</p>, dirty: true }} />);
    expect(html.indexOf("ts-side-tab-edit")).toBeLessThan(html.indexOf("ts-side-tab-preview"));
    expect(html).toContain("적용하지 않은 변경");
    expect(html).toContain("<p>폼</p>");
  });
});
