// The entry funnel and the mailed links' landings: the screens reached from
// outside the app with nothing beneath them, which no tab owns.

package com.cogra.app.navigation

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.domain.InviterView
import com.cogra.feature.auth.LoginRoute
import com.cogra.feature.auth.PasswordResetRoute
import com.cogra.feature.auth.ResetExpiredRoute
import com.cogra.feature.auth.ResetNewRoute
import com.cogra.feature.auth.RestoreRoute
import com.cogra.feature.invites.VouchAskRoute
import com.cogra.feature.onboarding.InviteEntryRoute
import com.cogra.feature.onboarding.JoinRoute
import com.cogra.feature.onboarding.KeyCeremonyRoute
import com.cogra.feature.settings.ChangeEmailLinkedRoute
import com.cogra.feature.settings.DeleteAccountConfirmedRoute
import kotlinx.coroutines.launch
import com.cogra.feature.onboarding.R as OnboardingR

/** The entry funnel: the invite entry, the application, sign-in and its reset, the key's two ceremonies. */
internal fun NavGraphBuilder.funnel(shell: ShellScope) = with(shell) {
    composable<InviteEntry>(
        deepLinks = listOf(
            // The canonical /join/<id> URL (auth.md "Link URLs")
            // carries the id as a path segment, which the
            // route-derived pattern cannot express (defaulted args
            // encode as query parameters) — so the patterns are
            // explicit, plus the bare /join landing.
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$JOIN_PATH/{inviteId}" },
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$JOIN_PATH" },
        ),
    ) { entry -> InviteEntryDestination(entry.toRoute<InviteEntry>()) }
    composable<Join> { entry -> JoinDestination(entry.toRoute<Join>()) }
    composable<KeyCeremony> {
        KeyCeremonyRoute(
            onDone = { navController.popBackStack() },
            onBack = { navController.popBackStack() },
        )
    }
    composable<Login> {
        LoginRoute(
            onForgotPassword = { navController.navigate(PasswordReset) },
            onJoin = { navController.navigate(InviteEntry()) },
            onBrowse = { navController.navigate(Feed) },
            // The signed-out root has nothing behind it; a visitor
            // who arrived from a read surface does.
            onBack = if (navController.previousBackStackEntry == null) {
                null
            } else {
                { navController.popBackStack() }
            },
        )
    }
    composable<PasswordReset> {
        // The header's back arrow opens SignIn (Reset.md:3), also when the
        // request was reached from a dead link with nothing beneath it.
        PasswordResetRoute(onBack = { backToSignIn() })
    }
    composable<Restore> { RestoreDestination() }
}

/**
 * The key's restore. PICKS KEPT PENDING WAIT: their review opens over the
 * surface the restore returns to, under the same snackbar, and nothing signs
 * on its own (Restore.md:39).
 */
@Composable
private fun ShellScope.RestoreDestination() {
    val keptPicks: KeptPicksDoorViewModel = hiltViewModel()
    val scope = rememberCoroutineScope()
    RestoreRoute(
        onRestored = {
            navController.report(actorRestoredKey, true)
            scope.launch {
                val waiting = keptPicks.picksWaiting()
                navController.popBackStack()
                if (waiting) navController.navigate(KeptPicks)
            }
        },
        onBack = { navController.popBackStack() },
    )
}

/** The mailed links' landings, each an App Link on the web origin. */
internal fun NavGraphBuilder.linkLandings(shell: ShellScope) {
    composable<DeleteAccountConfirmed>(
        deepLinks = listOf(
            // The link the deletion mails (auth.md "Link URLs"), on the
            // same host rules as /join.
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$DELETE_ACCOUNT_PATH?token={token}" },
        ),
    ) { entry -> shell.DeleteAccountConfirmedDestination(entry) }
    composable<ChangeEmailLinked>(
        deepLinks = listOf(
            // The link the change mails to the new address (auth.md
            // "Link URLs"; EC delta 8), on the same host rules as /join.
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$EMAIL_CHANGE_PATH?token={token}" },
        ),
    ) { entry -> shell.ChangeEmailLinkedDestination(entry) }
    composable<VouchAsk>(
        deepLinks = listOf(
            // The ask link (auth.md "Link URLs": `/vouch/<link-id>`), on the
            // same host rules as /join; the id is a path segment.
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$VOUCH_PATH/{askLinkId}" },
        ),
    ) { entry -> shell.VouchAskDestination(entry) }
    composable<ResetNew>(
        deepLinks = listOf(
            // The link the reset mails (auth.md "Link URLs"), on the same host rules as /join.
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$RESET_PATH?token={token}" },
        ),
    ) { entry -> shell.ResetNewDestination(entry) }
    composable<ResetExpired> { shell.ResetExpiredDestination() }
}

