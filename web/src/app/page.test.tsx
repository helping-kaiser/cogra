import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

it("renders the landing page", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CoGra");
});
