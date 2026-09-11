Use `ContentRow` for every list line in the product: a 40px disc, two lines of words, a trailing edge. The wallet's history, the campaigns list, the campaigns door and the chronicle are all this row.

```jsx
<ContentRow variant="campaign" title="Sunday at the tide market" second="Open · ends 8 Sep" image={cover} trailing="12,500" onOpen={openCampaign} />
<ContentRow variant="door" title="Campaigns" second="1 open · start a new one" glyph="campaign" onOpen={openCampaigns} />
<ContentRow variant="chronicle" title="Signed a post" titleAside="2 acts" second="Sunday at the tide market — four pictures…" glyph="history" trailing="4d" chevron={false} inert />
```

The wallet's history has its own name for this row — use [`LedgerRow`](../wallet/LedgerRow.prompt.md), which speaks money (`words`, `context`, `amount`, `pending`) over this master.

What holds:

- **The disc leads, by precedence** — a picture, else a monogram for a name, else a stance face, else the kind's glyph. It always sits in a 40px box that can carry a direction badge, whether or not this row wants one: a badge that moved the words when it appeared would give one list two rhythms.
- **The second line is ONE line, ellipsized, in every variant.** A row in a list is scanned, not read; the moment one row can be two lines tall the reader loses the rhythm that lets them skim past nine to find the tenth. Where the whole snippet matters, the row's destination is where it belongs.
- **A row is a control unless it is declared `inert`** — a record of something that happened has no destination, and it draws the same card with nothing to press.
- **The `door` variant's filled disc is deliberate.** It is the one row that is an entrance rather than an entry, and the fill says so without a word of chrome. Do not spread it to ordinary rows.
- Rows are card-lite (`surface-card`, medium radius) with 8px seams — the feed's rhythm, calmer.
