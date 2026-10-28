// Settings, rebuilt to rows (the settings round; `Settings.jsx`,
// `SettingsBody` in `_shared.jsx`, `Settings.md`): one scrolling page of
// groups in the ruled order under a pinned header, every node wearing its
// registered `settings.*` path.

package com.cogra.feature.settings

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.DeletionBand
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.SegmentedFilter
import com.cogra.core.designsystem.v2.atom.SegmentedOption
import com.cogra.core.designsystem.v2.atom.SettingsGroup
import com.cogra.core.designsystem.v2.atom.SettingsRow
import com.cogra.core.designsystem.v2.atom.SettingsRowKind
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.compose.licenseName
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.ageLadder
import com.cogra.domain.dateLine
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.feedFilterSummary
import com.cogra.domain.forwardLadder
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.store.ThemeChoice
import com.cogra.feature.feedfilter.FeedFilterSheet
import kotlinx.coroutines.launch

/** The page's registered root (`nodes.json` "Settings", prefix `settings`). */
private val Page = DataNode("settings")

/** Where the page's own callbacks lead; the NavHost owns every one. */
data class SettingsDoors(
    val onBack: () -> Unit = {},
    /** The interim backup route (DRIFT: the SettingsBackup* boards are the backup-replacement packet's). */
    val onOpenBackup: () -> Unit = {},
    val onExportKey: () -> Unit = {},
    val onOpenKeyCeremony: () -> Unit = {},
    val onChangePassword: () -> Unit = {},
    val onChangeHandle: () -> Unit = {},
    val onOpenEmail: (EmailDoor) -> Unit = {},
    val onOpenAbout: () -> Unit = {},
    /** The release chronicle (WhatsNew.md). */
    val onOpenWhatsNew: () -> Unit = {},
    /** The reader's own mail, addressed to the contact address — never the report. */
    val onContact: () -> Unit = {},
    /** The Delete account row's two doors: the request screen, or the grace page. */
    val onOpenDeletion: (DeletionDoor) -> Unit = {},
)

@Composable
fun SettingsRoute(
    versionName: String,
    doors: SettingsDoors,
    /** A subpage's answer to say over the page once ("Password changed — …"). */
    notice: String? = null,
    onNoticeShown: () -> Unit = {},
    /** Opened by the system's "Manage space": Clearing data in view, nothing cleared. */
    clearingInView: Boolean = false,
    onClearingShown: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // Every arrival re-reads, so a subpage's change reads on return.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    val uriHandler = LocalUriHandler.current
    val contact = stringResource(R.string.settings_about_contact_address)
    SettingsScreen(
        state = state,
        versionName = versionName,
        hidden = com.cogra.feature.saved.rememberHiddenSet(),
        events = viewModel.events,
        notice = notice,
        onNoticeShown = onNoticeShown,
        clearingInView = clearingInView,
        onClearingShown = onClearingShown,
        actions = SettingsActions(
            onTheme = viewModel::onTheme,
            onStanceInputMode = viewModel::onStanceInputMode,
            onConfirmMultiActionSubmits = viewModel::onConfirmMultiActionSubmits,
            onOpenLicense = viewModel::onOpenLicense,
            onStageLicense = viewModel::onStageLicense,
            onLicenseDone = viewModel::onLicenseDone,
            onDismissLicense = viewModel::onDismissLicense,
            onRetryLicense = viewModel::onRetryLicense,
            onOpenReading = viewModel::onOpenReading,
            onStageReading = viewModel::onStageReading,
            onResetReading = viewModel::onResetReading,
            onReadingDone = viewModel::onReadingDone,
            onDismissReading = viewModel::onDismissReading,
            onShowExactValues = viewModel::onShowExactValues,
            onAlwaysUnveil = viewModel::onAlwaysUnveil,
            onRevokeSession = viewModel::onRevokeSession,
            onRevokeOthers = viewModel::onRevokeOthers,
            onForgetOnSignOut = viewModel::onForgetOnSignOut,
            onSignOut = viewModel::onSignOut,
            onEraseAndSignOut = viewModel::onEraseAndSignOut,
            onDismissSignOutConfirm = viewModel::onDismissSignOutConfirm,
            onMakeRecoveryCode = {
                viewModel.onMakeRecoveryCode()
                doors.onOpenBackup()
            },
            onErase = viewModel::onErase,
            onEraseEverything = viewModel::onEraseEverything,
            onDismissEraseConfirm = viewModel::onDismissEraseConfirm,
            onMakeRecoveryCodeFromErase = {
                viewModel.onMakeRecoveryCodeFromErase()
                doors.onOpenBackup()
            },
            onDeleteAccount = viewModel::onDeleteAccount,
            onCancelDeletion = viewModel::onCancelDeletion,
        ),
        doors = doors.copy(
            onContact = {
                doors.onContact()
                // mailto: is the documented way to open the reader's own mail
                // addressed (RFC 6068; ACTION_SENDTO under the handler).
                runCatching { uriHandler.openUri("mailto:$contact") }
            },
        ),
    )
}

