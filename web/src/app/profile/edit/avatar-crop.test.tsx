import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CENTERED } from "@/lib/ui2/media/crop";
import { AvatarCrop } from "./avatar-crop";

function draw() {
  const handlers = { onCrop: vi.fn(), onNext: vi.fn(), onBack: vi.fn(), onLeave: vi.fn() };
  render(<AvatarCrop src="blob:face" crop={CENTERED} {...handlers} />);
  return handlers;
}

// AvatarCrop.jsx / AvatarCrop.md: `Your picture`, the circle on the 390 × 390
// stage, the zoom track under it, no shape chips, Next pinned in the foot.
describe("AvatarCrop", () => {
  it("stands as its board draws it", () => {
    draw();
    expect(screen.getByRole("heading", { name: "Your picture" })).toHaveFocus();
    expect(screen.getByTestId("avatar-crop-frame").style.aspectRatio).toBe("390 / 390");
    expect(screen.getByRole("slider", { name: "Zoom" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "The post's shape" })).not.toBeInTheDocument();
    // No VISIBLE line says how to move the picture (round 44); the stage's
    // visually hidden key description stays (seam 323, G3, kept as today).
    const lines = [...screen.getByTestId("avatar-crop").querySelectorAll("p")].filter(
      (p) => !p.classList.contains("sr-only"),
    );
    expect(lines).toEqual([]);
    const column = screen.getByTestId("avatar-crop-next").parentElement!;
    expect(column.lastElementChild).toBe(screen.getByTestId("avatar-crop-next"));
  });

  it("hands each way out to its host", () => {
    const handlers = draw();
    fireEvent.click(screen.getByTestId("avatar-crop-next"));
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Back a step"));
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Leave"));
    expect(handlers.onLeave).toHaveBeenCalledTimes(1);
  });
});
