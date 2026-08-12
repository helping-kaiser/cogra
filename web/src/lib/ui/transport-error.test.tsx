import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TransportError } from "./transport-error";

describe("TransportError", () => {
  it("renders the standard copy as an alert", () => {
    render(<TransportError testId="oops" />);
    expect(screen.getByTestId("oops")).toHaveTextContent(/reach the server/);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("a surface-specific message overrides the copy", () => {
    render(<TransportError testId="oops" message="Custom words." />);
    expect(screen.getByTestId("oops")).toHaveTextContent("Custom words.");
  });
});
