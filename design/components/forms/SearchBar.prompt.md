Use `SearchBar` at the head of a surface that searches: the Explore tab, and the two pickers that search to stage — the tag picker and the citation picker. It is M3's search bar (a 48px pill on the container surface with a leading glyph), not a `TextField` variant; any other surface needing text input uses `TextField`.

```jsx
<CograBand>
  <SearchBar query={query} placeholder="Search people, posts, tags…" onChange={setQuery} />
</CograBand>
<SearchBar query={name} placeholder="Name a tag" ariaLabel="Name a tag" onChange={setName} />
```

**The name is the use's, never the placeholder.** A placeholder leaves when the reader types, so `ariaLabel` names the field per use — `Search` on Explore (the default), `Name a tag` in the tag picker, `Cite something` in the citation picker.

Queries may open with the scope operators — `@handle <text>` or `#tag <text>` (readme §13, the search rulings); the bar renders them as plain text, the client parses them. Without `onChange` the bar renders statically (prototype boards): the query text plus a standing caret, the name riding the text.
