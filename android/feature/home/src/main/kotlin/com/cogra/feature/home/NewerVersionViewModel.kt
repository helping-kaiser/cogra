package com.cogra.feature.home

import androidx.lifecycle.ViewModel
import com.cogra.domain.release.NewerVersionAnnouncer
import com.cogra.domain.release.Release
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** The feed's door to the process's one [NewerVersionAnnouncer]. */
@HiltViewModel
class NewerVersionViewModel @Inject constructor(
    private val announcer: NewerVersionAnnouncer,
) : ViewModel() {

    /** The feed has arrived: the release to announce, or null. */
    suspend fun onFeedArrived(): Release? = announcer.onFeedArrived()

    /** The snackbar is showing [release]. */
    suspend fun onShown(release: Release) = announcer.onShown(release)
}
