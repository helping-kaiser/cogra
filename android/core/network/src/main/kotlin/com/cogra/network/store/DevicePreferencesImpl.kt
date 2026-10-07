// The device's own choices (Settings.md "Theme", "Show exact values"),
// over the same encrypted store the identity rides. Nothing here is a
// secret; reusing the store costs one class instead of a second
// DataStore. The names sit outside every `acct:` slot, so no account's
// purge reaches them and no sign-in changes them — the device keeps its
// theme whoever is signed in.

package com.cogra.network.store

import com.cogra.domain.store.DevicePreferences
import com.cogra.domain.store.ThemeChoice
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DevicePreferencesImpl @Inject constructor(
    private val store: EncryptedStore,
) : DevicePreferences {

    // An unreadable or unknown value is the default rather than a fault:
    // a rendering preference, not material anyone could lose.
    override val theme: Flow<ThemeChoice> = store.watch(THEME).map { bytes ->
        bytes?.decodeToString()?.let { name -> ThemeChoice.entries.firstOrNull { it.name == name } }
            ?: ThemeChoice.AUTO
    }.distinctUntilChanged()

    override suspend fun setTheme(choice: ThemeChoice) {
        store.put(THEME, choice.name.encodeToByteArray())
    }

    override val showExactValues: Flow<Boolean> = store.watch(EXACT_VALUES).map { bytes ->
        bytes?.firstOrNull() == ONE
    }.distinctUntilChanged()

    override suspend fun setShowExactValues(value: Boolean) {
        if (value) store.put(EXACT_VALUES, byteArrayOf(ONE)) else store.remove(EXACT_VALUES)
    }

    private companion object {
        const val THEME = "device:theme"
        const val EXACT_VALUES = "device:show_exact_values"
        const val ONE: Byte = 1
    }
}
