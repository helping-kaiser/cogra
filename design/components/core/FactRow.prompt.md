Use `FactRow` for every hairline line that reads *label · value* — the seal's list of what a signature carries, the wallet's facts about a campaign.

```jsx
<FactRow label="License" value="Public domain — your default" action="Change" onAction={openLicense} />
<FactRow label="Your opinion" value={<StanceReadout pair={pair} />} action="Adjust" onAction={openPad} />
<FactRow label="Sensitive" value="Not marked" action="Mark" onAction={openSensitive} last />
```

```jsx
<FactRow emphasis="ledger" label="Deposit" value={<MoneyFigure amount={12500} />} />
<FactRow emphasis="ledger" label="When it settles" value="One public record" last />
```

**The emphasis says which half is the quiet one.** In `seal` the reader is checking a list of things they are about to sign, so the labels are what they read down: the label keeps `on-surface`, the value goes quiet, and the rules **enclose** the block — one above every row and one below the `last`. In `ledger` the label is the question and the value is the answer: the label goes quiet, the value right-aligns in `on-surface`, and the rules **separate**, sitting under every row but the `last`, because the block already stands inside a card.

- **A string value gets the variant's voice; a node keeps its own** in `seal` — a `StanceReadout` is a face and a pair, not a sentence, and a text wrapper around it would be a second opinion about its colour. In `ledger` every value wears the answer's voice, figures included.
- **The action is an `InlineAction`, never a `Button`.** The row holds one line by ruling, and a pill's 64px minimum is what wraps it.
- The 44px minimum is the row's rhythm, not a tap target: the row is not pressable, and the word at its end brings its own 48px.
- **A row that reads a state reads it in the value and renames the action** (backlog item 99, ruled the batch-rulings round). Sensitive is `value="Not marked" action="Mark"` at rest and `value="Marked" action="Change"` once a mark exists — both states are on this component's card. It gets no third word for clearing: the sheet behind the row carries the switch that takes the mark off, and a row offering the undo beside the door would make undoing the easier of the two.
