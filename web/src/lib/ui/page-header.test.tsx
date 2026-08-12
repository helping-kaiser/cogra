import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the back link with its accessible name and target", () => {
    render(
      <PageHeader title="Feed" backHref="/" backLabel="Back to home" backTestId="feed-back" />,
    );
    const back = screen.getByRole("link", { name: "Back to home" });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toBe(screen.getByTestId("feed-back"));
    expect(screen.getByRole("heading", { name: "Feed" })).toBeInTheDocument();
  });

  it("renders without a title and with a trailing action", () => {
    render(
      <PageHeader
        backHref="/feed"
        backLabel="Back to feed"
        backTestId="post-back"
        action={<button type="button">Edit</button>}
      />,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
