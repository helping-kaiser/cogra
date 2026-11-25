// WHAT THIS DEVICE JUST SIGNED INTO ITS OWN PROFILE, laid over the head until
// a read asked after it answers. web's twin is `web/src/lib/profile/signed-profile.ts`.
//
// "WHEN the signing is taken -> the profile shows the change" (ProfileEditSeal.md:45,
// AvatarSeal.md:37), and a return "reads profile.identity's facts again beneath
// them, so a signed edit or a changed handle shows on arrival, and the list never
// moves" (Profile.md:97). The server serves the change from its signature on
// (data-model.md, "Actor profiles": the merged version row is "served to every
// reader from then on"), so the return's read confirms it — but that read is one
// round trip away, and the returning profile holds the head it read before the
// edit. So the device keeps what it signed — its own act, its values in hand —
// and the head wears them from the first frame; the first read ASKED AFTER the
// change replaces them, whatever it answers: the server is the truth about the
// profile.
//
// ONLY A CHANGE TAKEN is laid: one still signing, or one that did not go
// through, leaves the head as it was (ProfileEditSeal.md:75-79, Profile.md:99).
//
// THE CHANGE IS THE SIGNING ACCOUNT'S (auth.md "Multi-account device custody"):
// it is laid beside the account and the profile it was signed for, only while
// that account is still the active one, and dropped the moment the active
// account ends or changes — `HiddenSet`'s watch on the token store.
//
// In memory and app-wide on the `SensitiveReveals` pattern: a plain
// `@Singleton` holding a `StateFlow` the profile's ViewModel folds into its
// UI state (developer.android.com, "State holders and UI state").

package com.cogra.domain.profile

import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ProfileView
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/** One field a change set: [value] is what it was set to, null where the change cleared it. */
data class Setting<out T>(val value: T)

/** A picture as uploaded: the asset the change named and where its bytes are. */
data class SignedPicture(val id: String, val url: String)

/** The fields one profile change set; a field it left untouched is null. */
data class SignedProfileFields(
    /** The display name never blanks, so a set name is always a value. */
    val displayName: String? = null,
    val bio: Setting<String?>? = null,
    val websiteUrl: Setting<String?>? = null,
    /** The new picture, or a [Setting] of null where the change removed it. */
    val avatar: Setting<SignedPicture?>? = null,
) {
    /** These fields over [earlier]'s: what this change left untouched keeps the earlier value. */
    fun over(earlier: SignedProfileFields): SignedProfileFields = SignedProfileFields(
        displayName = displayName ?: earlier.displayName,
        bio = bio ?: earlier.bio,
        websiteUrl = websiteUrl ?: earlier.websiteUrl,
        avatar = avatar ?: earlier.avatar,
    )
}

/** What stands laid: the account and profile it was signed for, and what it set. */
data class LaidProfile(
    val owner: String,
    val profileId: String,
    val fields: SignedProfileFields,
    /** The order the changes began signing in: a later one's fields win. */
    internal val signing: Long,
    /** The generation it was laid at; a read asked at or after it confirms it. */
    internal val generation: Long,
)

/** The fields laid over [profileId]'s head, or null where none are. */
fun LaidProfile?.over(profileId: String): SignedProfileFields? = this?.takeIf { it.profileId == profileId }?.fields

/** The profile as read, wearing what was signed over it. */
fun ProfileView.wearing(fields: SignedProfileFields?): ProfileView {
    if (fields == null) return this
    return copy(
        displayName = fields.displayName?.let { displayName.copy(value = it) } ?: displayName,
        bio = fields.bio?.let { bio.copy(value = it.value) } ?: bio,
        websiteUrl = fields.websiteUrl?.let { websiteUrl.copy(value = it.value) } ?: websiteUrl,
        avatar = when (val picture = fields.avatar) {
            null -> avatar
            // A new asset: none of the old picture's facts are its.
            else -> picture.value?.let {
                MediaAssetView(
                    id = it.id,
                    url = it.url,
                    altText = null,
                    status = FieldStatus.NORMAL,
                    aspectRatio = AVATAR_RATIO,
                )
            }
        },
    )
}

/** The profile picture's fixed crop: a circle-masked square (D13). */
private const val AVATAR_RATIO = 1f

@Singleton
class SignedProfile @Inject constructor(
    private val tokens: TokenStore,
    @ApplicationScope scope: CoroutineScope,
) {
    /** One signing of a profile change, begun by [begin]: whose it is and its place in the order. */
    class Signing internal constructor(internal val owner: String?, internal val number: Long)

    private val lock = Any()
    private var signings = 0L
    private var generation = 0L

    private val _laid = MutableStateFlow<LaidProfile?>(null)

    /** What stands laid over a profile's head for the active account, or null. */
    val laid: StateFlow<LaidProfile?> = _laid.asStateFlow()

    init {
        scope.launch {
            // A sign-out or a change of account: nothing of the last account's stands.
            tokens.tokens.map { it?.accountId }.collect { account ->
                synchronized(lock) {
                    if (_laid.value?.owner != account) _laid.value = null
                }
            }
        }
    }

    /** A profile change starts signing: the account it signs for and its place in the order. */
    suspend fun begin(): Signing {
        val owner = tokens.current()?.accountId
        return synchronized(lock) { Signing(owner, ++signings) }
    }

    /**
     * [signing] was taken: [profileId]'s head wears [fields] from now until a
     * read asked after it answers — laid only while the active account is still
     * the signing one. A change laid earlier and not yet confirmed keeps the
     * fields this one left untouched, and a change that began signing before
     * the one laid never overrides it.
     */
    suspend fun lay(signing: Signing, profileId: String, fields: SignedProfileFields) {
        val owner = signing.owner ?: return
        if (tokens.current()?.accountId != owner) return
        synchronized(lock) {
            val earlier = _laid.value?.takeIf { it.owner == owner && it.profileId == profileId }
            val merged = when {
                earlier == null -> fields
                signing.number >= earlier.signing -> fields.over(earlier.fields)
                else -> earlier.fields.over(fields)
            }
            generation += 1
            _laid.value = LaidProfile(
                owner = owner,
                profileId = profileId,
                fields = merged,
                signing = maxOf(signing.number, earlier?.signing ?: signing.number),
                generation = generation,
            )
        }
    }

    /** Marks a read of a profile being asked; hand the mark back to [answered] with its answer. */
    fun asked(): Long = synchronized(lock) { generation }

    /**
     * A read asked at [asked] answered [profileId]: a change laid at or before
     * it is the server's to say now, and the head reads the answer alone. A
     * read already in flight when the change was taken confirms nothing.
     */
    fun answered(asked: Long, profileId: String) {
        synchronized(lock) {
            val now = _laid.value
            if (now != null && now.profileId == profileId && now.generation <= asked) _laid.value = null
        }
    }
}
