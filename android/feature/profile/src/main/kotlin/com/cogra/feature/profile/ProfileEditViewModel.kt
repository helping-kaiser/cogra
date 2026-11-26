package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.content.isBioTooLong
import com.cogra.domain.content.isDisplayNameTooLong
import com.cogra.domain.content.isWebsiteUrlTooLong
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.overPictureCap
import com.cogra.domain.profile.Setting
import com.cogra.domain.profile.SignedPicture
import com.cogra.domain.profile.SignedProfile
import com.cogra.domain.profile.SignedProfileFields
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.KnownMedia
import com.cogra.domain.signing.SentProfile
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.known
import com.cogra.domain.signing.profileExpectation
import com.cogra.domain.signing.profileUpdate
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The profile picture, as the form holds it.
 *
 * The three states are the contract's three (D13) plus the one the form
 * needs while a new picture is on its way: [Held] is what the account
 * already has and the form has not touched, [Cleared] is the explicit
 * clear, [Picked] is a local file mid-upload, and [Uploaded] is the
 * asset the update will name. Only [Cleared] and [Uploaded] change
 * anything; [Held] sends nothing at all, which is what makes "leave it
 * alone" distinguishable from "clear it".
 */
sealed interface ProfileImageState {
    data class Held(val url: String?) : ProfileImageState

    data object Cleared : ProfileImageState

    data class Picked(val uri: String) : ProfileImageState

    /**
     * On the server. [known] is what the intent check holds the avatar
     * entry to: the upload digest this device computed and the server
     * echoed, and the rendition digest.
     */
    data class Uploaded(val mediaId: String, val url: String, val known: KnownMedia? = null) : ProfileImageState

    data class Failed(val uri: String, val message: String) : ProfileImageState

    /** What the header should draw right now, or null for the monogram. */
    val previewUrl: Any?
        get() = when (this) {
            is Held -> url
            is Picked -> uri
            is Uploaded -> url
            is Failed -> uri
            Cleared -> null
        }

    /** This state, or the server's picture where the form has none of its own. */
    fun orHeld(url: String?): ProfileImageState =
        if (this is Held) Held(url) else this

    /** The wire value: absent, an explicit clear, or an id. */
    fun toUpdate(): MediaFieldUpdate = when (this) {
        is Held, is Picked, is Failed -> MediaFieldUpdate.Untouched
        Cleared -> MediaFieldUpdate.Clear
        is Uploaded -> MediaFieldUpdate.Set(mediaId)
    }
}

/** The edit's two stages: the form, and the change's seal (`ProfileEdit` → `ProfileEditSeal`). */
enum class ProfileEditStage { Form, Seal }

/**
 * What took the commit's place on the seal when a press did not land
 * (ProfileEditSeal.md:47-57): the fault line and Retry, the write rule's
 * notice, or the bug's.
 */
enum class ProfileSealFault { Offline, WriteRule, Bug }

data class ProfileEditUiState(
    /** The account's own id: the node a profile payload binds to. */
    val profileId: String = "",
    val loading: Boolean = true,
    /** The form's own read failed: nothing to edit yet. */
    val transportFailed: Boolean = false,
    val displayName: String = "",
    val bio: String = "",
    val websiteUrl: String = "",
    val avatar: ProfileImageState = ProfileImageState.Held(null),
    /** The fields as read, which the seal's row names the change against. */
    val readDisplayName: String = "",
    val readBio: String = "",
    val readWebsiteUrl: String = "",
    val stage: ProfileEditStage = ProfileEditStage.Form,
    /** `Sign the change` was pressed and has not answered. */
    val signing: Boolean = false,
    val fault: ProfileSealFault? = null,
    val emptyName: Boolean = false,
    /** CoGra reserves this name: the Display name field's own line, until the next Save. */
    val nameReserved: Boolean = false,
    /** One-shot: the change was taken while the seal stood; the caller pops back and confirms. */
    val saved: Boolean = false,
) {
    /** A picture is still on its way; saving would name nothing. */
    val imagesPending: Boolean
        get() = avatar is ProfileImageState.Picked

    val displayNameTooLong: Boolean get() = isDisplayNameTooLong(displayName)
    val bioTooLong: Boolean get() = isBioTooLong(bio)
    val websiteUrlTooLong: Boolean get() = isWebsiteUrlTooLong(websiteUrl)

    /** Save may open the seal: nothing pending, and no field is over its ruled cap. */
    val canSubmit: Boolean
        get() = !imagesPending && !displayNameTooLong && !bioTooLong && !websiteUrlTooLong

    /** The seal's one acts row: what the change holds (ProfileEditSeal.md:5-9). */
    val changeSummary: String
        get() = profileChangeSummary(
            renewed = listOfNotNull(
                "picture".takeIf { avatar is ProfileImageState.Uploaded },
                "display name".takeIf { displayName.trim() != readDisplayName.trim() },
                "bio".takeIf { bio.trim() != readBio.trim() },
                "website".takeIf { websiteUrl.trim() != readWebsiteUrl.trim() },
            ),
            removed = avatar == ProfileImageState.Cleared,
        )
}

