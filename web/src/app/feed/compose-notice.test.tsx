import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyWizard } from "@/lib/compose/wizard";
import type { ComposeDraftStore } from "@/lib/compose/draft-store";
import { ComposeNotice } from "./compose-notice";

const drafts = {
  load: () => Promise.resolve({ ...emptyWizard(), title: "Salt maps of the coast road" }),
} as unknown as ComposeDraftStore;

describe("ComposeNotice", () => {
  // ComposeExpired: a `TaskCard` — the task ring, the title, the mark — on the
  // feed card's ground, in copy-voice's words (straight quotes around the name).
  it("is a task card naming the post that did not land", async () => {
    render(<ComposeNotice onDismiss={vi.fn()} drafts={drafts} />);
    const card = screen.getByTestId("compose-expired");
    expect(card.className).toContain("cg-task-ring");
    expect(screen.getByRole("heading", { name: "Your post didn't land" })).toBeInTheDocument();
    expect(
      await screen.findByText(
        '"Salt maps of the coast road" couldn\'t finish settling. Nothing was spent — your draft is saved.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("compose-expired-open")).toHaveAttribute("href", "/compose");
  });
});
