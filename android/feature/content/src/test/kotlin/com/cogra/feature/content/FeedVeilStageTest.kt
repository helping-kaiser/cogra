package com.cogra.feature.content

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.media.VideoSound
import com.cogra.core.designsystem.v2.media.VideoStage
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
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
 * A SENSITIVE CLIP IN THE FEED, end to end: the real [FeedScreen], its stage,
 * and [VideoStage]'s one player.
 *
 * The veil covers its clip the way a sheet covers a surface (jakob
 * 2026-09-24, backlog item 103; `design/readme.md`, "The feed-video
 * rulings"): veiled, the clip plays nothing and draws no sound disc; the
 * reader's reveal re-elects the feed's stage, and the clip — here the only
 * one, past the gate — wins it. `VeiledStageTest` (core:designsystem) pins the
 * election against a qualifying incumbent; this pins that the feed's veil is
 * the one the stage hears.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
// A phone-sized window, so the feed's first clip stands past the 70% gate.
@Config(qualifiers = "w411dp-h891dp")
class FeedVeilStageTest {

    @get:Rule
    val compose = createComposeRule()

    private var reveals by mutableStateOf<Map<String, SensitiveMark>>(emptyMap())

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    @Test
    fun aVeiledClipInTheFeedPlaysNothingAndDrawsNoSoundDisc() {
        renderFeed()

        assertThat(VideoStage.holding?.owner).isNull()
        compose.onNodeWithTag(SOUND_DISC_TAG, useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theReadersRevealReElectsTheFeedsStageAndTheClipPlays() {
        renderFeed()

        compose.onNodeWithTag("feed_post_${POST}_veil_reveal").performClick()
        compose.waitForIdle()

        assertThat(VideoStage.holding?.url).isEqualTo(POST_CLIP)
        assertThat(VideoStage.holding?.owner).isNotNull()
        compose.onNodeWithTag(SOUND_DISC_TAG, useUnmergedTree = true).assertExists()
    }

    private fun renderFeed() {
        compose.setContent {
            FeedScreen(
                state = FeedUiState(loading = false, posts = listOf(sensitiveClipPost()), reveals = reveals),
                onRefresh = {},
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
                onReveal = { id, mark -> reveals = reveals + (id to mark) },
            )
        }
        compose.waitForIdle()
    }

    private fun sensitiveClipPost(): PostView = testPost(POST).copy(
        content = testModeratedField(null),
        attachmentsStatus = FieldStatus.SENSITIVE,
        attachments = listOf(
            MediaAssetView(
                id = "post-asset",
                url = POST_CLIP,
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = 1f,
                mimeType = "video/mp4",
                durationMs = 5_000,
            ),
        ),
    )

    private companion object {
        const val POST = "p1"
        const val POST_CLIP = "https://example.invalid/post.mp4"
        const val SOUND_DISC_TAG = "video_mute"
    }
}