/** The page's own acts, wired to the ViewModel by the route. */
data class SettingsActions(
    val onTheme: (ThemeChoice) -> Unit = {},
    val onStanceInputMode: (StanceInputMode) -> Unit = {},
    val onConfirmMultiActionSubmits: () -> Unit = {},
    val onOpenLicense: () -> Unit = {},
    val onStageLicense: (com.cogra.domain.LicenseChoice) -> Unit = {},
    val onLicenseDone: () -> Unit = {},
    val onDismissLicense: () -> Unit = {},
    val onRetryLicense: () -> Unit = {},
    /** What your feed shows (SettingsReading.md): the row opens the feed's own sheet over Settings. */
    val onOpenReading: () -> Unit = {},
    val onStageReading: (FeedFilter) -> Unit = {},
    val onResetReading: () -> Unit = {},
    val onReadingDone: () -> Unit = {},
    val onDismissReading: () -> Unit = {},
    val onShowExactValues: () -> Unit = {},
    val onAlwaysUnveil: () -> Unit = {},
    val onRevokeSession: (String) -> Unit = {},
    val onRevokeOthers: () -> Unit = {},
    val onForgetOnSignOut: () -> Unit = {},
    val onSignOut: () -> Unit = {},
    val onEraseAndSignOut: () -> Unit = {},
    val onDismissSignOutConfirm: () -> Unit = {},
    val onMakeRecoveryCode: () -> Unit = {},
    /** The Clearing data row: raises `EraseConfirm`, erases nothing. */
    val onErase: () -> Unit = {},
    val onEraseEverything: () -> Unit = {},
    val onDismissEraseConfirm: () -> Unit = {},
    val onMakeRecoveryCodeFromErase: () -> Unit = {},
    val onDeleteAccount: () -> Unit = {},
    /** The deletion band's Cancel, under the header. */
    val onCancelDeletion: () -> Unit = {},
)

