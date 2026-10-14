// The single NavHost with type-safe routes, inside the shell scaffold
// (android/CLAUDE.md "Navigation"; design.md §6): the bottom bar frames
// the read surfaces — the tabs and the read drill-ins — and the
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.core.util.Consumer
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
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
import com.cogra.app.ui.DeviceLockKeeper
import com.cogra.app.ui.SecurityNoticeHost
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.v2.media.LocalAlwaysUnveil
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StanceZeroWords
import com.cogra.core.designsystem.v2.token.NavTransitions
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.store.TokenStore
import com.cogra.feature.auth.LoginRoute
import com.cogra.feature.auth.PasswordResetRoute
import com.cogra.feature.auth.RestoreRoute
import com.cogra.feature.content.ChatsComingSoonRoute
import com.cogra.feature.content.CommentsReturn
import com.cogra.feature.content.CommentsScroll
import com.cogra.feature.content.edit.PostEditRoute
import com.cogra.feature.content.wizard.ComposeWizardRoute
import com.cogra.feature.content.FeedRoute
import com.cogra.feature.content.PostDetailRoute
import com.cogra.feature.content.SavedDoors
import com.cogra.feature.content.SavedRoute
import com.cogra.feature.content.reply.CommentEditRoute
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.content.reply.ReplyTargetKind
import com.cogra.feature.content.reply.ReplyWizardRoute
import com.cogra.feature.home.BorrowedViewBandRoute
import com.cogra.feature.home.DeletionBandRoute
import com.cogra.feature.home.KeyRestoreBannerRoute
import com.cogra.feature.home.NewerVersionAnnouncement
import com.cogra.feature.home.StatusBannersRoute
import com.cogra.feature.home.VOUCH_CARD
import com.cogra.feature.home.VouchCardRoute
import com.cogra.feature.home.VouchedInScreen
import com.cogra.feature.invites.InvitesRoute
import com.cogra.feature.onboarding.ApplyRoute
import com.cogra.feature.onboarding.InviteEntryRoute
import com.cogra.feature.onboarding.KeyCeremonyRoute
import com.cogra.feature.profile.ProfileEditRoute
import com.cogra.feature.profile.ProfileRoute
import com.cogra.feature.profile.SAVED_ORIGIN
import com.cogra.feature.notifications.BellViewModel
import com.cogra.feature.notifications.NotificationsRoute
import com.cogra.feature.notifications.RootBellViewModel
import com.cogra.feature.profile.NOTIFICATIONS_ORIGIN
import com.cogra.domain.notifications.NotificationTarget
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.feature.profile.avatar.AvatarFlowRoute
import com.cogra.feature.settings.AboutScreen
import com.cogra.feature.settings.BackupRoute
import com.cogra.feature.settings.ChangeEmailConfirmRoute
import com.cogra.feature.settings.ChangeEmailLinkedRoute
import com.cogra.feature.settings.ChangeEmailRoute
import com.cogra.feature.settings.ChangeHandleRoute
import com.cogra.feature.settings.ChangePasswordRoute
import com.cogra.feature.settings.DeleteAccountConfirmedRoute
import com.cogra.feature.settings.DeleteAccountMailRoute
import com.cogra.feature.settings.DeleteAccountPendingRoute
import com.cogra.feature.settings.DeleteAccountRoute
import com.cogra.feature.settings.DeletionDoor
import com.cogra.feature.settings.EmailDoor
import com.cogra.feature.settings.KeyExportRoute
import com.cogra.feature.settings.SettingsDoors
import com.cogra.feature.settings.SettingsRoute
import com.cogra.feature.settings.WhatsNewRoute
import com.cogra.feature.stance.StanceControlRoute
import com.cogra.feature.stance.vouchBackVariant
import com.cogra.feature.topics.TopicRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
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

/**
 * The composer. [postId] names an edit target; [referenceTargetId]
 * arrives from a node's Reference affordance and opens a fresh post
 * with that node already staged as a chip (D20).
 */
@Serializable
data class ComposePost(
    val postId: String? = null,
    val referenceTargetId: String? = null,
)

/**
 * A post's detail. [from] names where the reader came from, which the back
 * arrow reads (`saved` → `Back to Saved`); [commentId] lands the thread on
 * that comment, opened over the post (Saved.md), and [aimReply] — a comment
 * card's comment glyph — opens the reply composer aimed at it.
 */
@Serializable
data class PostDetail(
    val postId: String,
    val from: String? = null,
    val commentId: String? = null,
    val aimReply: Boolean = false,
)

/**
 * The reply wizard, pinned to what it answers (graph.json `ReplyEntry`
 * 5 and 7): [isComment] false is the post, true the comment.
 *
 * The card's words ride the route rather than a second read — a
 * composer that had to fetch its own target would open empty, and the
 * thread already holds every one of these.
 */
@Serializable
data class ReplyWizard(
    val targetId: String,
    val isComment: Boolean,
    val title: String,
    val snippet: String,
    val authorHandle: String,
    val avatarUrl: String? = null,
)

/** `CommentEdit` on an own comment (graph.json `ReplyMedia` 6). */
@Serializable
data class EditComment(val commentId: String, val parentTitle: String)

/** A topic by its canonical name — reachable from a chip anywhere (D20). */
@Serializable
data class Topic(val name: String)

/** An actor's profile; a null handle is the viewer's own (the tab). [from] names the back arrow's origin. */
@Serializable
data class Profile(val handle: String? = null, val from: String? = null)

/** The reader's Saved list, reached from their own profile's ⋮ (Saved.md). */
@Serializable
data object Saved

/**
 * The reader's notification list, reached from the bell on a root band
 * (Notifications.md). [from] names the root the bell was tapped on — the slot
 * the bar keeps lit and the root the back arrow names.
 */
@Serializable
data class Notifications(val from: String = "feed")

@Serializable
data object ProfileEdit

/**
 * The profile-picture flow (`AvatarCrop` → `AvatarSeal`).
 *
 * Its own destination rather than a step inside the edit form, because it
 * ends in **its own seal**: changing your picture is a signed act in its
 * own right (design/readme.md §13).
 */
