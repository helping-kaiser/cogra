// WALLET · NOT HERE YET — what the bar's wallet slot opens in V1.0
// (WalletComingSoon.jsx; WalletComingSoon.md; readme §13, *The V1.0 scope
// cut*). IT IS A TAB ROOT, drawn as one: the band above (chats and the bell
// for a reader; bare for a guest, chats asking to join), the coming-soon card
// on the brand wash, no back arrow and no action. One face for every reader
// state. web's twin is `web/src/app/wallet/wallet-view.tsx`.
//
// UNREGISTERED: nodes.json carries no `WalletComingSoon`; the screen wears
// its evident prefix, `wallet`, until design registers it.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.RootReselectEffect
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.core.designsystem.v2.atom.CograBandBell
import com.cogra.core.designsystem.v2.atom.CograBandChats
import com.cogra.core.designsystem.v2.atom.CograBandIdentity
import com.cogra.core.designsystem.v2.atom.ComingSoonCard
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space

/** The screen's evident prefix (unregistered). */
val WALLET = DataNode("wallet")

@Composable
fun WalletComingSoonScreen(
    /** The bar's wallet slot re-tapped over this root: scrolled, back to the top; at the top, nothing. */
    reselects: Int,
    /** The band's chats; a guest's asks to join (WalletComingSoon.md:13). */
    onChats: () -> Unit,
    /** The bell; null for a guest, whose band carries none (:11). */
    bell: BandBell?,
    modifier: Modifier = Modifier,
) {
    val list = rememberLazyListState()
    RootReselectEffect(reselects, list)
    val band = WALLET / "band"
    Column(modifier.fillMaxSize().dataNodeSurface()) {
        Row(
            modifier = Modifier
                .defaultMinSize(minHeight = Layout.TopBarHeight)
                .padding(horizontal = Space.x4)
                .dataNode(band),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            CograBandIdentity(Modifier.weight(1f), node = band)
            // The cluster's icons stand shoulder to shoulder (`CograBand.jsx`).
            Row(verticalAlignment = Alignment.CenterVertically) {
                CograBandChats(onChats, node = band)
                bell?.let { CograBandBell(it, node = band) }
            }
        }
        LazyColumn(state = list, modifier = Modifier.fillMaxSize().padding(top = Space.x2)) {
            item(key = "door") {
                ComingSoonCard(
                    headline = stringResource(R.string.content_wallet_coming_soon),
                    line = stringResource(R.string.content_wallet_line),
                    node = WALLET / "comingSoon",
                )
            }
        }
    }
}
