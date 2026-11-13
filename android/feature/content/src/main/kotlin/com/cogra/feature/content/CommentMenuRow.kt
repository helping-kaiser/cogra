package com.cogra.feature.content

import com.cogra.core.designsystem.DataNode

/**
 * The rows a comment's menu can hold, by the names their sheet nodes take
 * (`postDetail.menuSheet.citedBy`, `history.menuSheet.edit`).
 */
internal enum class CommentMenuRow(val nodeName: String) {
    Save("save"),
    Cite("cite"),
    Edit("edit"),
    Remove("remove"),
    CitedBy("citedBy"),
    Opinions("opinions"),
    License("license"),
    Report("report"),
}

/**
 * Where a comment's menu stands: the sheet it raises and which of its rows
 * that host's boards register. A row outside [rows] keeps its per-comment tag
 * (`comment_menu_<row>_<id>`), so an unregistered row never borrows a path.
 */
internal data class CommentMenuPlacement(val sheet: DataNode, val rows: Set<CommentMenuRow>) {
    companion object {
        /** Every row: the thread (CommentMenu, CommentMenuOwn), History, a profile's Comments tab. */
        val ALL: Set<CommentMenuRow> = CommentMenuRow.entries.toSet()
    }
}
