// Whether kept picks wait for their review — the one fact the restore's way
// out routes on (Restore.md:39: "WHEN the key is restored GIVEN picks kept
// pending wait -> KeptPicksReview opens under the same snackbar AND NEVER a
// kept pick signs on its own"). A kept vouch-back or approval is not one: it
// waits on its own card (KeptPicksReview.md:9).

package com.cogra.app.navigation

import androidx.lifecycle.ViewModel
import com.cogra.domain.stance.KeptPickStore
import com.cogra.domain.stance.opinions
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class KeptPicksDoorViewModel @Inject constructor(private val kept: KeptPickStore) : ViewModel() {

    /** Plain picks wait unsigned on this device for the active account. */
    suspend fun picksWaiting(): Boolean = kept.list().opinions().isNotEmpty()
}
