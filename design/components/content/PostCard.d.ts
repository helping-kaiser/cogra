import type { StanceBundle } from "../stance/StanceReadout";
import type { License } from "../forms/LicenseChooser";

export interface PostAuthor {
  handle: string;
  displayName?: string | null;
}

/**
 * The post card of design.md §6, in its summary and detail variants.
 *
 * A POST'S BODY IS `content` XOR `media` — words or a picture, never both
 * (`docs/instances/post.md`). The words that belong beside a picture are the
 * `description`. Both kinds draw in one order: title · body · description.
 * Handed both, the card renders the media reading and drops `content`.
 */
export interface PostCardProps {
  author?: PostAuthor;
  title?: string | null;
  /**
   * The caption, under the body on both kinds of post. Clamped to two lines in
   * the feed with the `More` opener under it; unclamped on `detail`.
   */
  description?: string | null;
  /**
   * The post's words — the body of a TEXT post, and absent on a media post,
   * whose body is its `media`. Passing both is an impossible post: the card
   * draws the media and ignores this.
   */
  content?: string | null;
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
   * "summary" clamps the body to a 4:5 media post's height (22 lines) and the
   * description to two, and links the text region — the feed. "detail" sets the
   * body at body-large, unclamped and unlinked — the post page.
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
   * explanation is item 13's Post Score drill-down, still undesigned.
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
  /** Shows `ShareButton` in the affordance row. Defaults to true. */
  showShare?: boolean;
  /** Fired when the reader shares the post, from `ShareButton`. */
  onShare?: () => void;
  /**
   * Renders the record's SKELETON instead of its content: an illegal verdict
   * removes the payload, so title, description, body, media, and the license all
   * go at once — there is no per-field redaction. `true` for the default wording,
   * or `RedactedContentProps` for the reason and date. The author, timestamp,
   * thread position, and stance control survive around it.
   */
  redacted?: boolean | import("../honesty/SensitiveVeil").RedactedContentProps;
  /**
   * The sensitive mark (readme §13): veils the body and the description while
   * the TITLE stays readable. The veil names its `source` — the author's
   * warning or the platform's verdict — and carries `reason` after it. One
   * reveal answers for the whole card.
   */
  sensitive?: { reason?: string; source?: "author" | "platform" };
  /**
   * Topic names, with or without the `#`. One line with the citation count at
   * its end, clipped on both variants (readme §13's collapse order) — the
   * topics-and-references sheet is the full set's home. On detail the whole
   * line opens the sheet.
   */
  topics?: readonly string[];
  /** The citation count, riding the end of the topics line. */
  references?: number;
  /** Opens the topics-and-references sheet. On detail, the whole line opens it. */
  onOpenReferences?: () => void;
  /** The post's media items, rendered full-bleed via `MediaGallery`. */
  media?: readonly import("../media/MediaAttachment").MediaAttachmentProps[];
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
   * Extra overflow-menu items, appended after the license entry. The rare
   * interactions live here — report, open a proposal, copy a link — so the
   * affordance row keeps only what a reader reaches for.
   */
  menuItems?: readonly { label: string; onSelect?: () => void }[];
  /**
   * Draw the card with its license terms already unfolded. The reveal is a
   * state of the card, not a surface of its own, so this is how a board shows
   * the reader who asked for the terms what they got.
   */
  defaultShowLicense?: boolean;
}

export declare function PostCard(props: PostCardProps): JSX.Element;
