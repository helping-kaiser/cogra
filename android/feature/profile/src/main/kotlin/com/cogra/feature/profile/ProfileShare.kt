// SHARING A PROFILE (ProfileOwnMenu.md "Share your profile", ProfileMenu.md
// "Share this profile"): the platform's own share sheet, handed the profile's
// web address — the same route `/u/<handle>` the web serves, so a link shared
// from the phone opens wherever it lands.

package com.cogra.feature.profile

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import com.cogra.domain.di.WebOrigin
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** Holds the web origin a profile's share link is built on. */
@HiltViewModel
class ProfileShareViewModel @Inject constructor(
    @WebOrigin private val webOrigin: String,
) : ViewModel() {
    fun urlFor(handle: String): String = profileShareUrl(webOrigin, handle)
}

internal fun profileShareUrl(webOrigin: String, handle: String): String = "$webOrigin/u/$handle"

/** `ACTION_SEND` in the system chooser — the platform's documented way to share plain text. */
internal fun Context.shareProfile(url: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, url)
    }
    startActivity(Intent.createChooser(send, null))
}
