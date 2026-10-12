package com.cogra.feature.content

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.core.designsystem.StancePadMode
import com.cogra.core.designsystem.v2.media.DETAIL_CLIP_TAG
import com.cogra.core.designsystem.v2.media.VIEWER_TAG
import com.cogra.core.designsystem.v2.media.VideoSound
import com.cogra.core.designsystem.v2.media.VideoStage
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.PostView
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * THE DETAIL CLIP, UN-PINNED (jakob's ruling 100 — design/readme.md §13, "The
 * clip detail rulings"; PostDetailVideo.md:3-63): the real [PostDetailScreen],
 * its detail clip, and [VideoStage]'s one player. One test per behavior line
 * that Android carries; the lines it does not yet carry are named at the foot.
 *
 * The phone is short on purpose, so the post is taller than the screen and
 * the page has somewhere to scroll.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h480dp")
class DetailClipTest {

    @get:Rule
    val compose = createComposeRule()

    private var orientation by mutableIntStateOf(Configuration.ORIENTATION_PORTRAIT)

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /** :3 — at the top of the detail, above the card, flush on it as one block. */
    @Test
    fun theClipStandsAboveTheCardFlushOnItAsOneBlock() {
        renderDetail(clipPost())

        val clip = compose.onNodeWithTag(DETAIL_CLIP_TAG).getUnclippedBoundsInRoot()
        val card = compose.onNode(isDetailCard()).getUnclippedBoundsInRoot()
        assertThat(card.top.value).isWithin(TOLERANCE).of(clip.bottom.value)
        compose.onNode(hasTestTag(DETAIL_CLIP_TAG) and hasAnyAncestor(hasTestTag(DETAIL_BLOCK_TAG)))
            .assertExists()
    }

    /** :5 — it scrolls with the page, never held on screen while the page moves. */
    @Test
    fun theClipScrollsWithThePage() {
        renderDetail(clipPost())
        compose.onNode(hasTestTag(DETAIL_CLIP_TAG) and hasAnyAncestor(hasTestTag("detail_list")))
            .assertExists()
        val before = compose.onNodeWithTag(DETAIL_CLIP_TAG).getUnclippedBoundsInRoot().top.value

        scrollPageBy(SCROLL_PX)

        val after = compose.onNodeWithTag(DETAIL_CLIP_TAG).getUnclippedBoundsInRoot().top.value
        assertThat(after).isLessThan(before)
    }

    /** :7 — opening the detail starts it; no share of the screen gates it. */
    @Test
    fun openingTheDetailStartsTheClipWithoutThe70PercentGate() {
        renderDetail(clipPost())

        assertThat(VideoStage.holding?.url).isEqualTo(CLIP)
        assertThat(VideoStage.holding?.owner).isNotNull()
        assertThat(VideoStage.holding?.player?.playWhenReady).isTrue()
    }

    /** :11 — scrolled out of view it plays on, and no mini-player takes its place. */
    @Test
    fun aClipScrolledAwayPlaysOnWithNoMiniPlayer() {
        renderDetail(clipPost())

        scrollPageBy(SCROLL_FAR_PX)

        // Still composed — the clip shares the card's row — so still the owner
        // of the one player, still playing.
        compose.onNodeWithTag("${DETAIL_CLIP_TAG}_video", useUnmergedTree = true).assertExists()
        assertThat(VideoStage.holding?.url).isEqualTo(CLIP)
        assertThat(VideoStage.holding?.owner).isNotNull()
        assertThat(VideoStage.holding?.player?.playWhenReady).isTrue()
        // One surface on the page: nothing floats in the clip's place.
        assertThat(compose.onAllNodesWithTag(SURFACE_TAG, useUnmergedTree = true).fetchSemanticsNodes())
            .hasSize(1)
    }

    /** :31 — the transport chrome stays up on Android. */
    @Test
    fun theTransportChromeStaysUpOnAndroid() {
        renderDetail(clipPost())

        compose.mainClock.advanceTimeBy(CHROME_WAIT_MS)
        compose.waitForIdle()

        compose.onNodeWithTag(TRANSPORT_TAG, useUnmergedTree = true).assertExists()
    }

    /** :63 — the phone turning to landscape over a landscape clip opens the viewer on it. */
    @Test
    fun thePhoneTurningToLandscapeOpensTheViewerOnALandscapeClip() {
        renderDetail(clipPost(aspectRatio = LANDSCAPE))
        compose.onNodeWithTag(VIEWER_TAG).assertDoesNotExist()

        orientation = Configuration.ORIENTATION_LANDSCAPE
        compose.waitForIdle()

        compose.onNodeWithTag(VIEWER_TAG).assertExists()
    }

    /** :63 'GIVEN the detail holds a landscape clip' — a portrait clip turns with the page. */
    @Test
    fun thePhoneTurningOverAPortraitClipOpensNothing() {
        renderDetail(clipPost())

        orientation = Configuration.ORIENTATION_LANDSCAPE
        compose.waitForIdle()

        compose.onNodeWithTag(VIEWER_TAG).assertDoesNotExist()
    }

    /** Nothing of a veiled clip plays (PostDetailVideoSensitive.md:3), the viewer included. */
    @Test
    fun thePhoneTurningOverAVeiledClipOpensNothing() {
        renderDetail(
            clipPost(aspectRatio = LANDSCAPE).copy(
                description = testModeratedField("Rubbings from three weekends at low tide."),
                attachmentsStatus = FieldStatus.SENSITIVE,
            ),
        )

        orientation = Configuration.ORIENTATION_LANDSCAPE
        compose.waitForIdle()

        compose.onNodeWithTag(VIEWER_TAG).assertDoesNotExist()
    }

    /**
     * :39/:43 — the comment count raises the comments sheet over the post and
     * the clip stops; the sheet's dismissal resumes it where it stopped.
     */
    @Test
    fun theCommentCountsSheetStopsTheClipAndItsDismissalResumesIt() {
        var dismiss: () -> Unit = {}
        renderDetail(clipPost(), commentsSheet = { onDismiss -> dismiss = onDismiss })
        val player = checkNotNull(VideoStage.holding?.player)

        compose.onNodeWithTag(COMMENTS_TAG, useUnmergedTree = true).press()
        compose.waitForIdle()
        assertThat(player.playWhenReady).isFalse()

        compose.runOnIdle { dismiss() }
        compose.waitForIdle()

        assertThat(player.playWhenReady).isTrue()
    }

    /**
     * :49/:51 — the opinion pad over the post pauses the clip, and its closing
     * resumes it. The real stance control in the card's row, opened by its tap
     * (#154: a tap opens the pad); the control announces the pad itself.
     */
    @Test
    fun theOpinionPadOverThePostPausesTheClipAndItsClosingResumesIt() {
        var pad by mutableStateOf(StancePadMode.CLOSED)
        renderDetail(clipPost(), stanceControl = { node ->
            StanceControl(
                state = StanceControlState(pad = pad),
                onHoldDefault = {},
                onOpenPad = { pad = StancePadMode.STICKY },
                onPick = {},
                onCommit = {},
                onDismissPad = { pad = StancePadMode.CLOSED },
                onToggleExactValues = {},
                onOpenSeverance = {},
                onConfirmSeverance = {},
                onDismissSeverance = {},
                onConfirmationShown = {},
                testTagPrefix = "detail_post",
                node = node,
            )
        })
        val player = checkNotNull(VideoStage.holding?.player)

        compose.onNodeWithTag(STANCE_ANCHOR_TAG, useUnmergedTree = true).press()
        compose.waitForIdle()
        assertThat(pad).isEqualTo(StancePadMode.STICKY)
        assertThat(player.playWhenReady).isFalse()

        compose.runOnIdle { pad = StancePadMode.CLOSED }
        compose.waitForIdle()

        assertThat(player.playWhenReady).isTrue()
    }

    /**
     * :41/:43 — the platform's share sheet is a sheet over the post: the share
     * stops the clip, and the screen resumed — the chooser gone — resumes it.
     */
    @Test
    fun theShareSheetStopsTheClipUntilTheScreenIsResumed() {
        val screen = ScreenLifecycle()
        var shared: String? = null
        renderDetail(clipPost(), lifecycle = screen, onShare = { shared = it })
        val player = checkNotNull(VideoStage.holding?.player)

        compose.onNodeWithTag(SHARE_TAG, useUnmergedTree = true).press()
        compose.waitForIdle()
        assertThat(shared).isEqualTo(POST)
        assertThat(player.playWhenReady).isFalse()

        // The chooser takes the foreground and gives it back.
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.STARTED }
        compose.waitForIdle()
        assertThat(player.playWhenReady).isFalse()
        compose.runOnIdle { screen.registry.currentState = Lifecycle.State.RESUMED }
        compose.waitForIdle()

        assertThat(player.playWhenReady).isTrue()
    }

    /**
     * A press through the control's own click action: the short phone puts
     * the card's row below the fold, where an injected touch lands nowhere.
     */
    private fun SemanticsNodeInteraction.press() {
        performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()
    }

    private fun scrollPageBy(px: Float) {
        compose.onNodeWithTag("detail_list").performSemanticsAction(SemanticsActions.ScrollBy) { scroll ->
            scroll(0f, px)
        }
        compose.waitForIdle()
    }

    private fun renderDetail(
        post: PostView,
        commentsSheet: @Composable (onDismiss: () -> Unit) -> Unit = {},
        stanceControl: @Composable (node: DataNode?) -> Unit = {},
        onShare: (String) -> Unit = {},
        lifecycle: LifecycleOwner? = null,
    ) {
        compose.setContent {
            // The device's own configuration, with the orientation this test
            // turns — the detail reads the turn through `LocalConfiguration`.
            val device = LocalConfiguration.current
            val turned = Configuration(device).apply { this.orientation = this@DetailClipTest.orientation }
            CompositionLocalProvider(
                LocalConfiguration provides turned,
                LocalLifecycleOwner provides (lifecycle ?: LocalLifecycleOwner.current),
            ) {
                PostDetailScreen(
                    state = PostDetailUiState(loading = false, post = post),
                    viewerId = null,
                    onRefresh = {},
                    onReveal = { _, _ -> },
                    onEdit = {},
                    onOpenActor = {},
                    onOpenPost = {},
                    onOpenTopic = {},
                    onReference = {},
                    onShare = onShare,
                    onBack = {},
                    stanceControl = { _, _, node -> stanceControl(node) },
                    commentsSheet = commentsSheet,
                )
            }
        }
        compose.waitForIdle()
    }

    /**
     * The detail destination's own lifecycle, held at RESUMED and moved by
     * hand — `createUnsafe` is the registry's documented testing constructor.
     */
    private class ScreenLifecycle : LifecycleOwner {
        val registry: LifecycleRegistry = LifecycleRegistry.createUnsafe(this).apply {
            currentState = Lifecycle.State.RESUMED
        }

        override val lifecycle: Lifecycle get() = registry
    }

    private fun clipPost(aspectRatio: Float = PORTRAIT): PostView = testPost(POST).copy(
        content = testModeratedField(null),
        attachments = listOf(
            MediaAssetView(
                id = "m1",
                url = CLIP,
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = aspectRatio,
                mimeType = "video/mp4",
                durationMs = 41_000,
            ),
        ),
    )

    private companion object {
        const val POST = "p1"
        const val CLIP = "https://example.invalid/clip.mp4"
        const val TRANSPORT_TAG = "video_transport"
        const val COMMENTS_TAG = "postDetail.card.actionRow.comments"
        const val SHARE_TAG = "postDetail.card.actionRow.share"
        const val STANCE_ANCHOR_TAG = "postDetail.card.actionRow.stance.anchor"
        const val SURFACE_TAG = "video_surface"
        const val PORTRAIT = 0.5625f
        const val LANDSCAPE = 16f / 9f
        const val SCROLL_PX = 120f
        const val SCROLL_FAR_PX = 5_000f
        const val CHROME_WAIT_MS = 10_000L
        const val TOLERANCE = 1f
    }
}
