package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.MediaFrame
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * A post's pictures: **one frame at the post's one crop shape, swiped, with
 * dots below** (`design/components/proposed/MediaAttachment.prompt.md`,
 * 2026-08-31; drawn on `FeedGallery`, `FeedFar`, `ComposeLanded`).
 *
 * Every frame shows whole, exactly as the author cropped it, and **the
 * height is one frame's height regardless of count** — a set of ten costs
 * the reader no more screen than a single picture does. That is what makes
 * the pager the right shape rather than a mosaic: a mosaic has to decide
 * how to crop the pictures it shrinks, and the layout never decides the
 * author's crop.
 *
 * **Dots only, never a `1/n` count pill** — the boards carry no counter
 * badge anywhere, and the dot row states the position to a screen reader
 * instead.
 *
 * The whole gallery is one tap target — a reader scrolling is choosing between
 * posts, not looking at one picture — so [onOpen] is a single callback and the
 * pages below it are not individually focusable. It is handed the page the
 * reader is on, because the two surfaces that wire it want different halves of
 * that: the feed opens the POST and ignores it, the detail opens the FULLSCREEN
 * VIEWER on the very frame under the thumb (graph.json, `PostDetail` via 4).
 *
 * @param frameRatio the shape every page takes. The composer crops a post's
 *   whole set to one shape, so this is the set's shape; it defaults to the
 *   lead picture's, capped at 4:5.
 * @param fit `Crop` where the author already cropped to the frame, `Fit`
 *   where the frame is imposed on uncropped pictures — a comment's case.
 * @param maxHeight the cap. A post's is the viewport-derived
 *   [mediaMaxHeight]; a comment's is [MediaFrame.CommentMaxHeight].
 * @param shape square-cornered and full-bleed in a post card, rounded and
 *   inset in a comment's.
 */
@Composable
fun MediaGallery(
    items: List<MediaItem>,
    modifier: Modifier = Modifier,
    onOpen: ((page: Int) -> Unit)? = null,
    frameRatio: Float = items.firstOrNull()?.aspectRatio?.cappedToTallestTile() ?: 1f,
    fit: ContentScale = ContentScale.Crop,
    maxHeight: Dp = mediaMaxHeight(),
    shape: Shape = RectangleShape,
    pagerState: PagerState = rememberPagerState { items.size },
    testTag: String? = null,
) {
    if (items.isEmpty()) return

    // The stage this gallery's clips compete for: the scroll surface's, or
    // the gallery's own when it stands in none.
    val stage = LocalScrollStage.current ?: rememberScrollStage()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (onOpen != null) {
                    Modifier.clickable { onOpen(pagerState.currentPage) }
                } else {
                    Modifier
                },
            )
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        HorizontalPager(
            state = pagerState,
            // One description for the whole set, on the pager rather than
            // per page: the set is what the reader is being told about, and
            // the dot row below carries the position.
            modifier = Modifier.clearAndSetSemantics {
                contentDescription = galleryDescription(items)
            },
        ) { page ->
            GalleryFrame(
                item = items[page],
                page = page,
                stage = stage,
                frameRatio = frameRatio,
                fit = fit,
                maxHeight = maxHeight,
                shape = shape,
            )
        }

        // THE ROW IS WINDOWED at seven (item 67, ruled 2026-09-14: "ten dots
        // under a gallery card is too much"), and it is the same row the
        // fullscreen viewer draws — one marker for one position, the card's
        // tone here and the viewer's there.
        PagerDots(
            count = items.size,
            current = pagerState.currentPage,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = MediaFrame.DotRowTopPadding),
            tone = DotTone.Card,
            testTag = testTag?.let { "${it}_dots" },
        )
    }
}

/**
 * One page. The reserved surface is painted before the bytes arrive, so
 * nothing jumps on load and nothing flashes on failure — and it is what
 * shows at the sides of a frame fitted whole inside the cap.
 */
