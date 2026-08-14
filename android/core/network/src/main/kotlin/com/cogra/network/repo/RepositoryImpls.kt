// The domain repositories over the generated Apollo client;
// Mapping.kt owns the response-tier translation.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.CommentView
import com.cogra.domain.AuthTokens
import com.cogra.domain.LoginGrant
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.ActorRef
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserProfile
import com.cogra.domain.WriteState
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.ApplicationStatusQuery
import com.cogra.network.graphql.ApplyWithInviteMutation
import com.cogra.network.graphql.ApproveActsMutation
import com.cogra.network.graphql.ApproveApplicantsMutation
import com.cogra.network.graphql.AttachActorKeyMutation
import com.cogra.network.graphql.ChangeHandleMutation
import com.cogra.network.graphql.ChangePasswordMutation
import com.cogra.network.graphql.ConfirmEmailChangeMutation
import com.cogra.network.graphql.ConfirmPasswordResetMutation
import com.cogra.network.graphql.CreateInviteLinkMutation
import com.cogra.network.graphql.CreateKeyBackupChallengeMutation
import com.cogra.network.graphql.HostPublicKeyQuery
import com.cogra.network.graphql.InviteLinkCheckQuery
import com.cogra.network.graphql.InviteLinksQuery
import com.cogra.network.graphql.KeyBackupQuery
import com.cogra.network.graphql.LogInMutation
import com.cogra.network.graphql.MeQuery
import com.cogra.network.graphql.PostDetailQuery
import com.cogra.network.graphql.PostsQuery
import com.cogra.network.graphql.PrepareCommentEditMutation
import com.cogra.network.graphql.PrepareCommentMutation
import com.cogra.network.graphql.PreparePostEditMutation
import com.cogra.network.graphql.PreparePostMutation
import com.cogra.network.graphql.PrepareStanceMutation
import com.cogra.network.graphql.RegisterMutation
import com.cogra.network.graphql.RequestEmailChangeMutation
import com.cogra.network.graphql.RequestPasswordResetMutation
import com.cogra.network.graphql.ResendVerificationEmailMutation
import com.cogra.network.graphql.RevokeInviteLinkMutation
import com.cogra.network.graphql.RevokeOtherSessionsMutation
import com.cogra.network.graphql.RevokeSessionMutation
import com.cogra.network.graphql.SessionsQuery
import com.cogra.network.graphql.StagedWriteQuery
import com.cogra.network.graphql.SubmitProposalsMutation
import com.cogra.network.graphql.UploadKeyBackupMutation
import com.cogra.network.graphql.VerifyEmailMutation
import com.cogra.network.graphql.type.ApplicationApprovalInput
import com.cogra.network.graphql.type.ApplyWithInviteInput
import com.cogra.network.graphql.type.PrepareCommentEditInput
import com.cogra.network.graphql.type.PrepareCommentInput
import com.cogra.network.graphql.type.PreparePostEditInput
import com.cogra.network.graphql.type.PreparePostInput
import com.cogra.network.graphql.type.ApprovalSignatureInput
import com.cogra.network.graphql.type.ApproveActsInput
import com.cogra.network.graphql.type.ApproveApplicantsInput
import com.cogra.network.graphql.type.AttachActorKeyInput
import com.cogra.network.graphql.type.ChangeHandleInput
import com.cogra.network.graphql.type.ChangePasswordInput
import com.cogra.network.graphql.type.ConfirmEmailChangeInput
import com.cogra.network.graphql.type.ConfirmPasswordResetInput
import com.cogra.network.graphql.type.CreateInviteLinkInput
import com.cogra.network.graphql.type.LogInInput
import com.cogra.network.graphql.type.PrepareStanceInput
import com.cogra.network.graphql.type.ProposalSignatureInput
import com.cogra.network.graphql.type.RegisterInput
import com.cogra.network.graphql.type.RequestEmailChangeInput
import com.cogra.network.graphql.type.RequestPasswordResetInput
import com.cogra.network.graphql.type.ResendVerificationEmailInput
import com.cogra.network.graphql.type.RevokeInviteLinkInput
import com.cogra.network.graphql.type.RevokeSessionInput
import com.cogra.network.graphql.type.SubmitProposalsInput
import com.cogra.network.graphql.type.UploadKeyBackupInput
import com.cogra.network.graphql.type.VerifyEmailInput
import com.cogra.network.payload
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.toInfo
import com.cogra.network.toInput
import com.cogra.network.toView
import com.cogra.network.unauthenticatedRefusal
import java.time.Instant
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

