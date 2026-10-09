// Settings, rebuilt to rows (the settings round; `Settings.jsx`,
// `SettingsBody` in `_shared.jsx`, `Settings.md`): one scrolling page of
// groups in the ruled order under a pinned header, every node wearing its
// registered `settings.*` path.

package com.cogra.feature.settings

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
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.SegmentedFilter
import com.cogra.core.designsystem.v2.atom.SegmentedOption
import com.cogra.core.designsystem.v2.atom.SettingsGroup
import com.cogra.core.designsystem.v2.atom.SettingsRow
import com.cogra.core.designsystem.v2.atom.SettingsRowKind
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.compose.licenseName
import com.cogra.domain.AccountState
import com.cogra.domain.ageLadder
import com.cogra.domain.dateLine
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.store.ThemeChoice
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
    /** The reader's own mail, addressed to the contact address — never the report. */
    val onContact: () -> Unit = {},
)

@Composable
fun SettingsRoute(
    versionName: String,
    doors: SettingsDoors,
    /** A subpage's answer to say over the page once ("Password changed — …"). */
    notice: String? = null,
    onNoticeShown: () -> Unit = {},
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
        events = viewModel.events,
        notice = notice,
        onNoticeShown = onNoticeShown,
        actions = SettingsActions(
            onTheme = viewModel::onTheme,
            onStanceInputMode = viewModel::onStanceInputMode,
            onConfirmMultiActionSubmits = viewModel::onConfirmMultiActionSubmits,
            onOpenLicense = viewModel::onOpenLicense,
            onStageLicense = viewModel::onStageLicense,
            onLicenseDone = viewModel::onLicenseDone,
            onDismissLicense = viewModel::onDismissLicense,
            onRetryLicense = viewModel::onRetryLicense,
            onShowExactValues = viewModel::onShowExactValues,
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
    val onShowExactValues: () -> Unit = {},
    val onRevokeSession: (String) -> Unit = {},
    val onRevokeOthers: () -> Unit = {},
    val onForgetOnSignOut: () -> Unit = {},
    val onSignOut: () -> Unit = {},
    val onEraseAndSignOut: () -> Unit = {},
    val onDismissSignOutConfirm: () -> Unit = {},
    val onMakeRecoveryCode: () -> Unit = {},
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
) {
    val snackbar = remember { SnackbarHostState() }
    // Plain, not snapshot state: the requesters are handles, never read to draw.
    val sessionFocus = remember { HashMap<String, FocusRequester>() }
    val signOutFocus = remember { FocusRequester() }
    val licenseFocus = remember { FocusRequester() }
    SettingsEffects(events, snackbar, sessionFocus, signOutFocus, notice, onNoticeShown)

    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        // The header is pinned: it stands outside the scrolling body.
        topBar = {
            PageHeader(
                title = stringResource(R.string.settings_title),
                onBack = doors.onBack,
                backContentDescription = stringResource(R.string.settings_back),
                node = Page / "header",
            )
        },
        snackbarHost = { CograSnackbarHost(snackbar, testTag = "settings_snackbar") },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            ThemeGroup(state, actions)
            StanceGroup(state, actions)
            WritingGroup(state, actions, licenseFocus)
            ReadingGroup(state, actions)
            PeopleGroup()
            BackupGroup(state, doors)
            SessionsGroup(state, actions, sessionFocus)
            CredentialsGroup(state, doors)
            AboutGroup(versionName, doors)
            LeavingGroup(state, actions, signOutFocus)
            EndingGroup(state)
        }
    }

    if (state.signOutConfirmOpen) {
        SignOutConfirm(
            onMakeRecoveryCode = actions.onMakeRecoveryCode,
            onErase = actions.onEraseAndSignOut,
            onDismiss = actions.onDismissSignOutConfirm,
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

/** The page's one-shots: snackbars, focus after a revoke or a closed dialog, and a subpage's notice. */
@Composable
private fun SettingsEffects(
    events: kotlinx.coroutines.flow.Flow<SettingsEvent>,
    snackbar: SnackbarHostState,
    sessionFocus: Map<String, FocusRequester>,
    signOutFocus: FocusRequester,
    notice: String?,
    onNoticeShown: () -> Unit,
) {
    val context = LocalContext.current
    LaunchedEffect(events) {
        events.collect { event ->
            when (event) {
                is SettingsEvent.Snackbar -> {
                    val arg = event.arg ?: event.argRes?.let { context.getString(it) }
                    val text = if (arg == null) context.getString(event.text) else context.getString(event.text, arg)
                    // Shown on its own job, so the focus move that follows a
                    // revoke never waits for the snackbar to go.
                    launch { snackbar.showSnackbar(text) }
                }
                is SettingsEvent.FocusSession -> runCatching { sessionFocus[event.id]?.requestFocus() }
                SettingsEvent.FocusSignOut -> runCatching { signOutFocus.requestFocus() }
            }
        }
    }
    // A subpage's answer, said once, then consumed.
    LaunchedEffect(notice) {
        if (notice != null) {
            onNoticeShown()
            snackbar.showSnackbar(notice)
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
private fun ReadingGroup(state: SettingsUiState, actions: SettingsActions) {
    val group = Page / "reading"
    SettingsGroup(
        label = stringResource(R.string.settings_reading),
        footnote = stringResource(R.string.settings_reading_footnote),
        node = group,
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.settings_reading_feed),
                    value = stringResource(R.string.settings_reading_feed_value),
                    kind = SettingsRowKind.Opens,
                    // DRIFT (feed-filter packet): SettingsReading's sheet
                    // waits for a feed filter to own the reader's default.
                    // The feed shows posts only, so the row reads true and
                    // the tap opens nothing yet.
                    onClick = {},
                    node = group / "feed",
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
private fun PeopleGroup() {
    val group = Page / "people"
    SettingsGroup(
        label = stringResource(R.string.settings_people),
        footnote = stringResource(R.string.settings_people_footnote),
        node = group,
        rows = listOf(
            {
                // DRIFT (hide-and-unhide packet): nothing can be hidden yet,
                // so the count is always nobody — inert at `None`, which is
                // the drawn state for that count (Settings.md :37-39).
                SettingsRow(
                    label = stringResource(R.string.settings_people_hidden),
                    value = stringResource(R.string.settings_people_hidden_none),
                    kind = SettingsRowKind.Inert,
                    node = group / "hidden",
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
            // DRIFT (the what's-new packet): the release chronicle is not built.
            row(R.string.settings_about_whats_new, "whatsNew", value = versionName) {},
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
 * navigating row with a chevron (`SettingsBody`'s `ending`). The footnote is
 * the applicant's when the reader is one (Settings.md :139-141).
 */
@Composable
private fun EndingGroup(state: SettingsUiState) {
    val group = Page / "ending"
    val applicant = state.account?.accountState == AccountState.APPLICANT
    SettingsGroup(
        ariaLabel = stringResource(R.string.settings_ending),
        footnote = stringResource(
            if (applicant) R.string.settings_ending_footnote_applicant else R.string.settings_ending_footnote_member,
        ),
        node = group,
        rows = listOf(
            {
                // DRIFT (the erasure-deletion packet): the deletion's request
                // screen (DeleteAccount), its grace status and the applicant's
                // locked look are not built, so the row opens nothing yet.
                SettingsRow(
                    label = stringResource(R.string.settings_ending_delete),
                    kind = SettingsRowKind.Opens,
                    onClick = {},
                    node = group / "delete",
                )
            },
        ),
    )
}
