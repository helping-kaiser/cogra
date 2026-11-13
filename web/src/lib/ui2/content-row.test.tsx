// The identity row's stance face (ContentRow.jsx `face` → `StanceValue`
// with `showPair={false}`): the face on screen, its word and the exact pair
// spoken — and the word for (0, 0) the row's DATA picks (seam 243).

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentRow } from "./content-row";

function face(pDirected: number, pInterest: number, severed?: boolean) {
  render(
    <ContentRow
      title="@sol gave an opinion on you"
      disc={{ kind: "face", pDirected, pInterest, severed }}
      testId="row"
    />,
  );
  return screen.getByRole("img");
}

describe("the identity row's stance face", () => {
  // ContentRow.jsx `face.severed` (seam 245, ask 19): absent or false, a
  // (0, 0) says nothing — the default is no longer the walk-back's word.
  it("speaks a (0, 0) face with no severed flag as Says nothing", () => {
    const img = face(0, 0);
    expect(img).toHaveTextContent("🤷");
    expect(img).toHaveAccessibleName("Says nothing, +0.00 / +0.00");
  });

  it("speaks a severed (0, 0) as Walked back", () => {
    expect(face(0, 0, true)).toHaveAccessibleName("Walked back, +0.00 / +0.00");
  });

  it("thinks at one zero and names the state, never a table face (ProfileStances.md:11)", () => {
    const img = face(0, 0.35);
    expect(img).toHaveTextContent("🤔");
    expect(img).toHaveAccessibleName("Interested, no side taken, +0.00 / +0.35");
  });

  it("reads the table off both zero lines", () => {
    const img = face(0.6, 0.65);
    expect(img).toHaveTextContent("🤩");
    expect(img).toHaveAccessibleName("Really into this, +0.60 / +0.65");
  });
});

describe("the identity row's trailing age", () => {
  it("sets label-small whole, weight with it (ContentRow.jsx TYPE, round 28)", () => {
    render(<ContentRow title="@ada commented on your post" trailing="35m" disc={{ kind: "monogram", name: "Ada" }} testId="row" />);
    const age = screen.getByTestId("row-trailing");
    expect(age.className.split(" ")).toContain("text-label-small");
    expect(age.getAttribute("style")).toBeNull();
  });
});

// NamesLong.md, at the board's longest legal handle (NamesLong.jsx).
describe("the identity row's long names", () => {
  const H = "@maximiliana_featherstone_haugh";
  const NAME = "Max Wilhelmina Featherstonehaugh Okonkwo-Lindqvist";
  const classes = (testId: string) => screen.getByTestId(testId).className.split(" ");

  // NamesLong.md:7 — the handle is the part cut, the words keep their room.
  it("cuts the handle in a notification's title and keeps the sentence's words", () => {
    render(<ContentRow title={`${H} commented on your post`} disc={{ kind: "monogram", name: NAME }} testId="row" />);
    const line = screen.getByTestId("row-title").querySelector("[data-name-line]") as HTMLElement;
    const [handle, words] = [...line.children] as HTMLElement[];
    expect(handle.textContent).toBe(H);
    expect(handle.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "text-ellipsis"]));
    expect(words.textContent).toBe(" commented on your post");
    expect(words.className.split(" ")).toContain("flex-none");
    expect(screen.getByTestId("row-title")).toHaveTextContent(`${H} commented on your post`);
  });

  // NamesLong.md:3 — a person row: the name ellipsizes first, the handle
  // stays whole until it alone cannot fit (ActorChip's arithmetic).
  it("yields the name before a bare handle aside", () => {
    render(<ContentRow title={NAME} titleAside={H} disc={{ kind: "monogram", name: NAME }} testId="row" />);
    expect(classes("row-title")).toEqual(expect.arrayContaining(["shrink-[999]", "min-w-0", "text-ellipsis"]));
    expect(classes("row-aside")).toEqual(expect.arrayContaining(["shrink", "min-w-0", "text-ellipsis", "whitespace-nowrap"]));
    expect(classes("row-aside")).not.toContain("flex-none");
  });

  // NamesLong.md:7 — an aside whose words name a handle gives up the handle,
  // the title and the aside's words kept.
  it("keeps the title whole and cuts the handle inside an aside's words", () => {
    render(<ContentRow title="Gave an opinion" titleAside={`on ${H}`} disc={{ kind: "glyph", glyph: "chat_bubble" }} testId="row" />);
    expect(classes("row-title")).toEqual(expect.arrayContaining(["flex-none", "max-w-full"]));
    expect(classes("row-aside")).toEqual(expect.arrayContaining(["shrink", "min-w-0", "text-ellipsis"]));
    expect(screen.getByTestId("row-aside")).toHaveTextContent(`on ${H}`);
  });

  it("keeps a handle-free aside at its width", () => {
    render(<ContentRow title="Saved" titleAside="· 2 acts" disc={{ kind: "glyph", glyph: "chat_bubble" }} testId="row" />);
    expect(classes("row-aside")).toContain("flex-none");
  });
});
