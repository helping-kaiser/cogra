package com.cogra.feature.content

import com.cogra.domain.feed.FeedKind

/** A tag picker that records every gesture a screen hands it, in order. */
class RecordingTagPicker : TagPickerHandlers {
    val calls = mutableListOf<String>()

    override fun onOpenTagPicker() {
        calls += "open"
    }

    override fun onCloseTagPicker() {
        calls += "close"
    }

    override fun onTagPickerQueryChange(query: String) {
        calls += "query:$query"
    }

    override fun onRetryTagIndex() {
        calls += "retry"
    }

    override fun onStageTag(name: String) {
        calls += "stage:$name"
    }

    override fun onUnstageTag(name: String) {
        calls += "unstage:$name"
    }
}

/** The citation picker's twin of [RecordingTagPicker]. */
class RecordingReferencePicker : ReferencePickerHandlers {
    val calls = mutableListOf<String>()

    override fun onOpenReferencePicker() {
        calls += "open"
    }

    override fun onCloseReferencePicker() {
        calls += "close"
    }

    override fun onReferencePickerQueryChange(query: String) {
        calls += "query:$query"
    }

    override fun onReferenceKindsChange(kinds: Set<FeedKind>) {
        calls += "kinds:${kinds.sorted().joinToString(",")}"
    }

    override fun onRetryCandidates() {
        calls += "retry"
    }

    override fun onStageReference(row: ReferenceCandidateRow) {
        calls += "stage:${row.targetId}"
    }

    override fun onUnstageReference(targetId: String) {
        calls += "unstage:$targetId"
    }
}