@Composable
fun SettingsScreen(
    state: SettingsUiState,
    versionName: String,
    actions: SettingsActions,
    doors: SettingsDoors,
    events: kotlinx.coroutines.flow.Flow<SettingsEvent> = kotlinx.coroutines.flow.emptyFlow(),
    notice: String? = null,
    onNoticeShown: () -> Unit = {},
    clearingInView: Boolean = false,
    onClearingShown: () -> Unit = {},
    /** The reader's hidden set: the People row's count and the Hidden accounts sheet. */
    hidden: HiddenSet? = null,
) {
    val snackbar = remember { SnackbarHostState() }
    val hiddenAccounts = rememberHiddenAccounts(hidden, snackbar)
    // Plain, not snapshot state: the requesters are handles, never read to draw.
    val sessionFocus = remember { HashMap<String, FocusRequester>() }
    val signOutFocus = remember { FocusRequester() }
    val eraseFocus = remember { FocusRequester() }
    val licenseFocus = remember { FocusRequester() }
    val readingFocus = remember { FocusRequester() }
    SettingsEffects(
        events,
        snackbar,
        sessionFocus,
        signOutFocus,
        eraseFocus,
        notice,
        onNoticeShown,
        doors.onOpenDeletion,
    )

    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = { SettingsTop(state, actions, doors) },
        snackbarHost = { CograSnackbarHost(snackbar, testTag = "settings_snackbar") },
    ) { padding ->
        val scroll = rememberScrollState()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scroll)
                .padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            ThemeGroup(state, actions)
            StanceGroup(state, actions)
            WritingGroup(state, actions, licenseFocus)
            ReadingGroup(state, actions, readingFocus)
            PeopleGroup(hiddenAccounts)
            SensitiveGroup(state, actions)
            BackupGroup(state, doors)
            ClearingGroup(state, actions, eraseFocus, ClearingInView(clearingInView, scroll, onClearingShown))
            SessionsGroup(state, actions, sessionFocus)
            CredentialsGroup(state, doors)
            AboutGroup(versionName, doors)
            LeavingGroup(state, actions, signOutFocus)
            EndingGroup(state, actions)
        }
    }

    SettingsDialogs(state, actions)
    HiddenAccountsSheet(hiddenAccounts)
    // WHAT YOUR FEED SHOWS, over Settings (SettingsReading.md): the feed's own
    // sheet, titled; Done saves the default and the row reads it back; every
    // way out returns focus to the row.
    state.readingSheet?.let { staged ->
        FeedFilterSheet(
            staged = staged,
            onStage = actions.onStageReading,
            onReset = actions.onResetReading,
            onDone = {
                actions.onReadingDone()
                runCatching { readingFocus.requestFocus() }
            },
            onDismiss = {
                actions.onDismissReading()
                runCatching { readingFocus.requestFocus() }
            },
            node = Page / "feedSheet",
            titled = true,
        )
    }
    state.licenseSheet?.let { staged ->
        SettingsLicenseSheet(
            staged = staged,
            onStage = actions.onStageLicense,
            onDone = {
                actions.onLicenseDone()
                runCatching { licenseFocus.requestFocus() }
            },
            onDismiss = actions.onDismissLicense,
        )
    }
}

/** The two think-twice dialogs over the page: the sign-out ask and the erase (`SettingsOverlays.kt`). */
@Composable
private fun SettingsDialogs(state: SettingsUiState, actions: SettingsActions) {
    if (state.signOutConfirmOpen) {
        SignOutConfirm(
            onMakeRecoveryCode = actions.onMakeRecoveryCode,
            onErase = actions.onEraseAndSignOut,
            onDismiss = actions.onDismissSignOutConfirm,
        )
    }
    if (state.eraseConfirmOpen) {
        EraseConfirm(
            backupMade = state.backupMade,
            onMakeRecoveryCode = actions.onMakeRecoveryCodeFromErase,
            onErase = actions.onEraseEverything,
            onDismiss = actions.onDismissEraseConfirm,
        )
    }
}

/**
 * The header is pinned: it stands outside the scrolling body — and so does
 * the deletion band directly under it (SettingsDeleting.md:3), which no
 * surface may scroll away.
 */
@Composable
private fun SettingsTop(state: SettingsUiState, actions: SettingsActions, doors: SettingsDoors) {
    Column {
        PageHeader(
            title = stringResource(R.string.settings_title),
            onBack = doors.onBack,
            backContentDescription = stringResource(R.string.settings_back),
            node = Page / "header",
        )
        state.graceDeletion?.let { deletion ->
            DeletionBand(
                count = forwardLadder(deletion.scheduledFor, state.now).words(),
                content = deletion.includesContent,
                onCancel = actions.onCancelDeletion,
                node = Page / "deletionBand",
            )
        }
    }
}

