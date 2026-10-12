package com.cogra.domain.settings

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** The threshold that unveils everything — Settings' switch turned on. */
const val UNVEIL_LEVEL: Int = 0

/**
 * Whether an account's filter level unveils sensitive content. The MVP
 * reads `contentFilteringSeverityLevel` as one threshold: 0 unveils, null
 * or 1–10 keeps the veil (api-spec.md `UserPreferences`).
 */
fun unveilsSensitive(level: Int?): Boolean = level == UNVEIL_LEVEL

/**
 * The account's sensitive-content choice, as this app last read it.
 *
 * Settings' `Always unveil sensitive content` FOLLOWS THE ACCOUNT, never
 * this device alone (Settings.md; settings packet §3.1a, contract A6): a
 * value set on the web has to reach the app, so the app reads
 * `me.preferences` rather than keeping a copy of its own that could
 * disagree. Nothing here is persisted — after a cold start the veil
 * stands until the account's read answers, and a signed-out reader is
 * always veiled.
 *
 * In memory and app-wide, on the `SensitiveReveals` pattern: the shell
 * records each account read, and every veil reads [alwaysUnveil].
 */
@Singleton
class SensitiveContentChoice @Inject constructor() {

    private val _level = MutableStateFlow<Int?>(null)
    private val _alwaysUnveil = MutableStateFlow(false)

    /** The account's filter level; null when unread, unset or signed out. */
    val level: StateFlow<Int?> = _level.asStateFlow()

    /** Whether every sensitive body reads unveiled for this account. */
    val alwaysUnveil: StateFlow<Boolean> = _alwaysUnveil.asStateFlow()

    /** Records the level an account read or a saved preference answered; null on sign-out. */
    fun record(level: Int?) {
        _level.value = level
        _alwaysUnveil.value = unveilsSensitive(level)
    }
}
