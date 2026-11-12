package com.cogra.feature.invites

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.InviteLinkInfo
import com.cogra.domain.invites.InvitesRead
import com.cogra.domain.invites.LetInPerson
import com.cogra.domain.invites.QueueLink
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Duration
import java.time.Instant

/**
 * People you let in and the halves around it, compiled from the sidecars'
 * lines (Invites.md:7-35, :79-81; InvitesEmpty.md:5). Tall, so the lazy
 * column composes every section at once.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h2400dp")
class PeopleLetInScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val now: Instant = Instant.parse("2026-11-12T10:00:00Z")

    private fun person(id: String, name: String?, daysAgo: Long, redacted: Boolean = false) = LetInPerson(
        id = id,
        door = id,
        name = if (redacted) null else name ?: "@$id",
        monogram = if (redacted) "" else name ?: id,
        avatarUrl = null,
        redacted = redacted,
        vouchedAt = now.minus(Duration.ofDays(daysAgo)),
    )

    private val nadia = person("nadia-id", "Nadia Rahimi", 2)
    private val wren = person("wren-id", null, 5)
    private val juno = person("juno-id", "Juno Baptiste", 9)
    private val kel = person("kel-id", "Kel Osei", 12)
    private val tobias = person("tobias-id", "Tobias Lind", 16)

    private val imke = ApplicationInfo(
        id = "application-imke",
        handle = "imke",
        emailVerified = false,
        keyAttached = false,
        createdAt = now.minus(Duration.ofDays(9)),
        inviteLink = QueueLink("c47b19e0", singleUse = false),
    )

    private val liveLink = InviteLinkInfo(
        id = "8f3c1d2a-5b47-4e90-9a61-2d7fbc084e15",
        singleUse = true,
        createdAt = now,
        expiresAt = now.plus(Duration.ofDays(7)),
        revokedAt = null,
        usable = true,
    )

    private fun state(
        people: List<LetInPerson> = emptyList(),
        queue: List<ApplicationInfo> = emptyList(),
        links: List<InviteLinkInfo> = emptyList(),
    ) = InvitesUiState(read = InvitesRead(queue, links, people))

    private fun render(state: InvitesUiState, actions: InvitesActions = InvitesActions()) {
        compose.setContent {
            InvitesScreen(
                state = state,
                door = InvitesDoor.PROFILE,
                actions = actions,
                now = now,
                joinUrl = { "https://cogra.social/join/${it.id}" },
            )
        }
    }

    private fun top(tag: String): Float = compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot.top

    @Test
    fun invites7_peopleYouLetInStandsBetweenApplicationsAndLiveLinks() {
        render(state(listOf(nadia), listOf(imke), listOf(liveLink)))
        compose.onNodeWithTag("invites.peopleLabel").assertTextEquals("People you let in")
        assertThat(top("invites.applicationsLabel")).isLessThan(top("invites.peopleLabel"))
        assertThat(top("invites.peopleLabel")).isLessThan(top("invites.linksLabel"))
    }

    @Test
    fun invites9_theSectionIsAbsentLabelAndAllForAReaderWhoLetNobodyIn() {
        render(state(queue = listOf(imke), links = listOf(liveLink)))
        compose.onNodeWithTag("invites.peopleLabel").assertDoesNotExist()
        compose.onAllNodesWithText("People you let in").assertCountEquals(0)
    }

    @Test
    fun invites11_aRowIsTheNameElseTheHandleAndWhenTheyWereLetInNewestFirst() {
        render(state(listOf(nadia, wren), listOf(imke)))
        val first = compose.onNodeWithTag("invites.person:nadia-id")
        val second = compose.onNodeWithTag("invites.person:wren-id")
        first.assertIsDisplayed()
        assertThat(first.fetchSemanticsNode().boundsInRoot.top)
            .isLessThan(second.fetchSemanticsNode().boundsInRoot.top)
        compose.onAllNodesWithTag("invites.person.title", useUnmergedTree = true).let { titles ->
            titles[0].assertTextEquals("Nadia Rahimi")
            titles[1].assertTextEquals("@wren")
        }
        compose.onAllNodesWithTag("invites.person.trailing", useUnmergedTree = true).let { ages ->
            ages[0].assertTextEquals("2d")
            ages[1].assertTextEquals("5d")
        }
        // No line of status: nothing waits on anyone here.
        compose.onAllNodesWithTag("invites.person.second", useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun invites13_aRowCarriesNoControlOfItsOwnAndWearsTheChevron() {
        render(state(listOf(nadia, wren), listOf(imke)))
        compose.onAllNodesWithTag("invites.person.chevron", useUnmergedTree = true).assertCountEquals(2)
        // The application's close stands on the application alone.
        compose.onAllNodesWithTag("invites.application.close", useUnmergedTree = true).assertCountEquals(1)
    }

    @Test
    fun invites15_moreThanThreeShowTheThreeNewestThenShowAllUnderTheThird() {
        render(state(listOf(nadia, wren, juno, kel, tobias), listOf(imke)))
        listOf("nadia-id", "wren-id", "juno-id").forEach { compose.onNodeWithTag("invites.person:$it").assertExists() }
        compose.onNodeWithTag("invites.person:kel-id").assertDoesNotExist()
        compose.onNodeWithTag("invites.peopleDoor").assertTextEquals("Show all")
        assertThat(top("invites.person:juno-id")).isLessThan(top("invites.peopleDoor"))
    }

    @Test
    fun invites17_threeOrFewerShowEveryRowAndNoDoor() {
        render(state(listOf(nadia, wren, juno), listOf(imke)))
        listOf("nadia-id", "wren-id", "juno-id").forEach { compose.onNodeWithTag("invites.person:$it").assertExists() }
        compose.onNodeWithTag("invites.peopleDoor").assertDoesNotExist()
    }

    @Test
    fun invites19_theDoorOpensEveryoneInPlaceAndLeavesAndNothingElseDoes() {
        var shown by mutableStateOf(state(listOf(nadia, wren, juno, kel, tobias), listOf(imke), listOf(liveLink)))
        compose.setContent {
            InvitesScreen(
                state = shown,
                door = InvitesDoor.PROFILE,
                actions = InvitesActions(onShowAllPeople = { shown = shown.copy(peopleOpened = true) }),
                now = now,
                joinUrl = { "https://cogra.social/join/${it.id}" },
            )
        }
        compose.onNodeWithTag("invites.peopleDoor").performClick()
        compose.waitForIdle()
        listOf("nadia-id", "wren-id", "juno-id", "kel-id", "tobias-id").forEach {
            compose.onNodeWithTag("invites.person:$it").assertExists()
        }
        assertThat(top("invites.person:kel-id")).isLessThan(top("invites.person:tobias-id"))
        compose.onNodeWithTag("invites.peopleDoor").assertDoesNotExist()
        // NEVER anything else leaves the page; NEVER a control to show fewer.
        compose.onNodeWithTag("invites.applicationsLabel").assertExists()
        compose.onNodeWithTag("invites.linksLabel").assertExists()
        compose.onNodeWithTag("invites.application:imke").assertExists()
        compose.onAllNodesWithText("Show fewer", substring = true, ignoreCase = true).assertCountEquals(0)
        compose.onAllNodesWithText("Show all").assertCountEquals(0)
    }

    @Test
    fun invites21_onlyPeopleLetInCarriesNewInviteAndPeopleAndNeitherHalf() {
        render(state(listOf(nadia)))
        compose.onNodeWithTag("invites.create").assertTextEquals("New invite")
        compose.onNodeWithTag("invites.peopleLabel").assertExists()
        listOf(
            "invites.applicationsLabel",
            "invites.applicationsEmpty",
            "invites.linksLabel",
            "invites.linksEmpty",
            "invites.empty",
        ).forEach { compose.onNodeWithTag(it).assertDoesNotExist() }
        assertThat(top("invites.create")).isLessThan(top("invites.peopleLabel"))
    }

    @Test
    fun invitesEmpty5_theEmptyInvitesNeverStandsGivenSomeoneWasLetIn() {
        render(state(listOf(nadia)))
        compose.onNodeWithTag("invites.empty").assertDoesNotExist()
        compose.onNodeWithTag("invites.empty.create").assertDoesNotExist()
    }

    @Test
    fun invites23_27_aPersonsRowOpensTheirPageDeletedOrNot() {
        val gone = person("gone-id", null, 5, redacted = true)
        val opened = mutableListOf<LetInPerson>()
        render(state(listOf(nadia, gone), listOf(imke)), InvitesActions(onOpenPerson = { opened += it }))
        compose.onNodeWithTag("invites_person_nadia-id_open", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("invites_person_gone-id_open", useUnmergedTree = true).performClick()
        assertThat(opened.map { it.door }).containsExactly("nadia-id", "gone-id").inOrder()
    }

    @Test
    fun invites25_aDeletedAccountKeepsItsPlaceAndAgeAndPrintsNoHandle() {
        val gone = person("gone-id", null, 5, redacted = true)
        render(state(listOf(nadia, gone), listOf(imke)))
        compose.onNodeWithTag("invites.redactedPerson:gone-id").assertExists()
        compose.onNodeWithTag("invites.person:gone-id").assertDoesNotExist()
        compose.onNodeWithTag("invites.redactedPerson.title", useUnmergedTree = true)
            .assertTextEquals("Deleted account")
        compose.onNodeWithTag("invites.redactedPerson.trailing", useUnmergedTree = true).assertTextEquals("5d")
        compose.onNodeWithTag("invites.redactedPerson.chevron", useUnmergedTree = true).assertExists()
        compose.onAllNodesWithText("@gone-id", substring = true).assertCountEquals(0)
        assertThat(top("invites.person:nadia-id")).isLessThan(top("invites.redactedPerson:gone-id"))
    }

    @Test
    fun invites29_31_noApplicationWaitingKeepsItsLabelOverItsQuietLine() {
        render(state(links = listOf(liveLink)))
        compose.onNodeWithTag("invites.applicationsLabel").assertTextEquals("Applications")
        compose.onNodeWithTag("invites.applicationsEmpty").assertTextEquals("No applications waiting.")
        assertThat(top("invites.applicationsLabel")).isLessThan(top("invites.applicationsEmpty"))
        compose.onNodeWithTag("invites.linksEmpty").assertDoesNotExist()
        compose.onNodeWithTag("invites.empty").assertDoesNotExist()
    }

    @Test
    fun invites29_33_noLiveLinkKeepsItsLabelOverItsQuietLine() {
        render(state(queue = listOf(imke)))
        compose.onNodeWithTag("invites.linksLabel").assertTextEquals("Live links")
        compose.onNodeWithTag("invites.linksEmpty").assertTextEquals("No live links.")
        assertThat(top("invites.linksLabel")).isLessThan(top("invites.linksEmpty"))
        compose.onNodeWithTag("invites.applicationsEmpty").assertDoesNotExist()
    }

    @Test
    fun invites79_81_aCopyThatFailedSaysSoOnItsCardAndRetryAsksAgain() {
        val copies = mutableListOf<String>()
        render(
            state(links = listOf(liveLink), queue = listOf(imke)).copy(copyFailed = liveLink.id),
            InvitesActions(onCopy = { copies += it.id }),
        )
        compose.onNodeWithTag("invites.link.copyFault", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("That didn't go through.", useUnmergedTree = true).assertExists()
        // The link stays whole on the card, and the line is the card's last.
        compose.onNodeWithText("https://cogra.social/join/${liveLink.id}", useUnmergedTree = true).assertExists()
        val caption = compose.onNodeWithTag("invites.link.caption", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot.top
        val fault = compose.onNodeWithTag("invites.link.copyFault", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot.top
        assertThat(caption).isLessThan(fault)
        compose.onAllNodesWithText("Link copied").assertCountEquals(0)

        compose.onNodeWithTag("invites_copy_fault_retry", useUnmergedTree = true).performClick()
        assertThat(copies).containsExactly(liveLink.id)
    }

    @Test
    fun invites79_aCopyThatWentThroughCarriesNoLine() {
        render(state(links = listOf(liveLink), queue = listOf(imke)))
        compose.onNodeWithTag("invites.link.copyFault", useUnmergedTree = true).assertDoesNotExist()
    }
}
