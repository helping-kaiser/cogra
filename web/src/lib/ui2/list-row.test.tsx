import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListRow, StancePair } from "./list-row";

describe("ListRow", () => {
  it("carries the kind in words, so the leading mark never has to say it", () => {
    render(
      <ListRow
        mark={<span>#</span>}
        title="The long way home — @ada"
        kind="Post"
        testId="row"
      />,
    );
    expect(screen.getByText("Post")).toBeInTheDocument();
    // The mark is decorative: the kind beside it is the readable fact.
    expect(screen.getByTestId("row").querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("opens what it points at", () => {
    const onOpen = vi.fn();
    render(<ListRow mark={null} title="A topic" kind="Topic" onOpen={onOpen} />);
    screen.getByRole("button", { name: /A topic/ }).click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("is inert when it points nowhere", () => {
    render(<ListRow mark={null} title="A topic" kind="Topic" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names its own dismiss control after the thing it removes", () => {
    const onDismiss = vi.fn();
    render(
      <ListRow mark={null} title="The long way home" kind="Post" onDismiss={onDismiss} />,
    );
    screen.getByRole("button", { name: "Remove The long way home" }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("StancePair", () => {
  it("always shows a signed pair at two decimals", () => {
    render(<StancePair face="🙂" reading="Like this" forAgainst={0.1} reaches={0.1} />);
    expect(screen.getByText("+0.10 / +0.10")).toBeInTheDocument();
  });

  it("renders a negative side plainly, not as a failure", () => {
    render(<StancePair face="🙁" reading="Against this" forAgainst={-0.9} reaches={0.3} />);
    expect(screen.getByText("−0.90 / +0.30")).toBeInTheDocument();
  });

  it("spells the value out for assistive technology, since an emoji cannot", () => {
    render(<StancePair face="🙂" reading="Like this" forAgainst={0.55} reaches={0.2} />);
    // The face's own accessible name would be "slightly smiling face", which
    // says nothing about a stance — so it is hidden and the words carry it.
    expect(
      screen.getByText("Like this, For or against +0.55, How much reaches you +0.20"),
    ).toBeInTheDocument();
  });
});
