// The domain repositories over the generated Apollo client. Anonymous
// flows call straight through; viewer-authorized calls ride the
// AuthGuard's refresh-and-replay. Viewer reads that come back with a
// null `me` are translated to an UNAUTHENTICATED refusal so the guard
// treats a stale access token and an explicit refusal the same way.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.ApplicantInfo
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.ApplicationQuery
import com.cogra.network.graphql.ApproveActsMutation
import com.cogra.network.graphql.ApproveApplicantRegistrationMutation
import com.cogra.network.graphql.ApproveApplicantsMutation
import com.cogra.network.graphql.ChangeHandleMutation
import com.cogra.network.graphql.ChangePasswordMutation
import com.cogra.network.graphql.ClaimLandedSessionMutation
import com.cogra.network.graphql.ConfirmEmailChangeMutation
import com.cogra.network.graphql.ConfirmPasswordResetMutation
import com.cogra.network.graphql.CreateInviteLinkMutation
import com.cogra.network.graphql.HostPublicKeyQuery
import com.cogra.network.graphql.InviteLinkCheckQuery
import com.cogra.network.graphql.InviteLinksQuery
import com.cogra.network.graphql.KeyBackupQuery
import com.cogra.network.graphql.LogInMutation
import com.cogra.network.graphql.MeQuery
import com.cogra.network.graphql.PrepareStanceMutation
import com.cogra.network.graphql.RequestEmailChangeMutation
import com.cogra.network.graphql.RequestPasswordResetMutation
import com.cogra.network.graphql.ResendVerificationEmailMutation
import com.cogra.network.graphql.RevokeInviteLinkMutation
import com.cogra.network.graphql.RevokeOtherSessionsMutation
import com.cogra.network.graphql.RevokeSessionMutation
import com.cogra.network.graphql.SessionsQuery
import com.cogra.network.graphql.StagedWriteQuery
import com.cogra.network.graphql.SubmitApplicantRegistrationMutation
import com.cogra.network.graphql.SubmitApplicationMutation
import com.cogra.network.graphql.SubmitProposalsMutation
import com.cogra.network.graphql.UploadKeyBackupMutation
import com.cogra.network.graphql.VerifyApplicantEmailMutation
import com.cogra.network.graphql.type.ApplicantApprovalInput
import com.cogra.network.graphql.type.ApprovalSignatureInput
import com.cogra.network.graphql.type.ApproveActsInput
import com.cogra.network.graphql.type.ApproveApplicantRegistrationInput
import com.cogra.network.graphql.type.ApproveApplicantsInput
import com.cogra.network.graphql.type.ChangeHandleInput
import com.cogra.network.graphql.type.ChangePasswordInput
import com.cogra.network.graphql.type.ClaimLandedSessionInput
import com.cogra.network.graphql.type.ConfirmEmailChangeInput
import com.cogra.network.graphql.type.ConfirmPasswordResetInput
import com.cogra.network.graphql.type.CreateInviteLinkInput
import com.cogra.network.graphql.type.LogInInput
import com.cogra.network.graphql.type.PrepareStanceInput
import com.cogra.network.graphql.type.ProposalSignatureInput
import com.cogra.network.graphql.type.RequestEmailChangeInput
import com.cogra.network.graphql.type.RequestPasswordResetInput
import com.cogra.network.graphql.type.ResendVerificationEmailInput
import com.cogra.network.graphql.type.RevokeInviteLinkInput
import com.cogra.network.graphql.type.RevokeSessionInput
import com.cogra.network.graphql.type.SubmitApplicantRegistrationInput
import com.cogra.network.graphql.type.SubmitApplicationInput
import com.cogra.network.graphql.type.SubmitProposalsInput
import com.cogra.network.graphql.type.UploadKeyBackupInput
import com.cogra.network.graphql.type.VerifyApplicantEmailInput
import com.cogra.network.payload
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import java.time.Instant
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

private fun unauthenticated(): Outcome.Refused =
    Outcome.Refused(listOf(UserError(ErrorCode.UNAUTHENTICATED, "no viewer for this request")))

private fun authOf(fields: com.cogra.network.graphql.fragment.AuthSessionFields): AuthTokens =
    AuthTokens(fields.accessToken, fields.refreshToken)

