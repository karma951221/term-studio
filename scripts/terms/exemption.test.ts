import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { DocumentNode } from "../../src/domain/document/nodes";

import { AGE15_EXEMPTION, AGE15_WAIVER_PARAM, applyExemption, EXEMPTION_PRESENT, splitAge15 } from "./exemption";

/**
 * 담보약관의 보장개시일 정의 항 (기능/상품 §3.9 · 기능/담보 §3.4) — 면책 특성이 있으면 정의 항(과 그 【예시】 박스)을 내고,
 * 그 안에서 「15세 이상만 적용」이면 15세 단서를 낸다. 변환기가 원문 트리에서 정의 항을 찾아 조건으로 감싸고 담보 시드의 면책 값을 읽어 낸다.
 */

type Json = Record<string, unknown> & { id?: string; kind?: string; children?: Json[]; branches?: Json[] };

/** 가지를 모두 켠(또는 15세 가지를 끈) 글 — 조건이 원문 글을 잃지 않는지 본다. */
function textOf(nodes: readonly Json[], age15: boolean): string {
  return nodes
    .map((n) => {
      if (n.kind === "text") return String(n.text);
      if (n.kind === "inlineCond") return age15 ? textOf(n.branches![0].children!, age15) : "";
      return `[${String(n.kind)}]`;
    })
    .join("");
}

const DEF_15 = "이 특별약관에서 암보장개시일이라 함은 계약일을 기준으로 피보험자의 보험나이가 15세 이상인 경우에는 계약일부터 그날을 포함하여 90일이 지난날의 다음날로 하며, 15세 미만인 경우에는 계약일로 합니다.";

function doc(defText: string, box = "BX000001"): DocumentNode {
  return {
    id: "d",
    kind: "document",
    title: "암진단비보장 특별약관",
    children: [
      {
        id: "a1",
        kind: "article",
        title: [{ id: "a1.t", kind: "text", text: "보험금의 지급사유" }],
        children: [
          { id: "a1-p1", kind: "paragraph", children: [{ id: "a1-p1-x1", kind: "text", text: "회사는 … 암보장개시일 이후에 … 지급합니다." }] },
          { id: "a1-p2", kind: "paragraph", children: [{ id: "a1-p2-x1", kind: "text", text: defText }] },
          { id: "a1-b1", kind: "boxRef", boxCode: box },
          { id: "a1-p3", kind: "paragraph", children: [{ id: "a1-p3-x1", kind: "text", text: "그 밖의 항" }] },
        ],
      },
    ],
  } as unknown as DocumentNode;
}

const titles: Record<string, string> = { BX000001: "암보장개시일[예시]", BX000002: "용어풀이" };
const boxTitle = (code: string) => titles[code];