// Null when the payload omits the viewer — the convention makes that a
// server fault, and the payload mapping surfaces it as Failed.
private fun authOf(fields: com.cogra.network.graphql.fragment.AuthSessionFields): AuthTokens? =
    fields.user?.let { AuthTokens(fields.accessToken, fields.refreshToken, it.id) }

@Singleton
class OnboardingRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : OnboardingRepository {

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> =
        client.query(InviteLinkCheckQuery(id)).fetch().map { data ->
            data.inviteLinkCheck?.let { InviteCheck(it.usable, it.inviterHandle, it.expiresAt) }
        }

    override suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> = client.mutation(
        RegisterMutation(
            RegisterInput(
                inviteLink = inviteLink,
                handle = handle,
                email = email,
                password = password,
                deviceLabel = Optional.presentIfNotNull(deviceLabel),
            ),
        ),
    ).payloadOutcome({ it.register.userErrors.map { e -> e.userErrorFields } }) {
        it.register.auth?.authSessionFields?.let(::authOf)
    }

    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = client.mutation(
        VerifyEmailMutation(VerifyEmailInput(verificationToken)),
    ).payloadOutcome({ it.verifyEmail.userErrors.map { e -> e.userErrorFields } }) {
        if (it.verifyEmail.ok == true) Unit else null
    }

    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = client.mutation(
        ResendVerificationEmailMutation(ResendVerificationEmailInput(email)),
    ).payloadOutcome({ emptyList() }) { if (it.resendVerificationEmail.ok) Unit else null }

    override suspend fun attachActorKey(
        actorPubkeyBase64: String,
        l0Address: String,
    ): Outcome<Unit> = guard.run {
        client.mutation(
            AttachActorKeyMutation(
                AttachActorKeyInput(actorPubkey = actorPubkeyBase64, l0Address = l0Address),
            ),
        ).payloadOutcome({ it.attachActorKey.userErrors.map { e -> e.userErrorFields } }) {
            it.attachActorKey.user?.let { Unit }
        }
    }

    override suspend fun applyWithInvite(inviteLink: String): Outcome<Unit> = guard.run {
        client.mutation(
            ApplyWithInviteMutation(ApplyWithInviteInput(inviteLink)),
        ).payloadOutcome({ it.applyWithInvite.userErrors.map { e -> e.userErrorFields } }) {
            it.applyWithInvite.application?.let { Unit }
        }
    }

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> = guard.run {
        client.query(ApplicationStatusQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                ApplicationStatus(
                    accountState = me.accountState?.toDomain() ?: AccountState.UNKNOWN,
                    application = me.application?.applicationFields?.toView(),
                    stagedRegistration = me.stagedWrites?.edges.orEmpty()
                        .map { it.node.stagedWriteFields.toDomain() }
                        .firstOrNull {
                            it.family == Family.REGISTRATION && it.state != WriteState.EXPIRED
                        },
                    actorPubkey = me.actorPubkey,
                ),
            )
        }
    }
}

