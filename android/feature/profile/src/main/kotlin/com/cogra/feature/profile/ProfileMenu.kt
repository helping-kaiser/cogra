// THE PROFILE'S ⋮ AND THE THREE SHEETS IT OPENS (ProfileOwnMenu.md,
// ProfileMenu.md, ProfileDeletedMenu.md; `_shared.jsx` `ownProfileMenu`,
// `otherProfileMenu`, `deletedProfileMenu`). The dot closes the profile's
// actions row (`profile.identity.actionRow.menu`) on all three. web's twin is
// `web/src/app/u/[handle]/profile-menu.tsx`.
//
// - The reader's own profile: Saved, History, Share your profile — the
//   private state's one door. No Report row: the own menus' rule.
// - Another person's: Save or Unsave, Mention in a new post, Share this
//   profile, Hide @handle, and Report at the tail.
// - A deleted account's: Save or Unsave, Share this profile, Hide this
//   account, Report — no Mention row and no handle anywhere.
//
// BUILT WHOLE, WIRED IN PART (saved-surface SS-1; the introduced-but-inert
// law, jakob 2026-09-14): History waits on the History surface, Mention on
// the wizard's profile reference, and — on
// this platform — Report on the report confirm reaching the profile (it lives
// in the content feature). Those rows stand at full strength and do nothing
// yet; the hand-test notes name each.

package com.cogra.feature.profile

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.CograOverflowMenu
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.domain.ProfileView
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.feature.saved.SavedHost

private val PROFILE = DataNode("profile")
private val SHEET = PROFILE / "menuSheet"

/** Which of the three sheets the ⋮ opens. */
enum class ProfileMenuKind { OWN, OTHER, DELETED }

@Composable
internal fun ProfileMenu(
    kind: ProfileMenuKind,
    profile: ProfileView,
    saved: SavedHost?,
    onOpenSaved: () -> Unit,
    onShare: () -> Unit,
    /** The guest gate a signed-out reader's rows open; null when signed in. */
    onRequireAccount: (() -> Unit)?,
) {
    val inert: () -> Unit = {}
    val gated: (() -> Unit) -> () -> Unit = { act -> { onRequireAccount?.invoke() ?: act() } }
    val save = saved?.menuRow(profile.id, profile.viewerBookmarkedAt, (SHEET / "save").tag)
        ?: MenuRow(stringResource(R.string.profile_menu_save), (SHEET / "save").tag, gated(inert))
    val share = stringResource(R.string.profile_menu_share_this)
    val report = MenuRow(stringResource(R.string.profile_menu_report), (SHEET / "report").tag, gated(inert))
    // HIDING KEEPS THE READER ON THE PROFILE (ProfileMenu.md:23): the person
    // leaves the feed, the page stays, and its snackbar offers Undo. A deleted
    // account's row and snackbar name no one (ProfileDeletedMenu.md:19).
    val person = HiddenPerson(
        id = profile.id,
        handle = profile.handle.takeUnless { kind == ProfileMenuKind.DELETED },
        displayName = profile.displayName.value,
        avatarUrl = profile.avatar?.url,
        redacted = kind == ProfileMenuKind.DELETED,
    )
    val hideAct = saved?.hideAct(person, profile.id) ?: gated(inert)
    val items = when (kind) {
        ProfileMenuKind.OWN -> listOf(
            MenuRow(stringResource(R.string.profile_menu_saved), (SHEET / "saved").tag, onOpenSaved),
            // INERT until History is built (saved-surface D4 / History's H3).
            MenuRow(stringResource(R.string.profile_menu_history), (SHEET / "history").tag, inert),
            MenuRow(stringResource(R.string.profile_menu_share_yours), (SHEET / "share").tag, onShare),
        )

        ProfileMenuKind.OTHER -> listOf(
            save,
            // INERT until the wizard takes a profile as a staged reference.
            MenuRow(stringResource(R.string.profile_menu_mention), (SHEET / "mention").tag, gated(inert)),
            MenuRow(share, (SHEET / "share").tag, onShare),
            MenuRow(stringResource(R.string.profile_menu_hide, "@${profile.handle}"), (SHEET / "hide").tag, hideAct),
            report,
        )

        ProfileMenuKind.DELETED -> listOf(
            save,
            MenuRow(share, (SHEET / "share").tag, onShare),
            MenuRow(stringResource(R.string.profile_menu_hide_account), (SHEET / "hide").tag, hideAct),
            report,
        )
    }
    CograOverflowMenu(
        items = items,
        contentDescription = when (kind) {
            ProfileMenuKind.OWN -> stringResource(R.string.profile_menu_own)
            ProfileMenuKind.OTHER -> stringResource(R.string.profile_menu_other, "@${profile.handle}")
            ProfileMenuKind.DELETED -> stringResource(R.string.profile_menu_deleted)
        },
        testTag = (PROFILE / "identity" / "actionRow" / "menu").tag,
        sheetNode = SHEET,
        // `placement="row"`: 40dp beside the row's buttons, answering at 48.
        inRow = true,
        // The sheet's own name (`BottomSheet` `ariaLabel`): `Profile actions` over
        // another's page or a deleted account's, `More on your profile` over your own.
        sheetLabel = stringResource(
            if (kind == ProfileMenuKind.OWN) R.string.profile_menu_own else R.string.profile_menu_sheet,
        ),
    )
}
