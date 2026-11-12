// THE COMPOSER OPENED BY ADDRESS (ApplicantFeed.md:49, ProfileApplicant.md:26:
// "NEVER the wizard opens"): an applicant lands where app-open lands, told;
// a member meets the wizard as before; nothing shows before the reader is known.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { settleReaderState, unsettleReaderState } from "@/lib/session/reader-state";
import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
import { ComposeRoute } from "./compose-route";

const { replace, params } = vi.hoisted(() => ({
  replace: vi.fn(),
  params: { value: new URLSearchParams() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => params.value,
}));
vi.mock("./wizard/wizard-view", () => ({ ComposeWizard: () => <div data-testid="stub-wizard" /> }));
vi.mock("./post-edit-route", () => ({
  PostEditRoute: ({ postId }: { postId: string }) => <div data-testid="stub-edit">{postId}</div>,
}));

function mount() {
  return render(
    <>
      <ComposeRoute />
      <CarriedSnackbar />
    </>,
  );
}

beforeEach(() => {
  replace.mockClear();
  params.value = new URLSearchParams();
});

describe("ComposeRoute", () => {
  it("an_applicant_opening_compose_by_address_is_told_and_lands_at_app_open", () => {
    settleReaderState("APPLICANT");
    params.value = new URLSearchParams("reference=p1");
    mount();
    expect(screen.queryByTestId("stub-wizard")).toBeNull();
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent("You can post once you're in.");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("nothing_is_drawn_before_the_readers_account_read_answers", () => {
    unsettleReaderState();
    mount();
    expect(screen.queryByTestId("stub-wizard")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("a_member_meets_the_wizard", () => {
    settleReaderState("MEMBER");
    mount();
    expect(screen.getByTestId("stub-wizard")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("a_members_post_address_opens_the_edit", () => {
    settleReaderState("MEMBER");
    params.value = new URLSearchParams("post=p9");
    mount();
    expect(screen.getByTestId("stub-edit")).toHaveTextContent("p9");
  });

  // A read that did not answer leaves the door open (`reader-state.ts`).
  it("an_unanswered_read_opens_the_wizard", () => {
    settleReaderState(null);
    mount();
    expect(screen.getByTestId("stub-wizard")).toBeInTheDocument();
  });
});
