import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecoveryCode } from "./recovery-code";

const CODE = "ABCDE-FGHJK-MNPQR-STVWX-YZ0123";

function show(onConfirmed = vi.fn()) {
  render(
    <RecoveryCode
      code={CODE}
      explainer="keep it somewhere safe"
      testId="code"
      onConfirmed={onConfirmed}
    />,
  );
  return onConfirmed;
}

describe("RecoveryCode", () => {
  it("shows the code and keeps the confirmation closed", () => {
    show();
    expect(screen.getByTestId("code")).toHaveTextContent(CODE);
    expect(screen.getByTestId("code_saved")).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the mismatch on a wrong answer instead of going quiet", () => {
    const onConfirmed = show();
    fireEvent.change(screen.getByTestId("code_typed_back"), { target: { value: "ABCDE" } });
    // Nothing is said before the reader answers.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("code_saved"));

    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't match the code above.");
    expect(screen.getByTestId("code_typed_back")).toHaveAttribute("aria-invalid", "true");
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("re-reads a marked field as the reader types, and clears it on the code", () => {
    const onConfirmed = show();
    const field = screen.getByTestId("code_typed_back");
    fireEvent.change(field, { target: { value: "ABCDE" } });
    fireEvent.click(screen.getByTestId("code_saved"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "ABCDE-FGHJK" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: CODE } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("opens on the code typed back, reading the confusable letters", () => {
    const onConfirmed = show();
    fireEvent.change(screen.getByTestId("code_typed_back"), {
      target: { value: "abcde fghjk mnpqr stvwx yzOI23" },
    });
    fireEvent.click(screen.getByTestId("code_saved"));
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it("copies the code itself", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    show();

    fireEvent.click(screen.getByTestId("code_copy"));

    expect(writeText).toHaveBeenCalledWith(CODE);
    // Copying fills the clipboard; pasting it back is what answers.
    expect(await screen.findByTestId("code_saved")).toBeDisabled();
  });

  it("says so when the browser refuses the copy", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.reject(new Error("insecure context"))) },
    });
    show();

    fireEvent.click(screen.getByTestId("code_copy"));

    expect(await screen.findByTestId("code_copy_failed")).toBeInTheDocument();
  });
});
