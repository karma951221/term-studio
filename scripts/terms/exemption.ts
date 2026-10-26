/**
 * 보장개시일 정의 항 · 15세 단서 — 데이터가 가른다 (개발 도구 — 제품 기능 아님). 근거: 기능/상품 §3.9 · 기능/담보 §3.4.
 *
 * 담보약관: 원문의 「이 특별약관에서 ○○보장개시일이라 함은 …」 항(과 바로 뒤 【○○보장개시일[예시]】 박스)은 급부의 면책 특성이 있을 때만 선다 —
 * 조 안 조건 블록 「면책 있음」(담보 레벨). 그 안의 「계약일을 기준으로 피보험자의 보험나이가 15세 이상인 경우에는 …, 15세 미만인 경우에는 계약일로」
 * 단서는 「15세 이상만 면책 있음」(급부 `exemption.age15_only` 를 담보 레벨로 모은 것)일 때만 — 문장 안 조건 둘로 감싼다.
 * 감쌌으면 원문의 기간(90일 = 3개월 · 1년 = 12개월) · 단서 유무를 그 담보의 면책 값으로 돌려준다 — 담보 시드(`coverages.json`)가 싣는다.
 *
 * 보통약관: 납입면제 부가항(알파Plus — 「제1항 제1호의 암보장개시일이라 함은 …」)의 같은 단서는 인자 「보험나이_15세_이상」(기본 연결 =
 * 「15세 이상 적용 납입면제 있음」 — 적용 종의 `waiver.age15`)이 감싼다(waiver.ts). 통합간편 원문에는 단서가 없다.
 */
import type { BlockNode, BoxRefNode, DocumentNode, InlineNode, ParagraphNode } from "../../src/domain/document/nodes";
import type { ParamDef } from "../../src/domain/clause/params";

/** 「15세 이상 적용 종」 — 세목 레벨 `waiver.applies and waiver.age15`. 「15세 이상 적용 납입면제 있음」이 모은다. */
export const AGE15_WAIVER_PLAN = "D0008";
/** 「15세 이상 적용 납입면제 있음」 — 상품 레벨 `any(D0008)`. 보통약관 납입면제 부가항의 인자 기본 연결 (바탕 시드 앞 코드). */
export const AGE15_WAIVER = "D0009";
/** 「면책 있음」 — 담보 레벨 `exist(exemption.months)`. 담보약관 보장개시일 정의 항의 조 안 조건. */
export const EXEMPTION_PRESENT = "D0010";
/** 「15세 이상만 면책」 — 급부 레벨 `exist(exemption.months) and exemption.age15_only` (면책 특성이 없는 급부는 거짓). */
export const AGE15_EXEMPTION_BENEFIT = "D0011";
/** 「15세 이상만 면책 있음」 — 담보 레벨 `any(D0011)`. 담보약관 15세 단서의 문장 안 조건. */
export const AGE15_EXEMPTION = "D0012";

/** 보통약관 납입면제 부가항(C0044)의 인자 — 참이면 15세 단서. */
export const AGE15_WAIVER_PARAM = "보험나이_15세_이상";
export const AGE15_PARAM: ParamDef = { name: AGE15_WAIVER_PARAM, type: { kind: "boolean" }, default: { kind: "discriminator", code: AGE15_WAIVER } };

export interface ExemptionTrait {
  /** 면책 기간(개월) — 원문 「그날을 포함하여 90일(1년)이 지난날의 다음날」. */
  months: number;
  /** 정의 항에 15세 단서가 있는가. */
  age15: boolean;
}

const DEFINITION = /보장개시일」?이라 함은/;
const PERIOD = /그날을 포함하여 (90일|1년)이 지난/;
/** 단서 앞 — 「계약일을 기준으로 피보험자의 보험나이가 15세 이상인 경우에는 」. */
const AGE15_HEAD = /(?:최초계약일|계약일)을 기준으로 피보험자의 보험나이가 15세 이상인 경우에는 /;
/** 단서 뒤 — 「하며, 15세 미만인 경우에는 계약일로 」(쉼표 뒤 띄어쓰기는 원문마다 다르다). */
const AGE15_TAIL = /하며, ?15세 미만인 경우에는 (?:최초계약일|계약일)로 /;

type TextLike = { id: string; kind: "text"; text: string };
type CondLike = { id: string; kind: "inlineCond"; branches: { id: string; when: string; children: TextLike[] }[] };

