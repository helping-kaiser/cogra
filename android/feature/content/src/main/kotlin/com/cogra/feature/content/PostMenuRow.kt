package com.cogra.feature.content

/**
 * The rows a post menu can hold, by the names their sheet nodes take
 * (`feed.menuSheet.save`, `postDetail.menuSheet.markSensitive`).
 */
internal enum class PostMenuRow(val nodeName: String) {
    Save("save"),
    Cite("cite"),
    Hide("hide"),
    License("license"),
    Report("report"),
    Edit("edit"),
    MarkSensitive("markSensitive"),
    Remove("remove"),
}
