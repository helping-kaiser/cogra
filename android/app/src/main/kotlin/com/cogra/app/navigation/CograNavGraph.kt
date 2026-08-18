// The single NavHost with type-safe routes, inside the shell scaffold
// (android/CLAUDE.md "Navigation"; design.md §6): the bottom bar frames
// the signed-in top-level tabs, and the account-status banners ride
// above whichever tab is active.
// Registration returns an ordinary session, so an applicant is simply
// signed in: the applicant/member distinction lives in the shell
// banners, not in navigation (auth.md "Application").

package com.cogra.app.navigation

import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.core.util.Consumer
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.app.R
import com.cogra.app.ui.CograBottomBar
import com.cogra.app.ui.SecurityNoticeHost
import com.cogra.domain.store.TokenStore
import com.cogra.feature.auth.LoginRoute
import com.cogra.feature.auth.PasswordResetRoute
import com.cogra.feature.auth.RestoreRoute
import com.cogra.feature.content.ComposePostRoute
import com.cogra.feature.content.FeedRoute
import com.cogra.feature.content.PostDetailRoute
import com.cogra.feature.home.KeyRestoreBannerRoute
import com.cogra.feature.home.StatusBannersRoute
import com.cogra.feature.invites.InvitesRoute
import com.cogra.feature.onboarding.ApplyRoute
import com.cogra.feature.onboarding.InviteEntryRoute
import com.cogra.feature.onboarding.KeyCeremonyRoute
import com.cogra.feature.profile.ProfileEditRoute
import com.cogra.feature.profile.ProfileRoute
import com.cogra.feature.settings.KeyExportRoute
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
data object Feed

@Serializable
data class ComposePost(val postId: String? = null)

@Serializable
data class PostDetail(val postId: String)

/** An actor's profile; a null handle is the viewer's own (the tab). */
@Serializable
data class Profile(val handle: String? = null)

@Serializable
data object ProfileEdit

@Serializable
data object Invites

@Serializable
data object Settings

@Serializable
data object KeyExport

/** The app's coarse auth phase; each value owns a navigation graph root. */
enum class AuthPhase { LOADING, SIGNED_OUT, SIGNED_IN }

/**
 * The Restore result key. It rides the back-stack ENTRY's
 * savedStateHandle — a different object from the one injected into the
 * entry's ViewModels, so it must be read here, where the entry is in
 * hand (android/CLAUDE.md "Navigation").
 */
private const val ACTOR_RESTORED_RESULT = "actor_restored"

/** The Settings→Profile result key: the handle changed, re-read. */
private const val HANDLE_CHANGED_RESULT = "handle_changed"

/** The Compose→(Feed|PostDetail) result key: a write signed, re-read. */
private const val CONTENT_SIGNED_RESULT = "content_signed"

