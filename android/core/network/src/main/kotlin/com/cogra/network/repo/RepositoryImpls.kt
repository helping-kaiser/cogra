// The domain repositories over the generated Apollo client;
// Mapping.kt owns the response-tier translation.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.CommentForEdit
import com.cogra.domain.CommentView
import com.cogra.domain.AuthTokens
import com.cogra.domain.LoginGrant
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.ActorRef
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.SelfMarkView
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserProfile
import com.cogra.domain.WriteState
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.topics.TagClaim
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.ApplicationStatusQuery
import com.cogra.network.graphql.AuthorRecordsQuery
import com.cogra.network.graphql.CommentRepliesQuery
import com.cogra.network.graphql.CommentForEditQuery
import com.cogra.network.graphql.MyProfileQuery
import com.cogra.network.graphql.PrepareProfileUpdateMutation
import com.cogra.network.graphql.UserByHandleQuery
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
import com.cogra.network.graphql.PostSelfMarkQuery
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
import com.cogra.network.graphql.type.AttachmentInput
import com.cogra.network.graphql.type.PrepareCommentEditInput
import com.cogra.network.graphql.type.PrepareCommentInput
import com.cogra.network.graphql.type.PreparePostEditInput
import com.cogra.network.graphql.type.PreparePostInput
import com.cogra.network.graphql.type.PrepareProfileUpdateInput
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
import com.cogra.network.graphql.type.ReferenceInput
import com.cogra.network.graphql.type.TagInput
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
                PrepareStanceInput(target = Optional.present(targetId), pDirected = pDirected, pInterest = pInterest),
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
                    displayName = me.displayName.value,
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
    override suspend fun posts(
        first: Int,
        after: String?,
        includePending: Boolean,
    ): Outcome<Page<PostView>> = guard.run {
        client.query(
            PostsQuery(
                first = first,
                after = Optional.presentIfNotNull(after),
                includePending = Optional.present(includePending),
            ),
        )
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
        includePending: Boolean,
    ): Outcome<PostDetail?> = guard.run {
        client.query(
            PostDetailQuery(
                id = id,
                commentsFirst = commentsFirst,
                commentsAfter = Optional.presentIfNotNull(commentsAfter),
                includePending = Optional.present(includePending),
            ),
        ).fetch().map { data ->
            data.post?.let { post ->
                PostDetail(
                    post = post.postFields.toDomain(),
                    comments = Page(
                        items = post.comments.edges.map { edge ->
                            edge.node.commentFields.toDomain()
                                .copy(replyCount = edge.node.replies.totalCount)
                        },
                        endCursor = post.comments.pageInfo.endCursor,
                        hasNextPage = post.comments.pageInfo.hasNextPage,
                    ),
                )
            }
        }
    }

    override suspend fun commentReplies(
        commentId: String,
        first: Int,
        after: String?,
        includePending: Boolean,
    ): Outcome<Page<CommentView>> = guard.run {
        client.query(
            CommentRepliesQuery(
                id = commentId,
                first = first,
                after = Optional.presentIfNotNull(after),
                includePending = Optional.present(includePending),
            ),
        ).fetch().flatMap { data ->
            when (val comment = data.comment) {
                null -> Outcome.Failed(IllegalStateException("comment vanished under its replies"))
                else -> Outcome.Success(
                    Page(
                        items = comment.replies.edges.map { edge ->
                            edge.node.commentFields.toDomain()
                                .copy(replyCount = edge.node.replies.totalCount)
                        },
                        endCursor = comment.replies.pageInfo.endCursor,
                        hasNextPage = comment.replies.pageInfo.hasNextPage,
                    ),
                )
            }
        }
    }

    override suspend fun comments(
        postId: String,
        first: Int,
        after: String?,
        includePending: Boolean,
    ): Outcome<Page<CommentView>> =
        post(postId, first, after, includePending).flatMap { detail ->
            when (detail) {
                null -> Outcome.Failed(IllegalStateException("post vanished under its thread"))
                else -> Outcome.Success(detail.comments)
            }
        }

    override suspend fun preparePost(
        title: String?,
        description: String?,
        content: String?,
        license: LicenseChoice,
        tags: List<TagClaim>,
        references: List<ReferenceClaim>,
        attachments: List<AttachmentClaim>,
        sensitive: Boolean,
        sensitiveReason: String?,
    ): Outcome<PreparedContentView> = guard.run {
        client.mutation(
            PreparePostMutation(
                PreparePostInput(
                    title = Optional.presentIfNotNull(title),
                    description = Optional.presentIfNotNull(description),
                    // A post's body is words XOR media (D16), and the
                    // server enforces it: a media post sends no content
                    // at all rather than an empty string, which is a
                    // value and would read as "both".
                    content = Optional.presentIfNotNull(content),
                    license = license.toInput(),
                    tags = tags.toInput(),
                    references = references.toInput(),
                    attachments = attachments.toInput(),
                    sensitive = Optional.present(sensitive),
                    // A reason only rides a mark: the server refuses one
                    // without it, and a blank counts as none.
                    sensitiveReason = Optional.presentIfNotNull(
                        sensitiveReason?.takeIf { sensitive && it.isNotBlank() },
                    ),
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

    override suspend fun postSelfMark(id: String): Outcome<SelfMarkView?> = guard.run {
        client.query(PostSelfMarkQuery(id)).fetch().map { data ->
            data.post?.let { SelfMarkView(it.sensitiveSelfMark, it.sensitiveReason) }
        }
    }

    override suspend fun preparePostEdit(
        id: String,
        title: String?,
        description: String?,
        content: String,
        sensitive: Boolean,
        sensitiveReason: String?,
    ): Outcome<PreparedContentView> = guard.run {
        client.mutation(
            PreparePostEditMutation(
                // An edit payload is the Post's complete content state,
                // so every field rides explicitly; a null renders as
                // nothing (post.md §4).
                PreparePostEditInput(
                    id = id,
                    title = Optional.present(title),
                    description = Optional.present(description),
                    content = Optional.present(content),
                    // The mark included: an omitted switch unmarks the
                    // post, so carrying the author's own mark through is
                    // the difference between an edit and a silent
                    // withdrawal of it.
                    sensitive = Optional.present(sensitive),
                    // Blank counts as none, and a reason without the
                    // switch is refused on `["sensitiveReason"]` — so the
                    // reason rides only under its own mark.
                    sensitiveReason = Optional.present(
                        sensitiveReason?.takeIf { sensitive && it.isNotBlank() },
                    ),
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
        tags: List<TagClaim>,
        references: List<ReferenceClaim>,
        attachments: List<AttachmentClaim>,
        pDirected: Double?,
        pInterest: Double?,
    ): Outcome<PreparedContentView> = guard.run {
        client.mutation(
            PrepareCommentMutation(
                PrepareCommentInput(
                    target = target,
                    content = content,
                    license = license.toInput(),
                    tags = tags.toInput(),
                    references = references.toInput(),
                    attachments = attachments.toCommentInput(),
                    // Absent leaves the contract's own +0.1; the reply
                    // seal's pad always names both.
                    pDirected = Optional.presentIfNotNull(pDirected),
                    pInterest = Optional.presentIfNotNull(pInterest),
                ),
            ),
        ).payloadOutcome({ it.prepareComment.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.prepareComment.node?.let { node ->
                data.prepareComment.writes?.let { writes ->
                    PreparedContentView(node, writes.map { w -> w.preparedWriteFields.toDomain() })
                }
            }
        }
    }

    override suspend fun commentForEdit(id: String): Outcome<CommentForEdit?> = guard.run {
        client.query(CommentForEditQuery(id)).fetch().map { data ->
            data.comment?.let {
                CommentForEdit(
                    comment = it.commentFields.toDomain(),
                    selfMark = SelfMarkView(it.sensitiveSelfMark, it.sensitiveReason),
                )
            }
        }
    }

    override suspend fun prepareCommentEdit(
        id: String,
        content: String,
        attachments: List<AttachmentClaim>,
        sensitive: Boolean,
        sensitiveReason: String?,
    ): Outcome<PreparedContentView> =
        guard.run {
            client.mutation(
                PrepareCommentEditMutation(
                    PrepareCommentEditInput(
                        id = id,
                        content = content,
                        // The complete gallery, like the words beside
                        // it: an edit payload is the whole state, so an
                        // omitted list would leave the old pictures
                        // standing and make removal unsayable.
                        attachments = attachments.toCommentInput(),
                        // Always sent, never omitted: the mark is
                        // complete-state too, so an absent field is read
                        // as `false` and would silently UNMARK a comment
                        // its author had marked.
                        sensitive = Optional.present(sensitive),
                        sensitiveReason = Optional.presentIfNotNull(sensitiveReason),
                    ),
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

/**
 * The topics a creation declares, as the API takes them. Both parameters
 * ride explicitly: the sliders start at the server's own defaults, so an
 * untouched slider says exactly what omitting it would (api-spec.md
 * `TagInput`). An empty list stays absent rather than riding as `[]`.
 */
private fun List<TagClaim>.toInput(): Optional<List<TagInput>?> = Optional.presentIfNotNull(
    takeIf { it.isNotEmpty() }?.map {
        TagInput(
            name = it.name,
            pDirected = Optional.present(it.relevance),
            pInterest = Optional.present(it.confidence),
        )
    },
)

/**
 * The references a creation declares, as the API takes them — the
 * same shape the tags beside them ride (api-spec.md `ReferenceInput`).
 * Both parameters go explicitly for the same reason: an untouched
 * slider sits on the server's own default and says so.
 */
@JvmName("referenceClaimsToInput")
private fun List<ReferenceClaim>.toInput(): Optional<List<ReferenceInput>?> =
    Optional.presentIfNotNull(
        takeIf { it.isNotEmpty() }?.map {
            ReferenceInput(
                target = it.targetId,
                relevance = Optional.present(it.relevance),
                support = Optional.present(it.support),
            )
        },
    )

/**
 * The gallery a creation declares (api-spec.md `AttachmentInput`).
 *
 * `displayOrder` and `isCover` are derived from the list's own order
 * rather than taken from the caller: the contract refuses an entry
 * whose stated index disagrees with its array position, so deriving
 * them is the only way the two cannot drift. `isCover` is true on the
 * first entry and nowhere else.
 */
@JvmName("attachmentClaimsToInput")
private fun List<AttachmentClaim>.toInput(): Optional<List<AttachmentInput>?> =
    Optional.presentIfNotNull(
        takeIf { it.isNotEmpty() }?.mapIndexed { index, claim ->
            AttachmentInput(
                mediaId = claim.mediaId,
                displayOrder = index,
                isCover = Optional.present(index == 0),
                altText = Optional.presentIfNotNull(claim.altText),
            )
        },
    )

/**
 * A comment's gallery on the wire.
 *
 * The same derived `displayOrder`, but **no cover**: a comment's set
 * leads nothing, so there is no first picture to mark, and claiming one
 * would state a fact about the gallery that is not true of it
 * (`CommentView.attachments`).
 *
 * An empty list rides as an explicit `[]` rather than being dropped,
 * because an edit's gallery is the complete state: removing the last
 * picture has to be sayable, and an absent field would leave the old one
 * standing.
 */
@JvmName("commentAttachmentClaimsToInput")
private fun List<AttachmentClaim>.toCommentInput(): Optional<List<AttachmentInput>?> =
    Optional.present(
        mapIndexed { index, claim ->
            AttachmentInput(
                mediaId = claim.mediaId,
                displayOrder = index,
                altText = Optional.presentIfNotNull(claim.altText),
            )
        },
    )

/**
 * The three-valued profile media field on the wire (D13): absent leaves
 * the picture alone, a present null clears it back to the monogram, and
 * a present id replaces it.
 */
private fun MediaFieldUpdate.toOptional(): Optional<String?> = when (this) {
    MediaFieldUpdate.Untouched -> Optional.Absent
    MediaFieldUpdate.Clear -> Optional.present(null)
    is MediaFieldUpdate.Set -> Optional.present(mediaId)
}

@Singleton
class ProfileRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : ProfileRepository {

    override suspend fun profileByHandle(handle: String): Outcome<ProfileView?> = guard.run {
        client.query(UserByHandleQuery(handle)).fetch().map { data ->
            data.user?.profileFields?.toDomain()
        }
    }

    override suspend fun myProfile(): Outcome<ProfileView?> = guard.run {
        client.query(MyProfileQuery()).fetch().map { data -> data.me?.profileFields?.toDomain() }
    }

    override suspend fun authorRecords(
        authorId: String,
        family: Family?,
        first: Int,
        after: String?,
    ): Outcome<Page<RecordRow>> = guard.run {
        client.query(
            AuthorRecordsQuery(
                author = authorId,
                family = Optional.presentIfNotNull(family?.toRecordFamily()),
                first = first,
                after = Optional.presentIfNotNull(after),
            ),
        ).fetch().map { data ->
            Page(
                items = data.records.edges.map { it.node.toRow() },
                endCursor = data.records.pageInfo.endCursor,
                hasNextPage = data.records.pageInfo.hasNextPage,
            )
        }
    }

    override suspend fun prepareProfileUpdate(
        displayName: String,
        bio: String?,
        websiteUrl: String?,
        avatar: MediaFieldUpdate,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            PrepareProfileUpdateMutation(
                // The edit form holds the full field set, so every field
                // rides as present; a present null clears (api-spec.md
                // "Content authoring") — the display name never nulls.
                //
                // The avatar is the exception and the reason
                // `MediaFieldUpdate` exists: an untouched picture must
                // be ABSENT, not a present null, because a present null
                // is the clear (D13).
                PrepareProfileUpdateInput(
                    displayName = Optional.present(displayName),
                    bio = Optional.present(bio),
                    websiteUrl = Optional.present(websiteUrl),
                    avatarMediaId = avatar.toOptional(),
                ),
            ),
        ).payloadOutcome({ it.prepareProfileUpdate.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.prepareProfileUpdate.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }
}

/** The reverse of RecordFamily.toDomain — null for UNKNOWN (no filter). */
private fun Family.toRecordFamily(): com.cogra.network.graphql.type.RecordFamily? =
    com.cogra.network.graphql.type.RecordFamily.knownEntries.find { it.rawValue == name }

/**
 * One chronicle row: family + genesis mark, the touched content's
 * snippet, and the post it opens. A record is a genesis exactly when
 * its target (binary) or terminal (hyper) is the mint of its own act.
 */
private fun AuthorRecordsQuery.Node.toRow(): RecordRow {
    val mint = "mint:$id"
    val terminalComment = terminal?.onComment
    val targetPost = target?.onPost
    val targetComment = target?.onComment
    val snippet = terminalComment?.content?.value
        ?: targetPost?.title?.value
        ?: targetPost?.content?.value
        ?: targetComment?.content?.value
    val link = when {
        // A Review's thread opens at its parent post, when the parent
        // is a post CoGra carries; nested reply chains stay unlinked
        // until a comment permalink exists.
        terminalComment != null -> terminalComment.target?.onPost?.id?.let { RecordLink.ToPost(it) }
        targetPost != null -> RecordLink.ToPost(targetPost.id)
        targetComment != null -> targetComment.target?.onPost?.id?.let { RecordLink.ToPost(it) }
        else -> null
    }
    return RecordRow(
        id = id,
        family = family.toDomain(),
        genesis = targetId == mint || terminalId == mint,
        snippet = snippet,
        link = link,
    )
}
