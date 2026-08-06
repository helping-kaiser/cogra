// The single NavHost with type-safe routes (android/CLAUDE.md
// "Navigation"): auth state drives navigation — signed-out vs.
// signed-in is a conditional-navigation concern observed from one
// activity-scoped holder, and every phase flip clears the back stack.
// Registration returns an ordinary session, so an applicant is simply
// signed in: the applicant/member distinction lives inside the Home
// shell, not in navigation (auth.md "Application").

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.domain.store.TokenStore
import com.cogra.feature.auth.LoginRoute
import com.cogra.feature.auth.PasswordResetRoute
import com.cogra.feature.auth.RestoreRoute
import com.cogra.feature.home.HomeRoute
import com.cogra.feature.invites.InvitesRoute
import com.cogra.feature.onboarding.ApplyRoute
import com.cogra.feature.onboarding.InviteEntryRoute
import com.cogra.feature.onboarding.KeyCeremonyRoute
import com.cogra.feature.settings.SettingsRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.serialization.Serializable

// The destinations (type-safe routes, Navigation 2.8+).
@Serializable
data class InviteEntry(val inviteId: String? = null)

@Serializable
data class Apply(val inviteId: String)

@Serializable
data object Login

@Serializable
data object PasswordReset

@Serializable
data object Restore

@Serializable
data object KeyCeremony

@Serializable
data object Home

@Serializable
data object Invites

@Serializable
data object Settings

/** The app's coarse auth phase; each value owns a navigation graph root. */
enum class AuthPhase { LOADING, SIGNED_OUT, SIGNED_IN }

/**
 * The Restore→Home result key. It rides the back-stack ENTRY's
 * savedStateHandle — a different object from the one injected into the
 * entry's ViewModels, so it must be read here, where the entry is in
 * hand (android/CLAUDE.md "Navigation").
 */
private const val ACTOR_RESTORED_RESULT = "actor_restored"

/** The Settings→Home result key: the handle changed, re-read the profile. */
private const val HANDLE_CHANGED_RESULT = "handle_changed"

/** The activity-scoped auth-state holder: the token store decides. */
@HiltViewModel
class AuthStateViewModel @Inject constructor(
    tokens: TokenStore,
) : ViewModel() {
    val phase: StateFlow<AuthPhase> =
        tokens.tokens.map { pair ->
            if (pair != null) AuthPhase.SIGNED_IN else AuthPhase.SIGNED_OUT
        }.stateIn(viewModelScope, SharingStarted.Eagerly, AuthPhase.LOADING)
}

@Composable
fun CograNavGraph(
    deepLinkedInviteId: String?,
    navController: NavHostController = rememberNavController(),
) {
    val authState: AuthStateViewModel = hiltViewModel()
    val phase by authState.phase.collectAsStateWithLifecycle()

    // Auth drives navigation: every phase flip lands on that phase's
    // root with a cleared stack (android/CLAUDE.md "Navigation"). An
    // applicant lands on Home too — the read shell with the application
    // riding along as cards, never a wall (auth.md "Application").
    LaunchedEffect(phase) {
        val root: Any = when (phase) {
            AuthPhase.LOADING -> return@LaunchedEffect
            AuthPhase.SIGNED_IN -> Home
            AuthPhase.SIGNED_OUT -> InviteEntry(deepLinkedInviteId)
        }
        navController.navigate(root) {
            popUpTo(0) { inclusive = true }
        }
    }

    NavHost(
        navController = navController,
        startDestination = InviteEntry(deepLinkedInviteId),
    ) {
        composable<InviteEntry>(
            deepLinks = listOf(
                navDeepLink<InviteEntry>(basePath = "${BuildConfig.WEB_ORIGIN}/join"),
            ),
        ) { entry ->
            val route = entry.toRoute<InviteEntry>()
            InviteEntryRoute(
                deepLinkedInviteId = route.inviteId,
                onUsableLink = { id -> navController.navigate(Apply(id)) },
                onLogInInstead = { navController.navigate(Login) },
            )
        }
        composable<Apply> { entry ->
            // A successful register flips the token store; the phase
            // holder navigates.
            ApplyRoute(inviteId = entry.toRoute<Apply>().inviteId)
        }
        composable<KeyCeremony> {
            KeyCeremonyRoute(onDone = { navController.popBackStack() })
        }
        composable<Login> {
            LoginRoute(onForgotPassword = { navController.navigate(PasswordReset) })
        }
        composable<PasswordReset> {
            PasswordResetRoute(onDone = { navController.popBackStack() })
        }
        composable<Restore> {
            RestoreRoute(
                onRestored = {
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set(ACTOR_RESTORED_RESULT, true)
                    navController.popBackStack()
                },
            )
        }
        composable<Home> { entry ->
            val actorRestoredResult by entry.savedStateHandle
                .getStateFlow(ACTOR_RESTORED_RESULT, false)
                .collectAsStateWithLifecycle()
            val handleChangedResult by entry.savedStateHandle
                .getStateFlow(HANDLE_CHANGED_RESULT, false)
                .collectAsStateWithLifecycle()
            HomeRoute(
                actorRestoredResult = actorRestoredResult,
                onActorRestoredResultConsumed = {
                    entry.savedStateHandle[ACTOR_RESTORED_RESULT] = false
                },
                handleChangedResult = handleChangedResult,
                onHandleChangedResultConsumed = {
                    entry.savedStateHandle[HANDLE_CHANGED_RESULT] = false
                },
                onOpenInvites = { navController.navigate(Invites) },
                onOpenSettings = { navController.navigate(Settings) },
                onRestoreActor = { navController.navigate(Restore) },
                onStartKeyCeremony = { navController.navigate(KeyCeremony) },
            )
        }
        composable<Invites> {
            InvitesRoute(onBack = { navController.navigateUp() })
        }
        composable<Settings> {
            SettingsRoute(
                onBack = { navController.navigateUp() },
                onHandleChanged = {
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set(HANDLE_CHANGED_RESULT, true)
                },
            )
        }
    }
}
