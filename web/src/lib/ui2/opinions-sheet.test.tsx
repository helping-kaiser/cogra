import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HeldOpinionView } from "@/lib/api/opinions-api";
import { byNode } from "@/test/data-node";
import { OpinionsSheet } from "./opinions-sheet";

function held(
  handle: string | null,
  name: string,
  pDirected: number,
  pInterest: number,
  extra: Partial<HeldOpinionView> & { redacted?: boolean } = {},
): HeldOpinionView {
  return {
    holderId: `addr-${handle ?? name}`,
    holder: { name, handle, avatarUrl: null, redacted: extra.redacted ?? false },
    pair: { pDirected, pInterest },
    severed: false,
    ...extra,
  };
}

/** The board's own holders (`_shared.jsx` `POST_OPINION_HOLDERS`), strongest first. */
const HOLDERS: readonly HeldOpinionView[] = [
  held("mira", "Mira Voss", 0.9, 0.25),
  held("ada", "Ada Okonkwo", 0.7, 0.4),
  held("juno", "Juno", -0.55, 0.25),
];

const NODE = { path: "postDetail.opinionsSheet" };
const rows = () => screen.getAllByTestId(byNode("postDetail.opinionsSheet.row"));

describe("OpinionsSheet", () => {
  it("is titled for what the opinions are on", () => {
    const { rerender } = render(<OpinionsSheet open onClose={() => {}} on="post" opinions={HOLDERS} />);
    expect(screen.getByRole("dialog", { name: "Opinions on this post" })).toBeInTheDocument();
    rerender(<OpinionsSheet open onClose={() => {}} on="comment" opinions={HOLDERS} />);
    expect(screen.getByRole("dialog", { name: "Opinions on this comment" })).toBeInTheDocument();
  });

  // PostOpinions.md: "a row carries the person and their public opinion, its
  // face leading and its pair in the reader's reading mode".
  it("carries the person, and their opinion — face drawn, pair the geek reading", () => {
    render(<OpinionsSheet open onClose={() => {}} on="post" opinions={HOLDERS} node={NODE} />);
    const mira = rows()[0]!;
    expect(mira.querySelector('[data-testid="postDetail.opinionsSheet.row.name"]')).toHaveTextContent("Mira Voss");
    expect(mira.querySelector('[data-testid="postDetail.opinionsSheet.row.handle"]')).toHaveTextContent("@mira");
    expect(mira.querySelector('[data-testid="postDetail.opinionsSheet.row.value.face"]')).toHaveTextContent("😍");
    const exact = mira.querySelector('[data-testid="postDetail.opinionsSheet.row.value.exact"]')!;
    expect(exact).toHaveTextContent("+0.90 / +0.25");
    expect(exact.className).toContain("cg-exact");
    // One image, named by the face's word and the pair in either mode.
    expect(screen.getAllByRole("img", { name: "Love this, +0.90 / +0.25" })).toHaveLength(1);
  });

  it("keeps the order it is handed — the fold's strongest-first", () => {
    render(<OpinionsSheet open onClose={() => {}} on="post" opinions={HOLDERS} node={NODE} />);
    expect(rows().map((r) => r.getAttribute("data-testid-key"))).toEqual(["1", "2", "3"]);
    expect(rows().map((r) => r.querySelector('[data-testid$=".name"]')?.textContent)).toEqual([
      "Mira Voss",
      "Ada Okonkwo",
      "Juno",
    ]);
  });

  // PostOpinions.md: "a row's face is 🤔, spoken as the state, never a table
  // face, GIVEN the row's opinion has exactly one number at zero".
  it("wears 🤔 on an opinion with exactly one number at zero", () => {
    render(<OpinionsSheet open onClose={() => {}} on="post" opinions={[held("kel", "Kel", 0.4, 0)]} node={NODE} />);
    expect(screen.getByTestId(byNode("postDetail.opinionsSheet.row.value.face"))).toHaveTextContent("🤔");
  });

  // Seam 245: which (0, 0) the row draws is the row's data.
  it("speaks Walked back for a walked-back standing and Says nothing for an empty-signed one", () => {
    render(
      <OpinionsSheet
        open
        onClose={() => {}}
        on="post"
        opinions={[held("wren", "Wren", 0, 0, { severed: true }), held("nadia", "Nadia", 0, 0)]}
      />,
    );
    expect(screen.getByRole("img", { name: "Walked back, +0.00 / +0.00" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Says nothing, +0.00 / +0.00" })).toBeInTheDocument();
  });

  it("opens the person's profile, and drops itself on the way", () => {
    const onClose = vi.fn();
    render(<OpinionsSheet open onClose={onClose} on="post" opinions={HOLDERS} node={NODE} />);
    expect(rows()[0]).toHaveAttribute("href", "/u/mira");
    fireEvent.click(rows()[0]!);
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps a deleted account's row, with its mark and no profile to open", () => {
    render(
      <OpinionsSheet
        open
        onClose={() => {}}
        on="post"
        opinions={[held(null, "Deleted account", 0.3, 0.3, { redacted: true })]}
        node={NODE}
      />,
    );
    const only = screen.getByTestId(byNode("postDetail.opinionsSheet.row"));
    expect(only).toHaveTextContent("Deleted account");
    expect(only.tagName).not.toBe("A");
  });

  it("is a sheet of rows: each row carries its own 16px gutter at 56px", () => {
    render(<OpinionsSheet open onClose={() => {}} on="post" opinions={HOLDERS} />);
    expect(screen.getByTestId("opinions-sheet-body").className).not.toMatch(/\bpx-6\b/);
    expect(screen.getByTestId("opinions-sheet-row-1").className).toMatch(/\bpx-4\b/);
    expect(screen.getByTestId("opinions-sheet-row-1").className).toMatch(/\bmin-h-14\b/);
  });

  // PostOpinions draws the post's list at the raised class (88%); the
  // comment's, stacked, at the master's default (CommentOpinionsEmpty, 62%).
  it("takes the board's height class: raised on the detail, the default stacked over a thread", () => {
    const { rerender } = render(<OpinionsSheet open onClose={() => {}} on="post" opinions={HOLDERS} />);
    expect(screen.getByTestId("opinions-sheet").style.maxHeight).toContain("88dvh");
    rerender(<OpinionsSheet open onClose={() => {}} on="comment" opinions={HOLDERS} stacked />);
    expect(screen.getByTestId("opinions-sheet").style.maxHeight).toContain("62dvh");
  });

  // CommentOpinionsEmpty.md: the empty line, calm, never the error colour.
  it("says the empty line, and only once the read has answered", () => {
    const { rerender } = render(<OpinionsSheet open onClose={() => {}} on="comment" opinions={null} />);
    expect(screen.queryByTestId("opinions-sheet-empty")).toBeNull();
    rerender(<OpinionsSheet open onClose={() => {}} on="comment" opinions={[]} />);
    const empty = screen.getByTestId("opinions-sheet-empty");
    expect(empty).toHaveTextContent("No opinions yet — yours would be the first.");
    expect(empty.innerHTML).not.toMatch(/error/);
  });
});
