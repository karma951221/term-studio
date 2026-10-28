import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RENEWABLE_PRODUCT } from "./renewal";
import type { ArticleNode, DocumentNode } from "../../src/domain/document/nodes";

import { guardExcludeSentence, guardOwnWaiver, SURRENDER_PAYING, WAIVER_PRESENT } from "./waiver";
import { foldTitle, titleNodes } from "../../src/domain/document/title";
import { productGeneral, type ProductGeneralSetting } from "./merge";

/**
 * 납입면제 재모델링의 변환 결과(시드 JSON) — 템플릿 모양 · 사유별 호 · 정의 함수조항(ADR-0086) · 역할 함수조항 본문 · 호를 가리키는 참조.
 * 원문과의 글자 대조는 `src/db/seed/real.test.ts`, 세목 변형은 같은 파일의 변형 describe.
 */

const DATA = path.join(process.cwd(), "src/db/seed/data");
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(DATA, file), "utf8")) as T;
type Json = Record<string, unknown> & { id?: string; kind?: string; children?: Json[] };

const [template] = read<{ code: string; tree: DocumentNode }[]>("generals.json");
const products = read<({ code: string } & ProductGeneralSetting)[]>("products.json");
const clauses = read<(Json & { code: string; label: string; params?: { name: string }[] })[]>("clauses.json");
/** 상품이 보는 보통약관 — 템플릿 「보통약관(일반)」 + 조 사본 − 노출 끈 조 (납입면제 세 조는 상품군 변형이다). */
const seen = (code: string) => productGeneral(template.tree, products.find((p) => p.code === code)!) as unknown as Json;
const alpha = seen("alpha-plus");
const meritz = seen("meritz");

