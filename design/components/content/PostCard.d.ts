import type { StanceBundle } from "../stance/StanceReadout";
import type { License } from "../forms/LicenseChooser";

export interface PostAuthor {
  handle: string;
  displayName?: string | null;
}

/**
 * The post card of readme §7's inventory, in its summary and detail variants.
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
  /**
   * Opens the edit history from the marker (the change-histories round): handed
   * one, `EditedMarker` takes its tappable form. Reachable only where a second
   * version exists, which is also the only case the marker is drawn in.
   */
  onInspectEdit?: () => void;
  bundle?: StanceBundle | null;
  signedIn?: boolean;
  /**
   * Whether this reader has already met the gesture. Owned by the SHELL:
   * "the first tap ever" is a fact about the reader, and a card in a feed of
   * twenty cannot know it. Defaults to true, so a card on its own teaches nothing.
   */
  taught?: boolean;
  /** Fires when a stance on this post is signed, so the shell can keep it. */
  onCommit?: (pick: import("../stance/StanceReadout").StancePair, bundle: StanceBundle) => void;
  /**
   * "summary" clamps the title to one line, the body to 18 and the description
   * to two, and links the text region — the feed. "detail" sets the body at
   * body-large, unclamped and unlinked — the post page.
   */
  variant?: "summary" | "detail";
  href?: string;
  onOpen?: () => void;
  /** In the reader's words. Defaults to "this post". */
  targetLabel?: string;
  /** Off only where a surface deliberately carries no stance affordance. */
  showStance?: boolean;
  /**
   * Draws the stance pad already bloomed. A shell fact, not a card one: it is
   * for a board whose subject IS the open pad. Pure pass-through to
   * `StanceControl`'s `defaultOpen`.
   */
  stanceOpen?: boolean;
  /**
   * How far the parked pad's bottom edge sits off the bottom of the screen.
   * 80 clears a bottom bar; the default 16 is for a surface with nothing under
   * it. Pass-through to `StanceControl`'s `padInset`.
   */
  stancePadInset?: number;
  /**
   * Where the pad's knob starts. Pass-through to `StanceControl`'s
   * `defaultPick`. A board drawing an open pad gives one rather than letting
   * the knob rest at the origin: the twenty-anchor table has no entry there,
   * so an origin pick reads as its nearest neighbour.
   */
  stanceDefaultPick?: { pDirected: number; pInterest: number };
  /**
   * Makes the pad's "Current opinion" line a door onto the timeline the
   * standing was summed from (the change-histories round). Pass-through to
   * `StanceControl`'s `onOpenHistory`.
   */
  stanceOnOpenHistory?: () => void;
  /**
   * A pick kept pending with the key elsewhere (the key-loss round).
   * Pass-through to `StanceControl`'s `pendingPick`.
   */
  stancePendingPick?: { pDirected: number; pInterest: number };
  /**
   * The key is back and the kept picks' review waits unsigned. Pass-through
   * to `StanceControl`'s `pendingReview`.
   */
  stancePendingReview?: boolean;
  /**
   * A signed act on this post in flight or failed — the hold's row line with
   * the pad closed, Set's state with it open; or a read-side comfort's
   * revert said on the row. Pass-through to `StanceControl`'s `signing`.
   */
  stanceSigning?: "busy" | "failed" | "writeRule" | "comfortFailed";
  /** Forwarded to `StanceControl`'s `holdProgress`: the hold's ring drawn standing at this 0–1 fill, for a board. */
  stanceHoldProgress?: number;
  /** Forwarded to `StanceControl`'s `knobHeld`: the pad's knob drawn under the finger, its pressed layer around it, for a board. */
  stanceKnobHeld?: boolean;
  /**
   * The Feed score, already formatted. Uncapped and possibly negative: render a
   * minus sign, never a colour. Renders `ExplainableNumber`; its four-screen
   * explanation is the Feed score drill-down (`FeedEntry` and below).
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
  /**
   * How many people hold an opinion on this post (backlog item 55). DETAIL
   * VARIANT ONLY, and only above zero: a quiet count line in the topics line's
   * register, opening the sheet that lists the holders. At zero there is no row
   * — a tap that can only open an empty list is a tap spent on nothing; a
   * comment's door is its ⋮ menu instead, where the row always stands.
   */
  opinions?: number;
  /** Opens the opinions-on-this-post sheet. */
  onOpenOpinions?: () => void;
  /**
   * How many artifacts cite this one — the INBOUND mirror of `references`,
   * which counts what this post points at. DETAIL VARIANT ONLY, and only above
   * zero, in the opinions row's own register. Never folded into `references`:
   * that count is the tags-and-references sheet's length, and this is a
   * different list by different authors.
   */
  citedBy?: number;
  /** Opens the "Cited by" sheet. */
  onOpenCitedBy?: () => void;
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
   * Stands where the author chip stands, for a feed kind that is not a post —
   * a message's sender and chat, a chat's disc, name and kind mark. Additive.
   */
  lead?: React.ReactNode;
  /**
   * Stands where the text block stands, inside the same door — a message as
   * its chat bubble, a chat as its last message's row. Additive.
   */
  main?: React.ReactNode;
  /**
   * The ⋮'s accessible name, for a feed kind whose menu is not a post's — a
   * person's `More about @ada`. Defaults to "More on this post". Additive.
   */
  menuLabel?: string;
  /**
   * The pad's four ends, for a target whose opinion is not a stance on content
   * — a tag's Affinity. Pass-through to `StanceControl`'s `axes`; defaults to
   * the control's own. Additive.
   */
  stanceAxes?: import("../stance/StancePad").PadAxes;
  /**
   * The kind's own act, for a feed kind riding this shell — the third slot of
   * the unified row (opinion · score · act · share), where a post's comments
   * stand. A tag's is `Tag a new post with it`. Additive.
   */
  act?: React.ReactNode;
  /**
   * Squares the top-left corner so a row flag (TaggedRow) fuses with the
   * card. Defaults to false.
   */
  attach?: boolean;
  /** The data-node name its placer gives this card — keyed by the author's handle (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `authorChip` (`avatar`, `name`, `handle`), `timestamp`, `menu`, `title`, `media` (`frame` per picture, keyed by its position from 1; `dots`), `description`, `body`, `opener`, `tagsLine` (`tag` keyed by name, `counts`), `opinions`, `citedBy`, `actionRow` (`stance` with its `anchor`, `score` with its `value`, `comments` with its `count`, `share`). */
  node?: string;
}

export declare function PostCard(props: PostCardProps): JSX.Element;
