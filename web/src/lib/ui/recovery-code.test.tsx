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

  it("says nothing on a correct partial", () => {
    show();
    fireEvent.change(screen.getByTestId("code_typed_back"), { target: { value: "ABCDE-FGHJK" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("code_saved")).toBeDisabled();
  });

  it("names the mismatch the instant a keystroke diverges", () => {
    show();
    fireEvent.change(screen.getByTestId("code_typed_back"), { target: { value: "ABCDQ" } });

    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't match the code above.");
    expect(screen.getByTestId("code_typed_back")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the mismatch on a backspace back to a valid prefix", () => {
    show();
    const field = screen.getByTestId("code_typed_back");
    fireEvent.change(field, { target: { value: "ABCDQ" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "ABCD" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never shows the mismatch on an empty field", () => {
    show();
    const field = screen.getByTestId("code_typed_back");
    fireEvent.change(field, { target: { value: "ABCDQ" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the confirm button disabled until the full code matches, even mid-diverge", () => {
    show();
    const field = screen.getByTestId("code_typed_back");
    fireEvent.change(field, { target: { value: "ABCDE-FGHJK" } });
    expect(screen.getByTestId("code_saved")).toBeDisabled();

    fireEvent.change(field, { target: { value: "ABCDQ" } });
    expect(screen.getByTestId("code_saved")).toBeDisabled();
  });

  it("enables the confirm button and calls onConfirmed on the exact code, reading confusable letters", () => {
    const onConfirmed = show();
    fireEvent.change(screen.getByTestId("code_typed_back"), {
      target: { value: "abcde fghjk mnpqr stvwx yzOI23" },
    });

    const saveButton = screen.getByTestId("code_saved");
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);
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
