// The profile's identity block against ProfileHeader.jsx: the long-name cases
// (NamesLong.md, round 40), the name's two-line rule (Profile.md:85-87,
// ProfileOther.md:87-91, round 47), the figures' two doors (Profile.md:13,
// ProfileOther.md:9), the figures' place (PROFILE_TOP_CSS) and the website row.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { expectWrapsLongWords } from "@/test/written";
import { nameFitSize } from "./name-fit";
import { ProfileHeader } from "./profile-header";

const IDENTITY = { path: "profile.identity" };
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

  // Profile.md:85 — the name wraps at its spaces and a word wider than its
  // line breaks inside the word (ProfileHeader.jsx: `overflowWrap:
  // break-word`, `wordBreak: normal`), and it is never cut.
  it("wraps the name at its spaces, breaks a too-wide word inside it, and never cuts it", () => {
    render(
      <ProfileHeader handle={HANDLE} displayName={NAME} own>
        <span />
      </ProfileHeader>,
    );
    const classes = screen.getByTestId("profile-display-name").className.split(" ");
    expect(classes).toContain("[overflow-wrap:break-word]");
    expect(classes).not.toContain("[overflow-wrap:anywhere]");
    expect(classes.some((c) => c === "truncate" || c.startsWith("line-clamp") || c === "text-ellipsis")).toBe(false);
  });

  // jakob's hand test 2026-11-19: the bio's over-long word continues on the
  // next line rather than running off the header.
  it("breaks an over-long word in the bio onto the next line", () => {
    render(
      <ProfileHeader handle={HANDLE} displayName={NAME} bio={"B".repeat(120)} own>
        <span />
      </ProfileHeader>,
    );
    expectWrapsLongWords(screen.getByTestId("profile-bio"));
  });
});

// THE TWO-LINE RULE, as the master's `nameFitSize` states it.
describe("nameFitSize", () => {
  it("keeps the role's 22px on 28px where the name holds two lines there", () => {
    expect(nameFitSize(() => 2)).toEqual({ size: 22, lineHeight: 28 });
    expect(nameFitSize(() => 1)).toEqual({ size: 22, lineHeight: 28 });
  });

  // ProfileOther.md:91 — the board's own samples: fifty 19px on 24px,
  // one-word 20px on 25px, widest 10px on 13px; the leading is
  // round(size × 28 / 22).
  it.each([
    [19, 24],
    [20, 25],
    [10, 13],
  ])("takes the largest whole size from 22 down that holds two lines: %ipx on %ipx", (fits, leading) => {
    const asked: number[] = [];
    const result = nameFitSize((size, lineHeight) => {
      asked.push(size);
      expect(lineHeight).toBe(Math.round((size * 28) / 22));
      return size > fits ? 3 : 2;
    });
    expect(result).toEqual({ size: fits, lineHeight: leading });
    expect(asked).toEqual(Array.from({ length: 22 - fits + 1 }, (_, i) => 22 - i));
  });

  // Profile.md:87 — no smallest size: two lines are the hard cap.
  it("has no floor above the last whole pixel", () => {
    expect(nameFitSize((size) => (size > 3 ? 3 : 2))).toEqual({ size: 3, lineHeight: 4 });
  });

  // TagPage.md:9-11 — the tag heading's floor: never below 12px, and a name
  // that holds two lines at no size down to 12 stands at 12 on 15.
  it("stops at the floor it is given, on the floor's leading, without asking below it", () => {
    const asked: number[] = [];
    expect(
      nameFitSize((size) => {
        asked.push(size);
        return 3;
      }, 12),
    ).toEqual({ size: 12, lineHeight: 15 });
    expect(Math.min(...asked)).toBeGreaterThan(11);
    expect(nameFitSize((size) => (size > 14 ? 3 : 2), 12)).toEqual({ size: 14, lineHeight: 18 });
  });
});

/*
 * A STAND-IN LAYOUT FOR THE NAME. jsdom lays nothing out, so the heading's
 * height is faked from its own text and inline size: each character is 0.6 of
 * the font size wide, the line `width` pixels long, the heading as tall as its
 * lines times its leading. Whether a browser wraps the same name the same way
 * is the conformance harness's claim, not this one.
 */
