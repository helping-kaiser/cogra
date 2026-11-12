import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormPasswordField, FormTextField } from "./form-fields";

describe("the fields' supporting line", () => {
  // TextField.jsx `FieldSupport`: the line sits in a baseline flex row, so it is
  // as wide as its words, never stretched across the field's column.
  it("a_text_fields_line_sits_in_its_supporting_row", () => {
    render(
      <FormTextField label="Handle" kind="handle" value="" onChange={() => {}} hint="3–30 characters" node={{ path: "f" }} />,
    );
    const row = screen.getByTestId("f.support").parentElement;
    expect(row).not.toHaveAttribute("data-testid");
    expect(row).toHaveClass("flex", "items-baseline");
  });

  // PasswordField.jsx: the line stands directly in the field's column.
  it("a_password_fields_line_stands_in_the_fields_column", () => {
    render(
      <FormPasswordField label="Password" value="" onChange={() => {}} autoComplete="new-password" hint="At least 12" node={{ path: "p" }} />,
    );
    expect(screen.getByTestId("p.support").parentElement).toHaveAttribute("data-testid", "p");
  });
});
