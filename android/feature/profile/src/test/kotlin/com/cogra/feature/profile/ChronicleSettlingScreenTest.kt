// A STILL-SETTLING ACT ON THE EVERYTHING TAB (Profile.md:31,
// ProfileOther.md:27; `_shared.jsx` `ChronicleAct` settling; ContentRow.jsx
// `pending`): the act stands as its act's card, its age its signing, and
// `Still settling` reads under the age on `profile.chronicle.act.pending` —
// on the reader's own profile and on another's, signed in or a guest. Its
// door is the landed act's. A landed act wears no marker. Nodes, never widths.

package com.cogra.feature.profile

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.crypto.Family
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Duration
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ChronicleSettlingScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.parse("2026-11-24T12:00:00Z")

    /** A [guest] is signed out: the screen holds the account gate its rows' locked actions open. */
    private fun render(state: ProfileUiState, onOpenPost: (String) -> Unit = {}, guest: Boolean = false) {
        compose.setContent {
            ProfileScreen(
                stanceControl = { _, _, _ -> },
                state = state,
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = {},
                onLoadMore = {},
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = onOpenPost,
                onBack = null,
                onChats = null,
                onMessage = {},
                onRequireAccount = if (guest) ({}) else null,
                backDescription = null,
                onOpenHistory = {},
                onOpenOpinions = {},
                onMention = {},
                now = now,
            )
        }
    }

    /** A profile standing on Everything, the reader's own or another's. */
    private fun everything(rows: List<RecordRow>, own: Boolean) = ProfileUiState(
        loading = false,
        tab = ProfileTab.EVERYTHING,
        profile = testProfile(id = "u1", handle = "ada", displayName = "Ada L"),
        own = own,
        rows = rows,
    )

    private val settlingPost = RecordRow(
        id = "rec:p1",
        family = Family.PUBLISH,
        genesis = true,
        snippet = "Salt maps",
        link = RecordLink.ToPost("p1"),
        act = RecordAct.GENESIS,
        pending = true,
        signedAt = now.minusSeconds(5),
    )

    private val settlingComment = RecordRow(
        id = "rec:c1",
        family = Family.REVIEW,
        genesis = true,
        snippet = "A fine reply",
        link = RecordLink.ToPost("p9"),
        act = RecordAct.GENESIS,
        pending = true,
        signedAt = now.minusSeconds(5),
    )

    private val landedPost = RecordRow(
        id = "rec:p0",
        family = Family.PUBLISH,
        genesis = true,
        snippet = "Older",
        link = RecordLink.ToPost("p0"),
        landedAt = now.minus(Duration.ofDays(3)),
        act = RecordAct.GENESIS,
    )

    @Test
    fun aSettlingPostReadsStillSettlingUnderItsAgeOnAnothersProfile() {
        render(everything(listOf(settlingPost, landedPost), own = false))

        compose.onNodeWithTag("profile.chronicle.act:1").performScrollTo()
        compose.onAllNodesWithTag("profile.chronicle.act.title", useUnmergedTree = true)[0]
            .assertTextEquals("Published a post")
        // Only the settling act wears the marker; the landed one below it does not.
        compose.onAllNodesWithTag("profile.chronicle.act.pending", useUnmergedTree = true)
            .assertCountEquals(1)
        compose.onNodeWithTag("profile.chronicle.act.pending", useUnmergedTree = true)
            .assertTextEquals("Still settling")
        // The age is its signing: a post signed seconds ago reads `now`, as
        // the board's settling act does.
        compose.onAllNodesWithTag("profile.chronicle.act.trailing", useUnmergedTree = true)[0]
            .assertTextEquals("now")
    }

    @Test
    fun aSettlingCommentReadsCommentedAndStillSettlingOnTheOwnProfile() {
        render(everything(listOf(settlingComment), own = true))

        compose.onNodeWithTag("profile.chronicle.act.title", useUnmergedTree = true)
            .assertTextEquals("Commented")
        compose.onNodeWithTag("profile.chronicle.act.second", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("profile.chronicle.act.pending", useUnmergedTree = true)
            .assertTextEquals("Still settling")
    }

    // A guest reads another's profile with no session: the same act, the
    // same marker, the same door.
    @Test
    fun aGuestSeesTheSameSettlingActAndItsDoorOpensThePost() {
        var opened: String? = null
        render(everything(listOf(settlingPost), own = false), onOpenPost = { opened = it }, guest = true)

        compose.onNodeWithTag("profile.chronicle.act.pending", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("chronicle_row_open", useUnmergedTree = true).performScrollTo().performClick()
        assertThat(opened).isEqualTo("p1")
    }

    @Test
    fun aSettlingCommentsDoorOpensItsThreadsPost() {
        var opened: String? = null
        render(everything(listOf(settlingComment), own = false), onOpenPost = { opened = it })

        compose.onNodeWithTag("chronicle_row_open", useUnmergedTree = true).performScrollTo().performClick()
        assertThat(opened).isEqualTo("p9")
    }

    @Test
    fun aLandedActWearsNoMarker() {
        render(everything(listOf(landedPost), own = true))

        compose.onAllNodesWithTag("profile.chronicle.act.pending", useUnmergedTree = true).assertCountEquals(0)
        compose.onNodeWithTag("profile.chronicle.act.trailing", useUnmergedTree = true).assertTextEquals("3d")
    }
}
