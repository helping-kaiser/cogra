// Invite-link ids in pasted text (auth.md "Link URLs"): a full
// `/join/<id>` URL or the bare id.

package com.cogra.domain

private val INVITE_ID_PATTERN =
    Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

/**
 * The last UUID wins so a full URL's path id beats anything earlier in
 * the text; lowercased into the canonical shape (the API's UUID scalar
 * is case-insensitive). Mirrors the web app's invite-input helper.
 */
fun extractInviteId(input: String): String? =
    INVITE_ID_PATTERN.findAll(input.trim()).lastOrNull()?.value?.lowercase()
