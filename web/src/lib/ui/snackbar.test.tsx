// The snackbar's one action (design/components/core/Snackbar.jsx) and the
// registered nodes a host's snackbar wears (`feed.snackbar{,.message,.action}`,
// `postDetail.snackbar.*`; item 83's aftermath slot).

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Snackbar } from "./snackbar";

describe("Snackbar", () => {
  it("a_hosts_snackbar_wears_its_node_with_the_words_on_message", () => {
    render(
      <Snackbar
        testId="feed-snackbar"
        node={{ path: "feed.snackbar" }}
        message="Reported."
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByTestId("feed.snackbar")).toBeInTheDocument();
    expect(screen.getByTestId("feed.snackbar.message")).toHaveTextContent("Reported.");
    // A confirmation with no way back carries no action.
    expect(screen.queryByTestId("feed.snackbar.action")).not.toBeInTheDocument();
  });

  it("the_action_slot_runs_its_act_and_drops_the_snackbar", () => {
    const undo = vi.fn();
    const dismiss = vi.fn();
    render(
      <Snackbar
        testId="post-snackbar"
        node={{ path: "postDetail.snackbar" }}
        message="Removed from Saved."
        action={{ label: "Undo", onAction: undo }}
        onDismiss={dismiss}
      />,
    );
    const action = screen.getByTestId("postDetail.snackbar.action");
    expect(action).toHaveTextContent("Undo");
    // The action rides the message's own line, inside the one surface.
    expect(screen.getByTestId("postDetail.snackbar")).toContainElement(action);
    fireEvent.click(action);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps_its_own_ids_on_a_surface_with_no_registered_snackbar", () => {
    render(
      <Snackbar
        testId="profile-snackbar"
        message="Saved."
        action={{ label: "Undo", onAction: () => {} }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByTestId("profile-snackbar")).toHaveTextContent("Saved.");
    expect(screen.getByTestId("profile-snackbar-action")).toHaveTextContent("Undo");
  });
});