/** The ProfileEdit→Profile result key: the update signed, re-read. */
private const val PROFILE_SAVED_RESULT = "profile_saved"

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

    // The read shells (Feed, PostDetail, Profile) live on both stacks
    // and swap their write affordances for join entries when anonymous
    // (android.md "Screens"). Null while the cold phase resolves:
    // neither affordance shows, the web twin's "resolving" branch.
    val signedIn = when (phase) {
        AuthPhase.LOADING -> null
        AuthPhase.SIGNED_IN -> true
        AuthPhase.SIGNED_OUT -> false
    }

    // Auth drives navigation: a genuine phase flip lands on the new
    // phase's root with a cleared stack (android/CLAUDE.md
    // "Navigation"). The signed-in root is the Feed tab — an applicant
    // lands there too, the application riding along as shell banners,
    // never a wall (auth.md "Application"). Two arrivals must NOT
    // navigate: the same phase re-resolving after recreation (the
    // restored stack is already right), and the cold LOADING →
    // SIGNED_OUT resolution — the start destination already IS the
    // signed-out root, carrying any invite deep link the NavController
    // applied from the launch intent, which clearing here would drop.
    // The NavHost composes inside the scaffold's subcomposition, so the
    // graph is not set yet on this scope's first side-effect pass — the
    // flip waits for the first back-stack entry.
    val backStackEntry by navController.currentBackStackEntryAsState()
    val graphReady = backStackEntry != null
    var navigatedPhase by rememberSaveable { mutableStateOf(AuthPhase.LOADING) }
    LaunchedEffect(phase, graphReady) {
        if (!graphReady) return@LaunchedEffect
        if (phase == AuthPhase.LOADING) return@LaunchedEffect
        val from = navigatedPhase
        navigatedPhase = phase
        val root: Any = when {
            from == phase -> return@LaunchedEffect
            phase == AuthPhase.SIGNED_IN -> Feed
            from == AuthPhase.LOADING -> return@LaunchedEffect
            else -> Login
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

    // The guest prompt behind an account-needing slot (design.md §6):
    // ask, never bounce — the reader picks the auth flow or stays put.
    var joinPrompt by remember { mutableStateOf(false) }
    if (joinPrompt) {
        AlertDialog(
            onDismissRequest = { joinPrompt = false },
            title = { Text(stringResource(R.string.join_prompt_title)) },
            text = { Text(stringResource(R.string.join_prompt_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        joinPrompt = false
                        navController.navigate(Login)
                    },
                    modifier = Modifier.testTag("join_prompt_signin"),
                ) {
                    Text(stringResource(R.string.join_prompt_signin))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { joinPrompt = false },
                    modifier = Modifier.testTag("join_prompt_dismiss"),
                ) {
                    Text(stringResource(R.string.join_prompt_dismiss))
                }
            },
            modifier = Modifier.testTag("join_prompt"),
        )
    }

    // The shell: one scaffold owning the bottom bar and the shell-level
    // snackbar host (design.md §6) — one frame for every viewer: the
    // bar rides the tab surfaces signed in or out, and a slot that
    // needs an account opens the join prompt on a signed-out tap —
    // ask, never bounce.
    val shellSnackbar = remember { SnackbarHostState() }
    val onFeedTab = backStackEntry?.destination?.hasRoute(Feed::class) == true
    val onOwnProfileTab = backStackEntry?.let { entry ->
        entry.destination.hasRoute(Profile::class) && entry.toRoute<Profile>().handle == null
    } == true

    // The documented tab pattern: pop to the signed-in root saving
    // state, single-top, restoring the target tab's state.
    fun toTab(route: Any) {
        navController.navigate(route) {
            popUpTo(Feed) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        snackbarHost = {
            SnackbarHost(shellSnackbar) { data ->
                Snackbar(snackbarData = data, modifier = Modifier.testTag("shell_snackbar"))
            }
        },
        bottomBar = {
            if (signedIn != null && (onFeedTab || onOwnProfileTab)) {
                CograBottomBar(
                    feedSelected = onFeedTab,
                    profileSelected = onOwnProfileTab,
                    onFeed = { toTab(Feed) },
                    onCompose = {
                        if (signedIn == true) {
                            navController.navigate(ComposePost())
                        } else {
                            joinPrompt = true
                        }
                    },
                    onProfile = {
                        if (signedIn == true) {
                            toTab(Profile())
                        } else {
                            joinPrompt = true
                        }
                    },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            // Login is the signed-out entry — signing in is the common
            // path; the invite entry hangs off it (design.md §6).
            startDestination = Login,
            // consumeWindowInsets rides with the padding (the documented
            // nested-scaffold pattern): without it every screen's own
            // scaffold re-applies the status inset the shell already
            // padded, doubling the space above each top bar.
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
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
                    onBrowseFeed = { navController.navigate(Feed) },
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
                LoginRoute(
                    onForgotPassword = { navController.navigate(PasswordReset) },
                    onJoin = { navController.navigate(InviteEntry()) },
                    onBrowse = { navController.navigate(Feed) },
                )
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
            composable<Feed> { entry ->
                val signedResult by entry.savedStateHandle
                    .getStateFlow(CONTENT_SIGNED_RESULT, false)
                    .collectAsStateWithLifecycle()
                val actorRestoredResult by entry.savedStateHandle
                    .getStateFlow(ACTOR_RESTORED_RESULT, false)
                    .collectAsStateWithLifecycle()
                FeedRoute(
                    signedIn = signedIn,
                    onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                    onOpenActor = { handle -> navController.navigate(Profile(handle)) },
                    // Pushes the login screen (the web guest entries link
                    // to /login), so back returns to the reading context.
                    onSignInOrJoin = { navController.navigate(Login) },
                    refreshSignal = signedResult,
                    onRefreshSignalConsumed = {
                        entry.savedStateHandle[CONTENT_SIGNED_RESULT] = false
                    },
                    keyBanner = {
                        if (signedIn == true) {
                            KeyRestoreBannerRoute(
                                onRestoreActor = { navController.navigate(Restore) },
                            )
                        }
                    },
                    banners = {
                        if (signedIn == true) {
                            StatusBannersRoute(
                                actorRestoredResult = actorRestoredResult,
                                onActorRestoredResultConsumed = {
                                    entry.savedStateHandle[ACTOR_RESTORED_RESULT] = false
                                },
                                onStartKeyCeremony = { navController.navigate(KeyCeremony) },
                                snackbarHostState = shellSnackbar,
                            )
                        }
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
                    keyBanner = {
                        if (signedIn == true) {
                            KeyRestoreBannerRoute(
                                onRestoreActor = { navController.navigate(Restore) },
                            )
                        }
                    },
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
                    signedIn = signedIn,
                    onEdit = { id -> navController.navigate(ComposePost(id)) },
                    onOpenActor = { handle -> navController.navigate(Profile(handle)) },
                    onSignInOrJoin = { navController.navigate(Login) },
                    onBack = { navController.navigateUp() },
                    refreshSignal = signedResult,
                    onRefreshSignalConsumed = {
                        entry.savedStateHandle[CONTENT_SIGNED_RESULT] = false
                    },
                )
            }
            composable<Profile> { entry ->
                val route = entry.toRoute<Profile>()
                val handleChangedResult by entry.savedStateHandle
                    .getStateFlow(HANDLE_CHANGED_RESULT, false)
                    .collectAsStateWithLifecycle()
                val profileSavedResult by entry.savedStateHandle
                    .getStateFlow(PROFILE_SAVED_RESULT, false)
                    .collectAsStateWithLifecycle()
                val actorRestoredResult by entry.savedStateHandle
                    .getStateFlow(ACTOR_RESTORED_RESULT, false)
                    .collectAsStateWithLifecycle()
                ProfileRoute(
                    handle = route.handle,
                    handleChangedResult = handleChangedResult,
                    onHandleChangedResultConsumed = {
                        entry.savedStateHandle[HANDLE_CHANGED_RESULT] = false
                    },
                    profileSavedResult = profileSavedResult,
                    onProfileSavedResultConsumed = {
                        entry.savedStateHandle[PROFILE_SAVED_RESULT] = false
                    },
                    onEdit = { navController.navigate(ProfileEdit) },
                    onOpenSettings = { navController.navigate(Settings) },
                    onOpenInvites = { navController.navigate(Invites) },
                    onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                    // The own-profile tab has no back arrow; another
                    // actor's profile is a drill-in.
                    onBack = if (route.handle == null) null else ({ navController.navigateUp() }),
                    keyBanner = {
                        if (route.handle == null && signedIn == true) {
                            KeyRestoreBannerRoute(
                                onRestoreActor = { navController.navigate(Restore) },
                            )
                        }
                    },
                    banners = {
                        if (route.handle == null && signedIn == true) {
                            StatusBannersRoute(
                                actorRestoredResult = actorRestoredResult,
                                onActorRestoredResultConsumed = {
                                    entry.savedStateHandle[ACTOR_RESTORED_RESULT] = false
                                },
                                onStartKeyCeremony = { navController.navigate(KeyCeremony) },
                                snackbarHostState = shellSnackbar,
                            )
                        }
                    },
                )
            }
            composable<ProfileEdit> {
                ProfileEditRoute(
                    onSaved = {
                        navController.previousBackStackEntry
                            ?.savedStateHandle
                            ?.set(PROFILE_SAVED_RESULT, true)
                        navController.popBackStack()
                    },
                    onBack = { navController.navigateUp() },
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
                    onExportKey = { navController.navigate(KeyExport) },
                    keyBanner = {
                        if (signedIn == true) {
                            KeyRestoreBannerRoute(
                                onRestoreActor = { navController.navigate(Restore) },
                            )
                        }
                    },
                )
            }
            composable<KeyExport> {
                // Arriving reveals nothing; the screen's own gate does.
                KeyExportRoute(onBack = { navController.navigateUp() })
            }
        }
    }
}
