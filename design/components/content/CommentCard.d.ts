import type { StanceBundle } from "../stance/StanceReadout";
import type { License } from "../forms/LicenseChooser";
import type { PostAuthor } from "./PostCard";

/** The comment of design.md §6 — top-level and nested. Renders as an `li`. */
export interface CommentCardProps {
  author?: PostAuthor;
  content: string;
  timestamp?: string;
  /**
   * The comment's pictures — below the words, inset at the card's medium rung
   * (an attachment, not the body). Never cropped; multiples render in the same
   * pager as a post's gallery, in a fixed square frame each whole frame fits
   * inside. The authoring-side cap is four pictures, or one video with its
   * cover — the same grammar a post's body carries, at comment scale.
   */
  media?: readonly import("../media/MediaAttachment").MediaAttachmentProps[];
  license?: License;
  pending?: boolean;
  edited?: boolean;
  bundle?: StanceBundle | null;
  /**
   * The sensitive mark. The WHOLE body veils as one comment-scale block —
   * words and pictures together — while the author, timestamp, topics and
   * stance control stay readable. The block names its `source` (the author's
   * warning or the platform's verdict) and carries `reason` after it.
   */
  sensitive?: { reason?: string; source?: "author" | "platform" };
  /**
   * Indents 12px once. The thread is two levels deep on screen (readme §13):
   * deeper answers flatten into the reply level and open with the @handle they
   * answer — mentions render in `primary`.
   */
  depth?: number;
  /** The EXPANDED replies. Collapsed, pass `replyCount` instead. */
  replies?: readonly (CommentCardProps & { id: string })[];
  /** Renders the collapsed "View n replies" line when `replies` is empty. */
  replyCount?: number;
  /** Expands the collapsed replies. */
  onOpenReplies?: () => void;
  /** The same topics-and-citations line a post wears (`TopicsLine`). */
  topics?: readonly string[];
  /** The citation count at that line's end. */
  references?: number;
  /** Makes the count open the topics-and-references sheet. */
  onOpenReferences?: () => void;
  signedIn?: boolean;
  /** Owned by the shell, like `PostCard.taught`. Defaults to true. */
  taught?: boolean;
  /**
   * Off only where a surface deliberately carries no stance affordance —
   * `PostCard`'s own prop. The edit history is the case: an opinion is held on
   * the comment, never on one of its versions.
   */
  showStance?: boolean;
  /** Fires when a stance on this comment is signed. */
  onCommit?: (pick: import("../stance/StanceReadout").StancePair, bundle: StanceBundle) => void;
  onReply?: () => void;
  onEdit?: () => void;
  /** The viewer authored this comment, so the edit affordance shows. */
  own?: boolean;
  targetLabel?: string;
  /**
   * Where this comment shows OUT of its thread — a profile's comments view, a
   * search result. The card leads with what it answers, one tap to get there.
   * A thread surface passes no target, since the sheet's post is the context.
   */
  target?: string;
  /** The target's kind, naming the glyph (`NODE_GLYPHS`). Defaults to `"post"`. */
  targetKind?: string;
  /** Opens the target. Shown only when both `target` and this are set. */
  onOpenTarget?: () => void;
  /**
   * How the card names what it answers: `"line"` (default — the one-line
   * pointer, where a comment is listed away from its thread) or `"thread"`
   * (the feed card's — the target as a head row, its own door, and the
   * comment hung under it on a connector rule). Needs `targetDetail`; falls
   * back to `"line"` without it.
   */
  targetShape?: "line" | "thread";
  /**
   * What the `"thread"` head row draws: a post's title over its author's
   * handle — an untitled post's first words in the title's place — or a
   * comment's author over its first words; the post's cover. `removed` is a
   * target whose payload went: the title's place reads the removal mark's
   * line in the system's voice, and the mark keeps its space empty.
   */
  targetDetail?: { title: string; sub?: string; cover?: string; removed?: boolean };
  /**
   * Folds the words at this many lines, with `More` under them opening them
   * in place — the caption's precedent. Offered on an estimate from the
   * column's width, as `PostCard`'s text body is. Off by default; the feed
   * card passes it.
   */
  clampLines?: number;
  /**
   * The card's own door: the words (and the pictures) open it. In the feed,
   * the comment's thread scrolled to it. Things with their own meaning keep it.
   */
  onOpen?: () => void;
  /**
   * Draws `onReply` as the comment glyph (`GlyphAction`, "Reply to @handle")
   * in the feed card's third slot instead of the thread's text button.
   */
  replyGlyph?: boolean;
  /**
   * The locked look on the text `Reply` for an applicant reader (auth.md):
   * `var(--state-disabled)`, the button still tappable, its tap answering
   * `You can comment once you're in.` Carried down to the replies.
   */
  replyOpacity?: string | number;
  /** Shows `ShareButton`, closing the row — the feed card's. A thread passes none. */
  onShare?: () => void;
  /** Extra affordances in the same row as the stance control, Reply and Edit. */
  actions?: React.ReactNode;
  /** Extra overflow-menu items, appended after the license entry. */
  menuItems?: readonly { label: string; onSelect?: () => void }[];
  /**
   * Renders the record's SKELETON instead of its content, as `PostCard` does:
   * redaction is record-granular, so the words, the pictures, the topics line
   * and the license go at once. `true` for the default wording, or
   * `RedactedContentProps` for the reason, the date and a note. The author, the
   * timestamp and the thread position survive around it.
   */
  redacted?: boolean | import("../honesty/SensitiveVeil").RedactedContentProps;
  /**
   * The feed score, already formatted, where the comment is RANKED — a feed
   * card. Second in the affordance row, `graph_3` plus the number, exactly as
   * `PostCard` wears it, opening the same trace. A thread passes none.
   */
  score?: string;
  /** Opens the score's trace (`FeedEntry`). */
  onOpenScore?: () => void;
  /** The data-node name its placer gives this card — keyed by the author's handle (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its media: `media` (`frame` per item, keyed by its position from 1, a clip's `soundDisc` or `playDisc`; `dots`). */
  node?: string;
  /** An open reply or edit composer, rendered between the card and its replies. */
  children?: React.ReactNode;
  /**
   * Squares the top-left corner so a row flag (TaggedRow) fuses with the
   * card. Defaults to false.
   */
  attach?: boolean;
}

export declare function CommentCard(props: CommentCardProps): JSX.Element;
