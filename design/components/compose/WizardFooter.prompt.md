The foot of a wizard step whose content runs edge to edge.

```jsx
<WizardFooter onNext={next}/>
<WizardFooter label="Next" onNext={next}/>
```

**It owns the side padding because nothing above it does.** The pick step's grid and tray band reach both edges, so there is no padded column for a footer to sit in — the 24px sides live in the footer itself, along with 12 above and 16 below. A step that IS drawn as a padded column does not use this: its Next button sits in the column and takes the margins already there.

**Three feet, three anatomies.** `SealFooter` owns no padding at all, deliberately — it is dropped into a padded column, and carrying its own would double the margins. A sheet's Done row (`ComposeLicense`) is a hairline, a summary line and a button sharing one row inside the sheet's own inset. This one is the third: the only region on an edge-to-edge step that must not touch the edge.

**The word is the step's, not the button's.** `label` defaults to `Next`, which is what every board drawing this footer says today.
