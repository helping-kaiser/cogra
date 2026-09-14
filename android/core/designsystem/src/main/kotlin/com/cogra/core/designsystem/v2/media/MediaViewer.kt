package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.util.UnstableApi
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.token.MediaOverlay

/**
 * The fullscreen media viewer (`design/components/media/MediaViewer.jsx`;
 * boards `ViewerPicture`, `ViewerVideo`, `ViewerLandscape`). DV-01 / H-25.
 *
 * **It is the whole surface, on black, with nothing behind it** (`:12-14`) —
 * "not a scrim over the post: a viewer you can still read a card through is not
 * full screen, and the ground has to be black so the frame's own edges are the
 * only edges". It is a `Dialog` with `usePlatformDefaultWidth = false`, which
 * is how Compose says "this window is the screen" rather than a card centred in
 * it (developer.android.com/develop/ui/compose/components/dialog), and it is a
 * dialog rather than a destination because **it never changes the underlying
 * route** (`:26`): the post is still the page the reader is on.
 *
 * **The frame is never cut here** (`:15-17`). `ContentScale.Fit`, centred, as
 * large as the surface allows — "a viewer that crops is not a viewer. This is
 * the surface the feed card's 4:5 clamp exists against: whatever a card crops,
 * the viewer restores." `ViewerLandscape.jsx:5-9` states the same rule for the
 * rotated case: a 16:9 clip fills the height and leaves ground at the sides.
 *
 * **It is a place you back out of** (`:25-29`): an X, a swipe DOWN, the system
 * back gesture, and the ground around the frame all close it. "The X rather
 * than a back arrow, because the reader is dismissing a layer, not walking a
 * step of a journey."
 *
 * **A picture pinch-zooms, and the gallery's swipe carries over** (`:30-34`):
 * the set pages here exactly as in the card, dots and all — dots only, no
 * arrows, the row windowed at seven ([PagerDots], item 67), and the count in
 * the accessible name rather than on the frame.
 *
 * **A video takes the full transport** (`:39-41`), the ladder's third rung,
 * with the same stop-at-end grammar the detail's pinned clip has. Rotating the
 * device fills the screen with it: rotation is the device's own gesture, so
 * there is no rotate control to draw, and the dialog follows the window.
 *
 * **No acts and no description** (`:42-47`). Acting on a post happens where the
 * post is, and alt text is written for people who cannot see the frame.
 *
 * @param index which attachment the viewer OPENS on. The pager owns the
 *   position from then on.
 */
@UnstableApi
@Composable
fun MediaViewer(
    items: List<MediaItem>,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    index: Int = 0,
    testTag: String = VIEWER_TAG,
) {
    if (items.isEmpty()) return
    val start = index.coerceIn(0, items.size - 1)
    val pagerState = rememberPagerState(initialPage = start) { items.size }

    Dialog(
        // THE SYSTEM BACK CLOSES IT, which is the platform's own way out of a
        // layer and the reason there is no back arrow drawn.
        onDismissRequest = onClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            // The viewer IS the screen: the window draws under the system bars
            // so the black ground reaches the edges, which is what makes the
            // frame's own edges the only ones on the surface.
            decorFitsSystemWindows = false,
        ),
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black)
                .testTag(testTag)
                // THE GROUND AROUND THE FRAME CLOSES IT (graph.json,
                // `ViewerPicture` via 3). No ripple and no indication: this is
                // a backdrop, not a button, and a ripple on the whole screen
                // would say otherwise.
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onClose,
                ),
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize().testTag("${testTag}_pager"),
            ) { page ->
                ViewerStage(
                    item = items[page],
                    onClose = onClose,
                    testTag = testTag,
                )
            }

            // THE DOT ROW, windowed at seven and in the viewer's tone (item
            // 67), held clear of the gesture zone the transport's bar also
            // respects. A post carries ten pictures OR one video, so the row
            // and the transport's bar never share the strip.
            PagerDots(
                count = items.size,
                current = pagerState.currentPage,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(bottom = GESTURE_ZONE),
                tone = DotTone.Viewer,
                testTag = "${testTag}_dots",
            )

            // THE WAY OUT. Top-left, over the frame: the chrome belongs to the
            // surface, not to the picture (`MediaViewer.jsx:167-168`).
            CloseButton(
                onClose = onClose,
                modifier = Modifier.align(Alignment.TopStart).padding(CHROME_INSET),
                testTag = "${testTag}_close",
            )
        }
    }
}

