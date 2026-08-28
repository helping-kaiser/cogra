Use `OrderSection` as the ordering section of ANY filter sheet — the feed's and search's, which are ruled identical. Never redraw the swap or the seen toggle by hand in a sheet.

```jsx
<OrderSection order={order} onOrder={setOrder} seen={seen} onSeen={setSeen} />
```

- **Order does not combine.** Ranked or Newest, a two-option `SegmentedFilter` — never chips.
- **The seen toggle rides in the same section**, a `Checkbox` reading "Show what you've already seen", default off — what you've seen stays out until you ask for it back. Seen means the card's impression entered the viewport — device-local, never a record, shared transiently with the viewer's chosen ranker. Showing seen is the deviation; the trigger says "showing seen" only then.
- **`FilterSection` is the one sheet-section chrome.** Any other section a filter sheet draws (kinds, forms, also-show) uses it too, so the feed's sheet and search's sheet stay one anatomy.
