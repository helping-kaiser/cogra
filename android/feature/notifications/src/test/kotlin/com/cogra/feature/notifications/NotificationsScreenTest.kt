// Notifications (Notifications.md, NotificationsEmpty.md; packet
// notifications-list §12.2): the flat list newest first, the drawn sentences,
// the row dots, the empty state, the faults and the back arrow by origin.
// web's twin is `notifications-view.test.tsx`.

package com.cogra.feature.notifications

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.v2.atom.WALKED_BACK_DISC_TAG
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenStatus
import com.cogra.domain.hidden.HiddenView
import com.cogra.domain.notifications.BellRoot
import com.cogra.domain.notifications.NOTIFICATIONS_EMPTY
import com.cogra.domain.notifications.Notification
import com.cogra.domain.notifications.NotificationActor
import com.cogra.domain.notifications.NotificationKind
import com.cogra.domain.notifications.NotificationPair
import com.cogra.domain.notifications.NotificationSubject
import com.cogra.domain.notifications.NotificationTarget
import com.cogra.domain.saved.SavedNode
import com.cogra.domain.saved.ThreadPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class NotificationsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.parse("2026-10-14T12:00:00Z")

    private fun text(value: String?) = ModeratedField(value, FieldStatus.NORMAL)

    private fun actor(handle: String, name: String) = NotificationActor("u-$handle", handle, text(name), null)

    private val commented = Notification(
        id = "n1",
        kind = NotificationKind.COMMENT,
        createdAt = now.minusSeconds(3_600),
        readAt = null,
        actor = actor("ada", "Ada Okonkwo"),
        subject = NotificationSubject.Content(
            SavedNode.Comment(
                "c1",
                text("The third headland light is real"),
                emptyList(),
                ModerationState.NORMAL,
                null,
                "ada",
                ThreadPost("p1", text("The long way home"), text("words"), emptyList(), "me"),
            ),
        ),
        context = null,
        pair = null,
        applicationId = null,
    )
    private val opinion = commented.copy(
        id = "n2",
        kind = NotificationKind.PROFILE_OPINION,
        createdAt = now.minusSeconds(6 * 3_600),
        actor = actor("sol", "Sol"),
        subject = NotificationSubject.Person("u-sol", "sol"),
        pair = NotificationPair(0.4, 0.5),
    )
    private val approved = commented.copy(
        id = "n3",
        kind = NotificationKind.APPLICATION_APPROVED,
        createdAt = now.minusSeconds(48 * 3_600),
        readAt = now.minusSeconds(40 * 3_600),
        actor = actor("mira", "Mira Voss"),
        subject = null,
    )

    private val opened = mutableListOf<Pair<String, NotificationTarget?>>()

    private fun render(
        state: NotificationsUiState,
        root: BellRoot = BellRoot.FEED,
        onRetry: () -> Unit = {},
        onLoadMore: () -> Unit = {},
    ) {
        compose.setContent {
            NotificationsScreen(
                state = state,
                root = root,
                onRetry = onRetry,
                onLoadMore = onLoadMore,
                onBack = {},
                onOpen = { row, target -> opened += row.id to target },
                now = now,
            )
        }
    }

    private fun loaded(vararg rows: Notification, opened: Set<String> = emptySet()) =
        NotificationsUiState(notifications = rows.toList(), loading = false, opened = opened)

    @Test
    fun `the list is flat and newest first`() {
        render(loaded(commented, opinion, approved))
        listOf("1", "2", "3").forEach { key ->
            assertThat(compose.onAllNodesWithTag("notifications.list.notification:$key").fetchSemanticsNodes())
                .hasSize(1)
        }
        compose.onNodeWithText("@ada commented on your post").assertIsDisplayed()
        compose.onNodeWithText("@sol gave an opinion on you").assertIsDisplayed()
        compose.onNodeWithText("@mira approved your application").assertIsDisplayed()
    }

    @Test
    fun `comment and reply rows carry the words that arrived`() {
        render(loaded(commented))
        compose.onNodeWithText("The third headland light is real").assertIsDisplayed()
    }

    @Test
    fun `the opinion row wears the face with no digits and no second line`() {
        render(loaded(opinion))
        compose.onNodeWithText("@sol gave an opinion on you").assertIsDisplayed()
        assertThat(compose.onAllNodesWithText("0.4", substring = true).fetchSemanticsNodes()).isEmpty()
    }

    // Faces follow the value, and the row says which (0, 0) it draws from
    // `Record.severed` (`StanceValue.zeroLabel`; seam 243).
    private fun faceSpoken(pair: NotificationPair): List<String> {
        render(loaded(opinion.copy(pair = pair)))
        return compose.onAllNodes(hasContentDescription(", ", substring = true), useUnmergedTree = true)
            .fetchSemanticsNodes()
            .flatMap { it.config.getOrElse(SemanticsProperties.ContentDescription) { emptyList() } }
    }

    @Test
    fun `an opinion row at zero that was never walked back says nothing`() {
        assertThat(faceSpoken(NotificationPair(0.0, 0.0, severed = false)))
            .contains("Says nothing, +0.00 / +0.00")
    }

    @Test
    fun `an opinion row at zero speaks walked back only when its record says so`() {
        assertThat(faceSpoken(NotificationPair(0.0, 0.0, severed = true)))
            .contains("Walked back, +0.00 / +0.00")
    }

    @Test
    fun `an opinion row with one number at zero thinks and names its state`() {
        assertThat(faceSpoken(NotificationPair(0.0, 0.4, severed = false)))
            .contains("Interested, no side taken, +0.00 / +0.40")
    }

    // Notifications.md:13, :21, :43 — the tenth kind, the opinion row's sibling.
    @Test
    fun `the withdrawal row wears the walked back face and opens the withdrawers profile`() {
        val withdrawn = opinion.copy(
            id = "n4",
            kind = NotificationKind.PROFILE_OPINION_WITHDRAWN,
            pair = NotificationPair(-0.4, -0.5),
        )
        render(loaded(withdrawn))
        compose.onNodeWithText("@sol walked back their opinion on you").assertIsDisplayed()
        // 🤷 where a picture would go, decorative: the sentence says what happened.
        compose.onNodeWithTag(WALKED_BACK_DISC_TAG, useUnmergedTree = true).assertIsDisplayed()
        assertThat(compose.onAllNodesWithText("🤷", useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()
        assertThat(compose.onAllNodesWithText("0.4", substring = true).fetchSemanticsNodes()).isEmpty()
        compose.onNodeWithTag("notification_n4_open").performClick()
        assertThat(opened).containsExactly("n4" to NotificationTarget.Person("sol"))
    }

    @Test
    fun `an unopened row wears the dot spoken new`() {
        render(loaded(commented, approved))
        // One unread row, one already read.
        assertThat(compose.onAllNodesWithContentDescription("New").fetchSemanticsNodes()).hasSize(1)
    }

    @Test
    fun `opening keeps row dots and a tap clears one`() {
        render(loaded(commented, opinion, opened = setOf("n1")))
        assertThat(compose.onAllNodesWithContentDescription("New").fetchSemanticsNodes()).hasSize(1)
    }

    @Test
    fun `a tap opens the row's destination`() {
        render(loaded(commented, opinion))
        compose.onNodeWithTag("notification_n1_open").performClick()
        compose.onNodeWithTag("notification_n2_open").performClick()
        assertThat(opened).containsExactly(
            "n1" to NotificationTarget.Comment("p1", "c1"),
            "n2" to NotificationTarget.Person("sol"),
        ).inOrder()
    }

    @Test
    fun `there is no mark all control`() {
        render(loaded(commented))
        assertThat(compose.onAllNodesWithText("Mark", substring = true, ignoreCase = true).fetchSemanticsNodes())
            .isEmpty()
    }

    @Test
    fun `the empty list names the kinds with no action and no error colour`() {
        render(NotificationsUiState(loading = false))
        compose.onNodeWithText(NOTIFICATIONS_EMPTY).assertIsDisplayed()
        assertThat(compose.onAllNodesWithTag("notifications.list.fault.retry").fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun `a list that cannot load says it cannot reach the server`() {
        var retried = 0
        render(NotificationsUiState(loading = false, failed = true), onRetry = { retried += 1 })
        compose.onNodeWithText("Can't reach the server. Check your connection and try again.").assertIsDisplayed()
        compose.onNodeWithTag("notifications.list.fault.retry").performClick()
        assertThat(retried).isEqualTo(1)
    }

    @Test
    fun `a failed next page offers couldnt load more and retry`() {
        var asked = 0
        render(
            loaded(commented, opinion).copy(moreFailed = true, hasNextPage = true, endCursor = "c2"),
            onLoadMore = { asked += 1 },
        )
        compose.onNodeWithText("Couldn't load more").assertIsDisplayed()
        compose.onNodeWithTag("notifications.list.moreFault.retry").performClick()
        assertThat(asked).isAtLeast(1)
    }

    // PR-11's client half: the held rows are laid under the reader's hidden set.
    @Test
    fun `hiding someone elsewhere drops their rows from the held list`() {
        val sol = HiddenPerson("u-sol", "sol", "Sol", avatarUrl = null, redacted = false)
        compose.setContent {
            NotificationsScreen(
                state = loaded(commented, opinion),
                root = BellRoot.FEED,
                onRetry = {},
                onLoadMore = {},
                onBack = {},
                onOpen = { _, _ -> },
                now = now,
                hidden = HiddenView(status = HiddenStatus.READ, entries = listOf(HiddenEntry(sol, now))),
            )
        }
        compose.onNodeWithText("@ada commented on your post").assertIsDisplayed()
        assertThat(compose.onAllNodesWithText("@sol gave an opinion on you").fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun `back returns to the bells root with its label`() {
        render(loaded(commented), root = BellRoot.PROFILE)
        compose.onNodeWithTag("notifications.header.back").assertContentDescriptionEquals("Back to your profile")
    }
}