/** The page's one-shots: snackbars, focus after a revoke or a closed dialog, and a subpage's notice. */
@Composable
private fun SettingsEffects(
    events: kotlinx.coroutines.flow.Flow<SettingsEvent>,
    snackbar: SnackbarHostState,
    sessionFocus: Map<String, FocusRequester>,
    signOutFocus: FocusRequester,
    eraseFocus: FocusRequester,
    notice: String?,
    onNoticeShown: () -> Unit,
    onOpenDeletion: (DeletionDoor) -> Unit,
) {
    val context = LocalContext.current
    val openDeletion by rememberUpdatedState(onOpenDeletion)
    LaunchedEffect(events) {
        events.collect { event ->
            when (event) {
                is SettingsEvent.OpenDeletion -> openDeletion(event.door)
                is SettingsEvent.Snackbar -> {
                    val arg = event.arg ?: event.argRes?.let { context.getString(it) }
                    val text = if (arg == null) context.getString(event.text) else context.getString(event.text, arg)
                    // Shown on its own job, so the focus move that follows a
                    // revoke never waits for the snackbar to go.
                    launch { snackbar.showSnackbar(text) }
                }
                is SettingsEvent.FocusSession -> runCatching { sessionFocus[event.id]?.requestFocus() }
                SettingsEvent.FocusSignOut -> runCatching { signOutFocus.requestFocus() }
                SettingsEvent.FocusErase -> runCatching { eraseFocus.requestFocus() }
            }
        }
    }
    // A subpage's answer, said once, then consumed. The snackbar runs on a
    // scope of its own: consuming flips the notice to null, which restarts
    // this effect — had the snackbar lived here, that restart would cancel it
    // the frame it appeared.
    val noticeScope = rememberCoroutineScope()
    LaunchedEffect(notice) {
        if (notice != null) {
            onNoticeShown()
            noticeScope.launch { snackbar.showSnackbar(notice) }
        }
    }
}

@Composable
private fun ThemeGroup(state: SettingsUiState, actions: SettingsActions) {
    val group = Page / "theme"
    SettingsGroup(
        label = stringResource(R.string.settings_theme),
        footnote = stringResource(R.string.settings_theme_footnote),
        bare = true,
        node = group,
        rows = listOf(
            {
                val light = stringResource(R.string.settings_theme_light)
                val dark = stringResource(R.string.settings_theme_dark)
                val auto = stringResource(R.string.settings_theme_auto)
                SegmentedFilter(
                    options = listOf(
                        SegmentedOption(ThemeChoice.LIGHT, light, "lightOption"),
                        SegmentedOption(ThemeChoice.DARK, dark, "darkOption"),
                        SegmentedOption(ThemeChoice.AUTO, auto, "autoOption"),
                    ),
                    selected = state.theme,
                    onSelect = actions.onTheme,
                    block = true,
                    ariaLabel = stringResource(R.string.settings_theme),
                    node = group / "picker",
                )
            },
        ),
    )
}

@Composable
private fun StanceGroup(state: SettingsUiState, actions: SettingsActions) {
    val group = Page / "stance"

    @Composable
    fun choice(mode: StanceInputMode, label: Int, status: Int, name: String): @Composable () -> Unit = {
        SettingsRow(
            label = stringResource(label),
            status = stringResource(status),
            kind = SettingsRowKind.Choice(selected = state.stanceInputMode == mode),
            onClick = { actions.onStanceInputMode(mode) },
            node = group / name,
        )
    }
    SettingsGroup(
        label = stringResource(R.string.settings_stance),
        footnote = stringResource(R.string.settings_stance_footnote),
        node = group,
        rows = listOf(
            choice(StanceInputMode.PAD, R.string.settings_stance_pad, R.string.settings_stance_pad_status, "pad"),
            choice(
                StanceInputMode.SLIDERS,
                R.string.settings_stance_sliders,
                R.string.settings_stance_sliders_status,
                "sliders",
            ),
            choice(
                StanceInputMode.ENTRY,
                R.string.settings_stance_typed,
                R.string.settings_stance_typed_status,
                "typed",
            ),
        ),
    )
}

