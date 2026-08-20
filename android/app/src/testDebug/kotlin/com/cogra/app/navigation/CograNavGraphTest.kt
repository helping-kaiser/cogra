// NavHost tests per the documented Navigation Compose pattern: a
// TestNavHostController drives the real graph, real destinations, and
// real Hilt ViewModels over the fake DI graph (FakeBindingsModule).

package com.cogra.app.navigation

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.performTextInput
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.ComposeNavigator
import androidx.navigation.testing.TestNavHostController
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.app.HiltTestActivity
import com.cogra.app.di.ScriptedAccountRepository
import com.cogra.app.di.ScriptedContentRepository
import com.cogra.app.di.ScriptedOnboardingRepository
import com.cogra.app.di.ScriptedProfileRepository
import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.sealKeyBackup
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.AuthTokens
import com.cogra.domain.UserProfile
import com.cogra.domain.identity.SecurityNotices
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeStorageHealth
import com.cogra.domain.testing.FakeTokenStore
import java.time.Instant
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import javax.inject.Inject
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class CograNavGraphTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var onboarding: ScriptedOnboardingRepository

    @Inject lateinit var content: ScriptedContentRepository

    @Inject lateinit var profiles: ScriptedProfileRepository

    @Inject lateinit var notices: SecurityNotices

    @Inject lateinit var storageHealth: FakeStorageHealth

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    private fun render() {
        compose.setContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            CograNavGraph(navController = navController)
        }
        compose.waitForIdle()
    }

    private fun signIn() = runBlocking {
        tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1"))
    }

    private fun member(): UserProfile {
        profiles.profile = com.cogra.domain.testing.testProfile(id = "u1", handle = "jakob")
        return UserProfile("u1", "jakob", null, AccountState.MEMBER, true, invitedBy = null)
    }

    private fun applicant(): UserProfile {
        profiles.profile = com.cogra.domain.testing.testProfile(id = "u1", handle = "joiner")
        return UserProfile("u1", "joiner", null, AccountState.APPLICANT, false, invitedBy = null)
    }

    private fun applicantStatus(keyAttached: Boolean) = ApplicationStatus(
        accountState = AccountState.APPLICANT,
        application = ApplicationView(
            handle = "joiner",
            emailVerified = true,
            keyAttached = keyAttached,
            approvedAt = null,
            landedAt = null,
            expiresAt = Instant.MAX,
        ),
        stagedRegistration = null,
        actorPubkey = null,
    )

    /** A real UUID: the entry's paste-fallback extraction demands one. */
    private val inviteId = "0b54c8ea-9f10-4c4e-8d67-2a1f3f6de901"

    private fun joinIntent(path: String) =
        Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.WEB_ORIGIN}$path"))

    private fun currentInviteEntry(): InviteEntry? =
        navController.currentBackStackEntry
            ?.takeIf { it.destination.hasRoute<InviteEntry>() }
            ?.toRoute<InviteEntry>()

    private fun waitForTag(tag: String) {
        // Generous: the first Robolectric + Hilt test in a JVM pays a
        // multi-second class-loading warmup that once tripped 5s.
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun aSignedOutUserLandsOnTheLoginScreen() {
        render()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Login>())
            .isTrue()
    }

    @Test
    fun theSecurityNoticeShowsAboveTheGraphAndDismissesOnce() {
        // The shell renders the notice wherever navigation stands
        // (auth.md "Reuse detection"); dismissal consumes it for good.
        render()
        notices.post(Instant.parse("2026-08-10T09:30:00Z"))
        waitForTag("security_notice")
        compose.onNodeWithTag("security_notice_dismiss").performClick()
        compose.waitForIdle()
        assertThat(compose.onAllNodesWithTag("security_notice").fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun theStorageLossNoticeShowsAboveTheGraphAndAcknowledges() {
        // Secure-store data loss is surfaced, never silent; the
        // acknowledgement clears the persisted mark.
        render()
        storageHealth.lost.value = true
        waitForTag("storage_notice")
        compose.onNodeWithTag("storage_notice_dismiss").performClick()
        compose.waitForIdle()
        assertThat(compose.onAllNodesWithTag("storage_notice").fetchSemanticsNodes()).isEmpty()
        assertThat(storageHealth.lost.value).isFalse()
    }

    @Test
    fun theFeedOpensAPostAndItsThread() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        content.details["p1"] = com.cogra.domain.PostDetail(
            post = com.cogra.domain.testing.testPost("p1"),
            comments = com.cogra.domain.Page(
                listOf(com.cogra.domain.testing.testComment("c1")),
                endCursor = null,
                hasNextPage = false,
            ),
        )
        render()
        // The signed-in root IS the feed tab (design.md §6).
        waitForTag("feed_post_p1")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()

        compose.onNodeWithTag("feed_post_p1").performClick()
        waitForTag("detail_comment_c1")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<PostDetail>()).isTrue()

        // A read drill-in keeps the frame and carries its own back arrow
        // (design.md §6); no tab is selected.
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isNotEmpty()
        assertThat(compose.onAllNodesWithTag("detail_back").fetchSemanticsNodes()).isNotEmpty()
    }

    @Test
    fun theComposerOpensFromTheBarsCenterAction() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        waitForTag("bar_compose")
        compose.onNodeWithTag("bar_compose").performClick()
        waitForTag("compose_body")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<ComposePost>()).isTrue()
        // A task flow owns the screen: the bar leaves (design.md §6).
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isEmpty()
    }

    // Content exists at authoring, not at landing (substrate.md §6), so
    // a signed post has somewhere to go: its own detail, where the
    // settling marker sits on it.
    @Test
    fun aSignedPostOpensOnItsOwnDetail() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        content.preparedNode = "p-new"
        content.details["p-new"] = com.cogra.domain.PostDetail(
            post = com.cogra.domain.testing.testPost(
                "p-new",
                landing = com.cogra.domain.Landing.Pending,
            ),
            comments = com.cogra.domain.Page(emptyList(), endCursor = null, hasNextPage = false),
        )
        render()
        waitForTag("bar_compose")
        compose.onNodeWithTag("bar_compose").performClick()
        waitForTag("compose_body")
        compose.onNodeWithTag("compose_body").performTextInput("Something new")
        compose.onNodeWithTag("compose_submit").performClick()

        waitForTag("detail_pending")
        val entry = navController.currentBackStackEntry
        assertThat(entry?.destination?.hasRoute<PostDetail>()).isTrue()
        assertThat(entry?.toRoute<PostDetail>()?.postId).isEqualTo("p-new")

        // The composer left the stack: back returns to the reading
        // context that launched it, not to a spent form.
        assertThat(navController.previousBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
    }

    @Test
    fun theBottomBarSwitchesToTheProfileTab() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        waitForTag("bar_profile")
        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("profile_display_name")
        val entry = navController.currentBackStackEntry
        assertThat(entry?.destination?.hasRoute<Profile>()).isTrue()
        assertThat(entry?.toRoute<Profile>()?.handle).isNull()
        // The own-profile tab carries no back arrow; the bar stays.
        assertThat(compose.onAllNodesWithTag("profile_back").fetchSemanticsNodes()).isEmpty()
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isNotEmpty()

        // Back to the feed tab by the bar.
        compose.onNodeWithTag("bar_feed").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
    }

    @Test
    fun anAuthorChipOpensTheirProfile() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        profiles.others["author"] =
            com.cogra.domain.testing.testProfile(id = "author-1", handle = "author")
        render()
        waitForTag("feed_author_p1")
        compose.onNodeWithTag("feed_author_p1").performClick()
        waitForTag("profile_display_name")
        val entry = navController.currentBackStackEntry
        assertThat(entry?.destination?.hasRoute<Profile>()).isTrue()
        assertThat(entry?.toRoute<Profile>()?.handle).isEqualTo("author")
        // Another actor's profile is a read drill-in: back arrow, no
        // edit, and the frame stays with no tab selected.
        assertThat(compose.onAllNodesWithTag("profile_back").fetchSemanticsNodes()).isNotEmpty()
        assertThat(compose.onAllNodesWithTag("profile_edit").fetchSemanticsNodes()).isEmpty()
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isNotEmpty()
    }

    @Test
    fun theProfileEditSavesAndConfirms() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        waitForTag("bar_profile")
        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("profile_edit")
        compose.onNodeWithTag("profile_edit").performScrollTo().performClick()
        waitForTag("profile_edit_bio")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<ProfileEdit>()).isTrue()
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isEmpty()

        compose.onNodeWithTag("profile_edit_bio").performTextInput("Hello from the hand test.")
        compose.onNodeWithTag("profile_edit_save").performScrollTo().performClick()

        // The save pops back to the profile, which re-reads.
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Profile>() == true
        }
        assertThat(profiles.updates).hasSize(1)
        assertThat(profiles.updates.first().second).contains("Hello")
        compose.waitUntilAtLeastOneExists(
            hasTestTag("profile_bio") and hasText("Hello", substring = true),
            timeoutMillis = 30_000,
        )
    }

    // The guest read shell: Feed and PostDetail live on the signed-out
    // stack too, write affordances swapped for join entries
    // (android.md "Screens").

    @Test
    fun aGuestBrowsesTheFeedFromTheFrontDoor() {
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        render()
        waitForTag("login_browse")
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        waitForTag("feed_post_p1")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        // One shell for every viewer: the guest keeps the bar.
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isNotEmpty()
        assertThat(compose.onAllNodesWithTag("feed_signin").fetchSemanticsNodes()).isNotEmpty()
    }

    @Test
    fun aGuestReadsAPostAndItsJoinEntryKeepsTheReadingContext() {
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        content.details["p1"] = com.cogra.domain.PostDetail(
            post = com.cogra.domain.testing.testPost("p1"),
            comments = com.cogra.domain.Page(
                listOf(com.cogra.domain.testing.testComment("c1")),
                endCursor = null,
                hasNextPage = false,
            ),
        )
        render()
        waitForTag("login_browse")
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        waitForTag("feed_post_p1")
        compose.onNodeWithTag("feed_post_p1").performClick()
        // The thread is a lazy list, so the prompt below it is composed
        // only once scrolled to.
        waitForTag("detail_list")
        compose.onNodeWithTag("detail_list")
            .performScrollToNode(hasTestTag("detail_comment_signin"))
        waitForTag("detail_comment_signin")
        // The composer is absent for the anonymous reader, swapped —
        // never merely disabled.
        assertThat(compose.onAllNodesWithTag("detail_comment_input").fetchSemanticsNodes()).isEmpty()

        // The frame rides the drill-in for the guest too, its gated
        // slots still asking in place rather than bouncing the read.
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isNotEmpty()
        compose.onNodeWithTag("bar_compose").performClick()
        waitForTag("join_prompt")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<PostDetail>()).isTrue()
        compose.onNodeWithTag("join_prompt_dismiss").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag("join_prompt").fetchSemanticsNodes().isEmpty()
        }

        // The join entry pushes the login screen, so back returns to the
        // post (web parity: the guest entries link to /login).
        compose.onNodeWithTag("detail_comment_signin").performScrollTo().performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Login>()).isTrue()
        assertThat(navController.previousBackStackEntry?.destination?.hasRoute<PostDetail>()).isTrue()
    }

    @Test
    fun aGuestsComposeSlotAsksAndSignInPushesTheLogin() {
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        render()
        waitForTag("login_browse")
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        waitForTag("feed_post_p1")

        // The gated slot asks in place — the feed stays underneath.
        compose.onNodeWithTag("bar_compose").performClick()
        waitForTag("join_prompt")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()

        // Sign in or join pushes the login, back returning to the read.
        compose.onNodeWithTag("join_prompt_signin").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Login>()).isTrue()
        assertThat(navController.previousBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
    }

    @Test
    fun aGuestsProfileSlotAsksAndKeepBrowsingStays() {
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        render()
        waitForTag("login_browse")
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        waitForTag("feed_post_p1")

        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("join_prompt")

        // Keep browsing dismisses; nothing navigated.
        compose.onNodeWithTag("join_prompt_dismiss").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag("join_prompt").fetchSemanticsNodes().isEmpty()
        }
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
    }

    @Test
    fun signingInWhileBrowsingLandsOnTheFeedTabWithAClearedStack() {
        content.listing = listOf(com.cogra.domain.testing.testPost("p1"))
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        waitForTag("login_browse")
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        waitForTag("feed_signin")

        signIn()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true &&
                navController.previousBackStackEntry == null
        }
    }

    @Test
    fun aSignedInSessionLandsOnTheFeedTabWithTheBar() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        waitForTag("bottom_bar")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
    }

    @Test
    fun aRestoredActorRefreshesTheShellAndConfirms() {
        val actor = ActorKey.generate()
        val code = RecoveryCode.generate()
        signIn()
        identity.seed = null
        account.profile = member()
        account.backupBlob = sealKeyBackup(actor.seed(), code)
        render()

        // The husk state offers restore; take it.
        waitForTag("home_restore")
        compose.onNodeWithTag("home_restore").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Restore>()).isTrue()

        // A real restore: the typed code opens the sealed blob.
        compose.onNodeWithTag("restore_code").performTextInput(code.display())
        compose.onNodeWithTag("restore_submit").performClick()

        // Back on the feed tab with the husk banner gone — no process
        // death. (The snackbar itself is asserted in StatusBannersTest;
        // under Robolectric's fast-forwarded clock it auto-dismisses
        // before a poll can catch it here.)
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true &&
                compose.onAllNodesWithTag("home_restore").fetchSemanticsNodes().isEmpty()
        }
        assertThat(identity.seed).isEqualTo(actor.seed())
    }

    // The husk banner rides every main surface (design.md §6): the
    // composer warns before drafting, settings alongside the backup
    // card.
    @Test
    fun theHuskBannerRidesTheComposerAndSettings() {
        signIn()
        identity.seed = null
        account.profile = member()
        render()

        waitForTag("bar_compose")
        compose.onNodeWithTag("bar_compose").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<ComposePost>() == true
        }
        waitForTag("home_restore")

        compose.onNodeWithTag("compose_back").performClick()
        waitForTag("bar_profile")
        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("profile_settings")
        compose.onNodeWithTag("profile_settings").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Settings>() == true
        }
        waitForTag("home_restore")
    }

    @Test
    fun aChangedHandleRefreshesTheProfile() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()

        waitForTag("bar_profile")
        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("profile_settings")
        compose.onNodeWithTag("profile_settings").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Settings>()).isTrue()

        compose.onNodeWithTag("settings_new_handle").performScrollTo().performTextInput("renamed")
        compose.onNodeWithTag("settings_change_handle").performScrollTo().performClick()
        compose.waitForIdle()
        // The service knows the new handle; the profile fake follows.
        profiles.profile = com.cogra.domain.testing.testProfile(id = "u1", handle = "renamed")

        // The scroll to the handle field collapsed the enterAlways bar;
        // an upward swipe brings it back before the tap — the thumb's
        // own gesture.
        compose.onRoot().performTouchInput { swipeDown() }
        compose.waitForIdle()

        // The profile outlives the push/pop; only the nav result
        // re-reads, so the handle must refresh on return.
        compose.onNodeWithTag("settings_back").performClick()
        compose.waitUntilAtLeastOneExists(
            hasTestTag("profile_handle") and hasText("renamed", substring = true),
            timeoutMillis = 30_000,
        )
    }

    @Test
    fun settingsReachesTheKeyExportScreen() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()

        waitForTag("bar_profile")
        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("profile_settings")
        compose.onNodeWithTag("profile_settings").performClick()
        compose.waitForIdle()
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isEmpty()

        compose.onNodeWithTag("settings_export_key").performScrollTo().performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<KeyExport>()).isTrue()
        // Arriving reveals nothing: the screen's own gate stands first.
        compose.onNodeWithTag("key_export_reveal").assertExists()
        compose.onNodeWithTag("key_export_pem").assertDoesNotExist()

        compose.onNodeWithTag("key_export_back").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Settings>()).isTrue()
    }

    @Test
    fun anApplicantLandsInTheShellWithTheWaitingHint() {
        // Registration returned an ordinary session: the applicant is
        // simply signed in, and the feed tab is the root — never a
        // wall; the application rides along as shell banners.
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = applicant()
        onboarding.status = applicantStatus(keyAttached = true)
        render()

        waitForTag("home_waiting")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        // Only acting is gated: the bar stays, the shell stays open.
        assertThat(compose.onAllNodesWithTag("bottom_bar").fetchSemanticsNodes()).isNotEmpty()
    }

    @Test
    fun anApplicantReachesSettingsAndSignsOut() {
        // The applicant is an ordinary logged-in account (auth.md
        // "Application"): account management is never gated.
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = applicant()
        onboarding.status = applicantStatus(keyAttached = true)
        render()

        waitForTag("bar_profile")
        compose.onNodeWithTag("bar_profile").performClick()
        waitForTag("profile_settings")
        compose.onNodeWithTag("profile_settings").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Settings>()).isTrue()

        compose.onNodeWithTag("settings_sign_out").performScrollTo().performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Login>() == true
        }
    }

    @Test
    fun theCeremonyCardRunsTheKeyCeremonyAndReturns() {
        signIn()
        identity.seed = null
        account.profile = applicant()
        onboarding.status = applicantStatus(keyAttached = false)
        render()

        // The missing key proof surfaces as a card; take it.
        waitForTag("home_create_key")
        compose.onNodeWithTag("home_create_key").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<KeyCeremony>()).isTrue()

        // Accept the backup: mint, attach, seal, show the code once.
        compose.onNodeWithTag("backup_accept").performClick()
        waitForTag("recovery_code")
        assertThat(identity.seed).isNotNull()
        assertThat(onboarding.attachedKeys).hasSize(1)
        assertThat(account.uploadedBackup).isNotNull()

        // Confirming the code — by typing it back — pops into the Home shell.
        val shown = compose.onNodeWithTag("recovery_code")
            .fetchSemanticsNode()
            .config[SemanticsProperties.Text]
            .single()
            .text
        compose.onNodeWithTag("recovery_code_typed_back").performTextInput(shown)
        compose.onNodeWithTag("recovery_code_saved").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true
        }
    }

    // Cold-start deep links ride the same NavController.handleDeepLink
    // call the framework makes on the launch intent at graph-set time;
    // the tests invoke it directly because replacing the scenario's
    // launch intent deadlocks ActivityScenario.close under Robolectric.
    // The true launch-intent plumbing is covered by the on-device link
    // check (hand-test notes).

    @Test
    fun aJoinDeepLinkCarriesTheIdIntoTheEntry() {
        render()
        val handled = navController.handleDeepLink(joinIntent("/join/$inviteId"))
        compose.waitUntil(timeoutMillis = 30_000) {
            onboarding.checkedInviteIds.isNotEmpty()
        }
        assertThat(handled).isTrue()
        assertThat(currentInviteEntry()?.inviteId).isEqualTo(inviteId)
        // The entry auto-checked exactly the linked id.
        assertThat(onboarding.checkedInviteIds).containsExactly(inviteId)
    }

    @Test
    fun aBareJoinLinkLandsOnTheEntryWithNoId() {
        // /join with no id segment must not forward a phantom id
        // (the old parse forwarded the literal "join").
        render()
        val handled = navController.handleDeepLink(joinIntent("/join"))
        compose.waitForIdle()
        assertThat(handled).isTrue()
        assertThat(currentInviteEntry()?.inviteId).isNull()
        assertThat(onboarding.checkedInviteIds).isEmpty()
    }

    @Test
    fun aWarmStartJoinLinkReachesTheEntry() {
        // singleTask delivers a link tap on a running app via
        // onNewIntent; the graph's listener forwards it.
        render()
        compose.activity.dispatchNewIntent(joinIntent("/join/$inviteId"))
        compose.waitUntil(timeoutMillis = 30_000) {
            onboarding.checkedInviteIds.isNotEmpty()
        }
        assertThat(currentInviteEntry()?.inviteId).isEqualTo(inviteId)
    }

    @Test
    fun aSignedInSessionIgnoresAWarmJoinLink() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        waitForTag("bottom_bar")

        compose.activity.dispatchNewIntent(joinIntent("/join/$inviteId"))
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        assertThat(onboarding.checkedInviteIds).isEmpty()
    }

    @Test
    fun aDeepLinkedInviteDoesNotResurrectAfterSignOut() {
        // The deep-linked id must not be retained anywhere: signing in
        // and back out lands on a clean entry.
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()
        navController.handleDeepLink(joinIntent("/join/$inviteId"))
        compose.waitUntil(timeoutMillis = 30_000) {
            onboarding.checkedInviteIds.isNotEmpty()
        }

        signIn()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true
        }

        runBlocking { tokens.clear() }
        // Signing out lands on the clean login root — the deep-linked
        // invite entry is gone from the stack entirely.
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Login>() == true
        }
    }
}
