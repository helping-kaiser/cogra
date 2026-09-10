// The body a post or a comment renders — words, or a gallery — with
// the two states that replace it: the sensitive veil and the removal
// placeholder (D12, D15).

package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.bleedHorizontally
import com.cogra.core.designsystem.v2.media.MediaGallery
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.RemovalReason
import com.cogra.core.designsystem.v2.media.RemovedPlaceholder
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.media.SensitiveVeil
import com.cogra.core.designsystem.v2.media.SensitiveVeilCompact
import com.cogra.core.designsystem.v2.media.cappedToTallestTile
import com.cogra.core.designsystem.v2.token.MediaFrame
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.feature.content.R

/**
 * Which surface the body is drawn on, and therefore how its pictures sit.
 *
 * A post's body **is** its pictures, so they run full-bleed to the card's
 * edges, square-cornered, at the author's own crop, and they lead the body
 * — the boards draw them between the title and the words.
 *
 * **A comment is words first and its pictures join them**
 * (`design/components/content/CommentCard.prompt.md`): they follow the
 * words, stay inset at the card's medium rung, round their corners, and cap
 * far lower. They are an attachment, not the body, so no full-bleed — and
 * they are never cropped (2026-08-31), which is why each whole frame is
 * fitted inside the frame rather than filling it.
 */
internal enum class BodySurface { Post, Comment }

/**
 * The body region of a card or a detail: the gallery, the words, and
 * the description — **as one state**.
 *
 * D12 (jakob, 2026-08-28) rules the granularity: a sensitive post blurs
 * media, text and description together and the title stays outside, so
 * this composable is exactly the region the veil covers and callers
 * draw the title above it.
 *
 * Redaction is record-granular: every authored field goes at once, so a
 * removed body is the placeholder rather than a gallery with holes in
 * it.
 *
 * **The reveal is not this composable's to remember.** It is per node
 * and per session, shared across every surface the node appears on, and
 * dropped when the node's own sensitive state changes (jakob
 * 2026-08-31) — none of which a `remember` keyed to one card can do. It
 * is hoisted to `SensitiveReveals`, and arrives here already decided.
 *
 * @param collapsed the summary card's reading: the body clamps to
 *   [TEXT_BODY_CLAMP_LINES], the description to
 *   [DESCRIPTION_CLAMP_LINES], and an opener unfolds whatever that hid.
 *   False on the detail, which is the read surface and clamps nothing.
 * @param revealed whether this reader has already chosen to look.
 * @param onReveal fired when they choose to; null where the surface
 *   holds no reveal state, which leaves the veil closed.
 */
@Composable
internal fun PostBody(
    content: ModeratedField,
    description: ModeratedField?,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
    moderation: ModerationState,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    collapsed: Boolean = false,
    /**
     * The card padding a post's gallery cancels so it runs to the
     * card's edges (`PostCard.jsx:263`, `margin: 0 calc(-1 *
     * var(--card-padding))`). Zero where there is none to escape.
     */
    bleed: Dp = 0.dp,
    onOpenMedia: (() -> Unit)? = null,
    surface: BodySurface = BodySurface.Post,
    revealed: Boolean = false,
    onReveal: () -> Unit = {},
    /**
     * Whose mark the veil carries. The statuses above are the veil
     * itself — the OR of the author's own mark and a moderator's verdict
     * — so the caller reads the author's half to tell the two apart.
     */
    sensitiveSource: SensitiveSource = SensitiveSource.Author,
    /** The author's public reason, shown on the veil after the source. */
    sensitiveReason: String? = null,
) {
    if (isRemoved(content, attachments, attachmentsStatus)) {
        RemovedPlaceholder(
            reason = removalReason(moderation),
            modifier = modifier,
            testTag = "${testTagPrefix}_removed",
        )
        return
    }

    // WORDS XOR MEDIA (D16): the picture IS the body, so a media post
    // draws no `content` even when the record carries one. The words
    // beside a picture are the description, and the card draws them
    // under it. Handed both — an impossible post — the documented media
    // reading wins: the manifest is the body, and half a card is better
    // than an invented one. A comment is words PLUS pictures, so the
    // exclusion is a post's alone.
    val mediaIsTheBody = surface == BodySurface.Post && attachments.isNotEmpty()
    val words = content.value?.takeIf { it.isNotEmpty() && !mediaIsTheBody }

    val body: @Composable () -> Unit = {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val gallery: @Composable () -> Unit = {
                if (attachments.isNotEmpty()) {
                    Gallery(attachments, surface, onOpenMedia, bleed, "${testTagPrefix}_gallery")
                }
            }
            val caption: @Composable () -> Unit = {
                Caption(words, description?.value, collapsed, testTagPrefix)
            }

            // A post leads with its pictures; a comment leads with its
            // words and its pictures join them.
            if (surface == BodySurface.Post) {
                gallery()
                caption()
            } else {
                caption()
                gallery()
            }
        }
    }

    val veiled = !revealed && isSensitive(content, description, attachmentsStatus)
    // THE TWO FACES OF ONE VEIL. A post's body carries media or several
    // lines, so it blurs in place and keeps its exact space. A comment
    // is two lines and an inset attachment: covering it in place would
    // wash the words and wash the pictures separately, so the whole body
    // is replaced by one block at the card's own scale
    // (design/components/honesty/SensitiveVeil.jsx).
    if (surface == BodySurface.Comment) {
        SensitiveVeilCompact(
            veiled = veiled,
            onReveal = onReveal,
            modifier = modifier.fillMaxWidth(),
            source = sensitiveSource,
            reason = sensitiveReason,
            testTag = "${testTagPrefix}_veil",
            content = body,
        )
    } else {
        SensitiveVeil(
            veiled = veiled,
            onReveal = onReveal,
            modifier = modifier.fillMaxWidth(),
            testTag = "${testTagPrefix}_veil",
            content = body,
        )
    }
}

