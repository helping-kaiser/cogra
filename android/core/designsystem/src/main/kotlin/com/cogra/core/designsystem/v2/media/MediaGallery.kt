package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
 * The whole gallery is one tap target opening the post — a reader scrolling
 * is choosing between posts, not looking at one picture — so [onOpen] is a
 * single callback and the pages below it are not individually focusable.
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
    onOpen: (() -> Unit)? = null,
    frameRatio: Float = items.firstOrNull()?.aspectRatio?.cappedToTallestTile() ?: 1f,
    fit: ContentScale = ContentScale.Crop,
    maxHeight: Dp = mediaMaxHeight(),
    shape: Shape = RectangleShape,
    pagerState: PagerState = rememberPagerState { items.size },
    testTag: String? = null,
) {
    if (items.isEmpty()) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onOpen != null) Modifier.clickable(onClick = onOpen) else Modifier)
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
                frameRatio = frameRatio,
                fit = fit,
                maxHeight = maxHeight,
                shape = shape,
            )
        }

        if (items.size > 1) {
            PageDots(
                count = items.size,
                current = pagerState.currentPage,
                testTag = testTag?.let { "${it}_dots" },
            )
        }
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
    frameRatio: Float,
    fit: ContentScale,
    maxHeight: Dp,
    shape: Shape,
) {
    // How much of this frame the reader can see. Autoplay follows it,
    // so a clip starts when it arrives and stops when it leaves —
    // "autoplay muted on visibility" (roadmap slice 2.5.2).
    var visible by remember { mutableFloatStateOf(0f) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(frameRatio)
            // The cap bounds the tile; the picture inside then fits rather
            // than cropping further, so obeying the cap never re-crops.
            .heightIn(min = MediaFrame.MinHeight, max = maxHeight)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .then(
                if (item.isVideo) {
                    Modifier.onVisibilityChanged { visible = it }
                } else {
                    Modifier
                },
            ),
    ) {
        val videoUrl = item.videoUrl
        // A player off screen is still a hardware codec held open, and a
        // device has only a handful. A frame nobody can see draws its
        // poster instead and holds nothing — which is also what the
        // poster is *for*, so the card looks the same either way.
        if (videoUrl != null && visible > 0f) {
            VideoPlayer(
                url = videoUrl,
                // The poster is the cover asset: what the author chose
                // as the clip's face on `ComposeCover`.
                posterUrl = item.imageModel(),
                autoplay = visible >= AUTOPLAY_VISIBLE_FRACTION,
                durationMs = item.durationMs,
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

/**
 * How much of a frame has to be showing before it starts itself.
 *
 * High rather than a bare majority: two clips can be on screen at once
 * on a tall display, and the mute is shared — so the bar for "the reader
 * is looking at this one" has to be more than half a card.
 */
private const val AUTOPLAY_VISIBLE_FRACTION = 0.7f

/**
 * The pager's position, below the media and never over it.
 *
 * The row carries the position in words for a screen reader; the dots
 * themselves are decorative, which is why they are cleared from the tree
 * rather than announced one by one.
 */
@Composable
private fun PageDots(count: Int, current: Int, testTag: String?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = MediaFrame.DotRowTopPadding)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .clearAndSetSemantics {
                contentDescription = "Picture ${current + 1} of $count"
            },
        horizontalArrangement = Arrangement.spacedBy(MediaFrame.DotGap, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(count) { index ->
            Box(
                modifier = Modifier
                    .size(MediaFrame.Dot)
                    .clip(CircleShape)
                    .background(
                        if (index == current) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.outlineVariant
                        },
                    ),
            )
        }
    }
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