function find(n: unknown, pred: (x: Json) => boolean): Json | undefined {
  if (Array.isArray(n)) {
    for (const x of n) {
      const hit = find(x, pred);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!n || typeof n !== "object") return undefined;
  const o = n as Json;
  if (pred(o)) return o;
  for (const v of Object.values(o)) {
    const hit = find(v, pred);
    if (hit) return hit;
  }
  return undefined;
}
const all = (n: unknown, pred: (x: Json) => boolean, out: Json[] = []): Json[] => {
  if (Array.isArray(n)) n.forEach((x) => all(x, pred, out));
  else if (n && typeof n === "object") {
    if (pred(n as Json)) out.push(n as Json);
    Object.values(n).forEach((v) => all(v, pred, out));
  }
  return out;
};
const clauseByLabel = (label: string) => clauses.find((c) => c.label === label)!;

/** 납입면제사유(E0001) 값 이름 — 정의 함수조항 이름에 쓴다. V12 · V13 은 열거형에서 지웠다 (ADR-0086 결정 5). */
const REASON_LABEL: Record<string, string> = {
  V01: "암(유사암제외)·면책",
  V02: "암(유사암제외)·무면책",
  V03: "뇌졸중",
  V04: "급성심근경색증",
  V05: "말기폐질환",
  V06: "말기간경화",
  V07: "말기신부전증",
  V08: "양성뇌종양",
  V09: "중대한재생불량성빈혈",
  V10: "만성당뇨합병증",
  V11: "상해및질병80%이상후유장해",
  V14: "중증화상및부식",
};
/** 호 함수조항 하나 — 사유 필드로 문구를 짓는다 (ADR-0095). */
const ITEM_LABEL = "납입면제 호";
/** 정의 — 글이 상품군마다 다른 사유(암 · 뇌졸중 · 급성심근경색증)는 꼬리표, 같은 사유(말기폐질환 ~ 만성당뇨합병증 · 중증화상및부식)는 함께 (결정 3). */
const definitionLabels = (line: string) => [
  `암(유사암제외) 정의 및 진단확정(${line})`,
  `뇌졸중 정의 및 진단확정(${line})`,
  `급성심근경색증 정의 및 진단확정(${line})`,
  ...["V05", "V06", "V07", "V08", "V09", "V10", "V14"].map((v) => `${REASON_LABEL[v]} 정의 및 진단확정`),
];
const labelOf = (code: unknown) => clauses.find((c) => c.code === code)?.label;
/** 조 제목 글 — 시드는 인라인 노드 목록이다 (ADR-0088). */
const titleOf = (x: object): string => {
  const t = (x as { title?: unknown }).title;
  return Array.isArray(t) ? foldTitle(t as ArticleNode["title"]) : String(t ?? "");
};
const articleOf = (tree: Json, title: string) => find(tree, (x) => x.kind === "article" && titleOf(x) === title)!;
const APPLIED_SOURCE = { kind: "source", source: { form: "waiver", filter: "waiver.applies = true" } };
/** 정의 조 제목 — 사유를 나열하지 않는 일반 고정 제목 (ADR-0088 결정 7, 2026-10-17). 원문(사유 나열)과의 차이는 허용 차이(knownDifferences.ts). */
const DEFINITION_FOLDED = "보험료 납입면제 사유의 정의 및 진단확정";

/** 템플릿 [납입면제종마다] 항 › [현재 종의 사유마다] › 호 함수조항 참조 하나 (ADR-0095). `itemKey` = 그 참조의 (조, P코드) — 조 참조 대상 대조용. */
function itemRefsOf(tree: Json): { outer: Json; inner: Json; ref: Json; itemKey: string } {
  const outer = find(tree, (x) => x.kind === "forBlock" && (x.source as Json).kind === "planOptions")!;
  const [inner] = (outer.children![0].items as Json[]) ?? [];
  const ref = inner.children![0];
  const article = find(tree, (x) => x.kind === "article" && find(x, (y) => y === ref) !== undefined)!;
  return { outer, inner, ref, itemKey: `${article.id}#${ref.code as string}` };
}

/** 함수조항 본문의 조 참조 중 호 함수조항 참조를 가리키는 것 — 대상마다 「안쪽 코드:값 한정(+)」, 대상끼리 「,」, 연결어. */
function itemRefShapes(label: string, itemKey: string): string[] {
  const key = (t: { articleId?: string; code?: string }) => `${t.articleId}#${t.code}`;
  type T = { articleId: string; code: string; innerCode?: string; restrict?: { values?: string[] } };
  const refs = all(clauseByLabel(label).body, (x) => x.kind === "articleRef" && (x.targets as T[]).some((t) => key(t) === itemKey));
  return refs.map((r) => `${(r.targets as T[]).map((t) => (key(t) === itemKey ? `${t.innerCode ? `${t.innerCode}:` : ""}${t.restrict?.values?.join("+") ?? "전부"}` : key(t))).join(",")} ${r.connector}`);
}

describe("알파Plus 납입면제 템플릿 — 사유 값으로 분기하지 않고 [종마다 › 그 종의 사유마다] 호 함수조항 하나 (결정 10 · 11 · 16 · ADR-0095)", () => {
  it("납입면제 세 조는 「납입면제 있음」 조 자리 IF 하나로 감싼다", () => {
    const wrap = find(alpha, (x) => x.kind === "condBlock" && /"(?:title|text)":"보험료의 납입면제"/.test(JSON.stringify(x)))!;
    const branches = wrap.branches as { when: string; children: Json[] }[];
    expect(branches).toHaveLength(1);
    expect(branches[0].when).toBe(WAIVER_PRESENT);
    expect(branches[0].children.map((a) => titleOf(a))).toEqual([
      "보험료의 납입면제",
      "납입면제에 관한 세부규정",
      DEFINITION_FOLDED,
    ]);
  });

  it("제27조의1 ① = [납입면제종마다] 항(번호 · 이름 슬롯) › 호 목록 = [현재 종의 사유마다] › 호 함수조항 하나(사유 ← 현재 사유)", () => {
    const { outer, inner, ref } = itemRefsOf(alpha);
    expect(outer.source).toEqual({ kind: "planOptions", form: "waiver", filter: "waiver.applies = true" });
    const p = outer.children![0];
    expect((p.children as Json[]).filter((c) => c.kind === "slot").map((c) => c.ref)).toEqual(["builtin.plan.number", "builtin.plan.name"]);
    expect(p.items as Json[]).toHaveLength(1);
    expect(inner.source).toEqual({ kind: "listOfCurrent", loop: outer.id, field: "reasons" });
    expect(inner.children).toHaveLength(1);
    expect([ref.kind, labelOf(ref.clauseCode), ref.bindings]).toEqual(["clauseBlockRef", ITEM_LABEL, { 사유: { kind: "current", loop: inner.id } }]);
    // 사유 반복은 호 자리 하나뿐(정의 조는 사유별 함수조항), 템플릿 어디에도 사유 값 코드 비교가 없다
    expect(all(alpha, (x) => x.kind === "forBlock" && (x.source as Json).kind !== "planOptions")).toEqual([inner]);
    expect(all(alpha, (x) => typeof x.when === "string" && /V\d\d/.test(x.when as string))).toEqual([]);
  });

  it("④ 1형 적립 중지는 「해약환급금 지급형 있음」 항 자리 IF, ⑤ 「제1항부터 제4항까지」는 대상 넷(반복 항 · 부가항 · ③ · ④)인 참조 하나 (결정 24)", () => {
    const wrap = find(alpha, (x) => x.kind === "condBlock" && (x.branches as { when: string }[])[0].when === SURRENDER_PAYING)!;
    expect(JSON.stringify(wrap)).toContain("1형(해약환급금 지급형)의 경우");
    const range = find(alpha, (x) => x.kind === "paragraph" && JSON.stringify(x.children).includes("의 규정에도 불구하고 보장보험료의 납입이 면제되기"))!;
    const refs = (range.children as Json[]).filter((c) => c.kind === "articleRef");
    expect((refs[0].targets as unknown[]).length).toBe(4);
    expect((range.children as Json[]).find((c) => c.kind === "text" && (c.text as string).startsWith("의 규정에도"))).toBeDefined();
  });

  it("정의 조 = 사유별 정의 함수조항을 열거형 순서로 늘어놓는다 — 프리셋 ‘적용 종’", () => {
    const article = articleOf(alpha, DEFINITION_FOLDED);
    expect(article.children!.map((r) => [r.kind, labelOf(r.clauseCode), r.preset, r.bindings])).toEqual(definitionLabels("알파Plus").map((label) => ["clauseBlockRef", label, "S01", undefined]));
  });

  it("종들을 받는 역할 함수조항(부활 문구 포함) · 사유별 정의는 프리셋 ‘적용 종’으로 넣는다 (ADR-0084)", () => {
    const applied = { 종들: APPLIED_SOURCE };
    for (const label of ["면제 부가항(알파Plus)", "납입면제 세부규정(알파Plus)", "무효 문구(알파Plus)", "부활 문구", ...definitionLabels("알파Plus")]) {
      expect(clauseByLabel(label).presets, label).toEqual([{ code: "S01", name: "적용 종", bindings: applied }]);
      const ref = find(alpha, (x) => x.kind === "clauseBlockRef" && x.clauseCode === clauseByLabel(label).code)!;
      expect([ref.preset, ref.options, ref.bindings], label).toEqual(["S01", {}, undefined]);
    }
    // 호는 반복의 현재 사유를 받아 프리셋이 없다 (프리셋은 반복의 현재 원소를 담지 않는다)
    expect(clauseByLabel(ITEM_LABEL).presets).toBeUndefined();
  });
});

describe("납입면제 호 함수조항 하나 — 인자 사유(E0001), 문구는 사유 필드(약관표시명 · 면책여부 · 장해호)가 짓는다 (ADR-0095)", () => {
  const item = () => clauseByLabel(ITEM_LABEL);
  /** 인라인 → 모양 글 — 글은 그대로, 슬롯은 〔식〕, 조사는 {프리셋}, 문장 안 조건은 [식 → 글]. */
  const shape = (list: Json[]): string =>
    list
      .map((n) => {
        if (n.kind === "text") return n.text as string;
        if (n.kind === "slot") return `〔${n.ref as string}〕`;
        if (n.kind === "particle") return `{${n.preset as string}}`;
        if (n.kind === "inlineCond") return (n.branches as { when?: string; children: Json[] }[]).map((b) => `[${b.when ?? "그 밖"} → ${shape(b.children)}]`).join("");
        return `<${n.kind as string}>`;
      })
      .join("");

  it("사유별 호 함수조항(납입면제 호 — …)은 없다 — 호 함수조항은 하나, 유형 「호」, 인자 사유 하나 · 내부 변수 · 프리셋 없음", () => {
    expect(clauses.filter((c) => c.label.startsWith("납입면제 호 — "))).toEqual([]);
    expect(clauses.filter((c) => c.label === ITEM_LABEL)).toHaveLength(1);
    expect(item().mode).toBe("item");
    expect(item().params).toEqual([{ name: "사유", type: { kind: "enum", enumCode: "E0001" } }]);
    expect(item().locals ?? []).toEqual([]);
  });

  it("본문 = IF 장해호 → 상해 호 · 질병 호(별표 참조) / 그 밖 → 진단 호 하나(면책이면 「암보장개시일 이후」 · 약관표시명 · 으로/로) — 값 코드 비교 없음", () => {
    const body = item().body as unknown as Json[];
    expect(body.map((b) => b.kind)).toEqual(["condBlock"]);
    const [disability, diagnosis] = body[0].branches as { when?: string; children: Json[] }[];
    expect(disability.when).toBe("arg.사유.F04 = true");
    expect(disability.children.map((i) => shape(i.children!))).toEqual([
      "피보험자가 상해로<appendixRef>에서 정한 장해지급률이 80% 이상에 해당하는 장해상태가 되었을 경우",
      "피보험자가 진단 확정된 질병으로<appendixRef>에서 정한 장해지급률이 80% 이상에 해당하는 장해상태가 되었을 경우",
    ]);
    expect(diagnosis.when).toBeUndefined();
    expect(diagnosis.children.map((i) => shape(i.children!))).toEqual(["피보험자가[arg.사유.F02 = true →  암보장개시일 이후]「〔arg.사유.F01〕」{euro-ro} 진단확정되었을 경우"]);
    expect(JSON.stringify(item().body)).not.toMatch(/V\d\d/);
  });

  it("열거형 E0001 의 F04 「장해호」 — 상해및질병80%이상후유장해(V11)만 예", () => {
    const e = read<{ code: string; fields: { key: string; label: string; type: string }[]; values: { code: string; fields: Record<string, unknown> }[] }[]>("enums.json").find((x) => x.code === "E0001")!;
    expect(e.fields.find((f) => f.key === "F04")).toMatchObject({ label: "장해호", type: "boolean" });
    expect(e.values.filter((v) => v.fields.F04 === true).map((v) => v.code)).toEqual(["V11"]);
    expect(e.values.every((v) => typeof v.fields.F04 === "boolean")).toBe(true);
  });
});

describe("사유별 정의 함수조항 — 인자 종들 + 내부 변수 「해당」으로 스스로 켜진다 (ADR-0086 결정 1 · 2 · 3)", () => {
  const perReason: [string, string[]][] = [
    ...[...definitionLabels("알파Plus"), ...definitionLabels("통합간편").slice(0, 3)].map((label): [string, string[]] => {
      const v = Object.keys(REASON_LABEL).find((k) => label.startsWith(`${REASON_LABEL[k]} `));
      return [label, v ? [v] : ["V01", "V02"]];
    }),
  ];

  it.each(perReason)("%s — 인자 종들 하나 · 사유들 = 종들의 사유 합치기 · 해당 = 그 값 · 본문 전체가 IF 해당", (label, values) => {
    const c = clauseByLabel(label);
    expect(c, label).toBeDefined();
    expect(c.params).toEqual([{ name: "종들", type: { kind: "planOptions", form: "waiver" } }]);
    expect(c.locals).toEqual([
      { name: "사유들", expr: "arg.종들.합치기(waiver.reasons)" },
      { name: "해당", expr: `var.사유들.있음(${values.map((v) => `'${v}'`).join(", ")})` },
    ]);
    const body = c.body as unknown as Json[];
    expect(body.map((b) => b.kind)).toEqual(["condBlock"]);
    expect((body[0].branches as { when: string }[]).map((b) => b.when)).toEqual(["var.해당"]);
  });

  it("정의는 유형 「항」, 정의가 없는 장해(V11) 정의 함수조항은 없다", () => {
    for (const label of definitionLabels("알파Plus")) expect(clauseByLabel(label).mode).toBe("block");
    expect(clauses.filter((c) => c.label.includes("후유장해 정의"))).toEqual([]);
  });

  it("V12 · V13(열거형에서 지웠다)과 값별 분기는 어느 함수조항에도 없다", () => {
    // 옵션 선택지 코드(V01 …)는 열거값이 아니다 — 낱말 옵션 함수조항(알파Plus2607 자동 탑재)은 선택지가 열둘을 넘기도 한다
    expect(JSON.stringify(clauses).replace(/"code":"V\d+"/g, "")).not.toMatch(/'V1[23]'|"V1[23]"/);
    expect(all(clauses, (x) => x.kind === "switchBlock" || x.kind === "inlineSwitch")).toEqual([]);
  });

  it("세부규정(알파Plus)의 「제27조의1 제1항 제1호」 = 호 참조 + 값 한정 암·면책, 「제10호, 제11호」 = 값 한정 장해(연결어는 원문대로) (ADR-0095)", () => {
    const { itemKey } = itemRefsOf(alpha);
    expect(itemRefShapes("납입면제 세부규정(알파Plus)", itemKey)).toEqual(["V01 및", "V01 및", "V01 및", "V11 및", "V11 또는"]);
    expect(itemRefShapes("면제 부가항(알파Plus)", itemKey)).toEqual(["V01 및"]);
  });
});

describe("통합간편 납입면제 템플릿 — 알파Plus 와 같은 모양, 호 · 상품군 사이에 같은 정의 · 부활 문구는 함께 쓴다", () => {
  it("세 조(납입면제 · 정의 · 세부규정)를 「납입면제 있음」 IF 로, 제29조 ① ② = [납입면제종마다] 항 하나(번호 · 이름 슬롯) › [현재 종의 사유마다] › 호 함수조항 하나", () => {
    const wrap = find(meritz, (x) => x.kind === "condBlock" && /"(?:title|text)":"보험료의 납입면제"/.test(JSON.stringify(x)))!;
    const [branch] = wrap.branches as { when: string; children: Json[] }[];
    expect(branch.when).toBe(WAIVER_PRESENT);
    expect(branch.children.map((a) => titleOf(a))).toEqual(["보험료의 납입면제", DEFINITION_FOLDED, "납입면제에 관한 세부규정"]);
    const { outer, inner, ref } = itemRefsOf(branch.children[0]);
    const p = outer.children![0];
    expect((p.children as Json[]).map((c) => (c.kind === "text" ? c.text : c.ref))[4]).toMatch(/^\)을 가입한 피보험자가 보험료 납입기간 중에/);
    expect(inner.source).toEqual({ kind: "listOfCurrent", loop: outer.id, field: "reasons" });
    expect([labelOf(ref.clauseCode), ref.bindings]).toEqual([ITEM_LABEL, { 사유: { kind: "current", loop: inner.id } }]);
    expect(all(meritz, (x) => x.kind === "forBlock" && (x.source as Json).kind !== "planOptions")).toEqual([inner]);
    expect(all(meritz, (x) => typeof x.when === "string" && /V\d\d/.test(x.when as string))).toEqual([]);
  });

  it("「제1항 또는 제2항」 = 반복 항 하나(연결어 또는) · 「제1항부터 제4항까지」 = 대상 셋(반복 항 · 부가항 · ④)인 참조 하나", () => {
    const article = articleOf(meritz, "보험료의 납입면제");
    const refs = all(article.children!.slice(2), (x) => x.kind === "articleRef");
    expect(refs.map((r) => [(r.targets as unknown[]).length, r.connector])).toEqual([
      [1, "또는"],
      [1, "또는"],
      [3, "및"],
      [1, "및"],
      [3, "및"],
      [1, "및"],
    ]);
  });

  it("부활 문구 — 기준일은 인자 「갱신」(기본 연결 갱신형 상품) + 문장 안 조건, 옵션 · 기준일 프리셋은 없고 두 보통약관 모두 프리셋 ‘적용 종’ (ADR-0086 결정 6)", () => {
    const revive = clauseByLabel("부활 문구");
    expect(revive.params).toEqual([
      { name: "종들", type: { kind: "planOptions", form: "waiver" } },
      { name: "갱신", type: { kind: "boolean" }, default: { kind: "discriminator", code: RENEWABLE_PRODUCT } },
    ]);
    expect(revive.options).toEqual([]);
    expect(revive.presets).toEqual([{ code: "S01", name: "적용 종", bindings: { 종들: APPLIED_SOURCE } }]);
    const cond = find(revive.body, (x) => x.kind === "inlineCond")!;
    expect((cond.branches as { when?: string; children: Json[] }[]).map((b) => [b.when, b.children.map((c) => c.text).join("")])).toEqual([
      ["arg.갱신 = true", "최초계약일"],
      [undefined, "계약일"],
    ]);
    for (const tree of [alpha, meritz]) {
      const ref = find(tree, (x) => x.kind === "clauseBlockRef" && x.clauseCode === revive.code)!;
      expect([ref.preset, ref.options, ref.bindings]).toEqual(["S01", {}, undefined]);
    }
  });

  it("세부규정(통합간편) — 호 참조 + 값 한정: 암·면책 · 장해 · 장해 + 화상 · 상해 호(장해 가지의 첫 호 — 안쪽 코드) + 화상 (ADR-0095)", () => {
    const { itemKey } = itemRefsOf(meritz);
    const body = (clauseByLabel(ITEM_LABEL).body as unknown as Json[])[0];
    const injury = (body.branches as { children: Json[] }[])[0].children[0].code as string;
    expect(injury).toMatch(/^P\d{4}$/);
    expect(itemRefShapes("납입면제 세부규정(통합간편)", itemKey)).toEqual(["V01 또는", "V01 또는", "V01 또는", "V11 또는", "V11+V14 또는", `${injury}:V11,V14 또는`]);
    expect(itemRefShapes("면제 부가항(통합간편)", itemKey)).toEqual(["V01 및"]);
  });

  it("정의 조 = 사유별 정의 함수조항(통합간편 셋 + 함께 쓰는 일곱), 제2조 표의 종 한 항 참조는 글로 굳힌다(종 한정 참조는 다음 기획)", () => {
    const article = articleOf(meritz, DEFINITION_FOLDED);
    expect(article.children!.map((r) => [labelOf(r.clauseCode), r.preset])).toEqual(definitionLabels("통합간편").map((label) => [label, "S01"]));
    const definitions = articleOf(meritz, "용어의 정의");
    expect(JSON.stringify(definitions)).toContain('"text":"제29조(보험료의 납입면제) 제2항"');
  });
});

