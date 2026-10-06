import * as React from "react";

export interface CheckboxProps {
  /** The row's label — part of the control, and the tap target with it. */
  label: React.ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  id?: string;
  /** The data-node name its placer gives this checkbox's row (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `box`, `label`. */
  node?: string;
}

/** The house checkbox: an 18px box on the extra-small rung with a 1px
    `outline` border, filling `primary` with the inlined `check` glyph when
    checked. The whole row — label included — is the 48px target. */
export function Checkbox(props: CheckboxProps): React.JSX.Element;
