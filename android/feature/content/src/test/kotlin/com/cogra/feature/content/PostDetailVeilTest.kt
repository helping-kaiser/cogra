package com.cogra.feature.content

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.media.PINNED_CLIP_TAG
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
 * A SENSITIVE VIDEO POST'S DETAIL, end to end: the real [PostDetailScreen],
 * its pinned clip, and [VideoStage]'s one player.
 *
 * The pinned-clip veil ruling (jakob 2026-09-24): the clip pinned above the
 * card wears ITS OWN veil in place — never demoted into the card — with no
 * transport under it, and it shares ONE scope with the card body beneath, so
 * one tap reveals both. A veiled clip is out of the stage (backlog item 103):
 * nothing claims the player until the reader chooses to look.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class PostDetailVeilTest {

    @get:Rule
    val compose = createComposeRule()

    private var reveals by mutableStateOf<Map<String, SensitiveMark>>(emptyMap())
    private var revealCalls = 0

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    @Test
    fun aSensitivePinnedClipWearsItsOwnVeilInPlaceAndClaimsNothing() {
        renderDetail(sensitiveClipPost())

        // In place: the veil is over the pinned frame, not folded into the card.
        compose.onNodeWithTag(PINNED_VEIL_TAG).assertExists()
        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").assertExists()
        compose.onNodeWithTag("${PINNED_CLIP_TAG}_poster", useUnmergedTree = true).assertExists()
        // No player composed, so no claim, no playback, no transport.
        compose.onNodeWithTag("${PINNED_CLIP_TAG}_video", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag(TRANSPORT_TAG, useUnmergedTree = true).assertDoesNotExist()
        assertThat(VideoStage.holding).isNull()
    }

    @Test
    fun oneRevealOnTheClipLiftsTheClipAndTheCardBodyTogether() {
        renderDetail(sensitiveClipPost())

        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").performClick()
        compose.waitForIdle()

        assertThat(revealCalls).isEqualTo(1)
        // One revealed-state: both faces are gone after the one tap.
        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").assertDoesNotExist()
        compose.onNodeWithTag("detail_veil_reveal").assertDoesNotExist()
        assertTheClipIsOnStage()
    }

    // The scope runs both ways. With the clip pinned, the card body is the
    // description alone — one line, under which the face's chrome is clipped
    // (SensitiveVeil's own caveat) — so the reader's way in is the wash over
    // it, which is the whole-tile reveal (PR #864).
    @Test
    fun aTapOnTheCardsVeiledBodyLiftsThePinnedClipToo() {
        renderDetail(sensitiveClipPost())

        // `detail_body` is the veil's own node: the card tags the region it
        // wraps, and that outer tag is the one the tree carries.
        compose.onNodeWithTag("detail_body").performTouchInput { click(center) }
        compose.waitForIdle()

        assertThat(revealCalls).isEqualTo(1)
        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").assertDoesNotExist()
        assertTheClipIsOnStage()
    }

    // THE WHOLE TILE IS THE REVEAL (PR #864): a tap on the wash away from the
    // button reveals, and does not fall through to the clip's viewer route.
    @Test
    fun aTapOnThePinnedWashRevealsRatherThanOpeningTheViewer() {
        renderDetail(sensitiveClipPost())

        compose.onNodeWithTag(PINNED_VEIL_TAG).performTouchInput { click(Offset(WASH_INSET, WASH_INSET)) }
        compose.waitForIdle()

        assertThat(revealCalls).isEqualTo(1)
        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").assertDoesNotExist()
        compose.onNodeWithTag("media_viewer").assertDoesNotExist()
    }

    @Test
    fun aRevealAlreadyMadeElsewhereIsNotAskedAgain() {
        val post = sensitiveClipPost()
        reveals = mapOf(post.id to post.sensitiveMark())
        renderDetail(post)

        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").assertDoesNotExist()
        compose.onNodeWithTag("detail_veil_reveal").assertDoesNotExist()
        assertTheClipIsOnStage()
    }

    @Test
    fun aClipThatIsNotSensitivePlaysWithItsTransportAsBefore() {
        renderDetail(sensitiveClipPost().copy(attachmentsStatus = FieldStatus.NORMAL))

        compose.onNodeWithTag("${PINNED_VEIL_TAG}_reveal").assertDoesNotExist()
        compose.onNodeWithTag("${PINNED_CLIP_TAG}_poster", useUnmergedTree = true).assertDoesNotExist()
        assertTheClipIsOnStage()
    }

    private fun assertTheClipIsOnStage() {
        compose.onNodeWithTag("${PINNED_CLIP_TAG}_video", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag(TRANSPORT_TAG, useUnmergedTree = true).assertExists()
        assertThat(VideoStage.holding?.url).isEqualTo(CLIP)
        assertThat(VideoStage.holding?.owner).isNotNull()
    }

    private fun renderDetail(post: PostView) {
        compose.setContent {
            PostDetailScreen(
                state = PostDetailUiState(loading = false, post = post, reveals = reveals),
                viewerId = null,
                onRefresh = {},
                onReveal = { id, mark ->
                    revealCalls++
                    reveals = reveals + (id to mark)
                },
                onEdit = {},
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

    /** A video post marked sensitive, with a description so the card body has a veil of its own. */
    private fun sensitiveClipPost(): PostView = testPost(POST).copy(
        content = testModeratedField(null),
        description = testModeratedField("Rubbings from three weekends at low tide."),
        attachmentsStatus = FieldStatus.SENSITIVE,
        attachments = listOf(
            MediaAssetView(
                id = "m1",
                url = CLIP,
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = 0.5625f,
                mimeType = "video/mp4",
                durationMs = 41_000,
            ),
        ),
    )

    private companion object {
        const val POST = "p1"
        const val CLIP = "https://example.invalid/clip.mp4"
        const val TRANSPORT_TAG = "video_transport"

        /** Well inside the wash's corner, far from the centred reveal button. */
        const val WASH_INSET = 12f
    }
}
