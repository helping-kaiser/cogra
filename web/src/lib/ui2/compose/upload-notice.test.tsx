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

  // STRICTLY THE IN-FLIGHT UPLOAD GATE (design/components/compose/
  // UploadNotice.prompt.md lines 1, 11): it never draws for an empty batch —
  // there is nothing moving to report, so a caller bug must draw nothing
  // rather than "Uploading 0 of 0".
  it("draws nothing for an empty batch", () => {
    render(<UploadStatusLine done={0} total={0} />);
    expect(screen.queryByTestId("upload-status")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
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

// ComposeUploading.md (round 22): "WHEN more than one picture's upload fails
// -> ... the line N pictures didn't upload. ... with Retry and Remove them";
// the gate's form reads "N pictures didn't upload. Signing waits for them."
describe("the plural failure", () => {
  it("offers Remove them under a count, Remove it under one", () => {
    const { unmount } = render(
      <UploadErrorLine message="2 pictures didn't upload." count={2} onRetry={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByTestId("upload-error-remove")).toHaveTextContent("Remove them");
    unmount();
    render(<UploadErrorLine onRetry={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByTestId("upload-error-remove")).toHaveTextContent("Remove it");
  });

  it("says signing waits for them at the gate", () => {
    render(<UploadStatusLine done={0} total={0} failed failedCount={3} message="3 pictures didn't upload." />);
    expect(screen.getByTestId("upload-status")).toHaveTextContent(
      "3 pictures didn't upload. Signing waits for them.",
    );
  });
});
