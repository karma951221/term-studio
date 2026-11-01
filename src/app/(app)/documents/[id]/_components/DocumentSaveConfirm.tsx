"use client";

/**
 * 문서 저장 확인 모달 — 저장이 다른 곳을 함께 바꿀 때 한 창에 모은다. 막지 않는다(확인하면 저장).
 *
 * - 깨질 참조 (ADR-0072 결정 6 · ADR-0081 결정 3) — 지운 조를 가리키던 다른 문서의 조연결 · 보통약관 조 참조, 템플릿을 쓰는 상품의 참조 깨짐(상품별로 앞에).
 * - 판정 변화 (ADR-0082 결정 11 · ADR-0098 결정 7) — 담보약관 · 보통약관 템플릿 저장이 그 문서를 쓰는 상품의 판정을 바꾸면 상품마다 한 묶음.
 *   줄은 상품담보 탭 확인 모달과 같다(`JudgmentLines` — 판정이 바뀌는 조 · 사본 · 깨지는 블록 지정 참조 · 특약 조 판정 · 「상품 · 특약 — 준용예외에 제N조 추가 / 빠짐」).
 * 제목 · 주 버튼은 깨질 참조가 있으면 「참조 N건」, 판정 변화만이면 상품담보 탭 모달과 같은 「저장하면 아래 내용이 함께 바뀝니다」 · 〔바꾸고 저장〕.
 */
import { coordinateHref } from "@/app/_components/coordinateHref";
import { JudgmentLines } from "@/app/_components/JudgmentLines";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { formatCoordinate } from "@/domain/coordinate";
import type { Coordinate, Impact } from "@/domain/types";

export function DocumentSaveConfirm({ impact, pending, onCancel, onConfirm }: { impact: Impact; pending?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const broken = impact.brokenRefs.length;
  const judgments = impact.judgments ?? [];
  // 상품 영향(ADR-0081 결정 3)은 상품별로 묶어 앞에 — 「이 템플릿을 쓰는 상품 N개에서 참조가 깨집니다」
  const products = impact.brokenRefs.filter((c) => c.document === "product");
  const docs = impact.brokenRefs.filter((c) => c.document !== "product");
  const productCount = new Set(products.map((c) => c.ownerId)).size;
  const line = (c: Coordinate, i: number) => {
    const href = coordinateHref(c);
    return (
      <li key={i}>
        {formatCoordinate(c, { source: true })}
        {href && (
          <>
            {" "}
            ·{" "}
            <a href={href} target="_blank" rel="noreferrer">
              새 창에서 보기
            </a>
          </>
        )}
      </li>
    );
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[560px]">
        <DialogTitle className="ts-confirm-title">{broken > 0 ? `저장하면 참조 ${broken}건이 깨진다` : "저장하면 아래 내용이 함께 바뀝니다"}</DialogTitle>
        {products.length > 0 && (
          <>
            <p>이 템플릿을 쓰는 상품 {productCount}개에서 참조가 깨집니다 — 확인하면 저장되고, 그 상품은 보통약관 탭에서 가리키는 조를 사본으로 고친다(고치기 전까지 그 탭 저장은 거부된다).</p>
            <ul className="ts-confirm-loss">{products.map(line)}</ul>
          </>
        )}
        {docs.length > 0 && (
          <>
            <ul className="ts-confirm-loss">{docs.map(line)}</ul>
            <p className="ts-muted">지운 조를 가리키던 조연결 · 보통약관 조 참조는 깨진 참조가 된다.</p>
          </>
        )}
        {judgments.length > 0 && (
          <>
            <p>이 문서를 쓰는 상품 {judgments.length}개에서 판정이 바뀝니다 — 확인하면 저장됩니다.</p>
            <ul className="ts-confirm-loss">
              {judgments.map((j) => (
                <li key={j.productId} className="ts-confirm-group">
                  <span className="ts-confirm-group-title">{j.productName}</span>
                  <ul>
                    <JudgmentLines judgment={j.judgment} />
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
        <DialogFooter className="ts-confirm-actions">
          <Button autoFocus onClick={onCancel} disabled={pending}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {broken > 0 ? `참조 ${broken}건 끊고 저장` : "바꾸고 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