@Composable
private fun WritingGroup(state: SettingsUiState, actions: SettingsActions, licenseFocus: FocusRequester) {
    val group = Page / "writing"
    val failed = state.licenseFailed != null
    SettingsGroup(
        label = stringResource(R.string.settings_writing),
        footnote = stringResource(R.string.settings_writing_footnote),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_writing_confirm),
                    status = stringResource(R.string.settings_writing_confirm_status),
                    kind = SettingsRowKind.Switch(checked = state.confirmMultiActionSubmits),
                    onClick = actions.onConfirmMultiActionSubmits,
                    node = group / "confirm",
                )
            },
            {
                val license = state.defaultLicense
                SettingsRow(
                    label = stringResource(R.string.settings_writing_license),
                    // A save that did not go through reverts, and the row says
                    // so with Retry — the hold's row vehicle (copy-voice
                    // "A read-side comfort that fails").
                    status = if (failed) stringResource(R.string.settings_save_failed) else null,
                    value = licenseName(license.attribution, license.provenance),
                    kind = SettingsRowKind.Opens,
                    onClick = actions.onOpenLicense,
                    trailing = if (failed) {
                        {
                            InlineAction(
                                text = stringResource(R.string.retry),
                                onClick = actions.onRetryLicense,
                                testTag = "settings_license_retry",
                            )
                        }
                    } else {
                        null
                    },
                    node = group / "license",
                    modifier = Modifier.focusRequester(licenseFocus),
                )
            },
        ),
    )
}

@Composable
private fun ReadingGroup(state: SettingsUiState, actions: SettingsActions, readingFocus: FocusRequester) {
    val group = Page / "reading"
    SettingsGroup(
        label = stringResource(R.string.settings_reading),
        footnote = stringResource(R.string.settings_reading_footnote),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_reading_feed),
                    // THE ROW IS THE TRIGGER (SettingsReading.jsx): it reads the
                    // saved default back in the pill's own words, against CoGra's.
                    value = feedFilterSummary(state.readerDefault, FeedFilter.DEFAULT),
                    kind = SettingsRowKind.Opens,
                    onClick = actions.onOpenReading,
                    node = group / "feed",
                    modifier = Modifier.focusRequester(readingFocus),
                )
            },
            {
                SettingsRow(
                    label = stringResource(R.string.settings_reading_exact),
                    status = stringResource(R.string.settings_reading_exact_status),
                    kind = SettingsRowKind.Switch(checked = state.showExactValues),
                    onClick = actions.onShowExactValues,
                    node = group / "exact",
                )
            },
        ),
    )
}

@Composable
private fun PeopleGroup(hidden: HiddenAccounts) {
    val group = Page / "people"
    val count = hidden.view.count
    SettingsGroup(
        label = stringResource(R.string.settings_people),
        footnote = stringResource(R.string.settings_people_footnote),
        node = group,
        rows = listOf(
            {
                // THE COUNT IS THE HIDDEN SET'S (hidden-actors §5.1). With
                // nobody hidden the row is inert and reads `None` — a tap that
                // could only open an empty sheet is a tap spent on nothing
                // (Settings.md :37-39). An Undo of an unhide that did not go
                // through after the sheet closed is said here, with Retry
                // (SettingsHidden.md:33).
                SettingsRow(
                    label = stringResource(R.string.settings_people_hidden),
                    status = if (hidden.rowFailed) stringResource(R.string.settings_save_failed) else null,
                    value = if (count == 0) {
                        stringResource(R.string.settings_people_hidden_none)
                    } else {
                        count.toString()
                    },
                    kind = if (count == 0) SettingsRowKind.Inert else SettingsRowKind.Opens,
                    onClick = hidden::show,
                    trailing = if (hidden.rowFailed) {
                        {
                            InlineAction(
                                text = stringResource(R.string.retry),
                                onClick = hidden::retryRow,
                                testTag = "settings_hidden_retry",
                            )
                        }
                    } else {
                        null
                    },
                    node = group / "hidden",
                    modifier = Modifier.focusRequester(hidden.rowFocus),
                )
            },
        ),
    )
}