/**
 * The Profile row's words (ProfileEditSeal.md:5-9; copy-voice, *The profile's
 * seal*): `A new` and the changed parts in the edit's order, joined `, ` and a
 * last ` and `; `The picture removed` alone, `, the picture removed` after the
 * others. web's twin is `web/src/app/profile/edit/change-summary.ts`, whose
 * `Nothing changed` this shares for a Save that changes nothing.
 */
internal fun profileChangeSummary(renewed: List<String>, removed: Boolean): String {
    val said = buildList {
        if (renewed.isNotEmpty()) add("A new ${listed(renewed)}")
        if (removed) add(if (isEmpty()) "The picture removed" else "the picture removed")
    }
    return if (said.isEmpty()) NOTHING_CHANGED else said.joinToString(", ")
}

private fun listed(parts: List<String>): String =
    if (parts.size <= 1) parts.joinToString("") else "${parts.dropLast(1).joinToString(", ")} and ${parts.last()}"

internal const val NOTHING_CHANGED = "Nothing changed"

/**
 * The profile edit form: pre-filled from the current version, saved as
 * a parallel Registration prepared by the backend and signed here
 * (substrate.md §9). The form holds the full field set — a blanked bio
 * or website clears; the display name cannot blank.
 */
@HiltViewModel
class ProfileEditViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val signer: WriteSigner,
    private val signedProfile: SignedProfile,
    private val changes: ProfileChanges,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileEditUiState())
    val state = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = profiles.myProfile()) {
                is Outcome.Success -> {
                    val profile = outcome.value
                    if (profile == null) {
                        _state.update { it.copy(loading = false, transportFailed = true) }
                    } else {
                        _state.update {
                            it.copy(
                                profileId = profile.id,
                                loading = false,
                                displayName = profile.displayName.value.orEmpty(),
                                bio = profile.bio.value.orEmpty(),
                                websiteUrl = profile.websiteUrl.value.orEmpty(),
                                readDisplayName = profile.displayName.value.orEmpty(),
                                readBio = profile.bio.value.orEmpty(),
                                readWebsiteUrl = profile.websiteUrl.value.orEmpty(),
                                // A picture the author has already touched
                                // outranks the one the server holds: a
                                // reload reached from the retry button
                                // would otherwise discard an upload still
                                // in flight.
                                avatar = it.avatar.orHeld(profile.avatar?.url),
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, transportFailed = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    fun onDisplayNameChange(v: String) = _state.update { it.copy(displayName = v, emptyName = false) }
    fun onBioChange(v: String) = _state.update { it.copy(bio = v) }
    fun onWebsiteChange(v: String) = _state.update { it.copy(websiteUrl = v) }
    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    // -- The profile picture (D13) --

    /**
     * A picked avatar: cropped to its fixed shape, processed and
     * uploaded exactly as a post's pictures are — same pipeline, same
     * `uploadMedia`, only the shape differs. With no framing the picture
     * is taken from the middle of whatever was picked.
     */
    fun onAvatarPicked(uri: String) = onAvatarFramed(uri, window = null)

    /**
     * The picture the crop handed back: `AvatarCrop`'s Next, opened from
     * Change picture, returns here holding it, and this form's one Save
     * signs it with the fields (ProfileEdit.md, AvatarCrop.md). It uploads
     * at once, framed as the author left it, so Save waits only on bytes
     * already on their way.
     */
    fun onAvatarFramed(uri: String, window: CropWindow?) =
        pick(uri, CropSpec(targetRatio = AVATAR_RATIO, window = window))

    /** Back to the monogram, which is the designed placeholder. */
    fun onAvatarCleared() = _state.update { it.copy(avatar = ProfileImageState.Cleared) }

    private fun pick(uri: String, crop: CropSpec) {
        _state.update { it.copy(avatar = ProfileImageState.Picked(uri)) }
        viewModelScope.launch {
            val processed = processor.process(uri, crop)
            val next = if (processed == null) {
                ProfileImageState.Failed(uri, UNREADABLE)
            } else if (processed.overPictureCap()) {
                // A profile picture takes the same cap a post's media
                // does (HT-19, jakob's ruling): it is the same asset kind
                // through the same `uploadMedia`, so a limit it did not
                // enforce was a hole rather than a difference. Weighed on
                // the encode's output, which is what the server measures.
                ProfileImageState.Failed(uri, TOO_BIG)
            } else {
                when (val outcome = media.uploadMedia(processed)) {
                    is Outcome.Success ->
                        ProfileImageState.Uploaded(outcome.value.id, outcome.value.url, outcome.value.known())
                    is Outcome.Refused ->
                        ProfileImageState.Failed(uri, outcome.errors.firstOrNull()?.message ?: REFUSED)
                    is Outcome.Failed -> ProfileImageState.Failed(uri, TRANSPORT)
                }
            }
            _state.update { it.copy(avatar = next) }
        }
    }

    /**
     * Save: the form's checks, then the change's seal — nothing is signed
     * before the seal's own commit (ProfileEdit.md, ProfileEditSeal.md:3).
     */
    fun onSubmit() {
        val s = _state.value
        if (s.stage != ProfileEditStage.Form || s.imagesPending) return
        // Every real press of Save takes the reserved line away (ProfileEdit.md:85),
        // even one that stops at a guard below.
        _state.update { it.copy(nameReserved = false) }
        if (s.displayName.isBlank()) {
            _state.update { it.copy(emptyName = true) }
            return
        }
        if (s.displayNameTooLong || s.bioTooLong || s.websiteUrlTooLong) return
        _state.update { it.copy(stage = ProfileEditStage.Seal, fault = null) }
    }

    /**
     * `Sign the change`: refuses a second press until the signing answers
     * (ProfileEditSeal.md:33). The signing runs in [ProfileChanges], so a seal
     * closed on it never cancels it (:73).
     */
    fun onSign() {
        val s = _state.value
        if (s.stage != ProfileEditStage.Seal || s.signing) return
        _state.update { it.copy(signing = true, fault = null) }
        val act = signingOf(s)
        viewModelScope.launch {
            val outcome = changes.sign(act)
            _state.update {
                when (outcome) {
                    ProfileChangeOutcome.Taken -> it.copy(signing = false, saved = true)
                    // The name's own line stands under its field, on the form (ProfileEdit.md:85).
                    ProfileChangeOutcome.NameReserved ->
                        it.copy(signing = false, stage = ProfileEditStage.Form, nameReserved = true)
                    ProfileChangeOutcome.Offline -> it.copy(signing = false, fault = ProfileSealFault.Offline)
                    ProfileChangeOutcome.WriteRule -> it.copy(signing = false, fault = ProfileSealFault.WriteRule)
                    ProfileChangeOutcome.Bug -> it.copy(signing = false, fault = ProfileSealFault.Bug)
                    // Another account is active: nothing was prepared or signed for it.
                    ProfileChangeOutcome.Foreign -> it.copy(signing = false)
                }
            }
        }
    }

    /**
     * The arrow, Back and the system gesture. On the seal before the press, the
     * edit comes back one stage behind (ProfileEditSeal.md:65-67); from the
     * press they close the seal and the change goes on (:73). Answers whether
     * the stage handled it; false means the route leaves.
     */
    fun onBack(): Boolean {
        val s = _state.value
        return when {
            s.signing -> {
                changes.close()
                false
            }
            s.stage == ProfileEditStage.Seal -> {
                _state.update { it.copy(stage = ProfileEditStage.Form, fault = null) }
                true
            }
            else -> false
        }
    }

    /** The header X: the flow is left (:69), or, from the press, the seal closes and the change goes on (:73). */
    fun onLeave() {
        if (_state.value.signing) changes.close()
    }

    /**
     * The seal can go without Back or the X — a sign-out or a session's end
     * clears the whole stack (CograNavGraph.kt, `popUpTo(0)`) — and the change
     * still goes on, its answer the head's (ProfileEditSeal.md:73-79). A
     * rotation never reaches here: the entry's ViewModel outlives it.
     */
    override fun onCleared() {
        if (_state.value.signing) changes.close()
    }

    /** A notice's `Not now` back to the seal as it stood before the press (:55, :63). */
    fun onNotNow() = _state.update { it.copy(fault = null) }

    /** The bug notice's `Not now`: the profile edit returns as it was left (:59). */
    fun onBugNotNow() = _state.update { it.copy(stage = ProfileEditStage.Form, fault = null) }

    /**
     * One signing of the change [s] holds: prepare, sign, and — taken — lay it
     * over the head (ProfileEditSeal.md:45). It closes over values only, never
     * this ViewModel, because it may outlive it and is what the head's Retry
     * signs again.
     */
    private fun signingOf(s: ProfileEditUiState): suspend (StillPressing) -> ProfileChangeOutcome {
        val sent = SentProfile(
            displayName = s.displayName.trim(),
            bio = s.bio.ifBlank { null },
            websiteUrl = s.websiteUrl.trim().ifBlank { null },
            avatar = s.avatar.toUpdate(),
        )
        val avatar = s.avatar as? ProfileImageState.Uploaded
        val ledger = avatar?.known?.let { mapOf(avatar.mediaId to it) }.orEmpty()
        val fields = sent.signedFields(s.avatar)
        val profileId = s.profileId
        val repository = profiles
        val writes = signer
        val head = signedProfile
        return act@{ pressing ->
            if (!pressing.holds()) return@act ProfileChangeOutcome.Foreign
            val prepared = when (
                val outcome = repository.prepareProfileUpdate(
                    displayName = sent.displayName,
                    bio = sent.bio,
                    websiteUrl = sent.websiteUrl,
                    avatar = sent.avatar,
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> return@act refusalOf(outcome.errors)
                is Outcome.Failed -> return@act ProfileChangeOutcome.Offline
            }
            // One profile update on this device's own profile, its payload held
            // to the fields this form sent and the avatar this device uploaded
            // (PayloadExpectation.kt).
            val profile = profileExpectation(profileId, sent, ledger)
            // The account may have changed while the prepare ran: never sign it
            // for another (the device would refuse it anyway, IntentCheck.kt).
            if (!pressing.holds()) return@act ProfileChangeOutcome.Foreign
            val signing = head.begin()
            val results = writes.sign(prepared, Expectation(listOf(profileUpdate(profile))))
            if (results.all { it is WriteResult.Done }) {
                // Taken: the profile shows the change from the return's first
                // frame (ProfileEditSeal.md:45) — exactly the fields it set.
                head.lay(signing, profileId, fields)
                ProfileChangeOutcome.Taken
            } else {
                outcomeOfUntaken(results)
            }
        }
    }

    /**
     * What this form's change set, as the head wears it: the form states its
     * full field set, so name, bio and website always; the picture only where
     * the form changed it — a new one or the explicit clear.
     */
    private fun SentProfile.signedFields(picture: ProfileImageState) = SignedProfileFields(
        displayName = displayName,
        bio = Setting(bio),
        websiteUrl = Setting(websiteUrl),
        avatar = when (picture) {
            ProfileImageState.Cleared -> Setting(null)
            is ProfileImageState.Uploaded -> Setting(SignedPicture(picture.mediaId, picture.url))
            is ProfileImageState.Held, is ProfileImageState.Picked, is ProfileImageState.Failed -> null
        },
    )

    internal companion object {
        /** D13's fixed crop: a circle-masked square. */
        const val AVATAR_RATIO = 1f

        const val UNREADABLE = "That file could not be read as a picture."

        /** The sentence the composers say, word for word. */
        const val TOO_BIG = "That picture is too big — a picture can be up to 10 MB."

        const val REFUSED = "The server would not take that picture."
        const val TRANSPORT = "The upload could not reach the server."
    }
}

/**
 * A refusal by its codes (copy-voice, *Faults by code*; the post seal's
 * `sealFaultOf`): the reserved name goes back to its field; the write rule is
 * its notice; anything else is a bug.
 */
private fun refusalOf(errors: List<UserError>): ProfileChangeOutcome = when {
    errors.any { it.code == ErrorCode.DISPLAY_NAME_RESERVED && it.field?.firstOrNull() == "displayName" } ->
        ProfileChangeOutcome.NameReserved
    errors.any { it.code == ErrorCode.WRITE_RULE_FAILED } -> ProfileChangeOutcome.WriteRule
    else -> ProfileChangeOutcome.Bug
}

/**
 * A signing that was not taken: a refusal reads by its codes; the device's own
 * refusal of bytes that were not what the form sent is a bug — nothing was
 * signed, and it is no fault of the network's; anything else never answered.
 */
private fun outcomeOfUntaken(results: List<WriteResult>): ProfileChangeOutcome {
    val refused = results.filterIsInstance<WriteResult.Refused>().firstOrNull()
    return when {
        refused != null -> refusalOf(refused.errors)
        results.any { it is WriteResult.RejectedByDevice } -> ProfileChangeOutcome.Bug
        else -> ProfileChangeOutcome.Offline
    }
}