/**
 * The body's words and the caption under them, with the opener that
 * unfolds whatever the clamp hid.
 *
 * BODY FIRST, DESCRIPTION UNDER IT, on both kinds of post — so the two
 * shapes read as one card re-proportioned rather than two layouts.
 */
@Composable
private fun Caption(
    words: String?,
    description: String?,
    collapsed: Boolean,
    testTagPrefix: String,
) {
    // What the clamp hid, remembered from the reading that hid it: once
    // the opener has unfolded the text nothing overflows any more, so a
    // live measurement would take the opener away with the fold.
    var folded by remember(testTagPrefix) { mutableStateOf(false) }
    var open by remember(testTagPrefix) { mutableStateOf(false) }
    val clamping = collapsed && !open

    words?.let {
        ClampedText(
            text = it,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = if (clamping) TEXT_BODY_CLAMP_LINES else Int.MAX_VALUE,
            onOverflow = { folded = true },
            testTag = "${testTagPrefix}_words",
        )
    }
    description?.takeIf { it.isNotEmpty() }?.let {
        ClampedText(
            text = it,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = if (clamping) DESCRIPTION_CLAMP_LINES else Int.MAX_VALUE,
            onOverflow = { folded = true },
            testTag = "${testTagPrefix}_description",
        )
    }
    // Only where there is something folded away. A text control, not a
    // link: it opens the text in place and never navigates.
    if (collapsed && folded) {
        Text(
            text = stringResource(if (open) R.string.content_less else R.string.content_more),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .clickable { open = !open }
                .testTag("${testTagPrefix}_opener"),
        )
    }
}

/**
 * THE DESCRIPTION IS TWO LINES in the feed, on both kinds of post. It is
 * the caption, not the body: enough to say what the thing is, never
 * enough to become the reading.
 */
internal const val DESCRIPTION_CLAMP_LINES = 2

/**
 * THE TEXT BODY'S CEILING — a text post stands about as tall as a media
 * post, never taller, so a feed of both keeps one rhythm. Derived from
 * the tokens rather than chosen: on the 390×844 board, 844 less the 44px
 * safe area, the 64px bottom bar and the 360px worst-case chrome leaves
 * 376px, and `body-medium`'s line height is 20px — floor(376 / 20) = 18.
 */
internal const val TEXT_BODY_CLAMP_LINES = 18

/**
 * A paragraph that reports whether the clamp hid anything.
 *
 * Measured rather than estimated from a character count: the board's
 * estimate exists because a static render cannot measure a paragraph,
 * and the rule it serves is "only where there is something folded away".
 */
@Composable
private fun ClampedText(
    text: String,
    color: Color,
    maxLines: Int,
    onOverflow: () -> Unit,
    testTag: String,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = color,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { if (it.hasVisualOverflow) onOverflow() },
        modifier = Modifier.testTag(testTag),
    )
}

/**
 * The gallery at the rung its surface gives it.
 *
 * A comment's set rides the same pager, in a fixed square frame each whole
 * frame fits inside — but a lone picture keeps its own shape, which is what
 * the board draws (a single 4:5 comment picture, fitted).
 */
