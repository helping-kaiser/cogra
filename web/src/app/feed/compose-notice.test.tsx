import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyWizard } from "@/lib/compose/wizard";
import type { ComposeDraftStore } from "@/lib/compose/draft-store";
import { settleReaderState } from "@/lib/session/reader-state";
import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
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

  // The draft's door is a door into the composer: an applicant's answers as
  // the bar's New post does (ApplicantFeed.md:49) — undrawn here, the drawn
  // doors' answer.
  it("an_applicants_open_the_draft_says_post_once_in_and_does_not_navigate", async () => {
    settleReaderState("APPLICANT");
    render(
      <>
        <ComposeNotice onDismiss={vi.fn()} drafts={drafts} />
        <CarriedSnackbar />
      </>,
    );
    const tap = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(screen.getByTestId("compose-expired-open"), tap);
    expect(tap.defaultPrevented).toBe(true);
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent("You can post once you're in.");
    await screen.findByText(/couldn't finish settling/);
  });

  it("a_members_open_the_draft_is_the_plain_way_to_the_composer", async () => {
    settleReaderState("MEMBER");
    render(
      <>
        <ComposeNotice onDismiss={vi.fn()} drafts={drafts} />
        <CarriedSnackbar />
      </>,
    );
    expect(screen.getByTestId("compose-expired-open")).toHaveAttribute("href", "/compose");
    expect(screen.queryByTestId("carried-snackbar")).toBeNull();
    await screen.findByText(/couldn't finish settling/);
  });
});