@Singleton
class OnboardingRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
) : OnboardingRepository {

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> =
        when (val fetched = client.query(InviteLinkCheckQuery(id)).fetch()) {
            is Outcome.Success -> Outcome.Success(
                fetched.value.inviteLinkCheck?.let {
                    InviteCheck(it.usable, it.inviterHandle, it.expiresAt)
                },
            )
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }

    override suspend fun submitApplication(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        actorPubkeyBase64: String,
        l0Address: String,
    ): Outcome<String> = client.mutation(
        SubmitApplicationMutation(
            SubmitApplicationInput(
                inviteLink = inviteLink,
                handle = handle,
                email = email,
                password = password,
                actorPubkey = actorPubkeyBase64,
                l0Address = l0Address,
            ),
        ),
    ).payloadOutcome({ it.submitApplication.userErrors.map { e -> e.userErrorFields } }) {
        it.submitApplication.applicantToken
    }

    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = client.mutation(
        VerifyApplicantEmailMutation(VerifyApplicantEmailInput(verificationToken)),
    ).payloadOutcome({ it.verifyApplicantEmail.userErrors.map { e -> e.userErrorFields } }) {
        if (it.verifyApplicantEmail.ok == true) Unit else null
    }

    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = client.mutation(
        ResendVerificationEmailMutation(ResendVerificationEmailInput(email)),
    ).payloadOutcome({ emptyList() }) { if (it.resendVerificationEmail.ok) Unit else null }

    override suspend fun application(applicantToken: String): Outcome<ApplicationStatus?> =
        when (val fetched = client.query(ApplicationQuery(applicantToken)).fetch()) {
            is Outcome.Success -> Outcome.Success(
                fetched.value.application?.let { view ->
                    val a = view.applicant.applicantFields
                    ApplicationStatus(
                        handle = a.handle,
                        emailVerified = a.emailVerified,
                        approvedAt = a.approvedAt,
                        landedAt = a.landedAt,
                        expiresAt = a.expiresAt,
                        stagedRegistration = view.stagedRegistration?.stagedWriteFields?.toDomain(),
                    )
                },
            )
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }

    override suspend fun submitRegistration(
        applicantToken: String,
        signatureBase64: String,
    ): Outcome<StagedWriteView> = client.mutation(
        SubmitApplicantRegistrationMutation(
            SubmitApplicantRegistrationInput(applicantToken, signatureBase64),
        ),
    ).payloadOutcome({ it.submitApplicantRegistration.userErrors.map { e -> e.userErrorFields } }) {
        it.submitApplicantRegistration.stagedWrite?.stagedWriteFields?.toDomain()
    }

    override suspend fun approveRegistration(
        applicantToken: String,
        signatureBase64: String,
    ): Outcome<StagedWriteView> = client.mutation(
        ApproveApplicantRegistrationMutation(
            ApproveApplicantRegistrationInput(applicantToken, signatureBase64),
        ),
    ).payloadOutcome({ it.approveApplicantRegistration.userErrors.map { e -> e.userErrorFields } }) {
        it.approveApplicantRegistration.stagedWrite?.stagedWriteFields?.toDomain()
    }

    override suspend fun claimLandedSession(
        applicantToken: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> = client.mutation(
        ClaimLandedSessionMutation(
            ClaimLandedSessionInput(applicantToken, Optional.presentIfNotNull(deviceLabel)),
        ),
    ).payloadOutcome({ it.claimLandedSession.userErrors.map { e -> e.userErrorFields } }) {
        it.claimLandedSession.auth?.authSessionFields?.let(::authOf)
    }
}

@Singleton
class SessionRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : SessionRepository {

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<AuthTokens> =
        client.mutation(
            LogInMutation(LogInInput(email, password, Optional.presentIfNotNull(deviceLabel))),
        ).payloadOutcome({ it.logIn.userErrors.map { e -> e.userErrorFields } }) {
            it.logIn.auth?.authSessionFields?.let(::authOf)
        }

    override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> = client.mutation(
        com.cogra.network.graphql.RefreshSessionMutation(
            com.cogra.network.graphql.type.RefreshSessionInput(refreshToken),
        ),
    ).payloadOutcome({ it.refreshSession.userErrors.map { e -> e.userErrorFields } }) {
        it.refreshSession.auth?.authSessionFields?.let(::authOf)
    }

    override suspend fun sessions(): Outcome<List<SessionInfo>> = guard.run {
        when (val fetched = client.query(SessionsQuery()).fetch()) {
            is Outcome.Success -> {
                val sessions = fetched.value.me?.sessions ?: return@run unauthenticated()
                Outcome.Success(
                    sessions.map {
                        val s = it.sessionFields
                        SessionInfo(s.id, s.deviceLabel, s.createdAt, s.lastUsedAt, s.expiresAt, s.isCurrent)
                    },
                )
            }
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }
    }

    override suspend fun revokeSession(id: String?): Outcome<Unit> = guard.run {
        client.mutation(
            RevokeSessionMutation(RevokeSessionInput(Optional.presentIfNotNull(id))),
        ).payloadOutcome({ it.revokeSession.userErrors.map { e -> e.userErrorFields } }) {
            it.revokeSession.session?.let { Unit }
        }
    }

    override suspend fun revokeOtherSessions(): Outcome<Int> = guard.run {
        client.mutation(RevokeOtherSessionsMutation())
            .payloadOutcome({ it.revokeOtherSessions.userErrors.map { e -> e.userErrorFields } }) {
                it.revokeOtherSessions.revokedCount
            }
    }
}

@Singleton
class WriteRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : WriteRepository {

    @Volatile
    private var cachedHostKey: ByteArray? = null

    override suspend fun hostPublicKey(): Outcome<ByteArray> {
        cachedHostKey?.let { return Outcome.Success(it) }
        return when (val fetched = client.query(HostPublicKeyQuery()).fetch()) {
            is Outcome.Success -> {
                val key = Base64.getDecoder().decode(fetched.value.hostPublicKey)
                cachedHostKey = key
                Outcome.Success(key)
            }
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }
    }

    override suspend fun prepareStance(
        targetId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            PrepareStanceMutation(
                PrepareStanceInput(target = targetId, pDirected = pDirected, pInterest = pInterest),
            ),
        ).payloadOutcome({ it.prepareStance.userErrors.map { e -> e.userErrorFields } }) {
            it.prepareStance.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        guard.run {
            client.mutation(
                SubmitProposalsMutation(
                    SubmitProposalsInput(listOf(ProposalSignatureInput(stagedWriteId, signatureBase64))),
                ),
            ).payloadOutcome({ it.submitProposals.userErrors.map { e -> e.userErrorFields } }) {
                it.submitProposals.stagedWrites?.singleOrNull()?.stagedWriteFields?.toDomain()
            }
        }

    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        guard.run {
            client.mutation(
                ApproveActsMutation(
                    ApproveActsInput(listOf(ApprovalSignatureInput(stagedWriteId, signatureBase64))),
                ),
            ).payloadOutcome({ it.approveActs.userErrors.map { e -> e.userErrorFields } }) {
                it.approveActs.stagedWrites?.singleOrNull()?.stagedWriteFields?.toDomain()
            }
        }

    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = guard.run {
        when (val fetched = client.query(StagedWriteQuery(id)).fetch()) {
            is Outcome.Success ->
                Outcome.Success(fetched.value.stagedWrite?.stagedWriteFields?.toDomain())
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }
    }
}

@Singleton
class AccountRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : AccountRepository {

    override suspend fun me(): Outcome<UserProfile?> = guard.run {
        when (val fetched = client.query(MeQuery()).fetch()) {
            is Outcome.Success -> {
                val me = fetched.value.me ?: return@run unauthenticated()
                Outcome.Success(
                    UserProfile(
                        id = me.id,
                        handle = me.handle,
                        displayName = me.displayName,
                        invitedBy = me.invitedBy?.let { ActorRef(it.id, it.handle) },
                    ),
                )
            }
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }
    }

    override suspend fun keyBackup(): Outcome<ByteArray?> = guard.run {
        when (val fetched = client.query(KeyBackupQuery()).fetch()) {
            is Outcome.Success -> {
                val me = fetched.value.me ?: return@run unauthenticated()
                Outcome.Success(me.keyBackup?.let { Base64.getDecoder().decode(it) })
            }
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }
    }

    override suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit> = guard.run {
        client.mutation(
            UploadKeyBackupMutation(
                UploadKeyBackupInput(Base64.getEncoder().encodeToString(blob)),
            ),
        ).payloadOutcome({ it.uploadKeyBackup.userErrors.map { e -> e.userErrorFields } }) {
            if (it.uploadKeyBackup.ok == true) Unit else null
        }
    }

    override suspend fun changePassword(currentPassword: String, newPassword: String): Outcome<Unit> = guard.run {
        client.mutation(ChangePasswordMutation(ChangePasswordInput(currentPassword, newPassword)))
            .payloadOutcome({ it.changePassword.userErrors.map { e -> e.userErrorFields } }) {
                if (it.changePassword.ok == true) Unit else null
            }
    }

    override suspend fun changeHandle(handle: String): Outcome<Unit> = guard.run {
        client.mutation(ChangeHandleMutation(ChangeHandleInput(handle)))
            .payloadOutcome({ it.changeHandle.userErrors.map { e -> e.userErrorFields } }) {
                it.changeHandle.user?.let { Unit }
            }
    }

    override suspend fun requestPasswordReset(email: String): Outcome<Unit> = client.mutation(
        RequestPasswordResetMutation(RequestPasswordResetInput(email)),
    ).payloadOutcome({ emptyList() }) { if (it.requestPasswordReset.ok) Unit else null }

    override suspend fun confirmPasswordReset(resetToken: String, newPassword: String): Outcome<Unit> =
        client.mutation(
            ConfirmPasswordResetMutation(ConfirmPasswordResetInput(resetToken, newPassword)),
        ).payloadOutcome({ it.confirmPasswordReset.userErrors.map { e -> e.userErrorFields } }) {
            if (it.confirmPasswordReset.ok == true) Unit else null
        }

    override suspend fun requestEmailChange(newEmail: String, currentPassword: String): Outcome<Unit> = guard.run {
        client.mutation(RequestEmailChangeMutation(RequestEmailChangeInput(newEmail, currentPassword)))
            .payloadOutcome({ emptyList() }) { if (it.requestEmailChange.ok) Unit else null }
    }

    override suspend fun confirmEmailChange(code: String): Outcome<Unit> = client.mutation(
        ConfirmEmailChangeMutation(ConfirmEmailChangeInput(code)),
    ).payloadOutcome({ it.confirmEmailChange.userErrors.map { e -> e.userErrorFields } }) {
        it.confirmEmailChange.user?.let { Unit }
    }

    override suspend fun inviteLinks(): Outcome<List<InviteLinkInfo>> = guard.run {
        when (val fetched = client.query(InviteLinksQuery()).fetch()) {
            is Outcome.Success -> {
                val me = fetched.value.me ?: return@run unauthenticated()
                val links = me.inviteLinks?.nodes ?: return@run unauthenticated()
                Outcome.Success(
                    links.map { link ->
                        InviteLinkInfo(
                            id = link.id,
                            singleUse = link.singleUse,
                            createdAt = link.createdAt,
                            expiresAt = link.expiresAt,
                            revokedAt = link.revokedAt,
                            applicants = link.applicants.nodes.map { node ->
                                val a = node.applicantFields
                                ApplicantInfo(a.id, a.handle, a.emailVerified, a.approvedAt, a.landedAt)
                            },
                        )
                    },
                )
            }
            is Outcome.Refused -> fetched
            is Outcome.Failed -> fetched
        }
    }

    override suspend fun createInviteLink(
        expiresAt: Instant,
        prefillPDirected: Double,
        prefillPInterest: Double,
        singleUse: Boolean,
    ): Outcome<InviteLinkInfo> = guard.run {
        client.mutation(
            CreateInviteLinkMutation(
                CreateInviteLinkInput(
                    expiresAt = expiresAt,
                    prefillPDirected = prefillPDirected,
                    prefillPInterest = prefillPInterest,
                    singleUse = Optional.present(singleUse),
                ),
            ),
        ).payloadOutcome({ it.createInviteLink.userErrors.map { e -> e.userErrorFields } }) {
            it.createInviteLink.inviteLink?.let { link ->
                InviteLinkInfo(
                    id = link.id,
                    singleUse = link.singleUse,
                    createdAt = link.createdAt,
                    expiresAt = link.expiresAt,
                    revokedAt = link.revokedAt,
                    applicants = emptyList(),
                )
            }
        }
    }

    override suspend fun revokeInviteLink(id: String): Outcome<Unit> = guard.run {
        client.mutation(RevokeInviteLinkMutation(RevokeInviteLinkInput(id)))
            .payloadOutcome({ it.revokeInviteLink.userErrors.map { e -> e.userErrorFields } }) {
                it.revokeInviteLink.inviteLink?.let { Unit }
            }
    }

    override suspend fun approveApplicant(
        applicantId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            ApproveApplicantsMutation(
                ApproveApplicantsInput(listOf(ApplicantApprovalInput(applicantId, pDirected, pInterest))),
            ),
        ).payloadOutcome({ it.approveApplicants.userErrors.map { e -> e.userErrorFields } }) {
            it.approveApplicants.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }
}
