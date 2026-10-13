// The vouch-back pad variant (`VouchBackPad`), written once for every place
// the vouch-back opens from: the feed's vouch card (VouchBack.md:31) and the
// profile of the member who vouched the account in (ProfileOther.md:35). The
// web's twin is `lib/vouch/vouch-back.ts`.

package com.cogra.feature.stance

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePadVariant

/**
 * The pad the vouch-back opens as: titled and its `?` named `Your vouch
 * back` (VouchBackPad.md:9), its own line on every open (:13), its own help
 * in place (:21), no Walk it back (:11), parked 16dp above the bar (:3).
 */
@Composable
fun vouchBackVariant(padNode: DataNode? = null): StancePadVariant = StancePadVariant(
    title = stringResource(R.string.vouch_back_title),
    help = listOf(
        stringResource(R.string.vouch_back_help_1),
        stringResource(R.string.vouch_back_help_2),
    ),
    note = stringResource(R.string.vouch_back_note),
    padNode = padNode,
)