describe("정의 조 제목 — 일반 고정 제목 (ADR-0088 결정 7, 2026-10-17)", () => {
  it.each(["alpha-plus", "alpha2607", "meritz"])("%s: 제목 = 글 하나 「보험료 납입면제 사유의 정의 및 진단확정」 — 사유를 나열하지 않는다(문장 안 반복 없음)", (code) => {
    const tree = seen(code);
    expect(all(tree, (x) => x.kind === "article" && Array.isArray(x.title) && (x.title as Json[]).some((n) => n.kind === "inlineFor"))).toEqual([]);
    const titled = all(tree, (x) => x.kind === "article" && titleOf(x) === DEFINITION_FOLDED);
    expect(titled).toHaveLength(1);
    expect(titled[0].title).toEqual([{ id: `${titled[0].id}.title`, kind: "text", text: DEFINITION_FOLDED }]);
  });
});

describe("납입면제 조를 가리키는 문장 — 「납입면제 있음」 조건 (납입면제 없는 상품이면 함께 빠진다)", () => {
  it.each([
    ["알파Plus", alpha, 2],
    ["메리츠", meritz, 3],
  ] as const)("%s — 제6조 「또는 … 납입면제 사유의 발생을 알게된 경우」는 문장 안 조건, 제2조 표 종 행의 정의 칸은 칸째 조건", (_, tree, rows) => {
    const notice = find(tree, (x) => x.kind === "article" && titleOf(x) === "보험금 지급사유 등의 통지")!;
    const cond = find(notice, (x) => x.kind === "inlineCond")!;
    const [branch] = cond.branches as { when: string; children: Json[] }[];
    expect(branch.when).toBe(`${WAIVER_PRESENT} = true`);
    expect(branch.children.map((c) => (c.kind === "text" ? c.text : c.kind))).toEqual([" 또는 ", "articleRef", "에서 정한 보험료 납입면제 사유의 발생을 알게된 경우"]);
    const definitions = find(tree, (x) => x.kind === "article" && titleOf(x) === "용어의 정의")!;
    expect(all(definitions, (x) => x.kind === "inlineCond" && (x.branches as { when: string }[])[0].when === `${WAIVER_PRESENT} = true`)).toHaveLength(rows);
  });
});