/**
 * THE VEIL IS THE ACCOUNT'S CHOICE, NOT THIS PHONE'S (#141): a group of its
 * own, because Reading's footnote promises "this device" and this does not.
 * One switch, off by default, never a sheet — live in the app, since Play
 * has no web-only rule.
 */
@Composable
private fun SensitiveGroup(state: SettingsUiState, actions: SettingsActions) {
    val group = Page / "sensitive"
    SettingsGroup(
        label = stringResource(R.string.settings_sensitive),
        footnote = stringResource(R.string.settings_sensitive_footnote),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_sensitive_unveil),
                    status = stringResource(
                        if (state.alwaysUnveil) {
                            R.string.settings_sensitive_unveil_on
                        } else {
                            R.string.settings_sensitive_unveil_off
                        },
                    ),
                    kind = SettingsRowKind.Switch(checked = state.alwaysUnveil),
                    onClick = actions.onAlwaysUnveil,
                    node = group / "unveil",
                )
            },
        ),
    )
}

@Composable
private fun BackupGroup(state: SettingsUiState, doors: SettingsDoors) {
    val group = Page / "backup"
    val notMade = stringResource(R.string.settings_backup_not_made)
    val made = state.account?.keyBackupCreatedAt
    val beforeCeremony = state.beforeKeyCeremony
    SettingsGroup(
        label = stringResource(R.string.settings_backup),
        footnote = stringResource(
            if (made != null) R.string.settings_backup_footnote_made else R.string.settings_backup_footnote_none,
        ),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_backup_recovery),
                    status = when {
                        beforeCeremony || made == null -> notMade
                        else -> stringResource(R.string.settings_backup_recovery_made, dateLine(made))
                    },
                    kind = SettingsRowKind.Opens,
                    onClick = if (beforeCeremony) doors.onOpenKeyCeremony else doors.onOpenBackup,
                    node = group / "recovery",
                )
            },
            {
                SettingsRow(
                    label = stringResource(R.string.settings_backup_key),
                    status = if (beforeCeremony) notMade else null,
                    kind = SettingsRowKind.Opens,
                    onClick = if (beforeCeremony) doors.onOpenKeyCeremony else doors.onExportKey,
                    node = group / "key",
                )
            },
            // No kept-picks row: kept picks are not built (Restore-and-kept-picks packet).
        ),
    )
}

/** The "Manage space" ask: whether the group is to be brought into view, and the page's scroll to do it with. */
private class ClearingInView(val asked: Boolean, val scroll: ScrollState, val onShown: () -> Unit)

/**
 * Clearing data (Settings.md :139-145), after Key backup because the loss
 * it warns of is the key's. The footnote opens on the key and says the
 * account is gone for good before anything else — with no recovery code the
 * sentence drops its condition — and the seen list's return comes last, a
 * copy of the server's. An unread backup state takes the no-code words: the
 * stronger warning is the safe one. The one row is quiet like Sign out, no
 * error colour; the weight lives in the dialog it raises.
 */
@Composable
private fun ClearingGroup(
    state: SettingsUiState,
    actions: SettingsActions,
    eraseFocus: FocusRequester,
    inView: ClearingInView,
) {
    val group = Page / "clearing"
    // The system's "Manage space" opens settings with this group in view: the
    // page jumps to where the group was placed — once, and without an
    // animation, so nothing keeps the page in motion behind the reader.
    var top by remember { mutableIntStateOf(-1) }
    LaunchedEffect(inView.asked, top) {
        if (inView.asked && top >= 0) {
            inView.scroll.scrollTo(top)
            inView.onShown()
        }
    }
    SettingsGroup(
        modifier = Modifier.onPlaced { top = it.positionInParent().y.toInt() },
        label = stringResource(R.string.settings_clearing),
        footnote = stringResource(
            when {
                state.backupMade -> R.string.settings_clearing_footnote_made
                else -> R.string.settings_clearing_footnote_none
            },
        ),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_clearing_erase),
                    kind = SettingsRowKind.Action,
                    onClick = actions.onErase,
                    node = group / "erase",
                    modifier = Modifier.focusRequester(eraseFocus),
                )
            },
        ),
    )
}

