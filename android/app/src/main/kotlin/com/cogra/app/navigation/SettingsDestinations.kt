// Settings and the pages behind its rows: credentials, the email change,
// the backup and the key, About and What's new, and the account deletion.
// Task flows all — each carries its back arrow and no bar.

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.feature.settings.AboutScreen
import com.cogra.feature.settings.BackupRoute
import com.cogra.feature.settings.ChangeEmailConfirmRoute
import com.cogra.feature.settings.ChangeEmailRoute
import com.cogra.feature.settings.ChangeHandleRoute
import com.cogra.feature.settings.ChangePasswordRoute
import com.cogra.feature.settings.DeleteAccountMailRoute
import com.cogra.feature.settings.DeleteAccountPendingRoute
import com.cogra.feature.settings.DeleteAccountRoute
import com.cogra.feature.settings.DeletionDoor
import com.cogra.feature.settings.EmailDoor
import com.cogra.feature.settings.KeyExportRoute
import com.cogra.feature.settings.SettingsDoors
import com.cogra.feature.settings.SettingsRoute
import com.cogra.feature.settings.WhatsNewRoute

/** Settings and its pages: the gear's whole subtree. */
internal fun NavGraphBuilder.settingsFlows(shell: ShellScope) {
    composable<Settings> { entry -> shell.SettingsDestination(entry) }
    settingsPages(shell)
    credentialChanges(shell)
    accountDeletion(shell)
}

/** The pages that only read or reveal: About, What's new, the key, the backup. */
private fun NavGraphBuilder.settingsPages(shell: ShellScope) = with(shell) {
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
    composable<SettingsBackup> {
        BackupRoute(
            onBack = { navController.navigateUp() },
            onExportKey = { navController.navigate(KeyExport) },
            deletionBand = deletionBand(node = null),
        )
    }
}

/** The credential changes: password, handle, email. */
private fun NavGraphBuilder.credentialChanges(shell: ShellScope) = with(shell) {
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
    composable<ChangeEmail> { entry -> ChangeEmailDestination(entry) }
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
}

/** The account deletion's request, its mail and its grace page. */
private fun NavGraphBuilder.accountDeletion(shell: ShellScope) = with(shell) {
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
}

@Composable
private fun ShellScope.SettingsDestination(entry: NavBackStackEntry) {
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

@Composable
private fun ShellScope.ChangeEmailDestination(entry: NavBackStackEntry) {
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