@Composable
private fun Gallery(
    attachments: List<MediaAssetView>,
    surface: BodySurface,
    onOpenMedia: (() -> Unit)?,
    bleed: Dp,
    testTag: String,
) {
    val items = attachments.map { it.toItem() }
    when (surface) {
        // FULL-BLEED, on the card and on the detail alike (design
        // backlog item 35, ruled 2026-09-08). The media cancels the
        // card's own padding so it runs to the card's edges and drops
        // its side radii — it meets the card's straight sides, never its
        // corners, so nothing needs clipping. It is the largest thing in
        // the card by a wide margin, which is the point.
        BodySurface.Post -> MediaGallery(
            items = items,
            onOpen = onOpenMedia,
            modifier = if (bleed > 0.dp) Modifier.bleedHorizontally(bleed) else Modifier,
            testTag = testTag,
        )

        BodySurface.Comment -> MediaGallery(
            items = items,
            onOpen = onOpenMedia,
            frameRatio = if (items.size == 1) {
                items[0].aspectRatio.cappedToTallestTile()
            } else {
                MediaShape.Square.ratio
            },
            fit = ContentScale.Fit,
            maxHeight = MediaFrame.CommentMaxHeight,
            shape = MaterialTheme.shapes.medium,
            testTag = testTag,
        )
    }
}

/**
 * The design-system view of one attachment.
 *
 * A clip hands over two URLs: the component draws the poster and plays
 * the video, and it is the *cover's* URL that becomes `url` because
 * that is the still the frame shows before a first frame exists.
 *
 * **A cover redacted on its own leaves the video playing.** The cover
 * answers with its own status, so a removed poster means the frame
 * reserves its space and waits for the first frame rather than drawing
 * bytes that are gone — the video itself was not removed, and pretending
 * otherwise would erase something nobody erased.
 */
internal fun MediaAssetView.toItem(): MediaItem {
    if (!isVideo) {
        return MediaItem(url = url, aspectRatio = aspectRatio, altText = altText)
    }
    val poster = cover?.takeIf { !it.status.hidden() }
    return MediaItem(
        url = poster?.url,
        aspectRatio = aspectRatio,
        altText = altText,
        videoUrl = url,
        durationMs = durationMs,
    )
}

/**
 * Which of the two removals a reader is looking at.
 *
 * The docs require the two to stay distinguishable, since collapsing
 * them lets a verdict hide behind an author's decision. `ILLEGAL` is the
 * passed proposal; every other state — an unnamed one included — leaves
 * the author's own removal as the only reading the evidence supports.
 */
internal fun removalReason(moderation: ModerationState): RemovalReason =
    if (moderation == ModerationState.ILLEGAL) RemovalReason.Platform else RemovalReason.Author

/**
 * Whether the whole body is gone.
 *
 * A words post is removed when its `content` is REDACTED; a media post
 * when its gallery is. UNKNOWN counts as removed on both: a state this
 * build cannot name is never rendered as if it were fine.
 */
internal fun isRemoved(
    content: ModeratedField,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
): Boolean {
    val galleryGone = attachments.isNotEmpty() &&
        (attachmentsStatus.hidden() || attachments.all { it.status.hidden() })
    val wordsGone = attachments.isEmpty() && content.status.hidden()
    return galleryGone || wordsGone
}

/**
 * The node's sensitive state, as a reveal is remembered against.
 *
 * The same three statuses [isSensitive] reads, kept together so a reveal
 * can be compared to the state it was made under rather than merely to
 * a node id.
 */
internal fun sensitiveMark(
    content: ModeratedField,
    description: ModeratedField?,
    attachmentsStatus: FieldStatus,
): SensitiveMark = SensitiveMark(
    content = content.status,
    description = description?.status,
    attachments = attachmentsStatus,
)

internal fun PostView.sensitiveMark(): SensitiveMark =
    sensitiveMark(content, description, attachmentsStatus)

internal fun CommentView.sensitiveMark(): SensitiveMark =
    sensitiveMark(content, description = null, attachmentsStatus = attachmentsStatus)

/** Whether the body is marked sensitive — one state for the whole of it. */
internal fun isSensitive(
    content: ModeratedField,
    description: ModeratedField?,
    attachmentsStatus: FieldStatus,
): Boolean = attachmentsStatus == FieldStatus.SENSITIVE ||
    content.status == FieldStatus.SENSITIVE ||
    description?.status == FieldStatus.SENSITIVE

private fun FieldStatus.hidden(): Boolean =
    this == FieldStatus.REDACTED || this == FieldStatus.UNKNOWN
