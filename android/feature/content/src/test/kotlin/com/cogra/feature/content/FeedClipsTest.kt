package com.cogra.feature.content

import androidx.compose.foundation.lazy.LazyListItemInfo
import androidx.compose.foundation.lazy.LazyListLayoutInfo
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.PostView
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * What the feed tells the stage to read ahead: its clips in the order the
 * reader meets them, and which one the reader is at.
 */
class FeedClipsTest {

    @Test
    fun aPostContributesTheClipItsCardLeadsWith() {
        val clips = FeedClips.of(listOf(words(0), video(1), picture(2), video(3)))

        assertThat(clips.urls).containsExactly(clipOf(1), clipOf(3)).inOrder()
    }

    @Test
    fun aRemovedBodyPlaysNothingAndPreloadsNothing() {
        val removed = video(1).copy(attachmentsStatus = FieldStatus.REDACTED)

        assertThat(FeedClips.of(listOf(removed, video(2))).urls).containsExactly(clipOf(2))
    }

    /**
     * PRELOADING STAYS ON under the veil (jakob 2026-09-24, backlog item 103):
     * invisible, it leaks nothing the veil hides, and it makes the unveil
     * instant. The veil takes the clip off the stage, never off this list.
     */
    @Test
    fun aVeiledClipIsStillPreloaded() {
        val veiled = video(1).copy(attachmentsStatus = FieldStatus.SENSITIVE)

        assertThat(FeedClips.of(listOf(veiled, video(2))).urls).containsExactly(clipOf(1), clipOf(2)).inOrder()
    }

    @Test
    fun aClipSeenTwiceIsListedWhereTheReaderFirstMeetsIt() {
        val again = video(4).copy(attachments = video(1).attachments)

        assertThat(FeedClips.of(listOf(video(1), words(2), again)).urls).containsExactly(clipOf(1))
    }

    @Test
    fun theFocusedPostIsTheOneAcrossTheMiddle() {
        val rows = listOf(row("p0", top = -300, size = 400), row("p1", top = 110, size = 600))

        assertThat(focusedPost(rows, middle = 300, postIndex = ::indexOfPost)).isEqualTo(1)
    }

    @Test
    fun aMiddleInTheSeamBetweenCardsFallsToTheOneBelow() {
        val rows = listOf(row("p0", top = 0, size = 296), row("p1", top = 304, size = 400))

        assertThat(focusedPost(rows, middle = 300, postIndex = ::indexOfPost)).isEqualTo(1)
    }

    @Test
    fun rowsThatAreNotPostsDoNotCount() {
        val rows = listOf(row("feed_banners", top = 0, size = 900), row("p0", top = 908, size = 400))

        assertThat(focusedPost(rows, middle = 300, postIndex = ::indexOfPost)).isEqualTo(0)
    }

    @Test
    fun pastTheLastVisiblePostTheFocusIsTheNextOne() {
        val rows = listOf(row("p6", top = -500, size = 400), row("tail", top = -92, size = 900))

        assertThat(focusedPost(rows, middle = 300, postIndex = ::indexOfPost)).isEqualTo(7)
    }

    @Test
    fun withNoPostOnScreenTheFocusIsTheTop() {
        assertThat(focusedPost(listOf(row("feed_banners", 0, 900)), middle = 300, postIndex = ::indexOfPost))
            .isEqualTo(0)
    }

    @Test
    fun theFocusedClipIsTheFirstAtOrBelowTheFocusedPost() {
        val clipPosts = listOf(1, 3, 8)

        assertThat(focusedClip(clipPosts, focusedPost = 0)).isEqualTo(0)
        assertThat(focusedClip(clipPosts, focusedPost = 1)).isEqualTo(0)
        assertThat(focusedClip(clipPosts, focusedPost = 2)).isEqualTo(1)
        assertThat(focusedClip(clipPosts, focusedPost = 8)).isEqualTo(2)
    }

    @Test
    fun pastTheLastClipEveryClipIsBehindTheReader() {
        assertThat(focusedClip(listOf(1, 3), focusedPost = 4)).isEqualTo(2)
    }

    @Test
    fun theFeedReadsItsFocusOffTheLayout() {
        // A words post across the middle: the reader's clip is the next one
        // down, the second in the list.
        val clips = FeedClips.of(listOf(video(0), words(1), words(2), video(3)))
        val layout = Layout(
            listOf(
                row("p0", top = -500, size = 600),
                row("p1", top = 108, size = 400),
                row("p2", top = 516, size = 400),
            ),
        )

        assertThat(clips.focus(layout)).isEqualTo(1)
    }

    private fun indexOfPost(key: Any): Int? = (key as? String)?.takeIf { it.startsWith("p") }?.drop(1)?.toIntOrNull()

    private fun clipOf(index: Int) = "https://example.invalid/$index.mp4"

    private fun words(index: Int): PostView = testPost("p$index")

    private fun picture(index: Int): PostView = testPost("p$index").copy(
        content = testModeratedField(null),
        attachments = listOf(asset(index, "https://example.invalid/$index.jpg", "image/jpeg")),
    )

    private fun video(index: Int): PostView = testPost("p$index").copy(
        content = testModeratedField(null),
        attachments = listOf(asset(index, clipOf(index), "video/mp4").copy(durationMs = 5_000)),
    )

    private fun asset(index: Int, url: String, mimeType: String) = MediaAssetView(
        id = "asset-$index",
        url = url,
        altText = null,
        status = FieldStatus.NORMAL,
        aspectRatio = 1f,
        mimeType = mimeType,
    )

    private fun row(key: String, top: Int, size: Int): LazyListItemInfo = Row(key, top, size)

    private data class Row(override val key: Any, override val offset: Int, override val size: Int) : LazyListItemInfo {
        override val index: Int = 0
    }

    /** A viewport 600 px tall, so its middle is 300. */
    private class Layout(override val visibleItemsInfo: List<LazyListItemInfo>) : LazyListLayoutInfo {
        override val viewportStartOffset: Int = 0
        override val viewportEndOffset: Int = 600
        override val totalItemsCount: Int = visibleItemsInfo.size
    }
}
