import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { countReading, TextField } from "./text-field";

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
    fireEvent.change(screen.getByTestId("title"), { target: { value: "Salt maps" } });
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

  describe("the late counter", () => {
    // The threshold is the last tenth, never fewer than the last 20
    // (design/components/forms/TextField.jsx:85-92): a 100-character cap's
    // window is floor-driven (max(20, 10) = 20), a 500-character cap's is
    // tenth-driven (max(20, 50) = 50).
    it("says nothing while remaining is outside the window", () => {
      expect(countReading("a".repeat(79), 100)).toBeNull();
      expect(countReading("a".repeat(449), 500)).toBeNull();
    });

    it("appears at the exact boundary, floor-driven and tenth-driven alike", () => {
      expect(countReading("a".repeat(80), 100)).toEqual({ text: "20 left", over: false });
      expect(countReading("a".repeat(450), 500)).toEqual({ text: "50 left", over: false });
    });

    it("flips to over past the cap", () => {
      expect(countReading("a".repeat(105), 100)).toEqual({ text: "5 over", over: true });
      expect(countReading("a".repeat(507), 500)).toEqual({ text: "7 over", over: true });
    });

    it("counts Unicode scalar values, not UTF-16 code units", () => {
      // An astral emoji is two UTF-16 code units and one scalar value.
      const value = "🎉".repeat(96); // 96 scalar values, cap 100 → 4 left
      expect(value.length).toBe(192);
      expect(countReading(value, 100)).toEqual({ text: "4 left", over: false });
    });

    it("renders nothing without a cap", () => {
      expect(countReading("anything", undefined)).toBeNull();
    });

    it("shows the count in the field and ties it into aria-describedby", () => {
      render(<TextField label="Title" value={"a".repeat(95)} onChange={() => {}} testId="title" cap={100} />);
      expect(screen.getByText("5 left")).toBeInTheDocument();
      const input = screen.getByTestId("title");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).not.toBeNull();
      expect(document.getElementById(describedBy!)).toHaveTextContent("5 left");
    });

    it("joins the error and the count in one describedby when both are live", () => {
      render(
        <TextField
          label="Description"
          value={"a".repeat(507)}
          onChange={() => {}}
          testId="d"
          cap={500}
          error="Too long — at most 500 characters."
        />,
      );
      const input = screen.getByTestId("d");
      const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
      expect(ids).toHaveLength(2);
      expect(screen.getByRole("alert")).toHaveTextContent("Too long — at most 500 characters.");
      expect(screen.getByText("7 over")).toBeInTheDocument();
    });

    it("carries no native maxLength, so typing past the cap is never truncated", () => {
      function Host() {
        const [value, setValue] = useState("a".repeat(99));
        return (
          <TextField label="Title" value={value} onChange={setValue} testId="title" cap={100} />
        );
      }
      render(<Host />);
      const input = screen.getByTestId("title") as HTMLInputElement;
      expect(input).not.toHaveAttribute("maxLength");
      fireEvent.change(input, { target: { value: "a".repeat(105) } });
      expect(input.value).toHaveLength(105);
      expect(screen.getByText("5 over")).toBeInTheDocument();
    });

    it("`used` overrides the arithmetic for a fixture drawing only a tail", () => {
      expect(countReading("only the tail", 500, 507)).toEqual({ text: "7 over", over: true });
    });
  });
});
