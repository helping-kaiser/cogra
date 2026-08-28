Use `SearchBar` only at the top of the Explore tab — the one search surface. It is M3's search bar (a 48px pill on the container surface with a leading glyph), not a `TextField` variant; an inner surface needing text input uses `TextField`.

```jsx
<CograBand>
  <SearchBar query={query} placeholder="Search people, posts, topics…" onChange={setQuery} />
</CograBand>
```

Queries may open with the scope operators — `@handle <text>` or `#topic <text>` (readme §13, the search rulings); the bar renders them as plain text, the client parses them. Without `onChange` the bar renders statically (prototype boards): the query text plus a standing caret.
