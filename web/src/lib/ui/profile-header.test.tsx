// The profile's identity block against ProfileHeader.jsx's long-name cases
// (NamesLong.md, round 40) at the board's longest legal handle and name.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileHeader } from "./profile-header";

const HANDLE = "maximiliana_featherstone_haugh";
const NAME = "MaximilianaWilhelminaFeatherstonehaughOkonkwoLiang";

describe("ProfileHeader with a long handle and name", () => {
  // NamesLong.md:5 — the profile's handle line never wraps; a handle too
  // long for it is cut with "…".
  it("keeps the handle line to one line, clipped at its end", () => {
    render(
      <ProfileHeader handle={HANDLE} displayName={NAME} own>
        <span />
      </ProfileHeader>,
    );
    const line = screen.getByTestId("profile-handle");
    expect(line.className.split(" ")).toContain("truncate");
    expect(line).toHaveTextContent(`@${HANDLE}`);
  });

  // The name heading keeps its master's form (ProfileHeader.jsx:233,
  // `overflow-wrap: anywhere`); its conflict with NamesLong.md:13 is filed
  // with design, not decided here.
  it("lets the name heading break as its master draws it", () => {
    render(
      <ProfileHeader handle={HANDLE} displayName={NAME} own>
        <span />
      </ProfileHeader>,
    );
    expect(screen.getByTestId("profile-display-name").className).toContain("[overflow-wrap:anywhere]");
  });
});
