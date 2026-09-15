package com.cogra.feature.content

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.domain.LicenseChoice

/**
 * THE ROWS THE ONE MENU HOLDS — the author's post vs someone else's
 * (`_shared.jsx:369-376`). Both keep the card's order: the acts the menu
 * was opened for lead, and the license closes it, the license being the
 * rarest read in the product.
 *
 * THE MENU IS THE POST'S, NOT THE SCREEN'S. `PostCard.jsx:257` draws it on
 * every non-detail card and `_shared.jsx:337-341` takes it off the detail's,
 * where the top bar carries the one menu instead — so a feed card and a
 * detail's app bar build the same two row sets. They live here rather than
 * in either caller, because a second copy is how the two drift.
 *
 * ROWS WHOSE DESTINATION IS NOT BUILT YET STAND ANYWAY and do nothing
 * (jakob 2026-09-14, the introduced-but-inert law): a menu that grew a
 * row per slice would be a different menu every release, and the row
 * order is ruled. `Save` waits on slice 2.6's `setBookmark`, the hide
 * row on its `hideActor`; `Mark as sensitive` and `Remove` wait on the
 * slices that own them — removal whole, in slice 8's erasure half.
 *
 * @param testTagPrefix scopes the rows to their surface — `detail_menu`
 *   gives `detail_menu_save`, and a feed card names itself per post so two
 *   cards' rows are never one tag.
 */
@Composable
internal fun postMenuRows(
    own: Boolean,
    handle: String?,
    license: LicenseChoice?,
    onEdit: () -> Unit,
    onCite: () -> Unit,
    onRemove: () -> Unit,
    onLicense: () -> Unit,
    testTagPrefix: String,
): List<MenuRow> = buildList {
    add(MenuRow(stringResource(R.string.content_menu_save), "${testTagPrefix}_save") {})
    if (own) {
        add(MenuRow(stringResource(R.string.content_edit), "${testTagPrefix}_edit", onEdit))
        // SENSITIVE STAYS IN EDIT (jakob 2026-09-14): marking a published
        // post sensitive is always a signed action changing the post — an
        // edit — so there is no standalone commit path and this row is a
        // door into the edit flow rather than a sheet of its own. Edit is
        // the general door; this is the intentioned one. When the edit
        // surface's drawn Sensitive row lands (CW-46) the link can focus it.
        add(
            MenuRow(
                stringResource(R.string.content_menu_sensitive),
                "${testTagPrefix}_sensitive",
                onEdit,
            ),
        )
        add(MenuRow(stringResource(R.string.content_menu_remove), "${testTagPrefix}_remove", onRemove))
    } else {
        add(MenuRow(stringResource(R.string.content_menu_cite), "${testTagPrefix}_cite", onCite))
        // THE HIDE ROW NAMES ITS PERSON (`ActorChip.jsx:67`): the handle is
        // what a reader recognises, and the word they will look for again
        // under Hidden accounts. A redacted author has none.
        val hide = if (handle == null) {
            stringResource(R.string.content_menu_hide_account)
        } else {
            stringResource(R.string.content_menu_hide_actor, "@$handle")
        }
        add(MenuRow(hide, "${testTagPrefix}_hide") {})
    }
    // The license rode the payload, so a redacted record has none to show
    // (`PostCard.jsx:142`).
    if (license != null) {
        add(
            MenuRow(
                stringResource(R.string.content_menu_license),
                "${testTagPrefix}_license",
                onLicense,
            ),
        )
    }
}