describe("guardExcludeSentence — 준용규정 「…은 제외하며, 1종 … [납입면제 두 조]도 제외합니다.」를 「납입면제 있음」으로 가른다", () => {
  const sentence = () =>
    ({
      children: [
        { id: "p-x1", kind: "text", text: "다만, 보통약관 " },
        { id: "p-x2", kind: "articleRef", scope: "general", targets: [{ articleId: "g-a9" }, { articleId: "g-a38" }], connector: "및" },
        { id: "p-x3", kind: "text", text: "은 제외하며, 보통약관 1종(보험료 납입면제 미적용형)으로 가입한 경우 보통약관 " },
        { id: "p-x4", kind: "articleRef", scope: "general", targets: [{ articleId: "g-a27_1" }, { articleId: "g-a27_2" }], connector: "및" },
        { id: "p-x5", kind: "text", text: "도 제외합니다." },
      ],
    }) as unknown as Parameters<typeof guardExcludeSentence>[0];

  it("앞 조 참조 뒤 「은 제외하며, …도 제외합니다.」가 IF 가지, ELSE 는 「은 제외합니다.」", () => {
    const p = sentence();
    expect(guardExcludeSentence(p, 3)).toBe(true);
    expect(p.children.map((c) => c.kind)).toEqual(["text", "articleRef", "inlineCond"]);
    const cond = p.children[2] as unknown as { branches: { when?: string; children: { kind: string; text?: string }[] }[] };
    expect(cond.branches[0].when).toBe(`${WAIVER_PRESENT} = true`);
    expect(cond.branches[0].children.map((c) => c.text ?? c.kind)).toEqual(["은 제외하며, 보통약관 1종(보험료 납입면제 미적용형)으로 가입한 경우 보통약관 ", "articleRef", "도 제외합니다."]);
    expect(cond.branches[1]).toMatchObject({ children: [{ text: "은 제외합니다." }] });
  });

  it("「…은 제외합니다. 또한, 1종 … [두 조]도 제외합니다.」 — 뒤 문장만 IF(ELSE 없음)", () => {
    const p = sentence();
    (p.children[2] as { text: string }).text = "은 제외합니다. 또한, 1종(보험료 납입면제 미적용형)으로 가입한 경우 보통약관 ";
    expect(guardExcludeSentence(p, 3)).toBe(true);
    const cond = p.children.at(-1) as unknown as { branches: { children: { kind: string; text?: string }[] }[] };
    expect(p.children.map((c) => (c.kind === "text" ? c.text : c.kind))).toEqual(["다만, 보통약관 ", "articleRef", "은 제외합니다.", "inlineCond"]);
    expect(cond.branches).toHaveLength(1);
    expect(cond.branches[0].children[0].text).toBe(" 또한, 1종(보험료 납입면제 미적용형)으로 가입한 경우 보통약관 ");
  });

  it("「은」이 빠진 원문(「…[조 참조] 제외하며, …」) — ELSE 도 원문 조사대로 「 제외합니다.」", () => {
    const p = sentence();
    (p.children[2] as { text: string }).text = " 제외하며, 보통약관 1종(보험료 납입면제 미적용형)으로 가입한 경우 보통약관 ";
    expect(guardExcludeSentence(p, 3)).toBe(true);
    const cond = p.children.at(-1) as unknown as { branches: { children: { text?: string }[] }[] };
    expect(cond.branches[1].children[0].text).toBe(" 제외합니다.");
  });

  it("모양이 아니면 건드리지 않는다", () => {
    const p = sentence();
    (p.children[4] as { text: string }).text = "은 제외합니다.";
    expect(guardExcludeSentence(p, 3)).toBe(false);
    expect(p.children).toHaveLength(5);
  });
});

