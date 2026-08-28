import type { StanceBundle } from "../stance/StanceReadout";
import type { License } from "../forms/LicenseChooser";

export interface PostAuthor {
  handle: string;
  displayName?: string | null;
}

/** The post card of design.md §6, in its summary and detail variants. */
export interface PostCardProps {
  author?: PostAuthor;
  title?: string | null;
  description?: string | null;
  content: string;
  /** Rendered right-aligned beside the author, body-small on onSurfaceVariant. */
  timestamp?: string;
  /** Shown only when the reader asks for it, from the overflow menu. */
  license?: License;
  /** Authored and signed, not yet ordered on L1. Shows in full regardless. */
  pending?: boolean;
  edited?: boolean;
  bundle?: StanceBundle | null;
  signedIn?: boolean;
  /**
   * Whether this reader has already met the stance gesture. Owned by the SHELL:
   * "the first tap ever" is a fact about the reader, and a card in a feed of
   * twenty cannot know it. Defaults to true, so a card on its own teaches nothing.
   */
  taught?: boolean;
  /** Fires when a stance on this post is signed, so the shell can keep it. */
  onCommit?: (pick: import("../stance/StanceReadout").StancePair, bundle: StanceBundle) => void;
  /**
   * "summary" clamps the body to four lines and links the text region — the feed.
   * "detail" sets the body at body-large, unclamped and unlinked — the post page.
   */
  variant?: "summary" | "detail";
  href?: string;
  onOpen?: () => void;
  /** In the reader's words. Defaults to "this post". */
  targetLabel?: string;
  /** Off only where a surface deliberately carries no stance affordance. */
  showStance?: boolean;
  /**
   * The Post Score, already formatted. Uncapped and possibly negative: render a
   * minus sign, never a colour. Renders `ExplainableNumber`; its four-screen
   * explanation is `components/proposed/score/`.
   */
  score?: string;
  /** Opens the score's detail surface (readme §7.1). */
  onOpenScore?: () => void;
  /**
   * The comment count. Third in the affordance row: `chat_bubble` plus the
   * number, the same shape as the score beside it. Zero shows the glyph alone.
   * Opens the comments sheet, from the feed and the detail view alike.
   */
  comments?: number;
  /** Opens the comments sheet. Defaults to `onOpen`. */
  onOpenComments?: () => void;
  /**
   * Renders the record's SKELETON instead of its content: an illegal verdict
   * removes the payload, so title, description, body, media, and the licence all
   * go at once — there is no per-field redaction. `true` for the default wording,
   * or `RedactedContentProps` for the reason and date. The author, timestamp,
   * thread position, and stance control survive around it.
   */
  redacted?: boolean | import("../honesty/SensitiveVeil").RedactedContentProps;
  /**
   * The author's self-mark (readme §13): veils the body and the description
   * while the TITLE stays readable, with the author's own reason on the veil
   * (`label`; omitted, the veil reads "Sensitive — tap to view"). One reveal
   * answers for the whole card.
   */
  sensitive?: { label?: string };
  /**
   * Topic names, with or without the `#`. One line with the citation count at
   * its end — clipped in the summary card (readme §13's collapse order),
   * wrapping only on the detail variant.
   */
  topics?: readonly string[];
  /** The citation count, riding the end of the topics line. */
  references?: number;
  /**
   * Detail variant only: takes over the media tap, which otherwise opens
   * `MediaViewer` in place. In the feed the same tap opens the post.
   */
  onOpenMedia?: (index: number) => void;
  /**
   * The affordance row beside the stance control — where everything a post grows
   * lands (a feed-rank figure, a route to a proposal against it, and so on). The
   * stance control always leads; nothing in here may take `primaryContainer`.
   */
  actions?: React.ReactNode;
  /**
   * Extra overflow-menu items, appended after the licence entry. The rare
   * interactions live here — report, open a proposal, copy a link — so the
   * affordance row keeps only what a reader reaches for.
   */
  menuItems?: readonly { label: string; onSelect?: () => void }[];
}

export declare function PostCard(props: PostCardProps): JSX.Element;
