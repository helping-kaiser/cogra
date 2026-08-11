// The storage-loss mark rides the same DataStore as the sealed values,
// but as a PLAIN preference: it must stay readable when the cipher is
// not. The mark is born in two places — the corruption handler's
// replacement content (file-level loss) and EncryptedStore's guarded
// reads (value-level loss) — and dies when the user acknowledges the
// shell's notice.

package com.cogra.network.store

import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.preferencesOf
import com.cogra.domain.store.StorageHealth
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

internal val STORAGE_LOST_KEY = booleanPreferencesKey("storage_lost_notice")

/**
 * The one secure Preferences DataStore: a corrupt file is replaced, not
 * fatal, and the replacement itself carries the storage-loss mark.
 */
fun secureDataStore(
    scope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
    produceFile: () -> File,
): DataStore<Preferences> = PreferenceDataStoreFactory.create(
    corruptionHandler = ReplaceFileCorruptionHandler { preferencesOf(STORAGE_LOST_KEY to true) },
    scope = scope,
    produceFile = produceFile,
)

@Singleton
class StorageHealthImpl @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) : StorageHealth {

    override val storageLost: Flow<Boolean> = dataStore.data.map { it[STORAGE_LOST_KEY] == true }

    override suspend fun acknowledge() {
        dataStore.edit { it.remove(STORAGE_LOST_KEY) }
    }
}
