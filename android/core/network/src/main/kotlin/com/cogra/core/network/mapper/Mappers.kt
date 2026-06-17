package com.cogra.core.network.mapper

import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.FieldModerationStatus
import com.cogra.core.domain.model.ModeratedText
import com.cogra.core.domain.model.ModerationStatus
import com.cogra.core.domain.model.NetworkRole
import com.cogra.core.domain.model.User
import com.cogra.network.graphql.fragment.UserFields

/**
 * Translates Apollo-generated types into domain types. Enums are matched on
 * their `rawValue` string rather than the generated Kotlin shape, so this
 * survives Apollo's enum-vs-sealed-class generation choice and maps any value
 * an older client doesn't know to a safe fallback instead of crashing.
 */

fun UserFields.toDomain(): User =
    User(
        id = id,
        handle = ModeratedText(handle.value, fieldStatusFromRaw(handle.status.rawValue)),
        displayName = ModeratedText(
            displayName.value,
            fieldStatusFromRaw(displayName.status.rawValue),
        ),
        bio = ModeratedText(bio.value, fieldStatusFromRaw(bio.status.rawValue)),
        websiteUrl = ModeratedText(websiteUrl.value, fieldStatusFromRaw(websiteUrl.status.rawValue)),
        networkRole = networkRoleFromRaw(networkRole.rawValue),
        moderationStatus = moderationStatusFromRaw(moderationStatus.rawValue),
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

fun fieldStatusFromRaw(raw: String): FieldModerationStatus =
    when (raw) {
        "NORMAL" -> FieldModerationStatus.NORMAL
        "SENSITIVE" -> FieldModerationStatus.SENSITIVE
        "REDACTED" -> FieldModerationStatus.REDACTED
        else -> FieldModerationStatus.NORMAL
    }

fun moderationStatusFromRaw(raw: String): ModerationStatus =
    when (raw) {
        "NORMAL" -> ModerationStatus.NORMAL
        "SENSITIVE" -> ModerationStatus.SENSITIVE
        "ILLEGAL" -> ModerationStatus.ILLEGAL
        else -> ModerationStatus.NORMAL
    }

fun networkRoleFromRaw(raw: String): NetworkRole =
    when (raw) {
        "MODERATOR" -> NetworkRole.MODERATOR
        else -> NetworkRole.MEMBER
    }

fun errorCodeFromRaw(raw: String): ErrorCode =
    when (raw) {
        "UNAUTHENTICATED" -> ErrorCode.UNAUTHENTICATED
        "FORBIDDEN" -> ErrorCode.FORBIDDEN
        "NOT_FOUND" -> ErrorCode.NOT_FOUND
        "BAD_INPUT" -> ErrorCode.BAD_INPUT
        "RATE_LIMITED" -> ErrorCode.RATE_LIMITED
        "INTERNAL" -> ErrorCode.INTERNAL
        "INVALID_CREDENTIALS" -> ErrorCode.INVALID_CREDENTIALS
        "INVITE_UNUSABLE" -> ErrorCode.INVITE_UNUSABLE
        "HANDLE_TAKEN" -> ErrorCode.HANDLE_TAKEN
        "WEAK_PASSWORD" -> ErrorCode.WEAK_PASSWORD
        "REGISTRATION_IN_PROGRESS" -> ErrorCode.REGISTRATION_IN_PROGRESS
        "VERIFICATION_TOKEN_INVALID" -> ErrorCode.VERIFICATION_TOKEN_INVALID
        "REFRESH_TOKEN_INVALID" -> ErrorCode.REFRESH_TOKEN_INVALID
        else -> ErrorCode.UNKNOWN
    }
