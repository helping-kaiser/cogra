// The settings surface over the generated client (settings-surface
// packet §6.1). The operation documents mirror the web's by name and
// selection — the two clients read one contract, and the operation
// budget guard prices both trees.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.AccountState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.settings.AccountEmail
import com.cogra.domain.settings.EmailChangeLinkCheck
import com.cogra.domain.settings.EmailChangeLinkState
import com.cogra.domain.settings.PendingEmailChange
import com.cogra.domain.settings.SettingsAccount
import com.cogra.domain.settings.SettingsRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.CancelEmailChangeMutation
import com.cogra.network.graphql.ConfirmEmailChangeMutation
import com.cogra.network.graphql.DefaultLicenseQuery
import com.cogra.network.graphql.EmailChangeLinkCheckQuery
import com.cogra.network.graphql.RequestEmailChangeMutation
import com.cogra.network.graphql.ResendEmailChangeMutation
import com.cogra.network.graphql.SetPreferencesMutation
import com.cogra.network.graphql.SettingsAccountQuery
import com.cogra.network.graphql.fragment.PendingEmailChangeFields
import com.cogra.network.graphql.type.ConfirmEmailChangeInput
import com.cogra.network.graphql.type.RequestEmailChangeInput
import com.cogra.network.graphql.type.SetPreferencesInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.toInput
import com.cogra.network.unauthenticatedRefusal
import javax.inject.Inject
import javax.inject.Singleton

internal fun PendingEmailChangeFields.toDomain(): PendingEmailChange = PendingEmailChange(
    newEmail = newEmail,
    requiresCode = requiresCode,
    codeConfirmed = codeConfirmed,
    linkConfirmed = linkConfirmed,
    expiresAt = expiresAt,
)

/** An unknown state is no live link — the landing reads it as dead. */
internal fun com.cogra.network.graphql.type.EmailChangeLinkState.toDomain(): EmailChangeLinkState =
    runCatching { EmailChangeLinkState.valueOf(rawValue) }.getOrDefault(EmailChangeLinkState.UNKNOWN)

@Singleton
class SettingsRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : SettingsRepository {

    override suspend fun settingsAccount(): Outcome<SettingsAccount?> = guard.run {
        client.query(SettingsAccountQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                SettingsAccount(
                    id = me.id,
                    handle = me.handle,
                    email = me.email,
                    emailVerified = me.emailVerified == true,
                    accountState = me.accountState?.toDomain() ?: AccountState.UNKNOWN,
                    actorPubkey = me.actorPubkey,
                    passwordChangedAt = me.passwordChangedAt,
                    keyBackupCreatedAt = me.keyBackupCreatedAt,
                    pendingEmailChange = me.pendingEmailChange?.pendingEmailChangeFields?.toDomain(),
                    defaultLicense = me.preferences?.defaultLicense?.let {
                        LicenseChoice(it.attribution, it.provenance)
                    },
                    sessions = me.sessions.orEmpty().map {
                        SessionInfo(it.id, it.deviceLabel, it.createdAt, it.lastUsedAt, it.isCurrent)
                    },
                ),
            )
        }
    }

    override suspend fun defaultLicense(): Outcome<LicenseChoice?> = guard.run {
        client.query(DefaultLicenseQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                me.preferences?.defaultLicense?.let { LicenseChoice(it.attribution, it.provenance) },
            )
        }
    }

    // `Optional.present(null)` is the explicit null that restores public
    // domain; every other preference stays absent and so is left as it is
    // (GraphQL spec §2.9.5, the input's own docstring).
    override suspend fun setDefaultLicense(license: LicenseChoice?): Outcome<LicenseChoice?> = guard.run {
        client.mutation(
            SetPreferencesMutation(
                SetPreferencesInput(defaultLicense = Optional.present(license?.toInput())),
            ),
        ).payloadOutcome({ it.setPreferences.userErrors.map { e -> e.userErrorFields } }) { data ->
            // The payload's preferences are present on success; what they
            // carry is the saved default, null being public domain.
            data.setPreferences.preferences?.let { prefs ->
                SavedLicense(prefs.defaultLicense?.let { LicenseChoice(it.attribution, it.provenance) })
            }
        }.map { it.license }
    }

    override suspend fun requestEmailChange(
        newEmail: String,
        currentPassword: String,
    ): Outcome<PendingEmailChange> = guard.run {
        client.mutation(RequestEmailChangeMutation(RequestEmailChangeInput(newEmail, currentPassword)))
            .payloadOutcome({ it.requestEmailChange.userErrors.map { e -> e.userErrorFields } }) {
                it.requestEmailChange.pendingEmailChange?.pendingEmailChangeFields?.toDomain()
            }
    }

    override suspend fun confirmEmailChange(code: String): Outcome<AccountEmail> = guard.run {
        client.mutation(ConfirmEmailChangeMutation(ConfirmEmailChangeInput(code)))
            .payloadOutcome({ it.confirmEmailChange.userErrors.map { e -> e.userErrorFields } }) {
                it.confirmEmailChange.user?.let { user ->
                    AccountEmail(user.email, user.pendingEmailChange?.pendingEmailChangeFields?.toDomain())
                }
            }
    }

    override suspend fun resendEmailChange(): Outcome<PendingEmailChange> = guard.run {
        client.mutation(ResendEmailChangeMutation())
            .payloadOutcome({ it.resendEmailChange.userErrors.map { e -> e.userErrorFields } }) {
                it.resendEmailChange.pendingEmailChange?.pendingEmailChangeFields?.toDomain()
            }
    }

    override suspend fun cancelEmailChange(): Outcome<AccountEmail> = guard.run {
        client.mutation(CancelEmailChangeMutation())
            .payloadOutcome({ it.cancelEmailChange.userErrors.map { e -> e.userErrorFields } }) {
                it.cancelEmailChange.user?.let { user ->
                    AccountEmail(user.email, user.pendingEmailChange?.pendingEmailChangeFields?.toDomain())
                }
            }
    }

    // Anonymous by design and never guarded: a signed-out device holding
    // the link is exactly who asks, and the answer is the same whoever
    // asks (api-spec.md `emailChangeLinkCheck`).
    override suspend fun emailChangeLinkCheck(token: String): Outcome<EmailChangeLinkCheck?> =
        client.query(EmailChangeLinkCheckQuery(token)).fetch().map { data ->
            data.emailChangeLinkCheck?.let { EmailChangeLinkCheck(it.newEmail, it.state.toDomain()) }
        }

    /** A non-null box, so a saved null (public domain) is not read as a fault. */
    private data class SavedLicense(val license: LicenseChoice?)
}