function fakeNameLayout(initialWidth: number) {
  let width = initialWidth;
  const native = HTMLElement.prototype.getBoundingClientRect;
  const observers = new Set<ResizeObserverCallback>();
  const NativeObserver = globalThis.ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.tagName !== "H1") return native.call(this);
    const size = parseFloat(this.style.fontSize) || 22;
    const leading = parseFloat(this.style.lineHeight) || 28;
    const lines = Math.max(1, Math.ceil(((this.textContent ?? "").length * size * 0.6) / width));
    return { width, height: lines * leading, top: 0, left: 0, right: width, bottom: lines * leading, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
  globalThis.ResizeObserver = class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      observers.add(this.callback);
    }
    unobserve() {}
    disconnect() {
      observers.delete(this.callback);
    }
  } as unknown as typeof ResizeObserver;
  return {
    resize(next: number) {
      width = next;
      act(() => {
        for (const callback of observers) callback([], {} as ResizeObserver);
      });
    },
    restore() {
      HTMLElement.prototype.getBoundingClientRect = native;
      globalThis.ResizeObserver = NativeObserver;
    },
  };
}

describe("ProfileHeader's name, whole on at most two lines", () => {
  let layout: ReturnType<typeof fakeNameLayout>;
  beforeEach(() => {
    layout = fakeNameLayout(262);
  });
  afterEach(() => layout.restore());

  function name() {
    return screen.getByTestId("profile.identity.name");
  }

  // Profile.md:85 — a name that holds two lines at 22px keeps the role.
  it("keeps the role's own size where the name holds two lines", () => {
    render(
      <ProfileHeader node={IDENTITY} handle="ada" displayName="Ada Okonkwo">
        <span />
      </ProfileHeader>,
    );
    expect(name().style.fontSize).toBe("");
    expect(name().style.lineHeight).toBe("");
    expect(name().className.split(" ")).toContain("text-title-large");
  });

  // Profile.md:87 — 50 characters at 0.6 em: 22px takes 660px, three lines
  // of 262; 17px takes 510, two lines; 18px takes 540, three.
  it("shrinks a name that would take three lines to the largest size that holds two", () => {
    render(
      <ProfileHeader node={IDENTITY} handle={HANDLE} displayName={NAME} showHandle>
        <span />
      </ProfileHeader>,
    );
    expect(name().style.fontSize).toBe("17px");
    expect(name().style.lineHeight).toBe(`${Math.round((17 * 28) / 22)}px`);
    expect(name()).toHaveTextContent(NAME);
  });

  // Profile.md:87 — the handle line and the rest of the head keep their sizes.
  it("leaves the handle line at its own size while the name shrinks", () => {
    render(
      <ProfileHeader node={IDENTITY} handle={HANDLE} displayName={NAME} showHandle>
        <span />
      </ProfileHeader>,
    );
    expect(name().style.fontSize).toBe("17px");
    const handle = screen.getByTestId("profile.identity.handle");
    expect(handle.getAttribute("style")).toBeNull();
    expect(handle.className.split(" ")).toContain("text-body-small");
  });

  // The rule is the line's: a wider line gives the name its size back.
  it("fits the name again when its line changes width", () => {
    render(
      <ProfileHeader node={IDENTITY} handle={HANDLE} displayName={NAME}>
        <span />
      </ProfileHeader>,
    );
    expect(name().style.fontSize).toBe("17px");
    layout.resize(400);
    expect(name().style.fontSize).toBe("");
    layout.resize(200);
    expect(name().style.fontSize).toBe("13px");
  });
});