@Serializable
data class AvatarFlow(val uri: String)

@Serializable
data object Invites

@Serializable
data object Settings

@Serializable
data object KeyExport

/** The release chronicle behind Settings' `What's new` row (WhatsNew.md). */
@Serializable
data object WhatsNew

/** The interim recovery-code route (DRIFT: the SettingsBackup* boards are the backup-replacement packet's). */
@Serializable
data object SettingsBackup

@Serializable
data object ChangePassword

@Serializable
data object ChangeHandle

/**
 * The email change's request. [applicant] is the unverified applicant's
 * carve-out (`ApplicantEmail`), opened from Settings by G1/G2.
 */
@Serializable
data class ChangeEmail(val applicant: Boolean = false)

@Serializable
data object ChangeEmailConfirm

/** The new address's link — the App Link on `/email-change?token=`. */
@Serializable
data class ChangeEmailLinked(val token: String)

@Serializable
data object About

/** The deletion's request screen (`DeleteAccount`), opened from the Settings row. */
@Serializable
data object DeleteAccount

/**
 * Where the request lands (`DeleteAccountMail`). [includeContent] is the
 * request screen's recorded choice, which Resend carries again.
 */
@Serializable
data class DeleteAccountMail(val includeContent: Boolean)

/** The grace page (`DeleteAccountPending`), opened from the row while the deletion is confirmed. */
@Serializable
data object DeleteAccountPending

/** The mailed link's landing — the App Link on `/delete-account?token=`. */
@Serializable
data class DeleteAccountConfirmed(val token: String)

/**
 * Chats — coming soon (backlog item 68, ruled 2026-09-14). Reachable from
 * every root band's chats affordance; no state of its own, so one route
 * serves every caller.
 */
@Serializable
data object ChatsComingSoon

/**
 * The vouch-back's ceremony (`VouchedIn`; VouchedIn.md). It carries the
 * voucher it names — handle, name, face — from the surface the signing was
 * taken on, so it needs no read of its own.
 */
@Serializable
data class VouchedIn(val handle: String, val name: String, val avatarUrl: String? = null)

/** The new address's link path (auth.md "Link URLs"), claimed beside `/join`. */
private const val EMAIL_CHANGE_PATH = "/email-change"

/** The account deletion's link path (auth.md "Link URLs"), claimed beside `/join`. */
private const val DELETE_ACCOUNT_PATH = "/delete-account"

/** What `ManageSpaceActivity` relays the system storage screen's "Manage space" as. */
const val ACTION_MANAGE_SPACE = "com.cogra.app.action.MANAGE_SPACE"

/** The app's coarse auth phase; each value owns a navigation graph root. */
enum class AuthPhase { LOADING, SIGNED_OUT, SIGNED_IN }

/**
 * A navigation result: the name it rides under, bound to the value that
 * means "nothing to report".
 *
 * The two belong together. A key read with the wrong default, or cleared
 * with a value of the wrong type, compiles perfectly well and fails at
 * runtime — binding them into one thing is what makes that unsayable.
 */
private class NavResultKey<T>(val name: String, val absent: T)

/**
 * The Restore result key. It rides the back-stack ENTRY's
 * savedStateHandle — a different object from the one injected into the
 * entry's ViewModels, so it must be read here, where the entry is in
 * hand (android/CLAUDE.md "Navigation").
 */
private val actorRestoredKey = NavResultKey("actor_restored", false)

/** The (ChangeHandle)→Profile result key: the handle changed, re-read. */
private val handleChangedKey = NavResultKey("handle_changed", false)

/**
 * The subpage→Settings result key: what to say over the page on return
 * (`Password changed — other devices are signed out.`, `Your handle is now
 * @x.`, …). The page re-reads on every arrival; this carries the words.
 */
private val settingsNoticeKey = NavResultKey<String?>("settings_notice", null)

/** The manage-space door's ask: settings opens with Clearing data in view (Settings.md). */
private val settingsClearingKey = NavResultKey("settings_clearing", false)

/** The Compose→(Feed|PostDetail) result key: a write signed, re-read. */
private val contentSignedKey = NavResultKey("content_signed", false)

/**
 * The (ReplyWizard|CommentEdit)→thread result key: a comment or an edit
 * signed, so the thread re-reads and says so once.
 *
 * Distinct from [contentSignedKey] because the surfaces answer them
 * differently — a signed comment earns the thread's snackbar, a
 * returning post edit only the refetch.
 */
private val commentSignedKey = NavResultKey("comment_signed", false)

/**
 * THE OTHER HALF OF THE SHEET'S RETURN (jakob 2026-09-15): which comment
 * the reply that just landed hangs under, so its branch unfolds and the
 * author sees what they wrote. Null is a comment on the post itself.
 *
 * "A comment landed" alone cannot draw the return — a reply arrives one
 * level down, behind a count that was collapsed when the reader left —
 * which is why this rides beside [commentSignedKey] rather than being
 * folded into it.
 */
private val commentParentKey = NavResultKey<String?>("comment_parent", null)

/**
 * …and where the reader was in the thread when it gave way.
 *
 * Reported by the surface to ITSELF on the way out, not by the composer
 * on the way back: the place is the sheet's own fact, and the composer
 * never knew it. It rides the same savedStateHandle the results do, so
 * it survives process death exactly as they do.
 *
 * A LazyColumn's place is two ints and an `IntArray` is what a Bundle
 * carries without a Parcelable of its own; [CommentsScroll] is the shape
 * everything above this layer speaks.
 */
private val commentsPlaceKey = NavResultKey<IntArray?>("comments_place", null)

private fun IntArray?.asCommentsScroll(): CommentsScroll? =
    this?.takeIf { it.size == 2 }?.let { CommentsScroll(it[0], it[1]) }