@Composable
private fun SessionsGroup(
    state: SettingsUiState,
    actions: SettingsActions,
    focus: MutableMap<String, FocusRequester>,
) {
    val group = Page / "sessions"
    val revokingLate = rememberParticiple(state.revokingSessionId != null)
    val rows = state.sessions.mapIndexed { index, session ->
        val row: @Composable () -> Unit = {
            val requester = focus.getOrPut(session.id) { FocusRequester() }
            val node = (group / "session").keyed((index + 1).toString())
            SettingsRow(
                label = session.deviceLabel ?: stringResource(R.string.settings_session_unnamed),
                status = if (session.isCurrent) {
                    stringResource(R.string.settings_session_this_phone)
                } else {
                    stringResource(
                        R.string.settings_session_last_used,
                        ageLadder(session.lastUsedAt ?: session.createdAt, state.now),
                    )
                },
                kind = SettingsRowKind.Inert,
                trailing = if (session.isCurrent) {
                    null
                } else {
                    {
                        val revoking = state.revokingSessionId == session.id
                        InlineAction(
                            text = stringResource(
                                if (revoking && revokingLate) {
                                    R.string.settings_session_revoking
                                } else {
                                    R.string.settings_session_revoke
                                },
                            ),
                            // In flight it refuses a second press and never dims.
                            onClick = { if (!revoking) actions.onRevokeSession(session.id) },
                            testTag = (group / "session" / "revoke").tag,
                        )
                    }
                },
                node = node,
                modifier = Modifier
                    .focusRequester(requester)
                    .focusable(),
            )
        }
        row
    }
    SettingsGroup(
        label = stringResource(R.string.settings_sessions),
        footnote = stringResource(R.string.settings_sessions_footnote),
        node = group,
        rows = rows + listOf<@Composable () -> Unit>(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_sessions_elsewhere),
                    kind = SettingsRowKind.Action,
                    onClick = actions.onRevokeOthers,
                    node = group / "elsewhere",
                )
            },
        ),
    )
}

@Composable
private fun CredentialsGroup(state: SettingsUiState, doors: SettingsDoors) {
    val group = Page / "credentials"
    val account = state.account
    SettingsGroup(
        label = stringResource(R.string.settings_credentials),
        footnote = stringResource(R.string.settings_credentials_footnote),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_credentials_password),
                    status = account?.passwordChangedAt?.let {
                        stringResource(R.string.settings_credentials_password_changed, ageLadder(it, state.now))
                    },
                    kind = SettingsRowKind.Opens,
                    onClick = doors.onChangePassword,
                    node = group / "password",
                )
            },
            {
                SettingsRow(
                    label = stringResource(R.string.settings_credentials_handle),
                    value = account?.handle?.let { stringResource(R.string.settings_credentials_handle_value, it) },
                    kind = SettingsRowKind.Opens,
                    onClick = doors.onChangeHandle,
                    node = group / "handle",
                )
            },
            {
                SettingsRow(
                    label = stringResource(R.string.settings_credentials_email),
                    // Always the address the account still has — never the new one.
                    value = account?.email,
                    status = if (state.pendingEmailChange != null) {
                        stringResource(R.string.settings_credentials_email_pending)
                    } else {
                        null
                    },
                    kind = SettingsRowKind.Opens,
                    onClick = { doors.onOpenEmail(state.emailDoor) },
                    node = group / "email",
                )
            },
        ),
    )
}