/**
 * THE ASK LINK'S LANDING (VouchAsk.md). Who opened it decides where it lands:
 * the asker and any applicant at app-open with their own snackbar, a member
 * already holding the asker on Invites at that row, everyone else on the
 * ask. Back and `Not now` return to the state the link opened over, or the
 * feed's root when it opened the app cold (:41-47).
 */
@Composable
private fun ShellScope.VouchAskDestination(entry: NavBackStackEntry) {
    val askLinkId = entry.toRoute<VouchAsk>().askLinkId
    VouchAskRoute(
        askLinkId = askLinkId,
        signedIn = signedIn,
        onBack = { leaveLanding() },
        onAppOpen = { line ->
            navController.startOnFeedRoot()
            announce(line)
        },
        // Invites joins the Profile tab, its home (`ProfileHeader`'s Invites).
        onInvites = { notice ->
            navController.popBackStack()
            if (navController.currentBackStackEntry?.destination.tab() == null) navController.startOnFeedRoot()
            navController.selectTab(TopLevelTab.PROFILE, onReselect = {})
            navController.navigate(Invites())
            navController.reportToCurrent(invitesNoticeKey, notice.encode())
        },
        onOpenProfile = { handle -> openFromLanding(Profile(handle)) },
        onRequireAccount = {
            holdAskLink(askLinkId)
            requireJoin()
        },
        onRestoreKey = { navController.navigate(Restore) },
    )
}

/**
 * THE RESET'S NEW-PASSWORD STEP (ResetNew.md). A taken password opens
 * SignIn in the landing's place, as the deletion's link does (:23). A
 * spent link — on its check before the form stands (:43), or on a press
 * while the form stood open (:41) — opens ResetExpired in the landing's
 * place. System Back leaves the app to wherever the mail link was opened
 * from, never to a CoGra screen in its place (:47): the landing goes, and
 * the task moves back.
 */
@Composable
private fun ShellScope.ResetNewDestination(entry: NavBackStackEntry) {
    val token = entry.toRoute<ResetNew>().token
    val activity = LocalActivity.current
    ResetNewRoute(
        token = token,
        onSignIn = { backToSignIn() },
        onExpired = {
            navController.navigate(ResetExpired) { popUpTo<ResetNew> { inclusive = true } }
        },
        onLeave = {
            navController.popBackStack()
            activity?.moveTaskToBack(true)
        },
    )
}

/**
 * A SPENT RESET LINK (ResetExpired.md). `Reset your password` opens the
 * request in this screen's place with its field empty (:15) — a fresh
 * destination, so a fresh view model; `Sign in` opens SignIn (:17). System
 * Back leaves to wherever the mail link was opened from, as ResetNew's does
 * (:21).
 */
@Composable
private fun ShellScope.ResetExpiredDestination() {
    val activity = LocalActivity.current
    ResetExpiredRoute(
        onReset = { navController.navigate(PasswordReset) { popUpTo<ResetExpired> { inclusive = true } } },
        onSignIn = { backToSignIn() },
        onLeave = {
            navController.popBackStack()
            activity?.moveTaskToBack(true)
        },
    )
}

/** The current screen goes and SignIn stands in its place — never a second sign-in on top of one. */
private fun ShellScope.backToSignIn() {
    navController.popBackStack()
    if (navController.currentBackStackEntry?.destination?.hasRoute(Login::class) != true) {
        navController.navigate(Login)
    }
}

/** A landing's way back: over a tab, the state it opened over; cold, the feed's root. */
private fun ShellScope.leaveLanding() {
    if (navController.previousBackStackEntry?.destination.tab() != null) {
        navController.popBackStack()
    } else {
        navController.startOnFeedRoot()
    }
}

@Composable
private fun ShellScope.DeleteAccountConfirmedDestination(entry: NavBackStackEntry) {
    val token = entry.toRoute<DeleteAccountConfirmed>().token
    // Resolved before anything renders: the two ways on differ.
    signedIn?.let { signed ->
        DeleteAccountConfirmedRoute(
            token = token,
            signedIn = signed,
            // The feed, under the deletion band (DeleteAccountConfirmed.md:39).
            onGoToFeed = { navController.startOnFeedRoot() },
            // The deletion stays confirmed; the sign-in is ordinary (:41).
            // A dead link's sign-in holds no link (DeleteLinkExpired.md:19).
            onSignIn = {
                navController.popBackStack()
                if (navController.currentBackStackEntry?.destination?.hasRoute(Login::class) != true) {
                    navController.navigate(Login)
                }
            },
            // A dead link with a session: settings, where the
            // deletion's state reads as it stands (DeleteLinkExpired.md:17).
            onBackToSettings = { openFromLanding(Settings) },
        )
    }
}

