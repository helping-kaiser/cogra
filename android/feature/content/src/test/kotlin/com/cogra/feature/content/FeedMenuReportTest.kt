package com.cogra.feature.content

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.testing.RecordingReportRepository
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The feed-hosted post menu's tail row and the report it sends
 * (FeedPostMenu.md:23; ReportConfirm.md; ruling 75, FC-G15): the confirm over
 * the feed sends nothing until its commit, the commit sends the report, and
 * the feed's snackbar never claims a report that did not go out.
 */
@RunWith(RobolectricTestRunner::class)
class FeedMenuReportTest {

    @get:Rule
    val compose = createComposeRule()

    private val reports = RecordingReportRepository()
    private var joinAsked = 0

    private fun renderFeed(signedOut: Boolean = false) {
        val viewModel = ReportViewModel(reports)
        // The route's own door, but with the view model built here rather
        // than by Hilt; the guest's door is exactly the route's.
        val confirm: ReportSheetSlot = { postId, onDismiss, notify ->
            ReportSheetRoute(
                postId = postId,
                onDismiss = onDismiss,
                notify = notify,
                testTag = "feed_report_sheet",
                node = DataNode("feed") / "reportSheet",
                viewModel = viewModel,
            )
        }
        val guest = reportDoor({ joinAsked += 1 }, testTag = "feed_report_sheet")
        val door = if (signedOut) guest else confirm
        compose.setContent {
            val snackbar = remember { SnackbarHostState() }
            CompositionLocalProvider(LocalSnackbarHostState provides snackbar) {
                FeedScreen(
                    state = FeedUiState(loading = false, posts = listOf(testPost("p1"))),
                    onRefresh = {},
                    onLoadMore = {},
                    onOpenPost = {},
                    onOpenActor = {},
                    onOpenTopic = {},
                    viewerId = "someone-else",
                    reportSheet = door,
                )
                CograSnackbarHost(snackbar)
            }
        }
    }

    private fun openReport() {
        compose.onNodeIn(feedCard("p1"), "feed.card.menu").performClick()
        compose.onNodeWithTag("feed.menuSheet.report").performClick()
        compose.waitForIdle()
    }

    /** FeedPostMenu.md:5 — the reader menu, Report at the sheet's tail. */
    @Test
    fun the_feed_menu_reads_report_at_the_tail() {
        renderFeed()
        compose.onNodeIn(feedCard("p1"), "feed.card.menu").performClick()
        compose.onNodeWithTag("feed.menuSheet.report").assertTextEquals("Report")
        val license = compose.onNodeWithTag("feed.menuSheet.license").fetchSemanticsNode().boundsInRoot.top
        val report = compose.onNodeWithTag("feed.menuSheet.report").fetchSemanticsNode().boundsInRoot.top
        assertThat(license).isLessThan(report)
    }

    /** FeedPostMenu.md:23 — the menu closes, the confirm rises, nothing is sent. */
    @Test
    fun report_raises_the_confirm_over_the_feed_and_sends_nothing() {
        renderFeed()
        openReport()
        compose.onAllNodesWithTag("feed.menuSheet").assertCountEquals(0)
        compose.onNodeWithTag("feed.reportSheet.title").assertTextEquals("Report this post?")
        compose.onNodeWithTag("feed.reportSheet.body")
            .assertTextEquals("It goes to the people who run CoGra for a look.")
        assertThat(reports.targets).isEmpty()
    }

    /** ReportConfirm.md:17 — Cancel drops the sheet and sends nothing. */
    @Test
    fun report_cancel_sends_nothing() {
        renderFeed()
        openReport()
        compose.onNodeWithTag("feed.reportSheet.cancel").performClick()
        compose.waitForIdle()
        compose.onAllNodesWithTag("feed.reportSheet").assertCountEquals(0)
        assertThat(reports.targets).isEmpty()
        compose.onAllNodesWithTag("feed.snackbar").assertCountEquals(0)
    }

    /** ReportConfirm.md:11 — the commit sends the mail (ruling 75). */
    @Test
    fun report_confirm_sends_the_mail_and_snackbars_reported() {
        renderFeed()
        openReport()
        compose.onNodeWithTag("feed.reportSheet.report").performClick()
        compose.waitForIdle()
        assertThat(reports.targets).containsExactly("p1")
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true).assertTextEquals("Reported.")
        compose.onAllNodesWithTag("feed.reportSheet").assertCountEquals(0)
    }

    /** ReportConfirm.md:15 — the day's reports spent (FC-G15). */
    @Test
    fun a_rate_limited_report_answers_with_the_no_answer_snackbar() {
        reports.answers += Outcome.Refused(listOf(UserError(ErrorCode.RATE_LIMITED, "rate limited")))
        renderFeed()
        openReport()
        compose.onNodeWithTag("feed.reportSheet.report").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true)
            .assertTextEquals("That didn't send. Try again.")
        // The sheet stays, so the reader can try again.
        compose.onNodeWithTag("feed.reportSheet").assertExists()
    }

    /** ReportConfirm.md:15 — the thing gone (FC-G15). */
    @Test
    fun a_refused_report_keeps_the_sheet_and_snackbars_that_didnt_send() {
        reports.answers += Outcome.Refused(listOf(UserError(ErrorCode.NOT_FOUND, "gone", listOf("target"))))
        renderFeed()
        openReport()
        compose.onNodeWithTag("feed.reportSheet.report").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true)
            .assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("feed.reportSheet").assertExists()
    }

    /** ReportConfirm.md:13 — no answer reaches the device. */
    @Test
    fun a_report_with_no_answer_keeps_the_sheet_and_snackbars_that_didnt_send() {
        reports.answers += Outcome.Failed(java.io.IOException("offline"))
        renderFeed()
        openReport()
        compose.onNodeWithTag("feed.reportSheet.report").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("feed.snackbar.message", useUnmergedTree = true)
            .assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("feed.reportSheet").assertExists()
    }

    /**
     * ReportConfirm.md:3-11 on the detail, the board that registers the sheet:
     * it wears `postDetail.reportSheet` and its title, body, report and cancel.
     */
    @Test
    fun the_detail_confirm_wears_the_registered_report_sheet() {
        val node = DataNode("postDetail") / "reportSheet"
        var notified: String? = null
        compose.setContent {
            ReportSheetRoute(
                postId = "p1",
                onDismiss = {},
                notify = { notified = it },
                testTag = "detail_report_sheet",
                node = node,
                viewModel = ReportViewModel(reports),
            )
        }
        compose.onNodeWithTag("postDetail.reportSheet").assertExists()
        compose.onNodeWithTag("postDetail.reportSheet.title").assertTextEquals("Report this post?")
        compose.onNodeWithTag("postDetail.reportSheet.body")
            .assertTextEquals("It goes to the people who run CoGra for a look.")
        compose.onNodeWithTag("postDetail.reportSheet.cancel").assertExists()
        compose.onNodeWithTag("postDetail.reportSheet.report").performClick()
        compose.waitForIdle()
        assertThat(reports.targets).containsExactly("p1")
        assertThat(notified).isEqualTo("Reported.")
    }

    /** ReportConfirm.md:21 — a guest is asked to join and no confirm rises. */
    @Test
    fun a_guest_report_asks_to_join_and_never_raises_the_confirm() {
        renderFeed(signedOut = true)
        openReport()
        assertThat(joinAsked).isEqualTo(1)
        compose.onAllNodesWithTag("feed.reportSheet").assertCountEquals(0)
        assertThat(reports.targets).isEmpty()
    }
}
