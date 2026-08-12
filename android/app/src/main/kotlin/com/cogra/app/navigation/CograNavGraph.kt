// The single NavHost with type-safe routes (android/CLAUDE.md
// "Navigation").
// Registration returns an ordinary session, so an applicant is simply
// signed in: the applicant/member distinction lives inside the Home
// shell, not in navigation (auth.md "Application").

package com.cogra.app.navigation

import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.core.util.Consumer
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
import com.cogra.app.ui.SecurityNoticeHost
import com.cogra.domain.store.TokenStore
import com.cogra.feature.auth.LoginRoute
import com.cogra.feature.content.ComposePostRoute
import com.cogra.feature.content.FeedRoute
import com.cogra.feature.content.PostDetailRoute
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
data object Feed

@Serializable
data class ComposePost(val postId: String? = null)

@Serializable
data class PostDetail(val postId: String)

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

/** The Compose→(Feed|PostDetail) result key: a write signed, re-read. */
private const val CONTENT_SIGNED_RESULT = "content_signed"

/** The activity-scoped auth-state holder: the token store decides. */
@HiltViewModel
class AuthStateViewModel @Inject constructor(
    tokens: TokenStore,
) : ViewModel() {
    val phase: StateFlow<AuthPhase> =
        tokens.tokens.map { pair ->
            if (pair != null) AuthPhase.SIGNED_IN else AuthPhase.SIGNED_OUT
        }.stateIn(viewModelScope, SharingStarted.Eagerly, AuthPhase.LOADING)

    /** The signed-in account id; gates creator-only affordances. */
    val accountId: StateFlow<String?> =
        tokens.tokens.map { pair -> pair?.accountId }
            .stateIn(viewModelScope, SharingStarted.Eagerly, null)
}

@Composable
fun CograNavGraph(
    navController: NavHostController = rememberNavController(),
) {
    val authState: AuthStateViewModel = hiltViewModel()
    val phase by authState.phase.collectAsStateWithLifecycle()

    // Auth drives navigation: a genuine phase flip lands on the new
    // phase's root with a cleared stack (android/CLAUDE.md
    // "Navigation"). An applicant lands on Home too — the read shell
    // with the application riding along as cards, never a wall
    // (auth.md "Application"). Two arrivals must NOT navigate: the
    // same phase re-resolving after recreation (the restored stack is
    // already right), and the cold LOADING → SIGNED_OUT resolution —
    // the start destination already IS the signed-out root, carrying
    // any invite deep link the NavController applied from the launch
    // intent, which clearing here would drop.
    var navigatedPhase by rememberSaveable { mutableStateOf(AuthPhase.LOADING) }
    LaunchedEffect(phase) {
        if (phase == AuthPhase.LOADING) return@LaunchedEffect
        val from = navigatedPhase
        navigatedPhase = phase
        val root: Any = when {
            from == phase -> return@LaunchedEffect
            phase == AuthPhase.SIGNED_IN -> Home
            from == AuthPhase.LOADING -> return@LaunchedEffect
            else -> InviteEntry()
        }
        navController.navigate(root) {
            popUpTo(0) { inclusive = true }
        }
    }

    // Warm-start App Links: launchMode="singleTask" delivers them via
    // onNewIntent, which Navigation does not observe by itself — the
    // deep-link docs require forwarding to handleDeepLink. Gated on
    // signed-out: a signed-in session ignores join links, cold and
    // warm alike.
    val phaseNow by rememberUpdatedState(phase)
    val activity = LocalActivity.current as? ComponentActivity
    DisposableEffect(activity, navController) {
        val listener = Consumer<Intent> { newIntent ->
            if (phaseNow == AuthPhase.SIGNED_OUT) {
                navController.handleDeepLink(newIntent)
            }
        }
        activity?.addOnNewIntentListener(listener)
        onDispose { activity?.removeOnNewIntentListener(listener) }
    }

    // Above the NavHost so the login security notice shows wherever
    // the post-login navigation lands (auth.md "Reuse detection").
    SecurityNoticeHost()

    NavHost(
        navController = navController,
        startDestination = InviteEntry(),
    ) {
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
                onOpenFeed = { navController.navigate(Feed) },
                onOpenInvites = { navController.navigate(Invites) },
                onOpenSettings = { navController.navigate(Settings) },
                onRestoreActor = { navController.navigate(Restore) },
                onStartKeyCeremony = { navController.navigate(KeyCeremony) },
            )
        }
        composable<Feed> { entry ->
            val signedResult by entry.savedStateHandle
                .getStateFlow(CONTENT_SIGNED_RESULT, false)
                .collectAsStateWithLifecycle()
            FeedRoute(
                onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                onCompose = { navController.navigate(ComposePost()) },
                onBack = { navController.navigateUp() },
                refreshSignal = signedResult,
                onRefreshSignalConsumed = {
                    entry.savedStateHandle[CONTENT_SIGNED_RESULT] = false
                },
            )
        }
        composable<ComposePost> { entry ->
            ComposePostRoute(
                postId = entry.toRoute<ComposePost>().postId,
                onSaved = {
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set(CONTENT_SIGNED_RESULT, true)
                    navController.popBackStack()
                },
                onBack = { navController.navigateUp() },
            )
        }
        composable<PostDetail> { entry ->
            val signedResult by entry.savedStateHandle
                .getStateFlow(CONTENT_SIGNED_RESULT, false)
                .collectAsStateWithLifecycle()
            val accountId by authState.accountId.collectAsStateWithLifecycle()
            PostDetailRoute(
                postId = entry.toRoute<PostDetail>().postId,
                viewerId = accountId,
                onEdit = { id -> navController.navigate(ComposePost(id)) },
                onBack = { navController.navigateUp() },
                refreshSignal = signedResult,
                onRefreshSignalConsumed = {
                    entry.savedStateHandle[CONTENT_SIGNED_RESULT] = false
                },
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
