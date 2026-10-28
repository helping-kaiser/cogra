package com.cogra.feature.content

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.domain.LicenseChoice

/**
 * THE ROWS THE ONE MENU HOLDS — the author's post vs someone else's
 * (`_shared.jsx:597-605`). Both keep the card's order: the acts the menu
 * was opened for lead, and the license closes the author's.
 *
 * REPORT SITS AT THE TAIL OF EVERY OTHER-PERSON MENU, below even the
 * license (ruling 75; `_shared.jsx:586-596`): the one row a reader reaches
 * for about someone else's conduct rather than about using the thing. Own
 * menus carry none — a reader has nothing to report themselves for.
 *
 * THE MENU IS THE POST'S, NOT THE SCREEN'S. `PostCard.jsx:262` draws it on
 * every non-detail card and `_shared.jsx:341-346` takes it off the detail's,
 * where the top bar carries the one menu instead — so a feed card and a
 * detail's app bar build the same two row sets. They live here rather than
 * in either caller, because a second copy is how the two drift.
 *
 * ROWS WHOSE DESTINATION IS NOT BUILT YET STAND ANYWAY and do nothing
 * (jakob 2026-09-14, the introduced-but-inert law): a menu that grew a
 * row per slice would be a different menu every release, and the row
 * order is ruled.
 *
 * @param onShare THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK
 *   (design/readme.md, jakob 2026-09-17, sharpened 2026-09-22 — PR #794):
 *   strictly below 360dp the affordance row's Share control folds into
 *   this menu instead, leading the sheet. Null where it does not apply —
 *   own posts have no drawn board for it, and at 360dp and above the row
 *   keeps it.
 * @param onReport the report row's door — the confirm over the surface the
 *   menu was opened from, or the join prompt for a guest. Null where the
 *   surface hosts no confirm yet, and the row then stands inert.
 * @param testTagPrefix scopes the rows to their surface — `detail_menu`
 *   gives `detail_menu_save`, and a feed card names itself per post so two
 *   cards' rows are never one tag.
 * @param rowNode the registered node a row wears on a registered sheet
 *   (`feed.menuSheet.save`), or null for a row the board does not register —
 *   that row keeps its [testTagPrefix] tag.
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
    onShare: (() -> Unit)?,
    testTagPrefix: String,
    onReport: (() -> Unit)? = null,
    rowNode: (PostMenuRow) -> DataNode? = { null },
    /**
     * The first row's words and act — `Save` or `Unsave` as the post is kept
     * (`saveMenuRow`, the one save behaviour every menu shares). Null stands
     * the row inert, for a host rendered outside the app's graph.
     */
    saveRow: MenuRow? = null,
    /**
     * The reader menu's hide act (`SavedHost.hideAct`, the one hide behaviour
     * every menu shares). Null stands the row inert.
     */
    onHide: (() -> Unit)? = null,
): List<MenuRow> {
    fun tag(row: PostMenuRow, legacy: String): String = rowNode(row)?.tag ?: "${testTagPrefix}_$legacy"
    val save = stringResource(R.string.content_menu_save)
    val cite = stringResource(R.string.content_menu_cite)
    val edit = stringResource(R.string.content_edit)
    val sensitive = stringResource(R.string.content_menu_sensitive)
    val remove = stringResource(R.string.content_menu_remove)
    val licenseLabel = stringResource(R.string.content_menu_license)
    val report = stringResource(R.string.content_menu_report)
    val share = stringResource(R.string.content_menu_share)
    // THE HIDE ROW NAMES ITS PERSON (`ActorChip.jsx:67`): the handle is
    // what a reader recognises, and the word they will look for again
    // under Hidden accounts. A redacted author has none.
    val hide = if (handle == null) {
        stringResource(R.string.content_menu_hide_account)
    } else {
        stringResource(R.string.content_menu_hide_actor, "@$handle")
    }
    return buildList {
        // SHARE LEADS THE SHEET, ahead of Save: every other row here is a menu
        // row by nature, and share is the one that was a one-tap control a
        // moment ago (design/readme.md). Only the reader's menu gains it — no
        // board draws it leaving the author's own.
        if (!own && onShare != null) {
            add(MenuRow(share, "${testTagPrefix}_share", onShare))
        }
        add(MenuRow(saveRow?.label ?: save, tag(PostMenuRow.Save, "save"), saveRow?.onSelect ?: {}))
        // CITE STANDS SECOND ON BOTH MENUS (`_shared.jsx:414-420`, backlog
        // item 100): self-citation is a real authorial act, so the thumb
        // finds one row in one place on every menu that has it.
        add(MenuRow(cite, tag(PostMenuRow.Cite, "cite"), onCite))
        if (own) {
            add(MenuRow(edit, tag(PostMenuRow.Edit, "edit"), onEdit))
            // SENSITIVE STAYS IN EDIT (jakob 2026-09-14): marking a published
            // post sensitive is always a signed action changing the post — an
            // edit — so there is no standalone commit path and this row is a
            // door into the edit flow rather than a sheet of its own. Edit is
            // the general door; this is the intentioned one. When the edit
            // surface's drawn Sensitive row lands (CW-46) the link can focus it.
            add(MenuRow(sensitive, tag(PostMenuRow.MarkSensitive, "sensitive"), onEdit))
            add(MenuRow(remove, tag(PostMenuRow.Remove, "remove"), onRemove))
        } else {
            add(MenuRow(hide, tag(PostMenuRow.Hide, "hide"), onHide ?: {}))
        }
        // The license rode the payload, so a redacted record has none to show
        // (`PostCard.jsx:146-148`).
        if (license != null) {
            add(MenuRow(licenseLabel, tag(PostMenuRow.License, "license"), onLicense))
        }
        if (!own) {
            add(MenuRow(report, tag(PostMenuRow.Report, "report"), onReport ?: {}))
        }
    }
}