// Profile.md:13, ProfileOther.md:9 (J-A) — the two opinion figures are two
// doors, the Posts figure no door, each door spoken as its figure's number
// and visible words and nothing more.
describe("ProfileHeader's figures", () => {
  const figures = { posts: 12, opinionsOn: 1204, opinionsBy: 7 };
  const href = (direction: "on" | "by") => (direction === "by" ? "/u/ada/opinions?tab=by" : "/u/ada/opinions");

  // ProfileHeader.jsx `PROFILE_TOP_CSS` (round 60): the figures move under the
  // avatar below the master's own measured fit, read from the master itself
  // so the web's constant cannot drift from it or swap own for another's.
  it.each([
    ["own", true],
    ["other", false],
  ] as const)("moves %s figures under the avatar at the master's measured width", (container, own) => {
    const master = readFileSync(join(process.cwd(), "..", "design", "components", "people", "ProfileHeader.jsx"), "utf8");
    const fit = new RegExp(`@container cg-profile-${container} \\(width < calc\\(96px \\+ ([0-9.]+rem)\\)\\)`).exec(master)?.[1];
    expect(fit).toBeDefined();
    const query = `@max-[calc(96px+${fit})]`;
    render(
      <ProfileHeader node={IDENTITY} handle="ada" own={own} figures={figures}>
        <span />
      </ProfileHeader>,
    );
    const row = screen.getByTestId("profile.identity.figures");
    const grid = row.parentElement!;
    const nameBlock = screen.getByTestId("profile.identity.name").parentElement!;
    expect(grid.className.split(" ")).toContain(`${query}:[grid-template-areas:'avatar_name''figures_figures']`);
    expect(nameBlock.className.split(" ")).toContain(`${query}:self-center`);
    expect(row.className.split(" ")).toContain(`${query}:mt-3`);
    expect(`${grid.className} ${nameBlock.className} ${row.className}`.match(/@max-\[[^\]]+\]/g)).toEqual([query, query, query]);
  });

  it("makes each opinion figure its own door, in reading order, and the row none", () => {
    render(
      <ProfileHeader node={IDENTITY} handle="ada" figures={figures} figuresHref={href}>
        <span />
      </ProfileHeader>,
    );
    const row = screen.getByTestId("profile.identity.figures");
    expect(row.tagName).toBe("DIV");
    expect(row).not.toHaveAttribute("aria-label");
    const doors = within(row).getAllByRole("link");
    expect(doors.map((door) => door.getAttribute("aria-label"))).toEqual([
      "1,204 Opinions on them",
      "7 Opinions by them",
    ]);
    expect(doors[0]).toHaveAttribute("data-testid", "profile.identity.figures.stancesOn");
    expect(doors[0]).toHaveAttribute("href", "/u/ada/opinions");
    expect(doors[1]).toHaveAttribute("data-testid", "profile.identity.figures.stancesTaken");
    expect(doors[1]).toHaveAttribute("href", "/u/ada/opinions?tab=by");
    for (const door of doors) {
      expect(door.className.split(" ")).toEqual(expect.arrayContaining(["cg-hit", "cg-focus", "rounded-small"]));
    }
  });

  it("leaves the Posts figure a plain fact", () => {
    render(
      <ProfileHeader node={IDENTITY} handle="ada" figures={figures} figuresHref={href}>
        <span />
      </ProfileHeader>,
    );
    const posts = screen.getByTestId("profile.identity.figures.posts");
    expect(posts.tagName).toBe("DIV");
    expect(posts.closest("a")).toBeNull();
  });

  it("speaks your own figures as you", () => {
    render(
      <ProfileHeader node={IDENTITY} handle="ada" own figures={figures} figuresHref={href}>
        <span />
      </ProfileHeader>,
    );
    expect(screen.getByRole("link", { name: "1,204 Opinions on you" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "7 Opinions by you" })).toBeInTheDocument();
  });

  it("draws no door without a place to open", () => {
    render(
      <ProfileHeader node={IDENTITY} handle="ada" figures={figures}>
        <span />
      </ProfileHeader>,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

// ProfileHeader.jsx — the website is a block child of the header's column, so
// it spans the column's width; it does not hug its words.
describe("ProfileHeader's website row", () => {
  it("spans the header's width", () => {
    render(
      <ProfileHeader node={IDENTITY} handle="ada" website="ada.example">
        <span />
      </ProfileHeader>,
    );
    const website = screen.getByTestId("profile.identity.website");
    expect(website.className.split(" ")).not.toContain("self-start");
    expect(website).toHaveAttribute("href", "https://ada.example");
  });
});
