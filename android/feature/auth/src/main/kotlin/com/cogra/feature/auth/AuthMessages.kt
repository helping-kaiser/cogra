package com.cogra.feature.auth

import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.UserError

/**
 * Turns the stable error vocabulary into user-facing copy. The client
 * localizes off [ErrorCode], not the server's developer-facing `message`
 * (schema `UserError`). Kept as plain strings for slice 1; these move to
 * string resources when localization lands.
 */
internal fun UserError.toDisplayMessage(): String =
    when (code) {
        ErrorCode.INVALID_CREDENTIALS -> "Email or password is incorrect."
        ErrorCode.HANDLE_TAKEN -> "That handle is already taken."
        ErrorCode.BAD_INPUT -> when (field.firstOrNull()) {
            "email" -> "Enter your email."
            "password" -> "Enter your password."
            "handle" -> "Handles use 3–30 letters, digits, or underscores."
            "displayName" -> "Enter a display name (up to 50 characters)."
            "bio" -> "Your bio is too long (up to 300 characters)."
            "websiteUrl" -> "Enter a valid web address (http:// or https://)."
            else -> "Check the details you entered."
        }
        ErrorCode.RATE_LIMITED -> "Too many attempts. Try again in a little while."
        ErrorCode.UNAUTHENTICATED -> "Your session expired. Please log in again."
        ErrorCode.INTERNAL -> "Something went wrong on our end. Try again."
        else -> message
    }
