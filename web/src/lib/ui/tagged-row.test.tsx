import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { byNode } from "@/test/data-node";
import { TaggedRow } from "./tagged-row";

// TaggedRow.jsx; TagPage.md: "ALWAYS every row carries the claim above it, its
// exact pair painting only in geek mode".
describe("TaggedRow", () => {
  const KEY = "dd44f5de-d68c-4931-aabc-915cefadab7f";

  function mount(relevance: number, confidence: number, pending = false) {
    render(
      <TaggedRow
        relevance={relevance}
        confidence={confidence}
        pending={pending}
        node={{ path: "tagPage.claim", key: KEY }}
        testId="row"
      >
        <section data-testid="the-card">card</section>
      </TaggedRow>,
    );
    return screen.getByTestId(byNode("tagPage.claim", KEY));
  }

  it("wears_the_tag_tables_glyph_and_the_exact_pair_as_the_board_draws_them", () => {
    // TagPage.dc.html: +0.10 / 1.00 reads 🔍, +0.55 / 1.00 and +0.40 / 0.90 read 🔗.
    mount(0.1, 1);
    expect(screen.getByTestId(byNode("tagPage.claim.glyph", KEY))).toHaveTextContent("🔍");
    expect(screen.getByTestId(byNode("tagPage.claim.exact", KEY))).toHaveTextContent("+0.10 / 1.00");
  });

  it.each([
    [0.55, 1, "🔗"],
    [0.4, 0.9, "🔗"],
  ])("reads_%s_%s_as_%s", (relevance, confidence, glyph) => {
    mount(relevance, confidence);
    expect(screen.getByTestId(byNode("tagPage.claim.glyph", KEY))).toHaveTextContent(glyph);
  });

  it("paints_the_exact_pair_only_in_geek_mode_and_speaks_one_reading_in_both", () => {
    const flag = mount(0.4, 0.9);
    expect(screen.getByTestId(byNode("tagPage.claim.exact", KEY))).toHaveClass("cg-exact");
    expect(screen.getByTestId(byNode("tagPage.claim.exact", KEY))).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId(byNode("tagPage.claim.glyph", KEY))).toHaveAttribute("aria-hidden", "true");
    expect(flag).toHaveTextContent("Tagged: definitely linked, +0.40 / 0.90");
  });

  it("names_the_flag_alone_so_the_card_under_it_keeps_its_own_path", () => {
    const flag = mount(0.1, 1);
    expect(flag).not.toContainElement(screen.getByTestId("the-card"));
  });

  it("says_a_claim_still_in_flight_is_settling", () => {
    mount(0.1, 1, true);
    expect(screen.getByTestId(byNode("tagPage.claim.pending", KEY))).toHaveTextContent("Still settling");
  });

  it("carries_no_marker_on_a_settled_claim", () => {
    mount(0.1, 1);
    expect(screen.queryByTestId(byNode("tagPage.claim.pending", KEY))).toBeNull();
  });
});
