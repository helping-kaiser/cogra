import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadErrorLine, UploadStatusLine } from "./upload-notice";

describe("UploadStatusLine", () => {
  it("says what is still moving and why the seal waits", () => {
    render(<UploadStatusLine done={2} total={4} />);
    expect(screen.getByTestId("upload-status")).toHaveTextContent(
      "Uploading 2 of 4 — signing waits for the pictures.",
    );
  });

  it("is a status rather than an alert, so it does not interrupt", () => {
    render(<UploadStatusLine done={1} total={3} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("UploadErrorLine", () => {
  it("states the failure and both ways out of it", () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(<UploadErrorLine onRetry={onRetry} onRemove={onRemove} />);
    expect(screen.getByTestId("upload-error")).toHaveTextContent("One picture didn't upload.");

    fireEvent.click(screen.getByTestId("upload-error-retry"));
    expect(onRetry).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("upload-error-remove"));
    expect(onRemove).toHaveBeenCalled();
  });

  it("carries the message it is given", () => {
    render(<UploadErrorLine message="Two pictures didn't upload." onRetry={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByTestId("upload-error")).toHaveTextContent("Two pictures didn't upload.");
  });
});
