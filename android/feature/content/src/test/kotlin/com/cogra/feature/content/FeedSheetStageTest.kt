package com.cogra.feature.content

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.media.VideoSound
import com.cogra.core.designsystem.v2.media.VideoStage
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.PostView
import com.cogra.domain.testing.testComment
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
 * THE THREAD RAISED OVER A PLAYING FEED, end to end: the real [FeedScreen]
 * with its stage, the real [CommentsSheet] in its own window with its own,
 * and [VideoStage]'s one player between them.
 *
 * A sheet over a surface suspends that surface's stage (jakob 2026-09-24,
 * `design/readme.md`, "The feed-video rulings"). `SheetOverStageTest`
 * (core:designsystem) pins the suspension on two bare hosts; this pins that
 * the feed hands its host the thread's open state.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
// A phone-sized window, so the feed's first clip stands past the 70% gate.
@Config(qualifiers = "w411dp-h891dp")
class FeedSheetStageTest {

    @get:Rule
    val compose = createComposeRule()

    private var dismissThread: () -> Unit = {}

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /**
     * The raised thread suspends the feed's stage (jakob 2026-09-24), and the
     * thread's own stage gives its clip the player.
     */
    @Test
    fun raisingTheThreadStopsTheFeedClipAndTheThreadsClipPlays() {
        renderFeed(thread = listOf(clipComment()))
        assertHolds(POST_CLIP)

        openThread()

        assertHolds(COMMENT_CLIP)
    }

    /** A thread with nothing to play still stops the card under it. */
    @Test
    fun aThreadWithoutClipsStillStopsTheFeedClip() {
        renderFeed(thread = listOf(testComment("c1")))

        openThread()

        assertThat(VideoStage.holding?.url).isEqualTo(POST_CLIP)
        assertThat(VideoStage.holding?.owner).isNull()
        assertThat(VideoStage.holding?.player?.playWhenReady).isFalse()
    }

    /** The thread drops, and the card under it takes the player back at once. */
    @Test
    fun droppingTheThreadHandsTheFeedClipThePlayerBack() {
        renderFeed(thread = listOf(clipComment()))
        openThread()

        closeThread()

        assertHolds(POST_CLIP)
    }

    private fun renderFeed(thread: List<CommentView>) {
        compose.setContent {
            FeedScreen(
                state = FeedUiState(loading = false, posts = listOf(clipPost())),
                onRefresh = {},
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
                commentsSheet = { _, onDismiss ->
                    dismissThread = onDismiss
                    CommentsSheet(
                        state = CommentsUiState(loading = false, comments = thread),
                        viewerId = null,
                        signedIn = true,
                        onDismiss = onDismiss,
                        onLoadMoreComments = {},
                        onAddComment = {},
                        onReplyTo = {},
                        onEditComment = {},
                        onCommentSignedShown = {},
                        onLoadMoreReplies = {},
                        onReveal = { _, _ -> },
                        onOpenActor = {},
                        onOpenTopic = {},
                        onReference = {},
                        onLicense = {},
                        onSignInOrJoin = {},
                    )
                },
            )
        }
        compose.waitForIdle()
    }

    /** Through the card's own count, the way a reader raises it. */
    private fun openThread() {
        compose.onNodeWithTag("feed_post_${POST}_comments").performClick()
        compose.waitForIdle()
    }

    /** The sheet's own dismissal — a swipe down or the scrim, as the feed hears it. */
    private fun closeThread() {
        compose.runOnIdle { dismissThread() }
        compose.waitForIdle()
    }

    private fun assertHolds(url: String) {
        assertThat(VideoStage.holding?.url).isEqualTo(url)
        assertThat(VideoStage.holding?.owner).isNotNull()
    }

    private fun clipPost(): PostView = testPost(POST).copy(
        content = testModeratedField(null),
        attachments = listOf(clip("post-asset", POST_CLIP)),
    )

    /** A comment is words plus media, never instead of them (D16). */
    private fun clipComment(): CommentView =
        testComment("c1").copy(attachments = listOf(clip("comment-asset", COMMENT_CLIP)))

    private fun clip(id: String, url: String) = MediaAssetView(
        id = id,
        url = url,
        altText = null,
        status = FieldStatus.NORMAL,
        aspectRatio = 1f,
        mimeType = "video/mp4",
        durationMs = 5_000,
    )

    private companion object {
        const val POST = "p1"
        const val POST_CLIP = "https://example.invalid/post.mp4"
        const val COMMENT_CLIP = "https://example.invalid/comment.mp4"
    }
}
