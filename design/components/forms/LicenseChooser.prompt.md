Use `LicenseChooser` in a composer that creates content (post, comment) and `LicenseTerms` on the read surface that shows it. An edit never shows the chooser — the license is immutable once declared.

```jsx
<LicenseChooser value={license} onChange={setLicense} name="compose" />
<LicenseTerms license={post.license} />
```

Only the three published readings per axis are offered: a free numeric input would ask authors to price a degree the platform has no reading for. Public domain says `Public domain — no obligation on reuse` rather than listing two absences.
