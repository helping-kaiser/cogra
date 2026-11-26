// `ProfileEditSeal` — the profile change's "What you sign" moment
// (design/designs/canonical/screens/ProfileEditSeal.jsx, behavior/ProfileEditSeal.md).
// Every profile change is a signed act, so Save opens this seal and nothing is
// signed before its own commit. The page is the profile seals' one drawing,
// [ProfileSealPage], which `AvatarSeal` shares; this is the edit's reading of it:
// `Your profile` beside the picture the change leaves, one acts-card row
// `Profile` saying what the change holds, counted `1 profile change`, and the
// header's "?" `Changing your profile` (:3-:19, :31).

package com.cogra.feature.profile

import androidx.compose.runtime.Composable
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.media.CograAvatar

/** The board's registered prefix (nodes.json `profileEditSeal`). */
internal val EDIT_SEAL = DataNode("profileEditSeal")

internal const val SEAL_HEAD = "Your profile"
internal const val SEAL_ROW_LABEL = "Profile"
internal const val SEAL_ROW_NOUN = "profile change"

/** The header's "?" (copy-voice, *Changing your profile*, blessed jakob 2026-11-17). */
internal const val CHANGING_YOUR_PROFILE = "Changing your profile"
private val CHANGING_YOUR_PROFILE_TEXT = listOf(
    "Your profile is a public record, and changes to it are signed actions in your name.",
    "Everything you change here signs together, as one change, paid for like your posts. " +
        "The record that you changed it stays, like every signed action.",
)

@Composable
internal fun ProfileEditSealStage(state: ProfileEditUiState, actions: ProfileSealActions) {
    ProfileSealPage(
        reading = ProfileSealReading(
            node = EDIT_SEAL,
            tagPrefix = "profile_edit_seal",
            head = SEAL_HEAD,
            rowLabel = SEAL_ROW_LABEL,
            rowValue = state.changeSummary,
            rowNoun = SEAL_ROW_NOUN,
            helpTitle = CHANGING_YOUR_PROFILE,
            helpParagraphs = CHANGING_YOUR_PROFILE_TEXT,
        ),
        status = ProfileSealStatus(signing = state.signing, fault = state.fault),
        actions = actions,
    ) {
        // The picture the change leaves; the monogram where it removes it (:11).
        CograAvatar(
            name = state.displayName,
            size = SEAL_PICTURE,
            url = state.avatar.previewUrl,
            testTag = "profile_edit_seal_picture",
        )
    }
}
