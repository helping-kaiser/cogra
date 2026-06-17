package com.cogra.core.domain.model

/** Per-field moderation state, mirroring the schema's `FieldModerationStatus`. */
enum class FieldModerationStatus { NORMAL, SENSITIVE, REDACTED }

/** Node-level cached max severity, mirroring the schema's `ModerationStatus`. */
enum class ModerationStatus { NORMAL, SENSITIVE, ILLEGAL }

/**
 * Text carrying its own moderation status. [value] is null when the field is
 * redacted or unset; [status] disambiguates the two cases — matching the
 * schema's `ModeratedText` contract.
 */
data class ModeratedText(
    val value: String?,
    val status: FieldModerationStatus,
)
