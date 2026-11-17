package com.cogra.feature.content

import androidx.compose.runtime.Composable
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.repo.ContentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/**
 * ONE COMMENT, READ AFRESH — the card that settles an edit signed off the
 * thread ([EditReturn]). The same read the edit itself opens on (`CommentFields`),
 * so the card wears exactly what any list would serve, its landing included.
 * Null when the comment is gone or the read did not answer: the card then
 * stands as listed.
 */
@HiltViewModel
class CommentRereadViewModel @Inject constructor(private val content: ContentRepository) : ViewModel() {
    suspend fun reread(id: String): CommentView? =
        (content.commentForEdit(id) as? Outcome.Success)?.value?.comment
}

/** The route's re-read of one comment, for its host's [EditReturn]. */
@Composable
fun rememberCommentReread(): suspend (String) -> CommentView? = hiltViewModel<CommentRereadViewModel>()::reread
