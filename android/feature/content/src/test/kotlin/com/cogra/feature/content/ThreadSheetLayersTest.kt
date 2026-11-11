package com.cogra.feature.content

import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.media.VideoSound
import com.cogra.core.designsystem.v2.media.VideoStage
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.testing.testComment
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers

/**
 * WHAT STANDS OVER THE THREAD SHEET, AND WHAT STAYS INSIDE IT (jakob's
 * round-2 hand test, 2026-11-11).
 *
 * The snackbar rides ABOVE the sheet at the screen's foot, centred, and
 * moves nothing in it (`SettingsUnhidden.jsx`, "The line rides above the
 * sheet"; `Snackbar.jsx`'s fixed, centred placement). A clip in the thread
 * draws INSIDE the sheet: its surface is a TextureView, which Compose clips,
 * never a SurfaceView, whose own compositor layer stood above the sheet up to
 * the top of the screen. That last is pinned as the surface type in the
 * sheet's window — the escape itself is a compositor effect Robolectric
 * cannot draw, so its visual proof is the hand test.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class ThreadSheetLayersTest {

    @get:Rule
    val compose = createComposeRule()

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    /** The snackbar stands centred over the sheet, and the comment field stays exactly where it was. */
    @Test
    fun theSnackbarStandsCentredOverTheSheetAndMovesNothing() {
        var signed by mutableStateOf(false)
        compose.setContent { Thread(listOf(testComment("c1")), signed = signed) }
        compose.waitForIdle()
        val fieldBefore = compose.onNodeWithTag("detail_add_comment").getUnclippedBoundsInRoot()

        compose.mainClock.autoAdvance = false
        signed = true
        compose.mainClock.advanceTimeBy(SNACKBAR_SETTLED_MS)

        val bar = compose.onNodeWithTag(THREAD_SNACKBAR_TAG).getUnclippedBoundsInRoot()
        val sheet = compose.onNodeWithTag(THREAD_SHEET.tag).getUnclippedBoundsInRoot()
        val fieldAfter = compose.onNodeWithTag("detail_add_comment").getUnclippedBoundsInRoot()
        assertThat(fieldAfter).isEqualTo(fieldBefore)
        val barCentre = (bar.left + bar.right) / 2
        val sheetCentre = (sheet.left + sheet.right) / 2
        assertThat((barCentre - sheetCentre).value).isWithin(1f).of(0f)
        // Over the field, not above it: the line lies on the layer at the foot.
        assertThat(bar.bottom).isGreaterThan(fieldBefore.top)
        assertThat(sheet.bottom - bar.bottom).isLessThan(32.dp)
    }

    /** A clip in the thread draws into a TextureView, never a SurfaceView. */
    @Test
    fun aClipInTheThreadDrawsInsideTheSheet() {
        compose.setContent { Thread(listOf(clipComment())) }
        compose.waitForIdle()

        val views = windowViews()
        assertThat(views.filterIsInstance<TextureView>()).isNotEmpty()
        assertThat(views.filterIsInstance<SurfaceView>()).isEmpty()
    }

    @Composable
    private fun Thread(comments: List<CommentView>, signed: Boolean = false) {
        CommentsSheet(
            state = CommentsUiState(loading = false, comments = comments, commentSigned = signed),
            viewerId = null,
            signedIn = true,
            onDismiss = {},
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
    }

    /** A comment is words plus media, never instead of them (D16). */
    private fun clipComment(): CommentView = testComment("c1").copy(
        attachments = listOf(
            MediaAssetView(
                id = "comment-asset",
                url = "https://example.invalid/comment.mp4",
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = 1f,
                mimeType = "video/mp4",
                durationMs = 5_000,
            ),
        ),
    )

    /**
     * Every view in every window — the sheet is its own window, beside the
     * activity's. `WindowManagerGlobal` is the framework's own registry of
     * root views; Robolectric runs the real one.
     */
    private fun windowViews(): List<View> {
        val global = Class.forName("android.view.WindowManagerGlobal").getMethod("getInstance").invoke(null)
        val roots: List<View> = ReflectionHelpers.getField(global, "mViews")
        return roots.flatMap(::descendants)
    }

    private fun descendants(view: View): List<View> {
        val group = view as? ViewGroup ?: return listOf(view)
        return listOf(view) + (0 until group.childCount).flatMap { descendants(group.getChildAt(it)) }
    }

    private companion object {
        /** Past the snackbar's enter animation, well inside its 4 s. */
        const val SNACKBAR_SETTLED_MS = 1_000L
    }
}
