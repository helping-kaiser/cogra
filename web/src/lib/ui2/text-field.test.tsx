import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TextField } from "./text-field";

function Host({ multiline = false }: { multiline?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <TextField
      label="Title"
      optional
      multiline={multiline}
      value={value}
      onChange={setValue}
      testId="title"
    />
  );
}

describe("TextField", () => {
  it("labels the control, so the label is what a reader lands on", () => {
    render(<TextField label="Title" value="" onChange={() => {}} testId="title" />);
    expect(screen.getByLabelText("Title")).toBe(screen.getByTestId("title"));
  });

  it("says Optional beside the label rather than inside the box", () => {
    render(<TextField label="Description" optional value="" onChange={() => {}} testId="d" />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("omits the note on a required field", () => {
    render(<TextField label="Handle" value="" onChange={() => {}} testId="h" />);
    expect(screen.queryByText("Optional")).toBeNull();
  });

  it("takes the taller box for a description and a single line for a title", () => {
    const { rerender } = render(<Host />);
    expect(screen.getByTestId("title").tagName).toBe("INPUT");
    rerender(<Host multiline />);
    expect(screen.getByTestId("title").tagName).toBe("TEXTAREA");
  });

  it("reports what the reader typed", () => {
    const onChange = vi.fn();
    render(<TextField label="Title" value="" onChange={onChange} testId="title" />);
    const input = screen.getByTestId("title") as HTMLInputElement;
    input.focus();
    // React's onChange rides the input event.
    input.value = "Salt maps";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("Salt maps");
  });

  it("announces a validation failure and ties it to the field", () => {
    render(
      <TextField label="Title" value="" onChange={() => {}} testId="title" error="Too long." />,
    );
    const input = screen.getByTestId("title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent("Too long.");
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("carries no error wiring when nothing is wrong", () => {
    render(<TextField label="Title" value="" onChange={() => {}} testId="title" />);
    expect(screen.getByTestId("title")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sits at the extra-small rung with a hairline outline", () => {
    render(<TextField label="Title" value="" onChange={() => {}} testId="title" />);
    const input = screen.getByTestId("title");
    expect(input.className).toContain("rounded-extra-small");
    expect(input.className).toContain("border-outline");
  });
});
