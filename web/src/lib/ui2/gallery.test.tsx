import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComponentGallery } from "./gallery";

// The gallery is the repo's stand-in for a component explorer, so this test is
// what keeps it honest: every variant listed there has to render, and the
// interactive ones have to still work when driven.

describe("ComponentGallery", () => {
  it("renders every variant", () => {
    render(<ComponentGallery />);
    for (const testId of [
      "gallery-filled",
      "gallery-outlined",
      "gallery-text",
      "gallery-disabled",
      "gallery-sm",
      "gallery-full",
      "gallery-action",
      "gallery-shape-tall",
      "gallery-shape-square",
      "gallery-shape-wide",
      "gallery-topic",
      "gallery-title",
      "gallery-description",
      "gallery-invalid",
      "gallery-row",
      "gallery-tile-wide",
      "gallery-tile-capped",
      "gallery-one-lead",
      "gallery-three-page-0",
      "gallery-many-dots",
      "body-veil",
      "crop-frame",
    ]) {
      expect(screen.getByTestId(testId), testId).toBeInTheDocument();
    }
  });

  it("shows both removal wordings side by side, where the difference is reviewable", () => {
    render(<ComponentGallery />);
    expect(screen.getByText("Removed by its author")).toBeInTheDocument();
    expect(screen.getByText("Removed under the platform's rules")).toBeInTheDocument();
  });

  it("drives the shape selection through to the crop frame", () => {
    render(<ComponentGallery />);
    expect(screen.getByTestId("gallery-shape-tall")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe(`${4 / 5} / 1`);

    fireEvent.click(screen.getByTestId("gallery-shape-wide"));

    expect(screen.getByTestId("gallery-shape-wide")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("crop-frame").style.aspectRatio).toBe("1.91 / 1");
  });

  it("opens the sheet from its trigger", () => {
    render(<ComponentGallery />);
    const sheet = screen.getByTestId("bottom-sheet") as HTMLDialogElement;
    expect(sheet.open).toBe(false);
    fireEvent.click(screen.getByTestId("gallery-open-sheet"));
    expect(sheet.open).toBe(true);
  });
});