/**
 * One item on the black ground, with the viewer's gestures over it.
 *
 * The zoom lives here rather than on the viewer, so it belongs to the picture
 * being looked at: paging away and back gives the next frame whole, which is
 * what the reader asked for by swiping.
 */
@UnstableApi
@Composable
private fun ViewerStage(item: MediaItem, onClose: () -> Unit, testTag: String) {
    var zoom by remember { mutableFloatStateOf(MIN_ZOOM) }
    var pan by remember { mutableStateOf(Offset.Zero) }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        val videoUrl = item.videoUrl
        if (videoUrl != null) {
            // THE LADDER'S THIRD RUNG. The stage hands the clip over by URL, so
            // opening the viewer on a clip the detail was already playing
            // continues it on the same decoder rather than starting a second —
            // and the transport it wears is the same component, with the same
            // stop-at-end grammar.
            VideoPlayer(
                url = videoUrl,
                posterUrl = item.imageModel(),
                autoplay = true,
                durationMs = item.durationMs,
                controls = VideoControls.Full,
                // THE FRAME IS NEVER CUT HERE. `Fit`, not the card's `Crop`:
                // the viewer's one promise is that nothing is lost.
                contentScale = ContentScale.Fit,
                // The clip's OWN ratio, uncapped — the 4:5 clamp is a card's
                // law and this is the surface it exists against.
                videoAspectRatio = item.aspectRatio,
                contentDescription = item.altText,
                modifier = Modifier.fillMaxSize(),
                testTag = "${testTag}_video",
            )
        } else {
            AsyncImage(
                model = item.imageModel(),
                contentDescription = item.altText,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .testTag("${testTag}_picture")
                    .graphicsLayer {
                        scaleX = zoom
                        scaleY = zoom
                        translationX = pan.x
                        translationY = pan.y
                    }
                    // A PICTURE PINCH-ZOOMS (`MediaViewer.jsx:30`).
                    // `detectTransformGestures` is Compose's own multitouch
                    // recogniser, and taking the zoom from it rather than from
                    // raw pointers is what keeps it consuming the gesture the
                    // pager would otherwise read as a swipe.
                    .pointerInput(item) {
                        detectTransformGestures { _, drag, gestureZoom, _ ->
                            val next = (zoom * gestureZoom).coerceIn(MIN_ZOOM, MAX_ZOOM)
                            zoom = next
                            pan = if (next == MIN_ZOOM) {
                                // Whole again: there is nothing left to be
                                // panned off-centre, so the offset goes with
                                // the magnification rather than being stranded.
                                Offset.Zero
                            } else {
                                // ZOOMED IN, THE DRAG MOVES THE PICTURE. At
                                // rest it belongs to the pager and to the
                                // dismiss, which is why the offset only
                                // accumulates past 1.
                                pan + drag
                            }
                        }
                    }
                    // THE SWIPE DOWN DISMISSES (`:25-29`). Down only: up is the
                    // scroller's gesture and this surface does not scroll. It
                    // is read from the frame at rest, so a pan inside a
                    // magnified picture is never taken for a way out.
                    .pointerInput(item) {
                        detectVerticalDragGestures { _, delta ->
                            if (zoom == MIN_ZOOM && delta > DISMISS_DRAG) onClose()
                        }
                    },
            )
        }
    }
}

@Composable
private fun CloseButton(onClose: () -> Unit, modifier: Modifier, testTag: String) {
    val label = stringResource(R.string.designsystem_viewer_close)
    Box(
        modifier = modifier
            .size(TOUCH_TARGET_MIN)
            .clip(CircleShape)
            .clickable(onClick = onClose)
            .semantics { contentDescription = label }
            .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
        )
    }
}

const val VIEWER_TAG = "media_viewer"

/** `padding: "8px"` around the X (`MediaViewer.jsx:175`). */
private val CHROME_INSET = 8.dp

/** `var(--touch-target-min)` (`:187-188`). */
private val TOUCH_TARGET_MIN = 48.dp

/** One is the frame whole — the viewer's own promise — and four is far enough
 * to read a face in a group shot without turning the picture into pixels. */
private const val MIN_ZOOM = 1f
private const val MAX_ZOOM = 4f

/** How far a drag has to travel downward before it is a dismiss rather than a
 * stray touch. Read per drag event, so it is a rate rather than a distance:
 * Compose reports the delta since the last frame and a deliberate flick clears
 * this comfortably while a resting thumb never does. */
private const val DISMISS_DRAG = 40f