describe("applyExemption — 보장개시일 정의 항을 면책 조건으로", () => {
  it("정의 항 + 【보장개시일 예시】 박스를 「면책 있음」 조건 블록 하나로 감싸고, 면책 값(90일 = 3개월 · 15세 단서 있음)을 돌려준다", () => {
    const tree = doc(DEF_15);
    expect(applyExemption(tree, boxTitle)).toEqual({ months: 3, age15: true });
    const article = tree.children[0] as unknown as Json;
    expect(article.children!.map((c) => c.kind)).toEqual(["paragraph", "condBlock", "paragraph"]);
    const cond = article.children![1];
    expect(cond.branches).toHaveLength(1);
    expect(cond.branches![0].when).toBe(`${EXEMPTION_PRESENT} = true`);
    expect(cond.branches![0].children!.map((c) => c.id)).toEqual(["a1-p2", "a1-b1"]);
  });

  it("15세 단서는 문장 안 조건(「15세 이상만 면책 있음」) — 켜면 원문 그대로, 끄면 「계약일부터 … 다음날로 합니다.」", () => {
    const tree = doc(DEF_15);
    applyExemption(tree, boxTitle);
    const paragraph = (tree.children[0] as unknown as Json).children![1].branches![0].children![0];
    const inline = paragraph.children!;
    expect(inline.filter((n) => n.kind === "inlineCond").every((n) => n.branches!.length === 1 && n.branches![0].when === `${AGE15_EXEMPTION} = true`)).toBe(true);
    expect(textOf(inline, true)).toBe(DEF_15);
    expect(textOf(inline, false)).toBe("이 특별약관에서 암보장개시일이라 함은 계약일부터 그날을 포함하여 90일이 지난날의 다음날로 합니다.");
  });

  it("갱신형 원문(최초계약일 · 자동갱신 단서)도 같은 모양 — 단서는 남는다", () => {
    const text = "이 특별약관에서 암보장개시일이라 함은 최초계약일을 기준으로 피보험자의 보험나이가 15세 이상인 경우에는 최초계약일부터 그날을 포함하여 90일이 지난날의 다음날로 하며, 15세 미만인 경우에는 최초계약일로 합니다. 다만,「자동갱신 특별약관」에 따라 보장이 자동갱신되는 경우에는 이 특별약관의 갱신일을 암보장개시일로 합니다.";
    const inline = splitAge15({ id: "x", kind: "text", text }, "x");
    expect(inline).toBeDefined();
    expect(textOf(inline as unknown as Json[], true)).toBe(text);
    expect(textOf(inline as unknown as Json[], false)).toBe(
      "이 특별약관에서 암보장개시일이라 함은 최초계약일부터 그날을 포함하여 90일이 지난날의 다음날로 합니다. 다만,「자동갱신 특별약관」에 따라 보장이 자동갱신되는 경우에는 이 특별약관의 갱신일을 암보장개시일로 합니다.",
    );
  });

  it("15세 단서가 없는 면책(1년 · 대상포진 같은 90일) — 조건 블록만, 문장 안 조건 없음, age15 아니오 · 1년 = 12개월", () => {
    const tree = doc("이 특별약관에서 당뇨병보장개시일이라 함은 계약일부터 그날을 포함하여 1년이 지난날의 다음날로 합니다.", "BX000002");
    expect(applyExemption(tree, boxTitle)).toEqual({ months: 12, age15: false });
    const article = tree.children[0] as unknown as Json;
    // 박스 제목이 보장개시일이 아니면 감싸지 않는다
    expect(article.children!.map((c) => c.kind)).toEqual(["paragraph", "condBlock", "boxRef", "paragraph"]);
    expect(JSON.stringify(article)).not.toContain("inlineCond");
  });

  it("정의 항이 없는 담보약관 — 그대로 두고 undefined (무면책)", () => {
    const tree = doc("그 밖의 정의");
    const before = JSON.stringify(tree);
    expect(applyExemption(tree, boxTitle)).toBeUndefined();
    expect(JSON.stringify(tree)).toBe(before);
  });

  it("기간을 읽을 수 없는 정의(「다음 각 호를 따릅니다」) — 감싸지 않는다", () => {
    const tree = doc("이 특별약관에서 재진단암보장개시일이라 함은 다음 각 호를 따릅니다.");
    expect(applyExemption(tree, boxTitle)).toBeUndefined();
  });

  it("재진단암의 첫번째암보장개시일(「보장개시일을 말합니다. 그럼에도 불구하고 … 15세 이상인 경우 …」) — 단서가 아니라 본문이라 감싸지 않는다", () => {
    const tree = doc("이 특별약관에서 첫번째암보장개시일이라 함은 보장개시일을 말합니다. 그럼에도 불구하고 보험계약일을 기준으로 피보험자의 보험나이가 15세 이상인 경우 계약일부터 그날을 포함하여 90일이 지난날의 다음날을 말합니다.");
    expect(applyExemption(tree, boxTitle)).toBeUndefined();
  });
});

// ───────────────────────────── 변환 결과(시드 JSON) ─────────────────────────────