@Composable
private fun ShellScope.ChangeEmailLinkedDestination(entry: NavBackStackEntry) {
    val token = entry.toRoute<ChangeEmailLinked>().token
    // Resolved before anything renders: the two readings differ.
    signedIn?.let { signed ->
        ChangeEmailLinkedRoute(
            token = token,
            signedIn = signed,
            onEnterTheCode = { openFromLanding(ChangeEmailConfirm) },
            onBackToSettings = { openFromLanding(Settings) },
            onSignIn = { holdsLink ->
                // Only a live link's sign-in holds it; a dead or
                // unknown one holds nothing, not even a link held
                // earlier (ChangeEmailLinkedSignedOut.md).
                holdEmailLink(token.takeIf { holdsLink })
                // Back to the signed-out root, never a second sign-in on top of it.
                navController.popBackStack()
                if (navController.currentBackStackEntry?.destination?.hasRoute(Login::class) != true) {
                    navController.navigate(Login)
                }
            },
        )
    }
}

/**
 * A landing's way on into a settings page, the landing leaving the stack.
 *
 * Over a tab, the page joins that tab's stack: a link opens over the state
 * the app was in (design/readme.md §4, *Navigation* — the layer law). With
 * no tab beneath — the app opened cold by the link, or the platform's deep
 * link handling having cleared what stood — the page opens over the
 * reader's own profile, the gear's home, with Feed's root under that: back
 * lands on the owning tab's root, then Feed's, then leaves.
 */
private fun ShellScope.openFromLanding(route: Any) {
    if (navController.previousBackStackEntry?.destination.tab() != null) {
        navController.popBackStack()
    } else {
        navController.startOnFeedRoot()
        navController.selectTab(TopLevelTab.PROFILE, onReselect = {})
    }
    navController.navigate(route)
}

/**
 * THE INVITE DOOR (InviteEntry.md, JoinInvalid.md). Its arrow is a link to
 * the bare view, never history, and system Back opens the same.
 *
 * A link opened from outside the app is checked at once: a live one opens
 * the form in the door's place, over whatever the link opened over — the
 * signed-in state included, since an invite link ignores sign-in (Join.md:7)
 * — and a dead one leaves that state as it was under one snackbar, never
 * the door's unusable reading (JoinInvalid.md:9-11).
 */
@Composable
private fun ShellScope.InviteEntryDestination(route: InviteEntry) {
    val expired = stringResource(OnboardingR.string.invite_expired)
    InviteEntryRoute(
        arrivalInviteId = route.inviteId,
        openedInvalid = route.invalid,
        onJoin = { id, inviter ->
            navController.navigate(Join(id, inviter.handle, inviter.name, inviter.avatarUrl)) {
                if (route.inviteId != null) popUpTo<InviteEntry> { inclusive = true }
            }
        },
        onDeadArrival = {
            leaveLanding()
            announce(expired)
        },
        onSignIn = { navController.navigate(Login) },
        onBrowseFeed = { navController.startOnFeedRoot() },
        onBack = { navController.startOnFeedRoot() },
    )
}

/**
 * THE FORM (Join.md). Back returns to the door the link was pasted at, or
 * to the state an arrival opened it over; the "?" opens About with a plain
 * Back; a spent link turns the form into the door's unusable reading.
 *
 * A made account flips the token store. Signed out, the phase holder then
 * lands the applicant on the feed. Over a signed-in state, where the phase
 * does not change, the form lands it itself: this device switches to the
 * new account and the applicant days begin on the feed (Join.md:51).
 */
@Composable
private fun ShellScope.JoinDestination(route: Join) {
    val overSignedIn = remember { signedIn == true }
    JoinRoute(
        inviteId = route.inviteId,
        inviter = InviterView(route.inviterHandle, route.inviterName, route.inviterAvatarUrl),
        onBack = {
            if (navController.previousBackStackEntry != null) {
                navController.popBackStack()
            } else {
                navController.startOnFeedRoot()
            }
        },
        onAbout = { navController.navigate(About(plainBack = true)) },
        onSignIn = { navController.navigate(Login) },
        onSpent = {
            navController.navigate(InviteEntry(invalid = true)) { popUpTo<Join> { inclusive = true } }
        },
        onCreated = { if (overSignedIn) navController.startOnFeedRoot() },
    )
}
