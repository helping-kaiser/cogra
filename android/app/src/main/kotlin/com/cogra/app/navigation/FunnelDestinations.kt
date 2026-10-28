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
            onGoToFeed = {
                navController.navigate(Feed) { popUpTo(0) { inclusive = true } }
            },
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
            onBackToSettings = {
                navController.navigate(Settings) {
                    popUpTo<DeleteAccountConfirmed> { inclusive = true }
                }
            },
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
            onEnterTheCode = {
                navController.navigate(ChangeEmailConfirm) {
                    popUpTo<ChangeEmailLinked> { inclusive = true }
                }
            },
            onBackToSettings = {
                navController.navigate(Settings) {
                    popUpTo<ChangeEmailLinked> { inclusive = true }
                }
            },
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
