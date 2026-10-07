// The settings surface's account vocabulary (settings-surface packet
// §6.1): the one read every row stands on, the account's preferences,
// and the email change's two-sided lifecycle (auth.md "Email change").
// Mapped from the generated operations by core:network.

package com.cogra.domain.settings

import com.cogra.domain.AccountState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import java.time.Instant

/**
 * An email change in flight: which of its two sides have landed.
 * [requiresCode] is false on the unverified carve-out, where the new
 * address's link is the whole proof.
 */
data class PendingEmailChange(
    val newEmail: String,
    val requiresCode: Boolean,
    val codeConfirmed: Boolean,
    val linkConfirmed: Boolean,
    val expiresAt: Instant,
) {
    /** The code side is still owed. */
    val codeOwed: Boolean get() = requiresCode && !codeConfirmed

    /** The link side is still owed. */
    val linkOwed: Boolean get() = !linkConfirmed
}

/**
 * Where the account's address stands after a confirm or a cancel: the
 * address it has, and the change still in flight — null once the change
 * applied, was called off, or ran out.
 */
data class AccountEmail(
    val email: String?,
    val pending: PendingEmailChange?,
)

/** Everything the Settings page reads, in one viewer read. */
data class SettingsAccount(
    val id: String,
    val handle: String,
    val email: String?,
    val emailVerified: Boolean,
    val accountState: AccountState,
    /** Null in the pre-attach window: no actor key is bound yet. */
    val actorPubkey: String?,
    val passwordChangedAt: Instant?,
    /** When the stored recovery-code backup was made; null when none. */
    val keyBackupCreatedAt: Instant?,
    val pendingEmailChange: PendingEmailChange?,
    /** Null reads as public domain (api-spec.md `UserPreferences`). */
    val defaultLicense: LicenseChoice?,
    val sessions: List<SessionInfo>,
)

/** Where a new-address link's change stands, read without a session. */
enum class EmailChangeLinkState {
    PENDING,
    APPLIED,
    CANCELED,
    EXPIRED,

    /** A state this build cannot name — read as a dead link. */
    UNKNOWN,
}

/** The anonymous view of a new-address link (`emailChangeLinkCheck`). */
data class EmailChangeLinkCheck(
    val newEmail: String,
    val state: EmailChangeLinkState,
)

/**
 * The settings surface's account calls. Every read and verb is the
 * viewer's own; [emailChangeLinkCheck] is the one anonymous read, for a
 * device with no session holding a new-address link.
 */
interface SettingsRepository {
    /** Null when the session is gone. */
    suspend fun settingsAccount(): Outcome<SettingsAccount?>

    /** The license a new post starts from; null reads as public domain. */
    suspend fun defaultLicense(): Outcome<LicenseChoice?>

    /** Saves the default license; null restores public domain. Returns the saved value. */
    suspend fun setDefaultLicense(license: LicenseChoice?): Outcome<LicenseChoice?>

    suspend fun requestEmailChange(newEmail: String, currentPassword: String): Outcome<PendingEmailChange>

    /** Either side's proof: the current address's code or the new address's link token. */
    suspend fun confirmEmailChange(code: String): Outcome<AccountEmail>

    /** Re-mails the owed sides only; NOT_FOUND once nothing is pending. */
    suspend fun resendEmailChange(): Outcome<PendingEmailChange>

    suspend fun cancelEmailChange(): Outcome<AccountEmail>

    /** Null for any token that names no change. */
    suspend fun emailChangeLinkCheck(token: String): Outcome<EmailChangeLinkCheck?>
}
