// The single NavHost with type-safe routes, inside the shell scaffold
// (android/CLAUDE.md "Navigation"; design.md §6): one nested graph per
// bottom-bar tab, each with its own back stack (TopLevelTab.kt); the bottom
// bar frames the read surfaces — the tabs and the read drill-ins — and the
// account-status banners ride above whichever tab is active.
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
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.util.Consumer
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.cogra.app.R
import com.cogra.app.ui.CograBottomBar
import com.cogra.app.ui.DeviceLockKeeper
import com.cogra.app.ui.SecurityNoticeHost
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalOnRestoreKey
import com.cogra.core.designsystem.LocalPadBottomInset
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.v2.media.LocalAlwaysUnveil
import com.cogra.core.designsystem.v2.token.NavTransitions
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.store.TokenStore
import com.cogra.feature.notifications.BellViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** The app's coarse auth phase; each value owns a navigation graph root. */
enum class AuthPhase { LOADING, SIGNED_OUT, SIGNED_IN }

/**
 * The activity-scoped auth-state holder: the token store decides. It also
 * hands the shell the account's deletion standing, which the shell forgets
 * when a session ends and reads for why it ended.
 */
@HiltViewModel
class AuthStateViewModel @Inject constructor(
    tokens: TokenStore,
    val deletion: AccountDeletionState,
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

/**
 * The app's one navigation graph, inside the shell scaffold.
 *
 * The shell's snackbar host is PUBLISHED here rather than by the caller.
 * It is the same composable that renders the `SnackbarHost`, so the host
 * a leaf publishes to and the host the frame draws cannot drift apart —
 * and, just as importantly, every test that composes this graph gets the
 * real wiring instead of a hand-built stand-in. Wiring it one level up
 * left the app correct and the tests blind to it.
 */
@Composable
fun CograNavGraph(
    navController: NavHostController = rememberNavController(),
    shellSnackbar: SnackbarHostState = remember { SnackbarHostState() },
) {
    // The account's sensitive-content choice reaches every veil from here
    // (`AccountPreferencesViewModel.kt`; `SensitiveVeil.kt`'s [LocalAlwaysUnveil]).
    val preferences: AccountPreferencesViewModel = hiltViewModel()
    val alwaysUnveil by preferences.alwaysUnveil.collectAsStateWithLifecycle()
    // THE PAD PARKS 16dp ABOVE THE BOTTOM BAR where the surface has one
    // (PadStanding.md:15): the bar's 64 plus the 16, or 16 off the edge.
    var barShown by remember { mutableStateOf(false) }
    CompositionLocalProvider(
        LocalSnackbarHostState provides shellSnackbar,
        LocalAlwaysUnveil provides alwaysUnveil,
        LocalPadBottomInset provides if (barShown) PAD_ABOVE_BAR else PAD_OFF_EDGE,
        // The pad's key notice opens the app's own restore (PadKeyAbsent.md).
        LocalOnRestoreKey provides { navController.navigate(Restore) },
    ) {
        CograNavGraphContent(navController, shellSnackbar, onBarShown = { barShown = it })
    }
}

/** The parked pad's standoff over a surface with the bottom bar: `--bottom-bar-height` 64 + 16. */
private val PAD_ABOVE_BAR = 80.dp

/** …and over one without it: 16 off the bottom edge. */
private val PAD_OFF_EDGE = 16.dp

@Composable
private fun CograNavGraphContent(
    navController: NavHostController,
    shellSnackbar: SnackbarHostState,
    onBarShown: (Boolean) -> Unit,
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
    // The shell's own counts and the link a signed-out landing holds through sign-in.
    val shellState = rememberSaveable(saver = ShellState.Saver) { ShellState() }
    val accountDeletedLine = stringResource(R.string.account_deleted)
    LaunchedEffect(phase, graphReady) {
        if (!graphReady) return@LaunchedEffect
        if (phase == AuthPhase.LOADING) return@LaunchedEffect
        // A session that ended takes its account's deletion standing with it:
        // no band from one account may stand over the next one's surfaces.
        // One that ended past the standing deadline is the deletion having
        // run, and lands like the applicant's (FeedDeleting.md:23; ER-G6).
        if (phase == AuthPhase.SIGNED_OUT) authState.deletion.onSessionEnded(Instant.now())
        val from = navigatedPhase
        navigatedPhase = phase
        // A cold start that opened an email-change or deletion link signed in
        // is already where it should be: the landing is the destination.
        val destination = navController.currentBackStackEntry?.destination
        val onLinkLanding = destination?.hasRoute(ChangeEmailLinked::class) == true ||
            destination?.hasRoute(DeleteAccountConfirmed::class) == true ||
            destination?.hasRoute(VouchAsk::class) == true
        // An applicant's account deleted from here: the session ended because
        // the account is gone, so the reader lands signed out on the bare view
        // under one snackbar, never on sign-in (DeleteAccount.md:29).
        val accountDeleted = phase == AuthPhase.SIGNED_OUT && authState.deletion.accountDeleted.value
        val root: Any = when {
            from == phase -> return@LaunchedEffect
            phase == AuthPhase.SIGNED_IN && from == AuthPhase.LOADING && onLinkLanding -> return@LaunchedEffect
            phase == AuthPhase.SIGNED_IN -> Feed
            accountDeleted -> Feed
            from == AuthPhase.LOADING -> return@LaunchedEffect
            else -> Login
        }
        // A new phase starts every tab fresh: the stack goes, and each tab's
        // left stack with it — none may come back carrying the last
        // session's screens.
        if (root == Feed) {
            navController.startOnFeedRoot()
        } else {
            navController.navigate(root) { popUpTo(0) { inclusive = true } }
            navController.forgetLeftStacks()
        }
        if (accountDeleted) {
            authState.deletion.consumeAccountDeleted()
            launch { shellSnackbar.showSnackbar(accountDeletedLine) }
        }
        val held = shellState.heldEmailLink
        if (root == Feed && phase == AuthPhase.SIGNED_IN && held != null) {
            shellState.heldEmailLink = null
            navController.navigate(ChangeEmailLinked(held))
        }
        // A guest who raised the gate over an ask comes back to it once
        // signed in (VouchAsk.md:23).
        val heldAsk = shellState.heldAskLink
        if (root == Feed && phase == AuthPhase.SIGNED_IN && heldAsk != null) {
            shellState.heldAskLink = null
            navController.navigate(VouchAsk(heldAsk))
        }
    }

    // Warm-start App Links: launchMode="singleTask" delivers them via
    // onNewIntent, which Navigation does not observe by itself — the
    // deep-link docs require forwarding to handleDeepLink. A join link is
    // gated on signed-out — a signed-in session ignores join links, cold
    // and warm alike; the email change's and the deletion's links answer
    // either way (the deletion's link is the capability, session or none).
    val phaseNow by rememberUpdatedState(phase)
    val activity = LocalActivity.current as? ComponentActivity
    // THE SYSTEM'S "MANAGE SPACE" DOOR (Settings.md: settings opens with
    // Clearing data in view, and nothing is cleared). `ManageSpaceActivity`
    // relays it here as one action, cold (the launch intent, read once) or
    // warm (a new intent). Signed in, settings opens at the group; signed
    // out there is no settings to open, and the app simply opens.
    var manageSpaceAsked by rememberSaveable {
        mutableStateOf(activity?.intent?.action == ACTION_MANAGE_SPACE)
    }
    LaunchedEffect(manageSpaceAsked, phase, graphReady) {
        if (!manageSpaceAsked || !graphReady || phase == AuthPhase.LOADING) return@LaunchedEffect
        manageSpaceAsked = false
        if (phase != AuthPhase.SIGNED_IN) return@LaunchedEffect
        navController.navigate(Settings) { launchSingleTop = true }
        navController.reportToCurrent(settingsClearingKey, true)
    }
    DisposableEffect(activity, navController) {
        val listener = Consumer<Intent> { newIntent ->
            if (newIntent.action == ACTION_MANAGE_SPACE) {
                manageSpaceAsked = true
                return@Consumer
            }
            val path = newIntent.data?.path
            val answersSignedIn = path?.startsWith(EMAIL_CHANGE_PATH) == true ||
                path?.startsWith(DELETE_ACCOUNT_PATH) == true ||
                path?.startsWith(VOUCH_PATH) == true
            if (phaseNow == AuthPhase.SIGNED_OUT || (answersSignedIn && phaseNow == AuthPhase.SIGNED_IN)) {
                navController.handleDeepLink(newIntent)
            }
        }
        activity?.addOnNewIntentListener(listener)
        onDispose { activity?.removeOnNewIntentListener(listener) }
    }

    // Above the NavHost so the login security notice shows wherever
    // the post-login navigation lands (auth.md "Reuse detection").
    SecurityNoticeHost()
    // The device lock's start-time duties (sign-out-custody §3.4-§3.5).
    DeviceLockKeeper()

    // The guest prompt behind an account-needing slot (design.md §6):
    // ask, never bounce — the reader picks the auth flow or stays put.
    if (shellState.joinPrompt) {
        AlertDialog(
            onDismissRequest = { shellState.joinPrompt = false },
            title = { Text(stringResource(R.string.join_prompt_title)) },
            text = { Text(stringResource(R.string.join_prompt_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        shellState.joinPrompt = false
                        navController.navigate(Login)
                    },
                    modifier = Modifier.testTag("join_prompt_signin"),
                ) {
                    Text(stringResource(R.string.join_prompt_signin))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { shellState.joinPrompt = false },
                    modifier = Modifier.testTag("join_prompt_dismiss"),
                ) {
                    Text(stringResource(R.string.join_prompt_dismiss))
                }
            },
            modifier = Modifier.testTag("join_prompt"),
        )
    }

    val bellModel: BellViewModel = hiltViewModel()
    val bellLit by bellModel.lit.collectAsStateWithLifecycle()
    val shellScope = rememberCoroutineScope()
    val shell = Shell(navController, authState, signedIn, shellState, bellLit, shellSnackbar, shellScope)

    // The shell: one scaffold owning the bottom bar and the shell-level
    // snackbar host (design.md §6) — one frame for every viewer: the bar
    // rides the read surfaces signed in or out, and a slot that needs an
    // account opens the join prompt on a signed-out tap — ask, never
    // bounce. The task flows drop it for their back arrow.
    val destination = backStackEntry?.destination
    val barShown = signedIn != null && destination.isReadSurface()
    SideEffect { onBarShown(barShown) }
    Scaffold(
        snackbarHost = {
            CograSnackbarHost(shellSnackbar, testTag = "shell_snackbar")
        },
        bottomBar = {
            if (barShown) ShellBottomBar(shell, shellState, destination)
        },
    ) { padding ->
        NavHost(
            navController = navController,
            // Login is the signed-out entry — signing in is the common
            // path; the invite entry hangs off it (design.md §6).
            startDestination = Login,
            // The transition layer the design defines and the app had none
            // of (`design/tokens/transitions.css`): a transition says where
            // a screen came from, and nothing else. Stock Navigation Compose
            // cross-fades, which makes back indistinguishable from forward.
            enterTransition = { NavTransitions.forwardEnter },
            exitTransition = { NavTransitions.forwardExit },
            popEnterTransition = { NavTransitions.backEnter },
            popExitTransition = { NavTransitions.backExit },
            // consumeWindowInsets rides with the padding (the documented
            // nested-scaffold pattern): without it every screen's own
            // scaffold re-applies the status inset the shell already
            // padded, doubling the space above each top bar.
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            // The entry funnel and the mailed links' landings belong to no
            // tab: they are reached from outside, with nothing beneath.
            funnel(shell)
            linkLandings(shell)
            // ONE NESTED GRAPH PER DESTINATION SLOT (design/readme.md §13):
            // each tab's stack is its own, and a screen stands in the graph
            // of the tab it was opened from, whatever it is about — so every
            // tab carries every drill-in, and the slot a screen lights is
            // read off its graph ([tab]), never remembered.
            navigation<FeedTab>(startDestination = Feed) {
                feedRoot(shell)
                // The ceremony opens over the feed root alone (VouchedIn.md:35).
                vouchedIn(shell)
                tabDestinations(shell)
            }
            navigation<ExploreTab>(startDestination = Explore) {
                exploreRoot(shell)
                tabDestinations(shell)
            }
            navigation<WalletTab>(startDestination = Wallet) {
                walletRoot(shell)
                tabDestinations(shell)
            }
            navigation<ProfileTab>(startDestination = Profile::class) {
                // The tab's root is the reader's own profile — the
                // `Profile` with no handle — and the profiles stacked on
                // it are the same destination, so the one registration
                // serves both.
                tabDestinations(shell)
            }
        }
    }
}

/** What every tab's stack can hold above its root: the read drill-ins and the task flows. */
private fun NavGraphBuilder.tabDestinations(shell: ShellScope) {
    readDrillIns(shell)
    yourTopics(shell)
    taskFlows(shell)
    settingsFlows(shell)
}

/** The read surfaces: the tab roots and the read drill-ins, which the bar frames. */
private fun NavDestination?.isReadSurface(): Boolean =
    this != null && READ_SURFACES.any { hasRoute(it) }

private val READ_SURFACES = listOf(
    Feed::class,
    Explore::class,
    Wallet::class,
    Profile::class,
    PostDetail::class,
    ChatsComingSoon::class,
    Saved::class,
    History::class,
    Notifications::class,
)

/**
 * The bar as the shell draws it over a read surface: the slot lit is the
 * tab the screen's stack belongs to — the originating root stays lit on a
 * drill-in (BottomNav.prompt.md; PostDetail.md:57, ProfileOther.md:17,
 * Notifications.md:31, Saved.md:119, ChatsComingSoon.md:13) — and each slot
 * climbs its ladder ([selectTab]).
 */
@Composable
private fun ShellBottomBar(shell: ShellScope, state: ShellState, destination: NavDestination?) {
    val tab = destination.tab()
    val navController = shell.navController
    fun select(target: TopLevelTab) {
        navController.selectTab(target, onReselect = { state.reselect(target) })
    }
    CograBottomBar(
        // The bar is the shell's, but each registered board names it under
        // its own screen (`feed.bottomBar`, `postDetail.bottomBar`), so it
        // wears the name of the screen it is standing under.
        node = destination?.let { BAR_NODES.firstOrNull { (route, _) -> it.hasRoute(route) }?.second },
        feedSelected = tab == TopLevelTab.FEED,
        profileSelected = tab == TopLevelTab.PROFILE,
        searchSelected = tab == TopLevelTab.EXPLORE,
        walletSelected = tab == TopLevelTab.WALLET,
        onFeed = { select(TopLevelTab.FEED) },
        // Explore and the wallet's door are open to every reader, a guest
        // included (Explore.md:35-37; WalletComingSoon.md:5).
        onSearch = { select(TopLevelTab.EXPLORE) },
        onWallet = { select(TopLevelTab.WALLET) },
        onCompose = {
            if (shell.signedIn == true) navController.navigate(ComposePost()) else shell.requireJoin()
        },
        onProfile = {
            if (shell.signedIn == true) select(TopLevelTab.PROFILE) else shell.requireJoin()
        },
    )
}

/** The registered names the bar wears, by the screen it stands under (nodes.json `*.bottomBar`). */
private val BAR_NODES = listOf(
    Feed::class to DataNode("feed") / "bottomBar",
    Explore::class to DataNode("explore") / "bottomBar",
    // Unregistered (nodes.json has no WalletComingSoon): the evident prefix.
    Wallet::class to DataNode("wallet") / "bottomBar",
    PostDetail::class to DataNode("postDetail") / "bottomBar",
    Notifications::class to DataNode("notifications") / "bottomBar",
    Profile::class to DataNode("profile") / "bottomBar",
    Saved::class to DataNode("saved") / "bottomBar",
    History::class to DataNode("history") / "bottomBar",
)
