package com.cogra.feature.settings

import com.cogra.domain.AccountState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.settings.AccountEmail
import com.cogra.domain.settings.EmailChangeLinkCheck
import com.cogra.domain.settings.PendingEmailChange
import com.cogra.domain.settings.SettingsAccount
import com.cogra.domain.testing.ThrowingSessionRepository
import com.cogra.domain.testing.ThrowingSettingsRepository
import java.io.IOException
import java.time.Instant

internal val NOW: Instant = Instant.parse("2026-10-07T12:00:00Z")

internal fun pending(
    codeConfirmed: Boolean = false,
    linkConfirmed: Boolean = false,
    requiresCode: Boolean = true,
    expiresAt: Instant = NOW.plusSeconds(86_400),
) = PendingEmailChange("sol@ferreira.studio", requiresCode, codeConfirmed, linkConfirmed, expiresAt)

internal fun account(
    state: AccountState = AccountState.MEMBER,
    emailVerified: Boolean = true,
    actorPubkey: String? = "cGs=",
    keyBackupCreatedAt: Instant? = Instant.parse("2026-08-12T09:00:00Z"),
    pendingEmailChange: PendingEmailChange? = null,
    defaultLicense: LicenseChoice? = null,
    sessions: List<SessionInfo> = listOf(
        SessionInfo("s2", "Pixel 8", NOW.minusSeconds(3 * 86_400), NOW.minusSeconds(2 * 86_400), false),
        SessionInfo("s1", "Pixel 6", NOW.minusSeconds(86_400), null, true),
        SessionInfo("s3", null, NOW.minusSeconds(60 * 86_400), null, false),
    ),
) = SettingsAccount(
    id = "u1",
    handle = "sol",
    email = "sol@solferreira.art",
    emailVerified = emailVerified,
    accountState = state,
    actorPubkey = actorPubkey,
    passwordChangedAt = NOW.minusSeconds(21 * 86_400),
    keyBackupCreatedAt = keyBackupCreatedAt,
    pendingEmailChange = pendingEmailChange,
    defaultLicense = defaultLicense,
    sessions = sessions,
)

/** The settings calls, scriptable per test. */
internal class ScriptedSettings : ThrowingSettingsRepository() {
    var read: Outcome<SettingsAccount?> = Outcome.Success(account())
    var saveLicense: Outcome<LicenseChoice?>? = null
    val savedLicenses = mutableListOf<LicenseChoice?>()
    var request: Outcome<PendingEmailChange> = Outcome.Success(pending())
    var confirm: Outcome<AccountEmail> =
        Outcome.Success(AccountEmail("sol@solferreira.art", pending(codeConfirmed = true)))
    var resend: Outcome<PendingEmailChange> = Outcome.Success(pending())
    var resends = 0
    var cancel: Outcome<AccountEmail> = Outcome.Success(AccountEmail("sol@solferreira.art", null))
    var check: Outcome<EmailChangeLinkCheck?> = Outcome.Success(null)
    var checks = 0
    val confirmed = mutableListOf<String>()

    override suspend fun settingsAccount(): Outcome<SettingsAccount?> = read

    override suspend fun setDefaultLicense(license: LicenseChoice?): Outcome<LicenseChoice?> {
        savedLicenses += license
        return saveLicense ?: Outcome.Success(license)
    }

    override suspend fun requestEmailChange(newEmail: String, currentPassword: String) = request

    override suspend fun confirmEmailChange(code: String): Outcome<AccountEmail> {
        confirmed += code
        return confirm
    }

    override suspend fun resendEmailChange(): Outcome<PendingEmailChange> {
        resends++
        return resend
    }

    override suspend fun cancelEmailChange(): Outcome<AccountEmail> = cancel

    override suspend fun emailChangeLinkCheck(token: String): Outcome<EmailChangeLinkCheck?> {
        checks++
        return check
    }
}

/** Sessions that revoke on request, or answer nothing at all. */
internal class ScriptedSessions : ThrowingSessionRepository() {
    var offline = false
    val revoked = mutableListOf<String?>()
    var othersRevoked = 0

    override suspend fun revokeSession(id: String?): Outcome<Unit> {
        if (offline) return Outcome.Failed(IOException("offline"))
        revoked += id
        return Outcome.Success(Unit)
    }

    override suspend fun revokeOtherSessions(): Outcome<Int> {
        if (offline) return Outcome.Failed(IOException("offline"))
        othersRevoked++
        return Outcome.Success(2)
    }
}
