// The score's written forms (copy-voice, *The score drill-down*) and the
// add-up rendering (FeedEntry.md:15; SR-G8).

import { describe, expect, it } from "vitest";

import { DASH, apportionCents, cardFigure, flagFigure, signedOfCents, traceFigure } from "./figure";

describe("the score's written forms", () => {
  it("a card keeps its plain figure, a negative its minus, a zero none", () => {
    expect(cardFigure(15.2)).toBe("15.20");
    expect(cardFigure(-4.104)).toBe("−4.10");
    expect(cardFigure(0)).toBe("0.00");
  });

  it("the_flag_wears_the_glyph_and_the_signed_figure — the sign only on the flag", () => {
    expect(flagFigure(15.2)).toBe("+15.20");
  });

  it("a_zero_flag_wears_no_sign", () => {
    expect(flagFigure(0)).toBe("0.00");
  });

  it("a_negative_flag_wears_a_minus", () => {
    expect(flagFigure(-2.5)).toBe("−2.50");
  });

  it("a_trace_with_no_computed_figure_reads_a_dash_never_0_00", () => {
    expect(flagFigure(null)).toBe(DASH);
    expect(flagFigure(null)).not.toBe("0.00");
  });

  it("signs every path's value", () => {
    expect(signedOfCents(680)).toBe("+6.80");
    expect(signedOfCents(-50)).toBe("−0.50");
    expect(signedOfCents(0)).toBe("0.00");
  });
});

describe("a tiny score never reads zero (ExplainableNumber.jsx; seam 315, 319)", () => {
  it("a_tiny_card_rounds_away_from_zero", () => {
    expect(cardFigure(0.0031)).toBe("0.01");
    expect(cardFigure(-0.00042)).toBe("−0.01");
    expect(cardFigure(0.00005)).toBe("0.01");
    expect(cardFigure(0.0000003)).toBe("0.01");
    expect(cardFigure(0.000999)).toBe("0.01");
    expect(cardFigure(0.004999)).toBe("0.01");
  });

  it("only_a_severed_score_reads_0_00_on_a_card", () => {
    expect(cardFigure(0)).toBe("0.00");
  });

  it("a_card_at_or_above_0_005_prints_as_before", () => {
    expect(cardFigure(0.005)).toBe("0.01");
    expect(cardFigure(0.0149)).toBe("0.01");
    expect(cardFigure(-0.005)).toBe("−0.01");
    expect(cardFigure(-4.104)).toBe("−4.10");
  });

  it("a_tiny_trace_figure_is_two_significant_digits_in_plain_decimals", () => {
    expect(traceFigure(0.0031)).toBe("+0.0031");
    expect(traceFigure(-0.00042)).toBe("−0.00042");
    expect(traceFigure(0.00005)).toBe("+0.000050");
    expect(traceFigure(0.0000042)).toBe("+0.000004");
    expect(traceFigure(0.000999)).toBe("+0.0010");
  });

  it("a_trace_figure_that_would_read_zero_reads_0_000001", () => {
    expect(traceFigure(0.0000003)).toBe("+0.000001");
    expect(traceFigure(-0.0000003)).toBe("−0.000001");
    expect(traceFigure(1e-9)).toBe("+0.000001");
  });

  it("the_cut_to_six_decimals_rounds_half_away_from_zero", () => {
    expect(traceFigure(0.0000045)).toBe("+0.000005");
    expect(traceFigure(-0.0000045)).toBe("−0.000005");
  });

  it("the_trace_keeps_two_decimals_and_its_signs_off_the_tiny_range", () => {
    expect(traceFigure(0)).toBe("0.00");
    expect(traceFigure(15.2)).toBe("+15.20");
    expect(traceFigure(-2.5)).toBe("−2.50");
    expect(traceFigure(0.005)).toBe("+0.01");
  });

  it("the_edge_of_tiny_reads_the_same_on_both", () => {
    expect(cardFigure(-0.005)).toBe("−0.01");
    expect(cardFigure(0.004999)).toBe("0.01");
    expect(traceFigure(0.004999)).toBe("+0.0050");
  });

  it("the_flag_prints_a_tiny_score_in_significant_digits", () => {
    expect(flagFigure(0.0031)).toBe("+0.0031");
    expect(flagFigure(-0.001)).toBe("−0.0010");
  });
});

describe("the arithmetic closes on the drawn surface (SR-G8)", () => {
  it("the board's own paths add to the board's own score", () => {
    const parts = apportionCents([6.8, 4.2, 2.6, 1.1, 0.5], 15.2);
    expect(parts).toEqual([680, 420, 260, 110, 50]);
  });

  it("rounded parts that would miss the figure by a cent are apportioned to close on it", () => {
    // Each rounds to 0.33 alone, and 0.99 is not the 1.00 the flag shows.
    const parts = apportionCents([1 / 3, 1 / 3, 1 / 3], 1);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    for (const part of parts) expect(Math.abs(part - 100 / 3)).toBeLessThanOrEqual(1);
  });

  it("negative paths apportion too, every part within a cent of its exact value", () => {
    const exact = [5.006, -1.004, 0.333, -0.335];
    const total = exact.reduce((a, b) => a + b, 0);
    const parts = apportionCents(exact, total);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(Math.round(total * 100));
    parts.forEach((part, index) => expect(Math.abs(part - exact[index]! * 100)).toBeLessThanOrEqual(1));
  });

  it("no paths apportion to nothing", () => {
    expect(apportionCents([], 0)).toEqual([]);
  });
});