/**
 * 15세 단서를 문장 안 조건으로 — 글 하나를 [앞 · ⟨단서 앞⟩ · 가운데 · ⟨단서 뒤⟩ · 끝] 으로 가른다. 단서가 없으면 undefined.
 * `when` 기본은 담보약관의 「15세 이상만 면책 있음」. 보통약관 함수조항은 인자 조건을 넘긴다.
 */
export function splitAge15(node: TextLike, idBase: string, when = `${AGE15_EXEMPTION} = true`): (TextLike | CondLike)[] | undefined {
  const head = AGE15_HEAD.exec(node.text);
  if (!head) return undefined;
  const out: (TextLike | CondLike)[] = [];
  const text = (suffix: string, t: string) => {
    if (t) out.push({ id: `${idBase}-${suffix}`, kind: "text", text: t });
  };
  const cond = (suffix: string, t: string) => out.push({ id: `${idBase}-${suffix}`, kind: "inlineCond", branches: [{ id: `${idBase}-${suffix}-t`, when, children: [{ id: `${idBase}-${suffix}-t-x1`, kind: "text", text: t }] }] });
  text("a", node.text.slice(0, head.index));
  cond("c15a", head[0]);
  const rest = node.text.slice(head.index + head[0].length);
  const tail = AGE15_TAIL.exec(rest);
  if (tail) {
    text("b", rest.slice(0, tail.index));
    cond("c15b", tail[0]);
    text("c", rest.slice(tail.index + tail[0].length));
  } else text("b", rest);
  return out;
}

const plain = (p: ParagraphNode) => p.children.map((c) => (c.kind === "text" ? c.text : "")).join("");

/**
 * 담보약관 트리의 보장개시일 정의 항을 「면책 있음」 조건으로 감싸고(바로 뒤 보장개시일 【예시】 박스와 함께) 15세 단서를 문장 안 조건으로 가른다.
 * 기간을 읽을 수 없는 정의(재진단암 「다음 각 호를 따릅니다」)와 15세가 본문인 정의(재진단암 첫번째암보장개시일)는 두지 않는다. 정의 항이 여럿(갱신형 짝 가지)이면 기간 · 단서가 같아야 한다.
 * 감싼 것이 없으면 undefined(무면책 — 트리 그대로).
 */
export function applyExemption(tree: DocumentNode, boxTitle: (code: string) => string | undefined): ExemptionTrait | undefined {
  let trait: ExemptionTrait | undefined;
  const visit = (list: unknown[]): void => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i] as BlockNode;
      if (node.kind === "paragraph" && DEFINITION.test(plain(node))) {
        // 재진단암 「첫번째암보장개시일이라 함은 보장개시일을 말합니다. 그럼에도 불구하고 … 15세 이상인 경우 …」 — 15세가 단서가 아니라 본문이다(면책 모델 밖)
        const period = /보장개시일을 말합니다/.test(plain(node)) ? null : PERIOD.exec(plain(node));
        if (period) {
          const found: ExemptionTrait = { months: period[1] === "1년" ? 12 : 3, age15: false };
          node.children = node.children.flatMap((c) => {
            if (c.kind !== "text") return [c];
            const split = splitAge15(c as TextLike, c.id);
            if (!split) return [c];
            found.age15 = true;
            return split as InlineNode[];
          });
          if (trait && (trait.months !== found.months || trait.age15 !== found.age15)) throw new Error(`${tree.title}: 보장개시일 정의 항의 기간 · 15세 단서가 서로 다르다`);
          trait = found;
          const next = list[i + 1] as BlockNode | undefined;
          const box = next?.kind === "boxRef" && (boxTitle((next as BoxRefNode).boxCode) ?? "").includes("보장개시일") ? [next] : [];
          const wrapped = { id: `${node.id}-ex`, kind: "condBlock", branches: [{ id: `${node.id}-ex-t`, when: `${EXEMPTION_PRESENT} = true`, children: [node, ...box] }] };
          list.splice(i, 1 + box.length, wrapped);
          continue;
        }
      }
      descend(node);
    }
  };
  const descend = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { kind?: string; children?: unknown; branches?: { children?: unknown[] }[] };
    if (n.kind === "paragraph" || n.kind === "item" || n.kind === "text") return;
    if (Array.isArray(n.children)) visit(n.children);
    for (const b of n.branches ?? []) if (Array.isArray(b.children)) visit(b.children);
  };
  visit(tree.children as unknown[]);
  return trait;
}
