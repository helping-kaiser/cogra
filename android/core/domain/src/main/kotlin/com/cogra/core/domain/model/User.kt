package com.cogra.core.domain.model

/** Network-scope role for a User, mirroring the schema's `NetworkRole`. */
enum class NetworkRole { MEMBER, MODERATOR }

/**
 * A User profile as the client cares about it. The four moderated text fields
 * keep their per-field [ModeratedText] status so the UI can mark redactions
 * rather than silently dropping them.
 */
data class User(
    val id: String,
    val handle: ModeratedText,
    val displayName: ModeratedText,
    val bio: ModeratedText,
    val websiteUrl: ModeratedText,
    val networkRole: NetworkRole,
    val moderationStatus: ModerationStatus,
    val createdAt: String,
    val updatedAt: String,
)
