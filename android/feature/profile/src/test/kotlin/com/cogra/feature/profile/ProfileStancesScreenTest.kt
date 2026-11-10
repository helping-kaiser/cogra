// behavior/ProfileStances.md compiled line by line onto the stateless screen,
// with the board's own rows (ProfileStances.dc.html). Assertions bind to the
// registered data-node ids (nodes.json `ProfileStances`).

package com.cogra.feature.profile

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.filter
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ProfileView
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionDirection
import com.cogra.domain.stance.OpinionHolder
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProfileStancesScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val ada = testProfile(id = "u2", handle = "ada")
    private val me = testProfile(id = "u1", handle = "jakob")
    private val husk = testProfile(id = "u9", handle = "gone")
        .copy(displayName = ModeratedField(null, FieldStatus.REDACTED))

    private val deletedId = "9d3f6a1b-4c2e-4b8a-a7d5-2e6f1c0b3a98"
    private val deletedRow = HeldOpinion(
        holderId = "addr-del",
        holder = OpinionHolder(deletedId, "gone", null, null, redacted = true),
        pair = StancePair(0.2, 0.2),
        severed = false,
    )

    /** The board's rows on another's On tab, strongest first. */
    private val boardRows = listOf(
        person("tobias", "Tobias Lindqvist", 0.7, 0.4),
        person("sol", "Sol Ferreira", 0.6, 0.3),
        person("mira", "Mira Voss", 0.4, 0.5),
        deletedRow,
        person("kel", "Kel Moreau", 0.0, 0.35),
        person("juno", "Juno Baptiste", -0.2, 0.1),
    )

    private fun person(handle: String, name: String, d: Double, i: Double, severed: Boolean = false) = HeldOpinion(
        holderId = "addr-$handle",
        holder = OpinionHolder("id-$handle", handle, name, null, redacted = false),
        pair = StancePair(d, i),
        severed = severed,
    )

    private fun state(
        profile: ProfileView = ada,
        own: Boolean = false,
        direction: OpinionDirection = OpinionDirection.ON,
        rows: List<HeldOpinion>? = boardRows,
        failed: Boolean = false,
    ) = ProfileStancesUiState(
        loading = false,
        profile = profile,
        own = own,
        direction = direction,
        rows = rows,
        failed = failed,
    )

    private val opened = mutableListOf<String>()
    private val directions = mutableListOf<OpinionDirection>()
    private var backs = 0
    private var refreshes = 0

    private fun render(state: ProfileStancesUiState, exact: Boolean = false) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides exact) {
                ProfileStancesScreen(
                    state = state,
                    onBack = { backs += 1 },
                    onDirection = { directions += it },
                    onRefresh = { refreshes += 1 },
                    onOpenPerson = { opened += it },
                )
            }
        }
    }

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    // -- :3, :5 the title --

    @Test
    fun theTitleReadsThePersonsHandleAndOpinions() {
        render(state())
        node("profileStances.header.title").assertTextEquals("@ada · Opinions")
    }

    @Test
    fun aDeletedAccountsPageIsTitledOpinionsAlone() {
        render(state(profile = husk))
        node("profileStances.header.title").assertTextEquals("Opinions")
    }

    // -- :7, :9, :11 the two directions on two tabs named in words --

    @Test
    fun anothersTabsReadOnThemAndByThemTheStandingOneSelected() {
        render(state())
        compose.onNodeWithTag("profileStances.tabRow.onTab").assertTextEquals("On them").assertIsSelected()
        compose.onNodeWithTag("profileStances.tabRow.byTab").assertTextEquals("By them").assertIsNotSelected()
        // The board draws the row once per tab, keyed by it (nodes.json).
        node("profileStances.tabRow:on").assertExists()
    }

    @Test
    fun theByTabStandsKeyedByItsValue() {
        render(state(direction = OpinionDirection.BY))
        node("profileStances.tabRow:by").assertExists()
        node("profileStances.tabRow.byTab").assertIsSelected()
    }

    @Test
    fun aDeletedAccountsTabsReadOnThemAndByThem() {
        render(state(profile = husk))
        compose.onNodeWithTag("profileStances.tabRow.onTab").assertTextEquals("On them")
        compose.onNodeWithTag("profileStances.tabRow.byTab").assertTextEquals("By them")
    }

    @Test
    fun theReadersOwnTabsReadOnYouAndByYou() {
        render(state(profile = me, own = true))
        compose.onNodeWithTag("profileStances.tabRow.onTab").assertTextEquals("On you")
        compose.onNodeWithTag("profileStances.tabRow.byTab").assertTextEquals("By you")
    }

    // -- :29, :31 a tab tap names its direction --

    @Test
    fun tappingATabAsksForItsDirection() {
        render(state())
        node("profileStances.tabRow.byTab").performClick()
        node("profileStances.tabRow.onTab").performClick()
        assertThat(directions).containsExactly(OpinionDirection.BY, OpinionDirection.ON).inOrder()
    }

    // -- :13 each row a person with the opinion it is about, face leading --

    @Test
    fun eachRowIsAPersonWithTheOpinionItIsAbout() {
        render(state(rows = listOf(person("tobias", "Tobias Lindqvist", 0.7, 0.4))))
        val row = "profileStances.list.row"
        node("$row:tobias").assertExists()
        node("$row.name").assertTextEquals("Tobias Lindqvist")
        node("$row.handle").assertTextEquals("@tobias")
        node("$row.avatar").assertExists()
        node("$row.value.face").assertTextEquals("😊")
        node("$row.value").assertContentDescriptionEquals("Like this, +0.70 / +0.40")
    }

    @Test
    fun theRowsStandInTheOrderTheyAreGivenOnePerPerson() {
        render(state())
        compose.onAllNodesWithTag("profileStances.list.row.name", useUnmergedTree = true).assertCountEquals(5)
        compose.onAllNodesWithTag("profileStances.list.redactedRow.name", useUnmergedTree = true).assertCountEquals(1)
    }

    @Test
    fun theExactPairShowsOnlyInTheExactReadingMode() {
        render(state(rows = listOf(person("tobias", "Tobias Lindqvist", 0.7, 0.4))))
        node("profileStances.list.row.value.exact").assertDoesNotExist()
    }

    @Test
    fun inTheExactReadingModeThePairStandsBesideTheFace() {
        render(state(rows = listOf(person("tobias", "Tobias Lindqvist", 0.7, 0.4))), exact = true)
        node("profileStances.list.row.value.exact").assertTextEquals("+0.70 / +0.40")
    }

    // -- :15 one number at zero --

    @Test
    fun aRowAtExactlyOneZeroWearsTheThinkingFaceSpokenInterested() {
        render(state(rows = listOf(person("kel", "Kel Moreau", 0.0, 0.35))))
        node("profileStances.list.row.value.face").assertTextEquals("🤔")
        node("profileStances.list.row.value").assertContentDescriptionEquals("Interested, no side taken, +0.00 / +0.35")
    }

    // -- StanceRow.jsx `severed`: which (0, 0) the row draws is its data --

    @Test
    fun aRowWalkedBackToNothingSpeaksWalkedBack() {
        render(state(rows = listOf(person("kel", "Kel Moreau", 0.0, 0.0, severed = true))))
        node("profileStances.list.row.value.face").assertTextEquals("🤷")
        node("profileStances.list.row.value").assertContentDescriptionEquals("Walked back, +0.00 / +0.00")
    }

    @Test
    fun aZeroRowNoWalkBackLeftSaysNothing() {
        render(state(rows = listOf(person("kel", "Kel Moreau", 0.0, 0.0, severed = false))))
        node("profileStances.list.row.value.face").assertTextEquals("🤷")
        node("profileStances.list.row.value").assertContentDescriptionEquals("Says nothing, +0.00 / +0.00")
    }

    // -- :17 read-only: the row is one door and carries no control --

    @Test
    fun aRowCarriesNoControlButItsDoor() {
        render(state(rows = listOf(person("tobias", "Tobias Lindqvist", 0.7, 0.4))))
        val inList = SemanticsMatcher("stands in the list") { semantics ->
            semantics.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("profileStances.list") == true
        }
        compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick), useUnmergedTree = true)
            .filter(inList)
            .assertCountEquals(1)
    }

    // -- :47 a row opens its person --

    @Test
    fun tappingARowOpensThatPersonsProfile() {
        render(state())
        node("profileStances.list.row:mira").performClick()
        assertThat(opened).containsExactly("mira")
    }

    // -- :23, :25, :27 the deleted holder's row --

    @Test
    fun aDeletedAccountsRowReadsDeletedAccountWithNoHandleAndKeepsItsOpinion() {
        render(state(rows = listOf(deletedRow)), exact = true)
        val row = "profileStances.list.redactedRow"
        node("$row:$deletedId").assertExists()
        node("$row.name").assertTextEquals("Deleted account")
        node("$row.avatar").assertExists()
        node("$row.handle").assertDoesNotExist()
        node("profileStances.list.row.handle").assertDoesNotExist()
        node("$row.value.face").assertTextEquals("🙂")
        node("$row.value.exact").assertTextEquals("+0.20 / +0.20")
    }

    @Test
    fun tappingADeletedAccountsRowOpensTheDeletedAccountsPage() {
        render(state(rows = listOf(deletedRow)))
        node("profileStances.list.redactedRow:$deletedId").performClick()
        assertThat(opened).containsExactly("gone")
    }

    @Test
    fun anAddressNoAccountFrontsKeepsItsRowAndOpensNothing() {
        val nobody = HeldOpinion(
            holderId = "addr-x",
            holder = OpinionHolder(null, null, null, null, redacted = false),
            pair = StancePair(0.1, 0.1),
            severed = false,
        )
        render(state(rows = listOf(nobody)))
        node("profileStances.list.row:addr-x").assertExists().performClick()
        assertThat(opened).isEmpty()
    }

    // -- :33-45 the empty tab --

    @Test
    fun anEmptyTabStandsItsLineInTheListsPlace() {
        render(state(rows = emptyList()))
        node("profileStances.list").assertDoesNotExist()
        node("profileStances.empty").assertExists()
    }

    @Test
    fun anothersEmptyOnReadsTheInvitation() {
        render(state(rows = emptyList()))
        node("profileStances.empty.title").assertTextEquals("No opinions yet — yours would be the first.")
    }

    @Test
    fun anothersEmptyByNamesThem() {
        render(state(rows = emptyList(), direction = OpinionDirection.BY))
        node("profileStances.empty.title").assertTextEquals("No opinions by @ada yet.")
    }

    @Test
    fun theReadersOwnEmptyOnSpeaksToYou() {
        render(state(profile = me, own = true, rows = emptyList()))
        node("profileStances.empty.title").assertTextEquals("No opinions on you yet.")
    }

    @Test
    fun theReadersOwnEmptyBySpeaksToYou() {
        render(state(profile = me, own = true, rows = emptyList(), direction = OpinionDirection.BY))
        node("profileStances.empty.title").assertTextEquals("No opinions by you yet.")
    }

    @Test
    fun aDeletedAccountsEmptyOn() {
        render(state(profile = husk, rows = emptyList()))
        node("profileStances.empty.title").assertTextEquals("No opinions on this account yet.")
    }

    @Test
    fun aDeletedAccountsEmptyBySaysItGaveNone() {
        render(state(profile = husk, rows = emptyList(), direction = OpinionDirection.BY))
        node("profileStances.empty.title").assertTextEquals("This account gave no opinions.")
    }

    // -- :49, :51, :53 the way back --

    @Test
    fun theBackArrowReadsBackToTheProfileOnAnothersPageAndGoesBack() {
        render(state())
        compose.onNodeWithTag("profileStances.header.back")
            .assert(hasContentDescription("Back to the profile"))
            .performClick()
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun theBackArrowReadsBackToTheProfileOnADeletedAccountsPage() {
        render(state(profile = husk))
        compose.onNodeWithTag("profileStances.header.back").assert(hasContentDescription("Back to the profile"))
    }

    @Test
    fun theBackArrowReadsBackToYourProfileOnTheReadersOwn() {
        render(state(profile = me, own = true))
        compose.onNodeWithTag("profileStances.header.back").assert(hasContentDescription("Back to your profile"))
    }

    // -- the undrawn states: the house loading line, the transport line and Try again --

    @Test
    fun nothingReadYetStandsTheLoadingLine() {
        render(ProfileStancesUiState())
        compose.onNodeWithTag("stances_loading").assertExists()
        node("profileStances.list").assertDoesNotExist()
    }

    @Test
    fun aFaultWithNothingInItsPlaceStandsTryAgainWhichReadsAgain() {
        render(state(rows = null, failed = true))
        compose.onNodeWithTag("stances_transport_error").assertExists()
        compose.onNodeWithTag("stances_retry").performClick()
        assertThat(refreshes).isEqualTo(1)
    }
}