@Composable
private fun AboutGroup(versionName: String, doors: SettingsDoors) {
    val group = Page / "about"

    @Composable
    fun row(label: Int, name: String, value: String? = null, onClick: () -> Unit): @Composable () -> Unit = {
        SettingsRow(
            label = stringResource(label),
            value = value,
            kind = SettingsRowKind.Opens,
            onClick = onClick,
            node = group / name,
        )
    }
    SettingsGroup(
        label = stringResource(R.string.settings_about),
        node = group,
        rows = listOf(
            // DRIFT (the intro packet): the intro has no Android surface yet.
            row(R.string.settings_about_intro, "intro") {},
            row(R.string.settings_about_cogra, "aboutCogra", onClick = doors.onOpenAbout),
            row(R.string.settings_about_whats_new, "whatsNew", value = versionName, onClick = doors.onOpenWhatsNew),
            // DRIFT (the report-a-problem packet): the report is not built.
            row(R.string.settings_about_report, "report") {},
            row(
                R.string.settings_about_contact,
                "contact",
                value = stringResource(R.string.settings_about_contact_address),
                onClick = doors.onContact,
            ),
            // DRIFT (the legal documents): Privacy and Terms open written
            // documents nobody in this repo writes yet.
            row(R.string.settings_about_privacy, "privacy") {},
            row(R.string.settings_about_terms, "terms") {},
        ),
    )
}

@Composable
private fun LeavingGroup(state: SettingsUiState, actions: SettingsActions, signOutFocus: FocusRequester) {
    val group = Page / "leaving"
    val late = rememberParticiple(state.signingOut)
    SettingsGroup(
        ariaLabel = stringResource(R.string.settings_leaving),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_leaving_forget),
                    status = stringResource(R.string.settings_leaving_forget_status),
                    kind = SettingsRowKind.Switch(checked = state.forgetOnSignOut),
                    onClick = actions.onForgetOnSignOut,
                    node = group / "forget",
                )
            },
            {
                SettingsRow(
                    label = stringResource(
                        if (late) R.string.settings_leaving_signing_out else R.string.settings_leaving_leave,
                    ),
                    kind = SettingsRowKind.Action,
                    onClick = actions.onSignOut,
                    node = group / "leave",
                    modifier = Modifier.focusRequester(signOutFocus),
                )
            },
        ),
    )
}

/**
 * The page's last row, in a group of its own after leaving — drawn quiet, a
 * navigating row with a chevron (`SettingsBody`'s `ending`).
 *
 * EVERY STATE KEYS ON THE SERVER'S DELETION PATH (OS-15), never on the
 * application: the member's footnote where the mailed link answers
 * (BY_LINK), the applicant's where the delete is immediate (IMMEDIATE), and
 * the locked look — visibly inactive at the disabled opacity and still
 * tappable — where neither verb answers yet (LOCKED; Settings.md :38-40).
 * In the grace the row counts down to the deadline and the footnote goes,
 * since it describes a request not yet made (SettingsDeleting.md :5-9). No
 * footnote is drawn before the path is read: the two readings differ.
 */
@Composable
private fun EndingGroup(state: SettingsUiState, actions: SettingsActions) {
    val group = Page / "ending"
    val grace = state.graceDeletion
    val footnote = when {
        grace != null -> null
        state.deletion?.path == AccountDeletionPath.BY_LINK -> R.string.settings_ending_footnote_member
        state.deletion != null -> R.string.settings_ending_footnote_applicant
        else -> null
    }
    SettingsGroup(
        ariaLabel = stringResource(R.string.settings_ending),
        footnote = footnote?.let { stringResource(it) },
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_ending_delete),
                    status = grace?.let {
                        stringResource(
                            R.string.settings_ending_deleting,
                            forwardLadder(it.scheduledFor, state.now).words(),
                        )
                    },
                    kind = SettingsRowKind.Opens,
                    onClick = actions.onDeleteAccount,
                    node = group / "delete",
                    modifier = if (state.deletionLocked && grace == null) {
                        Modifier.alpha(DISABLED_ALPHA)
                    } else {
                        Modifier
                    },
                )
            },
        ),
    )
}

/** The locked look's opacity — Material's disabled content alpha, the system's `disabled opacity`. */
private const val DISABLED_ALPHA = 0.38f
