import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/providers";
import { InviteEntry } from "./invite-entry";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";
const NOT_A_LINK = "That doesn't look like an invite link.";

describe("InviteEntry", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it("routes a pasted invite to /join", () => {
    renderWithProviders(<InviteEntry />);
    fireEvent.change(screen.getByTestId("invite_input"), {
      target: { value: `https://cogra.example/join/${ID}` },
    });
    fireEvent.click(screen.getByTestId("invite_continue"));
    expect(push).toHaveBeenCalledWith(`/join/${ID}`);
  });

  it("reads a bare invite id pasted in the link's place as the same link", () => {
    renderWithProviders(<InviteEntry />);
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: ID } });
    fireEvent.click(screen.getByTestId("invite_continue"));
    expect(push).toHaveBeenCalledWith(`/join/${ID}`);
  });

  // InviteEntryError.md
  it("flags_input_with_no_link_on_the_field_and_never_the_heading", () => {
    renderWithProviders(<InviteEntry />);
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: "cogra" } });
    fireEvent.click(screen.getByTestId("invite_continue"));
    expect(screen.getByRole("alert")).toHaveTextContent(NOT_A_LINK);
    expect(screen.getByTestId("invite_input")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("invite_input")).toHaveValue("cogra");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Enter your invite");
    expect(push).not.toHaveBeenCalled();
  });

  it("the_standing_line_re_checks_as_the_text_changes_and_goes_once_it_reads_as_a_link", () => {
    renderWithProviders(<InviteEntry />);
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: "cogra" } });
    fireEvent.click(screen.getByTestId("invite_continue"));
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: "cogra2" } });
    expect(screen.getByRole("alert")).toHaveTextContent(NOT_A_LINK);
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: ID } });
    expect(screen.queryByText(NOT_A_LINK)).not.toBeInTheDocument();
  });

  it("the_line_never_stands_before_a_press", () => {
    renderWithProviders(<InviteEntry />);
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: "cogra" } });
    expect(screen.queryByText(NOT_A_LINK)).not.toBeInTheDocument();
  });

  it("continue_stands_disabled_with_its_waiting_line_while_the_field_is_empty", () => {
    renderWithProviders(<InviteEntry />);
    expect(screen.getByTestId("invite_continue")).toBeDisabled();
    expect(screen.getByText("Waiting for your invite link")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: "c" } });
    expect(screen.getByTestId("invite_continue")).toBeEnabled();
    expect(screen.queryByText("Waiting for your invite link")).not.toBeInTheDocument();
  });

  it("heads with Back to the bare view and the door's own words", () => {
    renderWithProviders(<InviteEntry />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Enter your invite");
    expect(screen.getByText("CoGra is invite-only. Paste your invite link to get started.")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite link")).toBeInTheDocument();
  });

  it("keeps the sign-in path and anonymous browsing", () => {
    renderWithProviders(<InviteEntry />);
    expect(screen.getByTestId("invite_login")).toHaveAttribute("href", "/login");
    expect(screen.getByTestId("invite_login")).toHaveTextContent("Already have an account? Sign in");
    expect(screen.getByTestId("invite_browse")).toHaveAttribute("href", "/feed");
    expect(screen.getByTestId("invite_browse")).toHaveTextContent("Just looking? Browse the feed →");
  });

  // JoinInvalid.md: the field and its ways out stand as the door's.
  it("an_unusable_link_reads_join_invalid_over_the_same_door", () => {
    renderWithProviders(<InviteEntry invalid />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This invite can't be used anymore");
    expect(
      screen.getByText("It may have expired or already been used. Ask the person who invited you for a new link."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("invite_input"), { target: { value: ID } });
    fireEvent.click(screen.getByTestId("invite_continue"));
    expect(push).toHaveBeenCalledWith(`/join/${ID}`);
    expect(screen.getByTestId("invite_login")).toBeInTheDocument();
    expect(screen.getByTestId("invite_browse")).toBeInTheDocument();
  });
});
