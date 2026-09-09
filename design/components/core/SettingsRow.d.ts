/**
 * The house switch: one thing that is on or off and takes effect the moment it
 * is pressed. 44×24 with an 18px knob — the sensitive sheet's geometry, kept,
 * because M3's 52×32 track carries a 2px outline and nothing in this system
 * does. The knob travels as well as changing colour, so the state is never
 * colour alone.
 */
export interface SwitchProps {
  /** On or off. */
  checked?: boolean;
  /** What the switch turns on. Required when the switch stands alone. */
  ariaLabel?: string;
  onChange?: () => void;
  /**
   * The drawing only — no role, no target, `aria-hidden`. What a `SettingsRow`
   * puts on its trailing edge, where the ROW carries `role="switch"` and the
   * row's own label is the switch's label.
   */
  decorative?: boolean;
}

export declare function Switch(props: SwitchProps): JSX.Element;

/**
 * One setting. The label says what it is, the second line says where it
 * stands, and the trailing edge is the variant: a switch, a value plus a
 * chevron, a chevron alone, or a control of the row's own.
 */
export interface SettingsRowProps {
  /** The setting's name. Impersonal, sentence case, never a verb phrase. */
  label: React.ReactNode;
  /**
   * One line under the label, showing STATUS rather than description —
   * "Last used 2 days ago", not a restatement of the label. A switch is the
   * exception: its line says what turning it on does.
   */
  status?: React.ReactNode;
  /** The current answer, for a choice made on another surface. */
  value?: React.ReactNode;
  /** A control of the row's own — the sessions list's Revoke. Pair with `inert`. */
  trailing?: React.ReactNode;
  /** Present makes this a switch row: the whole row is the switch. */
  checked?: boolean;
  /** Present makes this a choice row: the leading radio, `ComposeLicense`'s dot. */
  selected?: boolean;
  /** The radio group a choice row belongs to. */
  name?: string;
  /** An action rather than a setting — the label takes `primary`, the chevron goes. */
  action?: boolean;
  /** Force the chevron on or off; by default it rides a plain navigating row. */
  chevron?: boolean;
  /** The row is not the target — the word at its end is. */
  inert?: boolean;
  /** Where the row goes, or what it toggles. */
  onOpen?: () => void;
}

export declare function SettingsRow(props: SettingsRowProps): JSX.Element;

/**
 * A group of settings: a quiet heading above, a filled card holding the rows
 * with an inset hairline between them, and a footnote under the card. The
 * footnote is what keeps rows short — the thing a reader needs once and never
 * again belongs there, not inside every row.
 */
export interface SettingsGroupProps {
  /** The group's heading — a short noun phrase, sentence case. */
  label?: React.ReactNode;
  /** The line under the card: the fact the group owes the reader. */
  footnote?: React.ReactNode;
  /** Accessible name for a group with no visible heading. */
  ariaLabel?: string;
  /**
   * No card — for a group whose whole content is a control that draws its own
   * container, where a card would be a second container saying the same thing.
   * Only the fill goes — the heading and footnote keep their inset.
   */
  bare?: boolean;
  children?: React.ReactNode;
}

export declare function SettingsGroup(props: SettingsGroupProps): JSX.Element;
