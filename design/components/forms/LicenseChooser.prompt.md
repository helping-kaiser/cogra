Use `LicenseChooser` in a composer that creates content (post, comment) and `LicenseTerms` in the sheet a read surface opens from its `License terms` menu row. An edit never shows the chooser — the license is immutable once declared.

```jsx
<LicenseChooser value={license} onChange={setLicense} name="compose" />
<LicenseTerms license={post.license} />
```

Only the three published readings per axis are offered: a free numeric input would ask authors to price a degree the platform has no reading for. Both axes at zero puts `Public domain` on the caption line; the two rows still spell what it means, so every license reads the same way.
