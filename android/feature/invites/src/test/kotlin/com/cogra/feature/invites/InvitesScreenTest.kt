package com.cogra.feature.invites

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.InviteLinkInfo
import com.cogra.domain.invites.InvitesRead
import com.cogra.domain.invites.QueueLink
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Duration
import java.time.Instant

/** The Invites page as drawn, compiled from the sidecars' lines (Invites.md, InvitesEmpty.md, Reject*.md). */
@RunWith(RobolectricTestRunner::class)
class InvitesScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val now: Instant = Instant.parse("2026-09-15T10:00:00Z")
    private val many = QueueLink("c47b19e0-3a52-4f68-b1d9-6e0a85f37c24", singleUse = false)

    private fun row(handle: String, ready: Boolean = true, link: QueueLink? = many) = ApplicationInfo(
        id = "application-$handle",
        handle = handle,
        emailVerified = ready,
        keyAttached = ready,
        createdAt = now.minus(Duration.ofDays(2)),
        inviteLink = link,
    )

    private val liveLink = InviteLinkInfo(
        id = "8f3c1d2a-5b47-4e90-9a61-2d7fbc084e15",
        singleUse = true,
        createdAt = now,
        expiresAt = now.plus(Duration.ofDays(7)),
        revokedAt = null,
        usable = true,
    )

    private fun render(
        state: InvitesUiState,
        door: InvitesDoor = InvitesDoor.PROFILE,
        actions: InvitesActions = InvitesActions(),
    ) {
        compose.setContent {
            InvitesScreen(
                state = state,
                door = door,
                actions = actions,
                now = now,
                joinUrl = { "https://cogra.social/join/${it.id}" },
            )
        }
    }

    private fun read(queue: List<ApplicationInfo> = emptyList(), links: List<InviteLinkInfo> = emptyList()) =
        InvitesUiState(read = InvitesRead(queue, links))

    @Test
    fun newInviteHeadsTheColumnThenApplicationsThenLiveLinks() {
        // Invites.md:5, :7.
        render(read(listOf(row("imke")), listOf(liveLink)))
        compose.onNodeWithTag("invites.create").assertTextEquals("New invite")
        compose.onNodeWithTag("invites.applicationsLabel").assertTextEquals("Applications")
        compose.onNodeWithTag("invites.linksLabel").assertTextEquals("Live links")
        val labels = compose.onNodeWithTag("invites.applicationsLabel").fetchSemanticsNode().boundsInRoot.top
        val links = compose.onNodeWithTag("invites.linksLabel").fetchSemanticsNode().boundsInRoot.top
        assertThat(labels).isLessThan(links)
    }

    @Test
    fun aGroupIsLabelledWithItsLinkAndCountAndClosesAllOnlyPastOne() {
        // Invites.md:9, :15, :17; RejectAllConfirm.md:9.
        render(read(listOf(row("imke"), row("vora"), row("solo", link = QueueLink("single-1", true)))))
        compose.onNodeWithText("Many uses · 2 waiting").assertIsDisplayed()
        compose.onNodeWithText("Single use · 1 waiting").assertIsDisplayed()
        compose.onAllNodesWithTag("invites.group.close").assertCountEquals(1)
        compose.onNodeWithContentDescription("Close all 2 applications from this link").assertExists()
    }

    @Test
    fun aRowWearsTheHandleAloneAndTheReadersFactNeverTheMissingProof() {
        // Invites.md:19, :21, :23.
        render(read(listOf(row("imke", ready = false), row("rafa"))))
        compose.onNodeWithText("@imke").assertIsDisplayed()
        compose.onNodeWithText("Not fully registered yet").assertIsDisplayed()
        compose.onNodeWithText("Ready for your approval").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close @imke's application").assertExists()
        compose.onAllNodesWithText("email", substring = true).assertCountEquals(0)
        compose.onAllNodesWithText("key", substring = true).assertCountEquals(0)
    }

    @Test
    fun theRowsTapAndItsCloseRaiseTheirOwnActs() {
        // Invites.md:39-43.
        var opened: String? = null
        var closed: String? = null
        render(
            read(listOf(row("imke"))),
            actions = InvitesActions(onOpenRow = { opened = it.handle }, onCloseRow = { closed = it.handle }),
        )
        compose.onNodeWithTag("invites_application_application-imke_open").performClick()
        compose.onNodeWithContentDescription("Close @imke's application").performClick()
        assertThat(opened).isEqualTo("imke")
        assertThat(closed).isEqualTo("imke")
    }

    @Test
    fun aLiveLinksCardHoldsTheLinkWholeLabelledAndCaptioned() {
        // Invites.md:27; copy-voice — no token, no reward.
        render(read(links = listOf(liveLink)))
        compose.onNodeWithText("Single use · not used yet").assertIsDisplayed()
        compose.onNodeWithText("https://cogra.social/join/${liveLink.id}").assertIsDisplayed()
        compose.onNodeWithText("Expires in 7 days", substring = true).assertIsDisplayed()
        compose.onNodeWithContentDescription("Copy the link").assertExists()
        compose.onNodeWithText("Revoke").assertIsDisplayed()
        compose.onAllNodesWithText("token", substring = true).assertCountEquals(0)
    }

    @Test
    fun revokeReadsItsWordUntilTheParticipleDelay() {
        // Invites.md:49, :51 — inert from the press, never a spinner.
        var revokes = 0
        render(
            read(links = listOf(liveLink)).copy(revoking = liveLink.id),
            actions = InvitesActions(onRevoke = { revokes++ }),
        )
        compose.mainClock.advanceTimeBy(300)
        compose.onNodeWithText("Revoking…").assertIsDisplayed()
        compose.onNodeWithText("Revoking…").performClick()
        assertThat(revokes).isEqualTo(0)
    }

    @Test
    fun theEmptyInvitesSaysTheCalmLineWithCreateInvite() {
        // InvitesEmpty.md:3, :5.
        var opened = 0
        render(read(), actions = InvitesActions(onOpenSheet = { opened++ }))
        compose.onNodeWithText(
            "No invites out yet. A link lets someone make an account. Your vouch — the opinion you sign " +
                "when you approve them — is what brings them in.",
        ).assertIsDisplayed()
        compose.onNodeWithTag("invites.empty.create").assertTextEquals("Create invite").performClick()
        assertThat(opened).isEqualTo(1)
        compose.onNodeWithTag("invites.create").assertDoesNotExist()
    }

    @Test
    fun theBackArrowNamesItsDoor() {
        // Invites.md:97.
        render(read(), door = InvitesDoor.NOTIFICATIONS)
        compose.onNodeWithContentDescription("Back to Notifications").assertExists()
    }

    @Test
    fun theRowCloseDialogNamesTheRowWithKeepFilledOnTheRight() {
        // RejectConfirm.md:3, :9.
        val imke = row("imke")
        render(read(listOf(imke)).copy(closing = ClosingState(CloseTarget.One(imke))))
        compose.onNodeWithTag("invites.dialog.title").assertTextEquals("Close @imke's application?")
        compose.onNodeWithText("It leaves your list and @imke is told.", substring = true).assertExists()
        compose.onNodeWithText("@imke gets a link to ask with.", substring = true).assertExists()
        val close = compose.onNodeWithTag("invites.dialog.close").fetchSemanticsNode().boundsInRoot.left
        val keep = compose.onNodeWithTag("invites.dialog.keep").fetchSemanticsNode().boundsInRoot.left
        assertThat(close).isLessThan(keep)
        compose.onNodeWithTag("invites.dialog.close").assertTextEquals("Close it")
        compose.onNodeWithTag("invites.dialog.keep").assertTextEquals("Keep it")
    }

    @Test
    fun aFailedClosingSaysSoAndItsCommitReadsRetry() {
        // RejectConfirm.md:23.
        val imke = row("imke")
        render(read(listOf(imke)).copy(closing = ClosingState(CloseTarget.One(imke), failed = true)))
        compose.onNodeWithText("That didn't send. Try again.").assertExists()
        compose.onNodeWithTag("invites.dialog.close").assertTextEquals("Retry")
    }

    @Test
    fun aClosingInFlightReadsClosingItPastTheDelay() {
        // RejectConfirm.md:17.
        val imke = row("imke")
        render(read(listOf(imke)).copy(closing = ClosingState(CloseTarget.One(imke), working = true)))
        compose.mainClock.advanceTimeBy(300)
        compose.onNodeWithTag("invites.dialog.close").assertTextEquals("Closing it…")
    }

    @Test
    fun theBatchDialogCountsInWordsAndNamesNoHandles() {
        // RejectAllConfirm.md:3, :7, :13.
        val rows = listOf(row("a"), row("b"), row("c"), row("d"))
        val group = com.cogra.domain.invites.layoutQueue(rows).groups.single()
        render(read(rows).copy(closing = ClosingState(CloseTarget.All(group))))
        compose.onNodeWithTag("invites.dialog.title").assertTextEquals("Close all 4 applications from this link?")
        compose.onNodeWithText("All four leave your list and all four people are told.", substring = true)
            .assertExists()
        compose.onAllNodesWithText("@a", substring = true).assertCountEquals(1)
        compose.onNodeWithTag("invites.dialog.close").assertTextEquals("Close them")
        compose.onNodeWithTag("invites.dialog.keep").assertTextEquals("Keep them")
    }

    @Test
    fun theCreateSheetHoldsTwoChoicesTheFootnoteAndCreateInvite() {
        // InviteNew.md:3, :7, :9, :11.
        render(read().copy(sheet = InviteSheetState()))
        compose.onNodeWithText("Only one person can use it").assertExists()
        compose.onNodeWithText("Expires after").assertExists()
        compose.onNodeWithText("7 days").assertExists()
        compose.onNodeWithText(
            "With it off, anyone holding the link can apply until it expires. Either way each person still " +
                "needs your approval, one at a time.",
        ).assertExists()
        compose.onNodeWithTag("invites.sheet.create").assertTextEquals("Create invite")
    }

    @Test
    fun theFreshLinksSheetServesTheLinkAndShareLink() {
        // InviteCreated.md:3, :5, :9.
        render(read().copy(sheet = InviteSheetState(created = liveLink)))
        compose.onNodeWithText("Your invite link").assertExists()
        compose.onNodeWithText("https://cogra.social/join/${liveLink.id}").assertExists()
        compose.onNodeWithTag("invites.sheet.share").assertTextEquals("Share link")
    }

    @Test
    fun theExpiryChooserOffersThreeLengthsWithOneSelected() {
        // InviteExpiry.md:5, :7.
        render(read().copy(sheet = InviteSheetState(choosing = true)))
        compose.onNodeWithText("24 hours").assertExists()
        compose.onNodeWithText("30 days").assertExists()
        compose.onAllNodesWithText("7 days").assertCountEquals(2)
    }
}