describe("guardOwnWaiver — 특약 자체의 납입면제(조째 · 통합형 특약의 소제목 자리)를 「납입면제 있음」으로 감싼다", () => {
  const p = (id: string) => ({ id, kind: "paragraph", children: [{ id: `${id}-x1`, kind: "text", text: id }] });
  const doc = (): DocumentNode =>
    ({
      id: "s-doc",
      kind: "document",
      title: "시험 특별약관",
      children: [
        { id: "s-a1", kind: "article", title: titleNodes("보험금의 지급사유", "s-a1"), children: [p("s-a1-p1")] },
        { id: "s-a9", kind: "article", title: titleNodes("보험료의 납입면제", "s-a9"), children: [p("s-a9-p1")] },
        { id: "s-a10", kind: "article", title: titleNodes("납입면제에 관한 세부규정", "s-a10"), children: [p("s-a10-p1")] },
        {
          id: "s-a3",
          kind: "article",
          title: titleNodes("세부보장에 관한 사항", "s-a3"),
          children: [p("s-a3-p1"), { id: "s-a3-b2-k", kind: "boxRef", boxCode: "BX000001" }, p("s-a3-p2"), { id: "s-a3-p3-k", kind: "clauseBlockRef", clauseCode: "C0001", options: {} }, { id: "s-a3-b4-k", kind: "boxRef", boxCode: "BX000002" }, p("s-a3-p4")],
        },
      ],
    }) as unknown as DocumentNode;
  /** 변환기가 표시한 통합형 특약 납입면제 소제목 자리 — 머리 박스 · 항(함수조항이 된 항은 원래 항 id). */
  const marked = new Set(["s-a3-b2", "s-a3-p2", "s-a3-p3"]);

  it("조째(제목 「보험료의 납입면제」 · 「납입면제에 관한 세부규정」)는 조 자리 IF, 표시한 소제목 자리는 잇닿은 블록째 IF", () => {
    const tree = doc();
    guardOwnWaiver(tree, marked);
    const kids = tree.children as unknown as { id: string; kind: string; branches?: { when: string; children: { id: string }[] }[] }[];
    expect(kids.map((c) => c.kind)).toEqual(["article", "condBlock", "condBlock", "article"]);
    expect(kids[1].branches).toEqual([{ id: "s-a9-if-own-waiver-b", when: `${WAIVER_PRESENT} = true`, children: [expect.objectContaining({ id: "s-a9" })] }]);
    const integrated = (tree.children[3] as ArticleNode).children as unknown as { id: string; kind: string; branches?: { when: string; children: { id: string }[] }[] }[];
    expect(integrated.map((c) => c.id)).toEqual(["s-a3-p1", "s-a3-b2-k-if-own-waiver", "s-a3-b4-k", "s-a3-p4"]);
    expect(integrated[1].branches![0].when).toBe(`${WAIVER_PRESENT} = true`);
    expect(integrated[1].branches![0].children.map((c) => c.id)).toEqual(["s-a3-b2-k", "s-a3-p2", "s-a3-p3-k"]);
  });

  it("감싼 자리 안 노드인지 가리는 술어를 돌려준다 — 그 자리를 가리키는 문장을 고칠 때", () => {
    const inside = guardOwnWaiver(doc(), marked);
    expect(["s-a9", "s-a9-p1", "s-a10-p1-i2", "s-a3-p2", "s-a3-p3", "s-a3-p3-i1"].every(inside)).toBe(true);
    expect(["s-a1", "s-a3", "s-a3-p1", "s-a3-p4", "s-a9x", "s-a3-p20"].some(inside)).toBe(false);
  });
});
