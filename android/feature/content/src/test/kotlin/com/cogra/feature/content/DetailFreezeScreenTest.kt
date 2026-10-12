package com.cogra.feature.content

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.media3.common.util.UnstableApi
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
import java.time.Instant

/**
 * THE DETAIL HOLDS WHAT WAS OPENED (PostDetail.md:5-15), on the real
 * [PostDetailScreen]: the newer-version line, its place in the page, the swap
 * in place, a redaction patching through, and the detail clip's one player
 * across all three (#146's carry, #150's DetailClip).
 *
 * The phone is short on purpose, so a clip post is taller than the screen and the
 * page has somewhere to scroll.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h480dp")
class DetailFreezeScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var state by mutableStateOf(PostDetailUiState(loading = false))

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /** :7 — the line, verbatim, between the header and the card; the card unchanged. */
    @Test
    fun anEditFoundOnRefreshHoldsTheSnapshotAndOffersTheNewVersion() {
        render(opened(), newer = edited(opened()))

        compose.onNodeWithTag(LINE).assertTextEquals(WORDS)
        compose.onNodeWithTag(TITLE).assertTextEquals("Title $POST")
        val line = compose.onNodeWithTag(LINE).getUnclippedBoundsInRoot()
        val card = compose.onNode(isDetailCard()).getUnclippedBoundsInRoot()
        assertThat(line.bottom.value).isAtMost(card.top.value)
    }

    @Test
    fun noLineStandsWhileNothingNewerWasFound() {
        render(opened())
        compose.onNodeWithTag(LINE).assertDoesNotExist()
    }

    /** :11 — in the page's flow and scrolling with it, full width, a 48dp target. */
    @Test
    fun theNewerVersionLineStandsInFlowAndIsNeverPinned() {
        // A clip post: its 9:16 frame alone is taller than this phone.
        render(clipPost(), newer = edited(clipPost()))
        compose.onNode(hasTestTag(LINE) and hasAnyAncestor(hasTestTag("detail_list"))).assertExists()

        val line = compose.onNodeWithTag(LINE).getUnclippedBoundsInRoot()
        val root = compose.onRoot().getUnclippedBoundsInRoot()
        assertThat(line.right.value - line.left.value).isWithin(TOLERANCE).of(root.right.value - root.left.value)
        assertThat(line.bottom.value - line.top.value).isAtLeast(TOUCH_TARGET_DP)

        compose.onNodeWithTag("detail_list").performSemanticsAction(SemanticsActions.ScrollBy) { scroll ->
            scroll(0f, SCROLL_PX)
        }
        compose.waitForIdle()
        assertThat(compose.onNodeWithTag(LINE).getUnclippedBoundsInRoot().top.value).isLessThan(line.top.value)
    }

    /** :13 — the tap swaps the newest in place and the line goes. */
    @Test
    fun tappingTheLineSwapsTheNewestPostTagsAndCitationsInPlace() {
        render(opened(), newer = edited(opened()))

        compose.onNodeWithTag(LINE).performClick()
        compose.waitForIdle()

        compose.onNodeWithTag(TITLE).assertTextEquals(EDITED_TITLE)
        compose.onNodeWithTag(LINE).assertDoesNotExist()
    }

    /** #146/#150 — neither the line arriving nor the swap remounts the detail clip. */
    @Test
    fun theDetailClipKeepsItsOnePlayerThroughTheLineAndTheSwap() {
        val clip = clipPost()
        render(clip)
        val player = VideoStage.holding?.player
        val owner = VideoStage.holding?.owner
        assertThat(owner).isNotNull()

        state = state.copy(newer = edited(clip))
        compose.waitForIdle()
        compose.onNodeWithTag(LINE).performClick()
        compose.waitForIdle()

        compose.onNodeWithTag(TITLE).assertTextEquals(EDITED_TITLE)
        assertThat(VideoStage.holding?.player).isSameInstanceAs(player)
        assertThat(VideoStage.holding?.owner).isSameInstanceAs(owner)
        assertThat(VideoStage.holding?.player?.playWhenReady).isTrue()
    }

    /** :15 — a redaction that removes the clip lets the clip go: it surrenders the stage. */
    @Test
    fun aRedactionThatRemovesTheClipLetsTheDetailClipGo() {
        val clip = clipPost()
        render(clip)
        assertThat(VideoStage.holding?.owner).isNotNull()

        val removed = edited(clip).copy(attachmentsStatus = FieldStatus.REDACTED)
        state = state.copy(post = removed, newer = null)
        compose.waitForIdle()

        compose.onNodeWithTag(LINE).assertDoesNotExist()
        assertThat(VideoStage.holding?.owner).isNull()
        assertThat(VideoStage.holding?.player?.playWhenReady).isFalse()
    }

    private fun render(post: PostView, newer: PostView? = null) {
        state = PostDetailUiState(loading = false, post = post, newer = newer)
        compose.setContent {
            PostDetailScreen(
                state = state,
                viewerId = null,
                onRefresh = {},
                onReveal = { _, _ -> },
                onEdit = {},
                onSwapToNewer = { state.newer?.let { state = state.copy(post = it, newer = null) } },
                onOpenActor = {},
                onOpenPost = {},
                onOpenTopic = {},
                onReference = {},
                onShare = {},
                onBack = {},
            )
        }
        compose.waitForIdle()
    }

    private fun opened(): PostView = testPost(POST)

    private fun edited(post: PostView): PostView =
        post.copy(title = testModeratedField(EDITED_TITLE), updatedAt = Instant.ofEpochSecond(EDITED_AT))

    private fun clipPost(): PostView = testPost(POST).copy(
        content = testModeratedField(null),
        attachments = listOf(
            MediaAssetView(
                id = "m1",
                url = CLIP,
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = PORTRAIT,
                mimeType = "video/mp4",
                durationMs = 41_000,
            ),
        ),
    )

    private companion object {
        const val POST = "p1"
        const val LINE = "postDetail.newerVersion"
        const val TITLE = "postDetail.card.title"
        const val WORDS = "Edited since you opened it — tap for the newest version."
        const val EDITED_TITLE = "Edited title"
        const val EDITED_AT = 3_600L
        const val CLIP = "https://example.invalid/clip.mp4"
        const val PORTRAIT = 0.5625f
        const val SCROLL_PX = 120f
        const val TOUCH_TARGET_DP = 48f
        const val TOLERANCE = 1f
    }
}