const DATA = path.join(process.cwd(), "src/db/seed/data");
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(DATA, file), "utf8")) as T;
const all = (n: unknown, pred: (x: Json) => boolean, out: Json[] = []): Json[] => {
  if (Array.isArray(n)) n.forEach((x) => all(x, pred, out));
  else if (n && typeof n === "object") {
    if (pred(n as Json)) out.push(n as Json);
    Object.values(n).forEach((v) => all(v, pred, out));
  }
  return out;
};

describe("시드 — 담보 면책 특성은 원문 보장개시일 정의 항에서", () => {
  const documents = read<{ code: string; ownerCoverage: string; tree: Json }[]>("documents.json");
  const coverages = read<{ key: string; name: string; benefitValues: { path: string; value: unknown }[] }[]>("coverages.json");
  const exemptionOf = (key: string) => {
    const values = coverages.find((c) => c.key === key)!.benefitValues.filter((v) => v.path.startsWith("exemption."));
    return Object.fromEntries(values.map((v) => [v.path, v.value]));
  };
  const guarded = (d: { tree: Json }) => all(d.tree, (x) => x.kind === "condBlock" && (x.branches ?? []).some((b) => b.when === `${EXEMPTION_PRESENT} = true`)).length > 0;

  it("면책 조건 블록이 있는 담보약관의 담보만 면책 값(기간 · 15세 이상만 · 신규계약만)이 있고, 없는 담보는 면책 특성이 없다", () => {
    for (const d of documents) {
      const values = exemptionOf(d.ownerCoverage);
      if (guarded(d)) expect(Object.keys(values).sort(), d.code).toEqual(["exemption.age15_only", "exemption.months", "exemption.new_only"]);
      else expect(values, d.code).toEqual({});
    }
  });

  it.each([
    ["a7-d30", 3, true], // 16대특정암 — 90일 · 15세
    ["a7-cancer5", 3, true], // 5대고액치료비암(손으로 쓴 템플릿)
    ["a7-d17", 3, true], // 암수술비 — 갱신형 짝(최초계약일)
    ["a7-d53", 12, false], // 당뇨병 — 1년 · 15세 단서 없음
    ["a7-d58", 3, false], // 대상포진 — 90일 · 15세 단서 없음
  ])("%s — 기간 %i개월 · 15세 이상만 %s", (key, months, age15) => {
    expect(exemptionOf(key)).toEqual({ "exemption.months": months, "exemption.age15_only": age15, "exemption.new_only": true });
  });

  it("상해 담보(정의 항 없음)는 면책 특성이 없다", () => {
    expect(exemptionOf("death")).toEqual({});
  });
});

describe("시드 — 보통약관 납입면제 부가항(C0044)의 15세 단서", () => {
  const clauses = read<(Json & { code: string; params?: { name: string; default?: unknown }[] })[]>("clauses.json");
  const c0044 = clauses.find((c) => c.code === "C0044")!;

  it("인자 「보험나이_15세_이상」(참거짓 · 기본 연결 = 15세 이상 적용 납입면제 있음 D0009)이 15세 단서 둘을 감싼다 — 면책 사유 조건 안에", () => {
    expect(c0044.params).toContainEqual({ name: AGE15_WAIVER_PARAM, type: { kind: "boolean" }, default: { kind: "discriminator", code: "D0009" } });
    const inside = all(c0044.body, (x) => x.kind === "condBlock")[0];
    const conds = all(inside, (x) => x.kind === "inlineCond");
    expect(conds).toHaveLength(2);
    expect(conds.every((x) => x.branches![0].when === `arg.${AGE15_WAIVER_PARAM} = true`)).toBe(true);
  });

  it("통합간편(C0051)은 원문에 15세 단서가 없어 그대로다", () => {
    const c0051 = clauses.find((c) => c.code === "C0051")!;
    expect(all(c0051.body, (x) => x.kind === "inlineCond")).toEqual([]);
  });
});