/**
 * `ReplyEntry` 5 and 7 — the composer, pinned to whatever the thread
 * said it answers.
 *
 * One route for both surfaces that raise the thread: the sheet over the
 * feed opens the same composer the sheet over the detail does, and two
 * copies of this call would be two chances for them to drift.
 */
private fun NavController.openReplyWizard(target: ReplyTarget) {
    navigate(
        ReplyWizard(
            targetId = target.id,
            isComment = target.kind == ReplyTargetKind.Comment,
            title = target.title,
            snippet = target.snippet,
            authorHandle = target.authorHandle,
            avatarUrl = target.avatarUrl,
        ),
    )
}

/**
 * The Wizard→Feed result key: a staged act was collected before it
 * landed. The value is the post's own label, so the feed's calm notice
 * can name what did not land (`ComposeExpired`).
 */
private val contentExpiredKey = NavResultKey<String?>("content_expired", null)

/** The ProfileEdit→Profile result key: the update signed, re-read. */
private val profileSavedKey = NavResultKey("profile_saved", false)

/**
 * A destination's own view of one result: what it says, and the lambda
 * that marks it read.
 *
 * Consuming is half of the pattern — a result left in the handle re-fires
 * on the next recomposition — so the read hands back the way to consume
 * it rather than leaving each site to remember the key and its default a
 * second time.
 */
@Composable
private fun <T> NavBackStackEntry.navResult(key: NavResultKey<T>): Pair<T, () -> Unit> {
    val value by savedStateHandle
        .getStateFlow(key.name, key.absent)
        .collectAsStateWithLifecycle()
    return value to { savedStateHandle[key.name] = key.absent }
}

/** Reports [value] to the destination this one returns to. */
private fun <T> NavController.report(key: NavResultKey<T>, value: T) {
    previousBackStackEntry?.savedStateHandle?.set(key.name, value)
}

/**
 * Reports [value] to the destination now on top — the shape a pop uses,
 * where the destination being answered is the one popped back to rather
 * than the one behind this.
 */
private fun <T> NavController.reportToCurrent(key: NavResultKey<T>, value: T) {
    currentBackStackEntry?.savedStateHandle?.set(key.name, value)
}

/**
 * Reports [value] to the named destination further down the stack.
 *
 * The avatar flow needs this: it is pushed from the edit screen, so
 * [report] hands its result to that screen — which reads no results at
 * all, so a signed picture was answered by nothing. The news belongs to
 * the profile two entries down, whether the reader saves the rest of
 * the edit afterwards or simply walks back.
 */
private inline fun <reified R : Any, T> NavController.reportTo(key: NavResultKey<T>, value: T) {
    val entry = runCatching { getBackStackEntry<R>() }.getOrNull() ?: return
    entry.savedStateHandle[key.name] = value
}

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
    CompositionLocalProvider(
        LocalSnackbarHostState provides shellSnackbar,
        LocalAlwaysUnveil provides alwaysUnveil,
    ) {
        CograNavGraphContent(navController, shellSnackbar)
    }
}