@Composable
private fun GalleryFrame(
    item: MediaItem,
    page: Int,
    stage: ScrollStage,
    frameRatio: Float,
    fit: ContentScale,
    maxHeight: Dp,
    shape: Shape,
) {
    val videoUrl = item.videoUrl
    // A clip plays when its surface's stage is its own — THE STAGE LAW
    // ([StageElection]): the incumbent keeps it while past 70%, the topmost
    // qualifying clip takes it the moment the incumbent drops, and nothing
    // plays when nothing qualifies. The frame's part is to say where it
    // stands, every layout pass, and which list row it stands in, so the
    // list can say when that row is no longer placed ([standOn]).
    val key = remember(videoUrl) { Any() }
    // **COMPOSITION NEVER READS THE PLACE, ONLY THE DECISION.** A clip's
    // place is rewritten on every layout pass, which while a list is
    // scrolling means every frame; composing from it would recompose this
    // frame once per frame per clip on screen, on the thread that owes the
    // compositor the next one (`GalleryVisibilityChurnTest`). The holder
    // changes only when the stage does, and `derivedStateOf` narrows even
    // that to the frames it concerns
    // (developer.android.com/develop/ui/compose/performance/bestpractices,
    // "Use derivedStateOf to limit recompositions").
    val playing by remember(stage, key) { derivedStateOf { stage.holder === key } }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(frameRatio)
            // The cap bounds the tile; the picture inside then fits rather
            // than cropping further, so obeying the cap never re-crops.
            .heightIn(min = MediaFrame.MinHeight, max = maxHeight)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .then(if (videoUrl != null) Modifier.standOn(stage, key, page, LocalScrollStageRow.current) else Modifier),
    ) {
        // Symptom (b) is about this number on the way back: the clip
        // should resume if it is in the viewport and must not start if
        // it is far out of it, and the log has to show which side of
        // the line the frame landed on and when.
        if (videoUrl != null) {
            val traced = remember(videoUrl) { VideoTrace.clip(videoUrl) }
            // Keyed on the decision, not on the number behind it: a line
            // per frame is not a log of what autoplay decided, it is the
            // decision buried in its own noise. The fraction is still
            // reported — read here, outside composition, so it says what
            // the frame measured at the moment the stage changed hands.
            val said = remember(traced) { SaidPlaying() }
            LaunchedEffect(playing, traced) {
                VideoTrace.autoplay(traced, stage.visibleOf(key), playing)
                said.playing = playing
            }
            // A frame the list disposes while it plays stops playing with it,
            // but no decision changes to say so — without this line the log
            // would name it playing for as long as the log is read.
            DisposableEffect(traced) {
                onDispose { if (said.playing) VideoTrace.autoplay(traced, stage.visibleOf(key), false) }
            }
        }
        // Only the clip holding the stage composes a player, and composing
        // it is what claims [VideoStage]'s one player for this clip; the
        // frame that lost the stage drops its player in the same pass,
        // which surrenders it. A frame off the stage draws its poster and
        // holds nothing — which is also what the poster is *for*, so the
        // card looks the same either way.
        if (videoUrl != null && playing) {
            VideoPlayer(
                url = videoUrl,
                // The poster is the cover asset: what the author chose
                // as the clip's face on `ComposeCover`.
                posterUrl = item.imageModel(),
                autoplay = playing,
                durationMs = item.durationMs,
                // The gallery's own scale, so a clip is framed the way
                // every picture beside it is — and so the poster and
                // the video are the same rectangle.
                contentScale = fit,
                // The clip's own shape, known before composition — so
                // the surface is measured once instead of measured and
                // then re-measured when the decoder reports in.
                videoAspectRatio = item.aspectRatio,
                contentDescription = item.altText,
                modifier = Modifier.fillMaxSize(),
                testTag = "gallery_video",
            )
        } else {
            AsyncImage(
                model = item.imageModel(),
                // The gallery announces itself as one node; a second
                // description here would be read out twice.
                contentDescription = null,
                contentScale = fit,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

/** The last autoplay verdict a frame put in the trace — read only when it leaves. */
private class SaidPlaying {
    var playing = false
}

/**
 * `--media-max-height`: the viewport, less the top safe area, the bottom
 * bar, and the worst-case post chrome — floored so a short screen still
 * shows something.
 *
 * Read from the window rather than hard-coded, because the whole point of
 * the cap is that a post fits *this* screen.
 */
@Composable
fun mediaMaxHeight(): Dp {
    val viewport = LocalConfiguration.current.screenHeightDp.dp
    val chrome = Layout.BottomBarHeight + MediaFrame.PostChrome
    return maxOf(MediaFrame.MinHeight, viewport - chrome)
}

/**
 * One description for the whole set. Authored alt text is used where it
 * exists; the count is stated either way, so a reader always learns how
 * much is there even when nothing was described.
 */
private fun galleryDescription(items: List<MediaItem>): String {
    val described = items.mapNotNull { it.altText }
    val count = if (items.size == 1) "1 picture" else "${items.size} pictures"
    return if (described.isEmpty()) count else "$count: " + described.joinToString(". ")
}

@ThemePreviews
@Composable
private fun MediaGalleryCounts() {
    val square = MediaItem(null, 1f, "A square frame")
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            MediaGallery(listOf(square))
            MediaGallery(List(4) { square })
        }
    }
}

@ThemePreviews
@Composable
private fun MediaGalleryComment() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            // A comment's pictures are never cropped: a fixed square frame
            // with each whole frame fitted inside it.
            MediaGallery(
                items = listOf(MediaItem(null, 0.8f, "A tall picture"), MediaItem(null, 1.91f)),
                frameRatio = 1f,
                fit = ContentScale.Fit,
                maxHeight = MediaFrame.CommentMaxHeight,
                shape = MaterialTheme.shapes.medium,
            )
        }
    }
}
