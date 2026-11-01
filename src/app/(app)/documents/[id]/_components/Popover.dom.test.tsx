// @vitest-environment jsdom
/**
 * Popover — 네이티브 `<dialog>` → Radix Dialog (2026-11-01, ADR-0085 잔여).
 * 역할(role=dialog) · 이름 · 누른 자리 아래 배치 · Esc 닫기 · 안에 뜬 오른쪽 클릭 메뉴가 팝업 안에 그려지는 것을 지킨다.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextMenu, Popover } from "./Popover";

afterEach(cleanup);

describe("Popover", () => {
  it("role=dialog 에 라벨이 이름으로 붙고, 안이 그려진다", () => {
    render(
      <Popover anchor={{ x: 120, y: 80 }} label="조연결 고치기" onClose={() => {}}>
        <button type="button">확인</button>
      </Popover>,
    );
    const dialog = screen.getByRole("dialog", { name: "조연결 고치기" });
    expect(dialog.getAttribute("data-slot")).toBe("dialog-content");
    expect(dialog.textContent).toContain("확인");
  });

  it("누른 자리 바로 아래(y + 4)에 고정 배치된다", () => {
    render(
      <Popover anchor={{ x: 120, y: 80 }} label="자리" onClose={() => {}}>
        <p>내용</p>
      </Popover>,
    );
    const dialog = screen.getByRole("dialog", { name: "자리" });
    expect(dialog.style.position).toBe("fixed");
    expect(dialog.style.top).toBe("84px");
    expect(dialog.style.left).toBe("120px");
  });

  it("Esc 로 닫힌다", async () => {
    const onClose = vi.fn();
    render(
      <Popover anchor={{ x: 0, y: 0 }} label="닫기" onClose={onClose}>
        <p>내용</p>
      </Popover>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("안에서 연 오른쪽 클릭 메뉴는 팝업 안에 그려지고, Esc 는 메뉴만 닫는다", async () => {
    const onClosePopup = vi.fn();
    const onCloseMenu = vi.fn();
    // 실제로도 팝업이 선 뒤 오른쪽 클릭으로 열린다 — 메뉴는 그때 열린 팝업(모달) 안에 그려져야 눌린다
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <Popover anchor={{ x: 0, y: 0 }} label="팝업" onClose={onClosePopup}>
          <button type="button" onClick={() => setOpen(true)}>
            메뉴 열기
          </button>
          {open && <ContextMenu x={10} y={10} sections={[[{ label: "삭제", name: "삭제", action: { do: "ops", ops: [] }, danger: true } as never]]} onPick={() => {}} onClose={onCloseMenu} />}
        </Popover>
      );
    }
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
    const menu = screen.getByRole("menu", { name: "편집 메뉴" });
    expect(screen.getByRole("dialog", { name: "팝업" }).contains(menu)).toBe(true);
    expect(screen.getByRole("menuitem", { name: "삭제" }).getAttribute("data-slot")).toBe("button");
    await userEvent.keyboard("{Escape}");
    expect(onCloseMenu).toHaveBeenCalled();
    expect(onClosePopup).not.toHaveBeenCalled();
  });
});
