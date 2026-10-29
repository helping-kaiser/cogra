// The entry funnel and the mailed links' landings: the screens reached from
// outside the app with nothing beneath them, which no tab owns.

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.feature.auth.LoginRoute
import com.cogra.feature.auth.PasswordResetRoute
import com.cogra.feature.auth.RestoreRoute
import com.cogra.feature.invites.VouchAskRoute
import com.cogra.feature.onboarding.ApplyRoute
import com.cogra.feature.onboarding.InviteEntryRoute
import com.cogra.feature.onboarding.KeyCeremonyRoute
import com.cogra.feature.settings.ChangeEmailLinkedRoute
import com.cogra.feature.settings.DeleteAccountConfirmedRoute

/** The entry funnel: the invite entry, the application, sign-in and its reset, the key's two ceremonies. */
internal fun NavGraphBuilder.funnel(shell: ShellScope) = with(shell) {
    composable<InviteEntry>(
        deepLinks = listOf(
            // The canonical /join/<id> URL (auth.md "Link URLs")
            // carries the id as a path segment, which the
            // route-derived pattern cannot express (defaulted args
            // encode as query parameters) — so the patterns are
            // explicit, plus the bare /join landing.
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}/join/{inviteId}" },
            navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}/join" },
        ),
    ) { entry ->
        val route = entry.toRoute<InviteEntry>()
        InviteEntryRoute(
            deepLinkedInviteId = route.inviteId,
            onUsableLink = { id -> navController.navigate(Apply(id)) },
            onLogInInstead = { navController.navigate(Login) },
            onBrowseFeed = { navController.navigate(Feed) },
            onBack = { navController.popBackStack() },
        )
    }
    composable<Apply> { entry ->
        // A successful register flips the token store; the phase
        // holder navigates.
        ApplyRoute(
            inviteId = entry.toRoute<Apply>().inviteId,
            onBack = { navController.popBackStack() },
        )
    }
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
        PasswordResetRoute(
            onDone = { navController.popBackStack() },
            onBack = { navController.popBackStack() },
        )
    }
    composable<Restore> {
        RestoreRoute(
            onRestored = {
                navController.report(actorRestoredKey, true)
                navController.popBackStack()
            },
            onBack = { navController.popBackStack() },
        )
    }
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
