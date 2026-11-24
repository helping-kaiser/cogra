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

  // ContentRow.jsx `ASIDE_FLEX.text` (round 62; jakob 2026-11-23, "everywhere
  // the tag is one-line at most"): an aside with no handle — a tag up to 128
  // characters — ends in "…" while the title (the verb) keeps its room.
  it("cuts a handle-free aside, a long tag, and keeps the verb whole", () => {
    const TAG = `#${"sweepfixture-".repeat(9)}end`;
    render(<ContentRow title="Tagged a post" titleAside={TAG} disc={{ kind: "letter", letter: "#" }} testId="row" />);
    expect(classes("row-title")).toEqual(expect.arrayContaining(["flex-none", "max-w-full"]));
    expect(classes("row-aside")).toEqual(expect.arrayContaining(["shrink", "min-w-0", "overflow-hidden", "text-ellipsis", "whitespace-nowrap"]));
    expect(classes("row-aside")).not.toContain("flex-none");
    // The cut is the paint's; the words, and so what is spoken, stay whole.
    expect(screen.getByTestId("row-aside")).toHaveTextContent(TAG);
  });

  it("cuts an opinion's `on #tag` aside the same way", () => {
    render(<ContentRow title="Gave an opinion" titleAside="on #saltmaps" disc={{ kind: "glyph", glyph: "chat_bubble" }} testId="row" />);
    expect(classes("row-title")).toEqual(expect.arrayContaining(["flex-none", "max-w-full"]));
    expect(classes("row-aside")).toEqual(expect.arrayContaining(["shrink", "min-w-0", "text-ellipsis"]));
  });
});

// ContentRow.jsx `pending`: a still-settling act reads `Still settling` under
// its age, the honesty marker in the trailing column, named `<node>.pending`.
describe("the identity row's pending marker", () => {
  it("reads Still settling under the age, inside the row's door, on the registered part", () => {
    render(
      <ContentRow
        title="Published a post"
        trailing="now"
        pending
        href="/posts/p1"
        disc={{ kind: "glyph", glyph: "dynamic_feed" }}
        node={{ path: "profile.chronicle.act", key: "1" }}
        testId="row"
      />,
    );
    const marker = screen.getByText("Still settling");
    expect(marker.tagName).toBe("SPAN");
    expect(marker).toHaveAttribute("data-testid", "profile.chronicle.act.pending");
    expect(marker).toHaveAttribute("data-testid-key", "1");
    expect(marker.className).not.toContain("text-error");
    // Under the age, in the same trailing column.
    expect(marker.previousElementSibling).toHaveTextContent("now");
    expect(screen.getByTestId("row-open")).toContainElement(marker);
  });

  it("draws no marker on a landed row", () => {
    render(<ContentRow title="Published a post" trailing="2h" disc={{ kind: "glyph", glyph: "dynamic_feed" }} testId="row" />);
    expect(screen.queryByText("Still settling")).not.toBeInTheDocument();
  });
});
