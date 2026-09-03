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
  /** Fires when a stance on this comment is signed. */
  onCommit?: (pick: import("../stance/StanceReadout").StancePair, bundle: StanceBundle) => void;
  onReply?: () => void;
  onEdit?: () => void;
  /** The viewer authored this comment, so the edit affordance shows. */
  own?: boolean;
  targetLabel?: string;
  /** Extra affordances in the same row as the stance control, Reply and Edit. */
  actions?: React.ReactNode;
  /** Extra overflow-menu items, appended after the license entry. */
  menuItems?: readonly { label: string; onSelect?: () => void }[];
  /** Draw the comment with its license terms already unfolded — the reveal is a
   *  state of the card, never a surface of its own. */
  defaultShowLicense?: boolean;
  /** An open reply or edit composer, rendered between the card and its replies. */
  children?: React.ReactNode;
}

export declare function CommentCard(props: CommentCardProps): JSX.Element;
