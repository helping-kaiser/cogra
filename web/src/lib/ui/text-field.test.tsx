import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TextField } from "./text-field";

describe("TextField", () => {
  it("wires the label to the input and reports typed values", () => {
    const onChange = vi.fn();
    render(<TextField label="Email" value="" onChange={onChange} testId="field" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBe(screen.getByTestId("field"));
    fireEvent.change(input, { target: { value: "a" } });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("the mono variant adds the monospace class", () => {
    render(<TextField label="Code" value="" onChange={() => {}} testId="field" mono />);
    expect(screen.getByTestId("field").className).toContain("font-mono");
  });

  it("stays quiet with no error", () => {
    render(<TextField label="Email" value="" onChange={() => {}} testId="field" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("field")).not.toHaveAttribute("aria-invalid");
  });

  it("announces an error and points the field at it", () => {
    render(
      <TextField label="Email" value="" onChange={() => {}} testId="field" error="Not an email." />,
    );
    const input = screen.getByTestId("field");
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent("Not an email.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
    expect(input.className).toContain("border-error");
  });
});