@Composable
private fun CograNavGraphContent(
    navController: NavHostController,
    shellSnackbar: SnackbarHostState,
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
    // The new address's link opened signed out, held through the sign-in
    // it asks for (ChangeEmailLinkedSignedOut.md: "the sign-in screen opens
    // holding the link"); applied and landed once the session exists.
    var heldEmailLink by rememberSaveable { mutableStateOf<String?>(null) }
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
            destination?.hasRoute(DeleteAccountConfirmed::class) == true
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
        navController.navigate(root) {
            popUpTo(0) { inclusive = true }
        }
        if (accountDeleted) {
            authState.deletion.consumeAccountDeleted()
            launch { shellSnackbar.showSnackbar(accountDeletedLine) }
        }
        val held = heldEmailLink
        if (root == Feed && phase == AuthPhase.SIGNED_IN && held != null) {
            heldEmailLink = null
            navController.navigate(ChangeEmailLinked(held))
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
                path?.startsWith(DELETE_ACCOUNT_PATH) == true
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
    // bar rides the read surfaces signed in or out, and a slot that
    // needs an account opens the join prompt on a signed-out tap —
    // ask, never bounce. A read drill-in keeps the frame but selects
    // no tab; the task flows drop it for their back arrow.
    val onFeedTab = backStackEntry?.destination?.hasRoute(Feed::class) == true
    val onProfile = backStackEntry?.destination?.hasRoute(Profile::class) == true
    // SAVED KEEPS PROFILE LIT (Saved.md, design digest item 51: the
    // originating root stays lit on a drill-in) — its one door is the
    // reader's own profile.
    val onSaved = backStackEntry?.destination?.hasRoute(Saved::class) == true
    // NOTIFICATIONS KEEPS LIT THE ROOT THE BELL WAS TAPPED ON (Notifications.md:27).
    val onNotifications = backStackEntry?.destination?.hasRoute(Notifications::class) == true
    val notificationsFrom = if (onNotifications) backStackEntry?.toRoute<Notifications>()?.from else null
    val onOwnProfileTab = onSaved ||
        notificationsFrom == "profile" ||
        (onProfile && backStackEntry?.toRoute<Profile>()?.handle == null)
    val onPostDetail = backStackEntry?.destination?.hasRoute(PostDetail::class) == true
    val onChatsComingSoon = backStackEntry?.destination?.hasRoute(ChatsComingSoon::class) == true
    val onReadSurface = onFeedTab || onProfile || onPostDetail || onChatsComingSoon || onSaved || onNotifications
    // THE BELL'S DOT: one state the whole shell shows, lit only on a root's
    // fresh load (FeedUnread.md) — each root reads it through its own entry's
    // `RootBellViewModel`; a guest has no list and no bell.
    val bellModel: BellViewModel = hiltViewModel()
    val bellLit by bellModel.lit.collectAsStateWithLifecycle()
    fun bellFor(from: String): BandBell? =
        BandBell(lit = bellLit, onOpen = { navController.navigate(Notifications(from)) }).takeIf { signedIn == true }

    // The documented tab pattern: pop to the signed-in root saving
    // state, single-top, restoring the target tab's state.
    fun toTab(route: Any) {
        navController.navigate(route) {
            popUpTo(Feed) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    // The two shell slots every destination that has them draws the same
    // way. Written once here, where `signedIn`, the controller and the
    // shell's snackbar are already in scope, rather than copied into each
    // destination — the profile's extra condition is the only variation
    // and it lives at that one call site.
    val keyBanner: @Composable () -> Unit = {
        if (signedIn == true) {
            KeyRestoreBannerRoute(onRestoreActor = { navController.navigate(Restore) })
        }
    }
    // The band rides both sides of the session — the guest reading carries
    // the shell's one sign-in-or-join entry, which is why the slot and not
    // the screen owns that navigation. Nothing is drawn while the auth
    // state is still unknown: the two readings differ, and guessing puts
    // the wrong sentence on screen for a frame.
    // The feed's own pulls, counted: the readers that ride the feed (the
    // band, the vouch card) read again with each one.
    var feedPulls by rememberSaveable { mutableIntStateOf(0) }
    // The bar's Feed slot re-tapped over the feed's own root, counted: the
    // feed answers each one it has not answered yet.
    var feedReselects by rememberSaveable { mutableIntStateOf(0) }
    val borrowedViewBand: @Composable () -> Unit = {
        signedIn?.let { signed ->
            BorrowedViewBandRoute(
                signedIn = signed,
                onSignInOrJoin = { navController.navigate(Login) },
                refreshSignal = feedPulls,
            )
        }
    }

    // The deletion band rides the signed-in reader's surfaces only: a
    // deletion is an account's, and a signed-out reader has none. It wears
    // the registered `feed.deletionBand` where the board draws it (the feed)
    // and its own tag elsewhere.
    fun deletionBand(node: DataNode?): @Composable () -> Unit = {
        if (signedIn == true) {
            DeletionBandRoute(signedIn = true, refreshSignal = feedPulls, node = node)
        }
    }

    // THE CEREMONY OPENS OVER THE FEED ROOT ALONE (VouchedIn.md:35): the
    // pad, the card or the profile it was signed from never come back on
    // Back, so the entry is pushed with everything above the feed popped.
    fun openCeremony(handle: String, name: String?, avatarUrl: String?) {
        navController.navigate(VouchedIn(handle, name?.takeIf { it.isNotBlank() } ?: handle, avatarUrl)) {
            popUpTo(Feed)
            launchSingleTop = true
        }
    }
    // The vouch card, the feed's own first card (`VouchBack`): its act is the
    // stance face toward the voucher — the tap blooms the vouch-back pad over
    // the shell, the hold signs the gentle default, and a taken signing either
    // way opens the ceremony (VouchBack.md:11, VouchBackPad.md:33).
    val vouchCard: @Composable () -> Unit = {
        if (signedIn == true) {
            VouchCardRoute(
                stance = { voucher ->
                    StanceControlRoute(
                        target = StanceTarget.Node(voucher.id),
                        testTagPrefix = "vouch_back",
                        targetLabel = "@${voucher.handle}",
                        node = VOUCH_CARD / "stance",
                        variant = vouchBackVariant(VOUCH_CARD / "stance" / "pad"),
                        lineFaceInk = MaterialTheme.colorScheme.onTertiaryContainer,
                        onTaken = {
                            openCeremony(voucher.handle, voucher.displayName, voucher.avatar?.url)
                        },
                    )
                },
                refreshSignal = feedPulls,
            )
        }
    }
    val statusBanners: @Composable (Boolean, () -> Unit) -> Unit = { restored, onConsumed ->
        if (signedIn == true) {
            StatusBannersRoute(
                actorRestoredResult = restored,
                onActorRestoredResultConsumed = onConsumed,
                onStartKeyCeremony = { navController.navigate(KeyCeremony) },
                snackbarHostState = shellSnackbar,
            )
        }
    }

    Scaffold(
        snackbarHost = {
            CograSnackbarHost(shellSnackbar, testTag = "shell_snackbar")
        },
        bottomBar = {
            if (signedIn != null && onReadSurface) {
                CograBottomBar(
                    // The bar is the shell's, but each registered board names
                    // it under its own screen (`feed.bottomBar`,
                    // `postDetail.bottomBar`), so it wears the name of the
                    // screen it is standing under.
                    node = when {
                        onFeedTab -> DataNode("feed") / "bottomBar"
                        onPostDetail -> DataNode("postDetail") / "bottomBar"
                        onNotifications -> DataNode("notifications") / "bottomBar"
                        else -> null
                    },
                    feedSelected = onFeedTab || notificationsFrom == "feed",
                    profileSelected = onOwnProfileTab,
                    // Over the feed's own root the slot is a re-tap the feed
                    // answers (Feed.md:85-91); from anywhere else it is the
                    // way back to the root, at the scroll it was left.
                    onFeed = {
                        if (onFeedTab) {
                            feedReselects += 1
                        } else {
                            toTab(Feed)
                        }
                    },
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
            composable<Feed> { entry ->
                val (signedResult, consumeSigned) = entry.navResult(contentSignedKey)
                val (actorRestored, consumeRestored) = entry.navResult(actorRestoredKey)
                val (expiredLabel, consumeExpired) = entry.navResult(contentExpiredKey)
                // THE COMMENTS SHEET IS RAISED HERE TOO, so the feed reads
                // the thread's return exactly as the detail does: the
                // return belongs to the sheet, not to the surface under it.
                val (commentSigned, consumeCommentSigned) = entry.navResult(commentSignedKey)
                val (commentParent, consumeCommentParent) = entry.navResult(commentParentKey)
                val (commentsPlace, consumeCommentsPlace) = entry.navResult(commentsPlaceKey)
                val accountId by authState.accountId.collectAsStateWithLifecycle()
                // THE BELL LIGHTS ON THIS ROOT'S FRESH LOAD (FeedUnread.md:5):
                // once per entry, and again on the reader's pull.
                val rootBell: RootBellViewModel? = if (signedIn == true) hiltViewModel(entry) else null
                FeedRoute(
                    signedIn = signedIn,
                    reselectSignal = feedReselects,
                    // A guest's Report asks them to join instead of raising
                    // the confirm (ReportConfirm.md:21).
                    onRequireAccount = { joinPrompt = true }.takeIf { signedIn == false },
                    onReply = { target -> navController.openReplyWizard(target) },
                    onEditComment = { commentId, parentTitle ->
                        navController.navigate(EditComment(commentId, parentTitle))
                    },
                    onSignInOrJoin = { navController.navigate(Login) },
                    commentsReturn = CommentsReturn(
                        scroll = commentsPlace.asCommentsScroll(),
                        landed = commentSigned,
                        parentCommentId = commentParent,
                    ),
                    onCommentsReturnConsumed = {
                        consumeCommentSigned()
                        consumeCommentParent()
                        consumeCommentsPlace()
                    },
                    onCommentsDepart = { scroll ->
                        navController.reportToCurrent(
                            commentsPlaceKey,
                            intArrayOf(scroll.index, scroll.offset),
                        )
                    },
                    expiredLabel = expiredLabel,
                    onExpiredDismissed = consumeExpired,
                    onOpenDraft = {
                        consumeExpired()
                        navController.navigate(ComposePost())
                    },
                    onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                    onOpenActor = { handle -> navController.navigate(Profile(handle)) },
                    onOpenTopic = { name -> navController.navigate(Topic(name)) },
                    // The card's ⋮ reaches the same two destinations the
                    // detail's menu does: a feed card's rows are the post's
                    // rows, so they cannot lead somewhere else.
                    viewerId = accountId,
                    onEditPost = { id -> navController.navigate(ComposePost(id)) },
                    onCitePost = { id ->
                        navController.navigate(ComposePost(referenceTargetId = id))
                    },
                    // The chats affordance the band carries (jakob
                    // 2026-09-01). A signed-out tap opens the guest gate,
                    // which is the edge the canvas draws (`graph.json`
                    // "FeedBare" → `GuestGate`); a signed-in tap reaches
                    // the coming-soon destination (`graph.json` "Feed" →
                    // `ChatsComingSoon`, backlog item 68). Nothing is
                    // drawn while the auth state is still unknown — the
                    // two readings differ, and guessing puts the wrong
                    // action on the tap for a frame.
                    onChats = when (signedIn) {
                        false -> {
                            { joinPrompt = true }
                        }
                        true -> {
                            { navController.navigate(ChatsComingSoon) }
                        }
                        null -> null
                    },
                    bell = bellFor("feed"),
                    refreshSignal = signedResult,
                    onRefreshSignalConsumed = consumeSigned,
                    keyBanner = keyBanner,
                    borrowedViewBand = borrowedViewBand,
                    deletionBand = deletionBand(DataNode("feed") / "deletionBand"),
                    banners = { statusBanners(actorRestored, consumeRestored) },
                    vouchCard = vouchCard,
                    onPulled = {
                        feedPulls += 1
                        rootBell?.pulled()
                    },
                )
                // A newer version, said once per release on a cold open's
                // feed — to members, applicants and guests alike
                // (FeedNewerVersion.md).
                val context = LocalContext.current
                NewerVersionAnnouncement(onUpdateNow = { openStoreListing(context) })
            }
            composable<VouchedIn> { entry ->
                val route = entry.toRoute<VouchedIn>()
                VouchedInScreen(
                    handle = route.handle,
                    name = route.name,
                    avatarUrl = route.avatarUrl,
                    // The member's own feed — the root already under this
                    // entry, so it comes back where the reader left it.
                    onGoToFeed = {
                        if (!navController.popBackStack(Feed, inclusive = false)) {
                            navController.navigate(Feed) { launchSingleTop = true }
                        }
                    },
                )
            }
            composable<ComposePost> { entry ->
                val editing = entry.toRoute<ComposePost>().postId != null
                // Creating a post runs the wizard (D19); editing one runs
                // the post edit, one screen and one batch (EditCompose).
                // Both live behind the same destination so the bottom
                // bar's centre action and the post menu's Edit keep their
                // routes.
                if (!editing) {
                    ComposeWizardRoute(
                        referenceTargetId = entry.toRoute<ComposePost>().referenceTargetId,
                        // `ComposeLanded` lands on the post itself, not on
                        // the feed: the author's next question is what
                        // they just made, and a feed landing answers a
                        // different one. The wizard leaves the stack
                        // first, so back from the post reaches the feed
                        // rather than the composer that made it.
                        onSigned = { nodeId ->
                            navController.popBackStack<Feed>(inclusive = false)
                            navController.reportToCurrent(contentSignedKey, true)
                            navController.navigate(PostDetail(nodeId))
                        },
                        // "Nothing was spent — your draft is saved": the
                        // notice belongs on the feed, which is where the
                        // canonical `ComposeExpired` board draws it.
                        onExpired = { label ->
                            navController.popBackStack<Feed>(inclusive = false)
                            navController.reportToCurrent(contentExpiredKey, label)
                        },
                        onLeave = { navController.navigateUp() },
                        onRestoreKey = { navController.navigate(Restore) },
                        keyBanner = keyBanner,
                        deletionBand = deletionBand(node = null),
                    )
                    return@composable
                }
                // The post edit, one screen and one batch (EditCompose). An
                // edit came from its post already and simply returns to it,
                // refreshed, the edit settling.
                PostEditRoute(
                    postId = checkNotNull(entry.toRoute<ComposePost>().postId),
                    onSaved = {
                        navController.report(contentSignedKey, true)
                        navController.popBackStack()
                    },
                    onBack = { navController.navigateUp() },
                    keyCard = keyBanner,
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<PostDetail> { entry ->
                val (signedResult, consumeSigned) = entry.navResult(contentSignedKey)
                val (commentSigned, consumeCommentSigned) = entry.navResult(commentSignedKey)
                val (commentParent, consumeCommentParent) = entry.navResult(commentParentKey)
                val (commentsPlace, consumeCommentsPlace) = entry.navResult(commentsPlaceKey)
                val accountId by authState.accountId.collectAsStateWithLifecycle()
                val detailRoute = entry.toRoute<PostDetail>()
                PostDetailRoute(
                    postId = detailRoute.postId,
                    from = detailRoute.from,
                    landOn = detailRoute.commentId,
                    aimReply = detailRoute.aimReply,
                    viewerId = accountId,
                    signedIn = signedIn,
                    onRequireAccount = { joinPrompt = true }.takeIf { signedIn == false },
                    onEdit = { id -> navController.navigate(ComposePost(id)) },
                    // `ReplyEntry` 5 and 7 — the composer, pinned to
                    // whatever the thread said it answers.
                    onReply = { target -> navController.openReplyWizard(target) },
                    // `ReplyMedia` 6 — `CommentEdit`, on an own comment.
                    onEditComment = { commentId, parentTitle ->
                        navController.navigate(EditComment(commentId, parentTitle))
                    },
                    onOpenActor = { handle -> navController.navigate(Profile(handle)) },
                    // A post cited from the tags-and-references sheet; a cited
                    // comment lands on the post carrying it, which has no
                    // permalink of its own.
                    onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                    onOpenTopic = { name -> navController.navigate(Topic(name)) },
                    onReference = { id ->
                        navController.navigate(ComposePost(referenceTargetId = id))
                    },
                    onSignInOrJoin = { navController.navigate(Login) },
                    onBack = { navController.navigateUp() },
                    refreshSignal = signedResult,
                    onRefreshSignalConsumed = consumeSigned,
                    commentsReturn = CommentsReturn(
                        scroll = commentsPlace.asCommentsScroll(),
                        landed = commentSigned,
                        parentCommentId = commentParent,
                    ),
                    onCommentsReturnConsumed = {
                        consumeCommentSigned()
                        consumeCommentParent()
                        consumeCommentsPlace()
                    },
                    onCommentsDepart = { scroll ->
                        navController.reportToCurrent(
                            commentsPlaceKey,
                            intArrayOf(scroll.index, scroll.offset),
                        )
                    },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<ReplyWizard> { entry ->
                val route = entry.toRoute<ReplyWizard>()
                ReplyWizardRoute(
                    target = ReplyTarget(
                        id = route.targetId,
                        kind = if (route.isComment) {
                            ReplyTargetKind.Comment
                        } else {
                            ReplyTargetKind.Post
                        },
                        title = route.title,
                        snippet = route.snippet,
                        authorHandle = route.authorHandle,
                        avatarUrl = route.avatarUrl,
                    ),
                    // Signed lands back on the thread it answers, which
                    // re-reads and shows the comment settling — and, for
                    // a reply, unfolds the branch it settled into. The
                    // wizard's own target IS that branch's comment, so
                    // the parent is known here and nowhere else.
                    onSigned = {
                        navController.report(commentSignedKey, true)
                        navController.report(
                            commentParentKey,
                            route.targetId.takeIf { route.isComment },
                        )
                        navController.navigateUp()
                    },
                    // Leaving keeps nothing: comments have no drafts
                    // (jakob 2026-09-01).
                    onLeave = { navController.navigateUp() },
                    onRestoreKey = { navController.navigate(Restore) },
                    keyBanner = keyBanner,
                )
            }
            composable<EditComment> { entry ->
                val route = entry.toRoute<EditComment>()
                CommentEditRoute(
                    commentId = route.commentId,
                    parentTitle = route.parentTitle,
                    onSaved = {
                        navController.report(commentSignedKey, true)
                        navController.navigateUp()
                    },
                    onLeave = { navController.navigateUp() },
                )
            }
            composable<Topic> { entry ->
                val topic = entry.toRoute<Topic>().name
                TopicRoute(
                    name = topic,
                    onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                    onOpenActor = { handle -> navController.navigate(Profile(handle)) },
                    onBack = { navController.navigateUp() },
                    // The page's one action, wired here because what a
                    // signed-out tap does is the shell's to say — the
                    // same guest gate the bar's slots raise. Nothing is
                    // drawn while the auth state is unknown: the two
                    // readings differ, and guessing puts the wrong
                    // action on the tap for a frame.
                    stanceControl = signedIn?.let { signed ->
                        {
                            StanceControlRoute(
                                target = StanceTarget.Topic(topic),
                                testTagPrefix = "topic_affinity",
                                axes = StanceAxes.Affinity,
                                // Disconnected, never severed (jakob's I2
                                // ruling, copy-voice.md "the topic
                                // disconnects") — the same split
                                // `StanceAxes.Affinity` already makes for
                                // the two signed slots.
                                zeroWords = StanceZeroWords.Disconnected,
                                // It NAMES WHAT IT STANCES, hash and all:
                                // this page carries more than one stance
                                // control and the accessible name is what
                                // says which is which (`TagPage`).
                                targetLabel = "#$topic",
                                wide = true,
                                onRequireAccount = { joinPrompt = true }.takeIf { !signed },
                            )
                        }
                    },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<Profile> { entry ->
                val route = entry.toRoute<Profile>()
                val (handleChanged, consumeHandleChanged) = entry.navResult(handleChangedKey)
                val (profileSaved, consumeProfileSaved) = entry.navResult(profileSavedKey)
                val (actorRestored, consumeRestored) = entry.navResult(actorRestoredKey)
                // The own profile is a ROOT: its fresh load reads the bell
                // (Profile.md:41; FeedUnread.md:5). Another actor's is a drill-in.
                val ownRoot = route.handle == null && signedIn == true
                if (ownRoot) hiltViewModel<RootBellViewModel>(entry)
                ProfileRoute(
                    handle = route.handle,
                    bell = if (ownRoot) bellFor("profile") else null,
                    handleChangedResult = handleChanged,
                    onHandleChangedResultConsumed = consumeHandleChanged,
                    profileSavedResult = profileSaved,
                    onProfileSavedResultConsumed = consumeProfileSaved,
                    onEdit = { navController.navigate(ProfileEdit) },
                    onOpenSettings = { navController.navigate(Settings) },
                    onOpenInvites = { navController.navigate(Invites) },
                    onOpenPost = { id -> navController.navigate(PostDetail(id)) },
                    // The own-profile tab has no back arrow; another
                    // actor's profile is a drill-in.
                    onBack = if (route.handle == null) null else ({ navController.navigateUp() }),
                    // Only the reader's own profile carries the shell
                    // banners: another actor's is a drill-in.
                    keyBanner = { if (route.handle == null) keyBanner() },
                    deletionBand = deletionBand(node = null),
                    banners = {
                        if (route.handle == null) statusBanners(actorRestored, consumeRestored)
                    },
                    // A signing on the member who vouched the reader in opens
                    // the ceremony, by Set or by the hold (ProfileOther.md:37).
                    onVouchedBack = { profile ->
                        openCeremony(profile.handle, profile.displayName.value, profile.avatar?.url)
                    },
                    // The own ⋮'s Saved row (ProfileOwnMenu.md).
                    onOpenSaved = { navController.navigate(Saved) },
                    onRequireAccount = { joinPrompt = true }.takeIf { signedIn == false },
                    from = route.from,
                )
            }
            // NOTIFICATIONS (Notifications.md): reached from the bell on a root
            // band; every row opens its thing with a back arrow reading `Back to
            // Notifications`, and the list's own arrow pops to the bell's root.
            composable<Notifications> { entry ->
                val route = entry.toRoute<Notifications>()
                NotificationsRoute(
                    from = route.from,
                    onBack = { navController.navigateUp() },
                    onOpen = { target ->
                        when (target) {
                            is NotificationTarget.Post -> navController.navigate(
                                PostDetail(target.postId, from = NOTIFICATIONS_ORIGIN),
                            )
                            is NotificationTarget.Comment -> navController.navigate(
                                PostDetail(target.postId, from = NOTIFICATIONS_ORIGIN, commentId = target.commentId),
                            )
                            is NotificationTarget.Person -> navController.navigate(
                                Profile(target.handle, from = NOTIFICATIONS_ORIGIN),
                            )
                            NotificationTarget.Invites -> navController.navigate(Invites)
                            NotificationTarget.OwnFeed -> toTab(Feed)
                        }
                    },
                )
            }
            // SAVED (Saved.md): reached from the own profile's ⋮, a feed of
            // every kept thing as its kind's own card; every door opens its
            // thing with a back arrow reading `Back to Saved`. A post card's
            // comment count raises the thread over Saved, as over the feed, so
            // the thread's return is read here the same way.
            composable<Saved> { entry ->
                val (commentSigned, consumeCommentSigned) = entry.navResult(commentSignedKey)
                val (commentParent, consumeCommentParent) = entry.navResult(commentParentKey)
                val (commentsPlace, consumeCommentsPlace) = entry.navResult(commentsPlaceKey)
                val accountId by authState.accountId.collectAsStateWithLifecycle()
                SavedRoute(
                    onBack = { navController.navigateUp() },
                    doors = SavedDoors(
                        onOpenPost = { id -> navController.navigate(PostDetail(id, from = SAVED_ORIGIN)) },
                        onOpenComment = { postId, commentId, aimReply ->
                            navController.navigate(
                                PostDetail(postId, from = SAVED_ORIGIN, commentId = commentId, aimReply = aimReply),
                            )
                        },
                        onOpenActor = { handle -> navController.navigate(Profile(handle, from = SAVED_ORIGIN)) },
                        onOpenTopic = { name -> navController.navigate(Topic(name)) },
                    ),
                    viewerId = accountId,
                    signedIn = signedIn,
                    onEditPost = { id -> navController.navigate(ComposePost(id)) },
                    onCitePost = { id -> navController.navigate(ComposePost(referenceTargetId = id)) },
                    onReply = { target -> navController.openReplyWizard(target) },
                    onEditComment = { commentId, parentTitle ->
                        navController.navigate(EditComment(commentId, parentTitle))
                    },
                    onSignInOrJoin = { navController.navigate(Login) },
                    commentsReturn = CommentsReturn(
                        scroll = commentsPlace.asCommentsScroll(),
                        landed = commentSigned,
                        parentCommentId = commentParent,
                    ),
                    onCommentsReturnConsumed = {
                        consumeCommentSigned()
                        consumeCommentParent()
                        consumeCommentsPlace()
                    },
                    onCommentsDepart = { scroll ->
                        navController.reportToCurrent(
                            commentsPlaceKey,
                            intArrayOf(scroll.index, scroll.offset),
                        )
                    },
                )
            }
            composable<ProfileEdit> {
                ProfileEditRoute(
                    onSaved = {
                        navController.report(profileSavedKey, true)
                        navController.popBackStack()
                    },
                    onPicturePicked = { uri -> navController.navigate(AvatarFlow(uri)) },
                    onBack = { navController.navigateUp() },
                )
            }
            composable<AvatarFlow> { entry ->
                AvatarFlowRoute(
                    uri = entry.toRoute<AvatarFlow>().uri,
                    onSigned = {
                        navController.reportTo<Profile, _>(profileSavedKey, true)
                        navController.popBackStack()
                    },
                    onLeave = { navController.popBackStack() },
                )
            }
            composable<Invites> {
                InvitesRoute(onBack = { navController.navigateUp() }, deletionBand = deletionBand(node = null))
            }
            composable<Settings> { entry ->
                val (notice, consumeNotice) = entry.navResult(settingsNoticeKey)
                val (clearing, consumeClearing) = entry.navResult(settingsClearingKey)
                // No collapsing top and no key card here: the header is
                // pinned (Settings.md) and the key card stands at the
                // feed's head (KeyElsewhere.md :3).
                SettingsRoute(
                    versionName = BuildConfig.VERSION_NAME,
                    notice = notice,
                    onNoticeShown = consumeNotice,
                    clearingInView = clearing,
                    onClearingShown = consumeClearing,
                    doors = SettingsDoors(
                        // The own profile — or ProfileApplicant — where the gear was.
                        onBack = { navController.navigateUp() },
                        onOpenBackup = { navController.navigate(SettingsBackup) },
                        onExportKey = { navController.navigate(KeyExport) },
                        onOpenKeyCeremony = { navController.navigate(KeyCeremony) },
                        onChangePassword = { navController.navigate(ChangePassword) },
                        onChangeHandle = { navController.navigate(ChangeHandle) },
                        onOpenEmail = { door ->
                            navController.navigate(
                                when (door) {
                                    EmailDoor.REQUEST -> ChangeEmail()
                                    EmailDoor.APPLICANT -> ChangeEmail(applicant = true)
                                    EmailDoor.CONFIRM -> ChangeEmailConfirm
                                },
                            )
                        },
                        onOpenAbout = { navController.navigate(About) },
                        onOpenWhatsNew = { navController.navigate(WhatsNew) },
                        onOpenDeletion = { door ->
                            navController.navigate(
                                when (door) {
                                    DeletionDoor.REQUEST -> DeleteAccount
                                    DeletionDoor.PENDING -> DeleteAccountPending
                                },
                            )
                        },
                    ),
                )
            }
            composable<DeleteAccount> {
                DeleteAccountRoute(
                    onBack = { navController.navigateUp() },
                    // The link is out: the mail screen, the request leaving the
                    // stack so Back reaches settings (DeleteAccountMail.md:27).
                    onMailed = { includeContent ->
                        navController.navigate(DeleteAccountMail(includeContent)) {
                            popUpTo<Settings> { inclusive = false }
                        }
                    },
                    // Neither verb answers from here: settings says why.
                    onLocked = { notice ->
                        navController.report(settingsNoticeKey, notice)
                        navController.popBackStack()
                    },
                )
            }
            composable<DeleteAccountMail> { entry ->
                DeleteAccountMailRoute(
                    includeContent = entry.toRoute<DeleteAccountMail>().includeContent,
                    onBack = { navController.navigateUp() },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<DeleteAccountPending> {
                DeleteAccountPendingRoute(
                    onBack = { navController.navigateUp() },
                    // Settings returns, the band gone, with the canceled snackbar.
                    onCanceled = { notice ->
                        navController.report(settingsNoticeKey, notice)
                        navController.popBackStack()
                    },
                )
            }
            composable<DeleteAccountConfirmed>(
                deepLinks = listOf(
                    // The link the deletion mails (auth.md "Link URLs"), on the
                    // same host rules as /join.
                    navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$DELETE_ACCOUNT_PATH?token={token}" },
                ),
            ) { entry ->
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
            composable<SettingsBackup> {
                BackupRoute(
                    onBack = { navController.navigateUp() },
                    onExportKey = { navController.navigate(KeyExport) },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<ChangePassword> {
                ChangePasswordRoute(
                    onBack = { navController.navigateUp() },
                    onDone = { notice ->
                        navController.report(settingsNoticeKey, notice)
                        navController.popBackStack()
                    },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<ChangeHandle> {
                ChangeHandleRoute(
                    onBack = { navController.navigateUp() },
                    onDone = { notice ->
                        // The profile two entries down re-reads the handle;
                        // settings says it.
                        navController.reportTo<Profile, _>(handleChangedKey, true)
                        navController.report(settingsNoticeKey, notice)
                        navController.popBackStack()
                    },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<ChangeEmail> { entry ->
                val applicant = entry.toRoute<ChangeEmail>().applicant
                ChangeEmailRoute(
                    applicant = applicant,
                    // G1 (ruled): opened from Settings, back and success return there.
                    onBack = { navController.navigateUp() },
                    onRequested = { notice ->
                        if (applicant) {
                            navController.report(settingsNoticeKey, notice)
                            navController.popBackStack()
                        } else {
                            // Both mails are out: the confirmation, the request
                            // leaving the stack so Back reaches settings.
                            navController.navigate(ChangeEmailConfirm) {
                                popUpTo<Settings> { inclusive = false }
                            }
                        }
                    },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<ChangeEmailConfirm> {
                ChangeEmailConfirmRoute(
                    onBack = { navController.navigateUp() },
                    onExit = { notice ->
                        val back = navController.popBackStack<Settings>(inclusive = false)
                        if (!back) navController.navigate(Settings)
                        notice?.let { navController.reportToCurrent(settingsNoticeKey, it) }
                    },
                    deletionBand = deletionBand(node = null),
                )
            }
            composable<ChangeEmailLinked>(
                deepLinks = listOf(
                    // The link the change mails to the new address (auth.md
                    // "Link URLs"; EC delta 8), on the same host rules as /join.
                    navDeepLink { uriPattern = "${BuildConfig.WEB_ORIGIN}$EMAIL_CHANGE_PATH?token={token}" },
                ),
            ) { entry ->
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
                            heldEmailLink = if (holdsLink) token else null
                            // Back to the signed-out root, never a second sign-in on top of it.
                            navController.popBackStack()
                            if (navController.currentBackStackEntry?.destination?.hasRoute(Login::class) != true) {
                                navController.navigate(Login)
                            }
                        },
                    )
                }
            }
            composable<About> {
                AboutScreen(onBack = { navController.navigateUp() }, deletionBand = deletionBand(node = null))
            }
            composable<KeyExport> {
                // Arriving reveals nothing; the screen's own gate does.
                KeyExportRoute(onBack = { navController.navigateUp() }, deletionBand = deletionBand(node = null))
            }
            composable<WhatsNew> {
                // Back pops to Settings, which keeps its own scroll — the
                // About group the row stood in (WhatsNew.md:23).
                val context = LocalContext.current
                WhatsNewRoute(
                    onBack = { navController.navigateUp() },
                    onUpdateNow = { openStoreListing(context) },
                )
            }
            composable<ChatsComingSoon> {
                ChatsComingSoonRoute(onBack = { navController.navigateUp() })
            }
        }
    }
}
