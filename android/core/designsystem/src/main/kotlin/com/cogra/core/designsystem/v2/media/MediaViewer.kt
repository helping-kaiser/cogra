package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
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
import net.engawapg.lib.zoomable.ScrollGesturePropagation
import net.engawapg.lib.zoomable.rememberZoomState
import net.engawapg.lib.zoomable.zoomable

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
 * **The black reaches the edges; the chrome does not** (jakob 2026-09-15, hand
 * test). The window draws under the system bars so the ground is edge to edge,
 * and everything the reader has to *press* is then placed inside
 * [WindowInsets.safeDrawing] — the X was landing behind the status bar's clock,
 * which is a way out nobody can reach. Insets rather than a drawn offset because
 * the size of the bars is the device's answer, not a number a board can hold
 * (developer.android.com/develop/ui/compose/layouts/insets).
 *
 * **A tap is not a way out** (jakob 2026-09-15, hand test; the behaviour web
 * already had). A tap on the surface toggles the clip's chrome and nothing
 * else; the viewer closes by the X, by a swipe DOWN, or by the system back
 * gesture. Tapping to collapse made every reach for a control a dismissal.
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
 * @param insets the system's own safe area. Null asks the window, which is what
 *   every real caller wants; it is a parameter at all so a test can state an
 *   inset and check the chrome moved off the bars without a device. It is read
 *   INSIDE the dialog deliberately — the dialog is its own window, and the
 *   screen that opened the viewer has usually consumed its insets already.
 */
@UnstableApi
@Composable
fun MediaViewer(
    items: List<MediaItem>,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    index: Int = 0,
    insets: WindowInsets? = null,
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
            // frame's own edges the only ones on the surface. What that costs
            // is the chrome's placement, and `safeArea` below is what pays it.
            decorFitsSystemWindows = false,
        ),
    ) {
        val safeArea = (insets ?: WindowInsets.safeDrawing).asPaddingValues()
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black)
                .testTag(testTag),
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize().testTag("${testTag}_pager"),
            ) { page ->
                ViewerStage(
                    item = items[page],
                    onClose = onClose,
                    safeArea = safeArea,
                    testTag = testTag,
                )
            }

            // THE DOT ROW, windowed at seven and in the viewer's tone (item
            // 67), held clear of the gesture zone the transport's bar also
            // respects — and of the navigation bar under it. A post carries ten
            // pictures OR one video, so the row and the transport's bar never
            // share the strip.
            PagerDots(
                count = items.size,
                current = pagerState.currentPage,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(bottom = GESTURE_ZONE + safeArea.calculateBottomPadding()),
                tone = DotTone.Viewer,
                testTag = "${testTag}_dots",
            )

            // THE WAY OUT. Top-left, over the frame: the chrome belongs to the
            // surface, not to the picture (`MediaViewer.jsx:167-168`) — and
            // inside the safe area, because the only control that closes the
            // viewer cannot sit behind the clock.
            CloseButton(
                onClose = onClose,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(
                        top = safeArea.calculateTopPadding() + CHROME_INSET,
                        start = safeArea.calculateStartPadding(LocalLayoutDirection.current) +
                            CHROME_INSET,
                    ),
                testTag = "${testTag}_close",
            )
        }
    }
}

/**
 * One item on the black ground, with the viewer's gestures over it.
 *
 * **The zoom is the library's, not ours** (jakob's standing law, 2026-09-15:
 * "we don't re-invent the wheel with the UX, gestures and known motions… we
 * should use what the open-sources already have"). `Modifier.zoomable` carries
 * pinch, double-tap, one-finger zoom, the fling and the pan bounds, and —
 * the part hand-rolled code kept getting wrong — it decides when a drag is the
 * picture's and when it belongs to the pager underneath
 * ([ScrollGesturePropagation]).
 *
 * `detectTransformGestures` was what broke both: it consumes a one-finger drag
 * as a pan whatever the zoom, so the pager never saw a swipe at all, while a
 * slow two-finger drag still leaked one through mid-zoom.
 *
 * The zoom state lives per page rather than on the viewer, so paging away and
 * back gives the next frame whole, which is what the reader asked for by
 * swiping.
 */
@UnstableApi
@Composable
private fun ViewerStage(
    item: MediaItem,
    onClose: () -> Unit,
    safeArea: PaddingValues,
    testTag: String,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            // THE SWIPE DOWN DISMISSES (`:25-29`). Down only: up is the
            // scroller's gesture and this surface does not scroll. It sits on
            // the stage rather than on the frame so it reads the drags the
            // zoom PROPAGATES — which is exactly the drags made at rest, so a
            // pan inside a magnified picture is never taken for a way out.
            .pointerInput(item) {
                detectVerticalDragGestures { _, delta ->
                    if (delta > DISMISS_DRAG) onClose()
                }
            },
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
                // The transport here IS at the screen's edges, so its bar takes
                // the same safe area the X and the dots do.
                chromeInsets = safeArea,
                modifier = Modifier.fillMaxSize(),
                testTag = "${testTag}_video",
            )
        } else {
            val zoomState = rememberZoomState(maxScale = MAX_ZOOM)
            AsyncImage(
                model = item.imageModel(),
                contentDescription = item.altText,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .testTag("${testTag}_picture")
                    // A PICTURE PINCH-ZOOMS (`MediaViewer.jsx:30`), AND THE
                    // GALLERY'S SWIPE CARRIES OVER (`:30-31`).
                    //
                    // `NotZoomed` is the whole of that sentence in one
                    // argument: at rest the drag is propagated, so the pager
                    // pages and the swipe down dismisses; magnified, the
                    // gesture is the picture's exclusively and no page can turn
                    // under the reader's fingers.
                    .zoomable(
                        zoomState = zoomState,
                        scrollGesturePropagation = ScrollGesturePropagation.NotZoomed,
                    ),
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

/** `padding: "8px"` around the X (`MediaViewer.jsx:175`), on top of whatever
 * the device's own bars take. */
private val CHROME_INSET = 8.dp

/** `var(--touch-target-min)` (`:187-188`), which is also Material's floor —
 * "touch targets should be at least 48 x 48 dp"
 * (developer.android.com/develop/ui/compose/accessibility). Controls drawn
 * smaller than this take `minimumInteractiveComponentSize` instead, which grows
 * the target without growing the glyph. */
private val TOUCH_TARGET_MIN = 48.dp

/** Four is far enough to read a face in a group shot without turning the
 * picture into pixels; one — the frame whole, the viewer's own promise — is the
 * zoom's own floor. */
private const val MAX_ZOOM = 4f

/** How far a drag has to travel downward before it is a dismiss rather than a
 * stray touch. Read per drag event, so it is a rate rather than a distance:
 * Compose reports the delta since the last frame and a deliberate flick clears
 * this comfortably while a resting thumb never does. */
private const val DISMISS_DRAG = 40f