@Singleton
class SessionRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : SessionRepository {

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<LoginGrant> =
        client.mutation(
            LogInMutation(LogInInput(email, password, Optional.presentIfNotNull(deviceLabel))),
        ).payloadOutcome({ it.logIn.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.logIn.auth?.authSessionFields?.let(::authOf)
                ?.let { LoginGrant(it, data.logIn.reuseDetectedAt) }
        }

    override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> = client.mutation(
        com.cogra.network.graphql.RefreshSessionMutation(
            com.cogra.network.graphql.type.RefreshSessionInput(refreshToken),
        ),
    ).payloadOutcome({ it.refreshSession.userErrors.map { e -> e.userErrorFields } }) {
        it.refreshSession.auth?.authSessionFields?.let(::authOf)
    }

    override suspend fun sessions(): Outcome<List<SessionInfo>> = guard.run {
        client.query(SessionsQuery()).fetch().flatMap { data ->
            val sessions = data.me?.sessions ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                sessions.map {
                    val s = it.sessionFields
                    SessionInfo(s.id, s.deviceLabel, s.createdAt, s.lastUsedAt, s.expiresAt, s.isCurrent)
                },
            )
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
        return client.query(HostPublicKeyQuery()).fetch().map { data ->
            Base64.getDecoder().decode(data.hostPublicKey).also { cachedHostKey = it }
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
        client.query(StagedWriteQuery(id)).fetch().map { it.stagedWrite?.stagedWriteFields?.toDomain() }
    }
}

@Singleton
class AccountRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : AccountRepository {

    override suspend fun me(): Outcome<UserProfile?> = guard.run {
        client.query(MeQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                UserProfile(
                    id = me.id,
                    handle = me.handle,
                    displayName = me.displayName,
                    accountState = me.accountState?.toDomain() ?: AccountState.UNKNOWN,
                    hasReciprocated = me.hasReciprocated,
                    invitedBy = me.invitedBy?.let { ActorRef(it.id, it.handle) },
                ),
            )
        }
    }

    override suspend fun keyBackup(): Outcome<ByteArray?> = guard.run {
        client.query(KeyBackupQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(me.keyBackup?.let { Base64.getDecoder().decode(it) })
        }
    }

    override suspend fun keyBackupChallenge(): Outcome<ByteArray> = guard.run {
        client.mutation(CreateKeyBackupChallengeMutation())
            .payloadOutcome({ it.createKeyBackupChallenge.userErrors.map { e -> e.userErrorFields } }) {
                it.createKeyBackupChallenge.challenge?.let { c -> Base64.getDecoder().decode(c) }
            }
    }

    override suspend fun uploadKeyBackup(
        blob: ByteArray,
        challenge: ByteArray,
        signature: ByteArray,
    ): Outcome<Unit> = guard.run {
        val encoder = Base64.getEncoder()
        client.mutation(
            UploadKeyBackupMutation(
                UploadKeyBackupInput(
                    blob = encoder.encodeToString(blob),
                    challenge = encoder.encodeToString(challenge),
                    signature = encoder.encodeToString(signature),
                ),
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
        client.query(InviteLinksQuery()).fetch().flatMap { data ->
            val me = data.me ?: return@flatMap unauthenticatedRefusal()
            val links = me.inviteLinks?.edges?.map { it.node } ?: return@flatMap unauthenticatedRefusal()
            Outcome.Success(
                links.map { link ->
                    InviteLinkInfo(
                        id = link.id,
                        prefillPDirected = link.prefillPDirected,
                        prefillPInterest = link.prefillPInterest,
                        singleUse = link.singleUse,
                        createdAt = link.createdAt,
                        expiresAt = link.expiresAt,
                        revokedAt = link.revokedAt,
                        applications = link.applications.edges.map { edge ->
                            edge.node.applicationFields.toInfo()
                        },
                    )
                },
            )
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
                    prefillPDirected = link.prefillPDirected,
                    prefillPInterest = link.prefillPInterest,
                    singleUse = link.singleUse,
                    createdAt = link.createdAt,
                    expiresAt = link.expiresAt,
                    revokedAt = link.revokedAt,
                    applications = emptyList(),
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

    override suspend fun approveApplication(
        applicationId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            ApproveApplicantsMutation(
                ApproveApplicantsInput(listOf(ApplicationApprovalInput(applicationId, pDirected, pInterest))),
            ),
        ).payloadOutcome({ it.approveApplicants.userErrors.map { e -> e.userErrorFields } }) {
            it.approveApplicants.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }
}

@Singleton
class ContentRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : ContentRepository {

    // Reads are public-graph queries; they still ride the guard so a
    // signed-in viewer's stale token refreshes rather than erroring.
    override suspend fun posts(first: Int, after: String?): Outcome<Page<PostView>> = guard.run {
        client.query(PostsQuery(first = first, after = Optional.presentIfNotNull(after)))
            .fetch()
            .map { data ->
                Page(
                    items = data.posts.edges.map { it.node.postFields.toDomain() },
                    endCursor = data.posts.pageInfo.endCursor,
                    hasNextPage = data.posts.pageInfo.hasNextPage,
                )
            }
    }

    override suspend fun post(
        id: String,
        commentsFirst: Int,
        commentsAfter: String?,
    ): Outcome<PostDetail?> = guard.run {
        client.query(
            PostDetailQuery(
                id = id,
                commentsFirst = commentsFirst,
                commentsAfter = Optional.presentIfNotNull(commentsAfter),
            ),
        ).fetch().map { data ->
            data.post?.let { post ->
                PostDetail(
                    post = post.postFields.toDomain(),
                    comments = Page(
                        items = post.comments.edges.map { it.node.commentFields.toDomain() },
                        endCursor = post.comments.pageInfo.endCursor,
                        hasNextPage = post.comments.pageInfo.hasNextPage,
                    ),
                )
            }
        }
    }

    override suspend fun comments(
        postId: String,
        first: Int,
        after: String?,
    ): Outcome<Page<CommentView>> =
        post(postId, first, after).flatMap { detail ->
            when (detail) {
                null -> Outcome.Failed(IllegalStateException("post vanished under its thread"))
                else -> Outcome.Success(detail.comments)
            }
        }

    override suspend fun preparePost(
        title: String?,
        description: String?,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView> = guard.run {
        client.mutation(
            PreparePostMutation(
                PreparePostInput(
                    title = Optional.presentIfNotNull(title),
                    description = Optional.presentIfNotNull(description),
                    content = content,
                    license = license.toInput(),
                ),
            ),
        ).payloadOutcome({ it.preparePost.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.preparePost.node?.let { node ->
                data.preparePost.writes?.let { writes ->
                    PreparedContentView(node, writes.map { w -> w.preparedWriteFields.toDomain() })
                }
            }
        }
    }

    override suspend fun preparePostEdit(
        id: String,
        title: String?,
        description: String?,
        content: String,
    ): Outcome<PreparedContentView> = guard.run {
        client.mutation(
            PreparePostEditMutation(
                // The edit form holds the full field set, so every field
                // rides as present; a present null clears (api-spec.md
                // "Content authoring").
                PreparePostEditInput(
                    id = id,
                    title = Optional.present(title),
                    description = Optional.present(description),
                    content = Optional.present(content),
                ),
            ),
        ).payloadOutcome({ it.preparePostEdit.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.preparePostEdit.node?.let { node ->
                data.preparePostEdit.writes?.let { writes ->
                    PreparedContentView(node, writes.map { w -> w.preparedWriteFields.toDomain() })
                }
            }
        }
    }

    override suspend fun prepareComment(
        target: String,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView> = guard.run {
        client.mutation(
            PrepareCommentMutation(
                PrepareCommentInput(target = target, content = content, license = license.toInput()),
            ),
        ).payloadOutcome({ it.prepareComment.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.prepareComment.node?.let { node ->
                data.prepareComment.writes?.let { writes ->
                    PreparedContentView(node, writes.map { w -> w.preparedWriteFields.toDomain() })
                }
            }
        }
    }

    override suspend fun prepareCommentEdit(id: String, content: String): Outcome<PreparedContentView> =
        guard.run {
            client.mutation(
                PrepareCommentEditMutation(
                    PrepareCommentEditInput(id = id, content = Optional.present(content)),
                ),
            ).payloadOutcome({ it.prepareCommentEdit.userErrors.map { e -> e.userErrorFields } }) { data ->
                data.prepareCommentEdit.node?.let { node ->
                    data.prepareCommentEdit.writes?.let { writes ->
                        PreparedContentView(node, writes.map { w -> w.preparedWriteFields.toDomain() })
                    }
                }
            }
        }
}
