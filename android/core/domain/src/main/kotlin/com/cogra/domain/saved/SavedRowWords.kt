// The word helpers a Saved row's reading (`SavedRows.kt`) is made of.

package com.cogra.domain.saved

import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState

internal fun ModeratedField.text(): String = value?.trim().orEmpty()

internal fun ModeratedField.redacted(): Boolean = status == FieldStatus.REDACTED

/** Words run onto one line; the row's own ellipsis does the cutting. */
internal fun oneLine(words: String): String = words.replace(Regex("\\s+"), " ").trim()

/** The first line of [words], and the rest. */
internal fun firstLine(words: String): Pair<String, String> {
    val trimmed = words.trim()
    val at = trimmed.indexOf('\n')
    return if (at < 0) trimmed to "" else trimmed.substring(0, at).trim() to trimmed.substring(at + 1).trim()
}

/** A sensitive thing's second line gives way to its reason. */
internal fun sensitiveReason(moderation: ModerationState, reason: String?): String? =
    if (moderation != ModerationState.SENSITIVE) null else reason?.trim()?.takeIf { it.isNotEmpty() }

/** The handle aside, dropped where the title already names it. */
internal fun aside(title: String, handle: String?): String? =
    if (handle == null || title.contains("@$handle")) null else "@$handle"
