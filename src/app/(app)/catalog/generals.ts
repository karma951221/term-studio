import { getServices } from "@/lib/services";

import { candidateGroups, type CandidateGroup } from "./lib";

/** 준용예외 구분자의 후보 칸 재료 — 보통약관 템플릿 전부(여러 템플릿의 조를 고를 수 있다, ADR-0098 결정 1). */
export async function candidateGroupsOfGenerals(): Promise<CandidateGroup[]> {
  const services = getServices();
  const list = await services.document.list("general");
  const records = await Promise.all(list.map((d) => services.document.get(d.id)));
  return candidateGroups(records.flatMap((r) => (r ? [{ id: r.id, title: r.title, tree: r.tree }] : [])));
}
