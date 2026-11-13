// A text matcher for words a long-name helper split into parts
// (`lib/ui/names.tsx`): Testing Library's default matcher reads an element's
// own text nodes, so `@ada commented on your post` drawn as
// [the handle][the words] no longer matches as one string. This one matches
// the innermost element whose whole text is `text`.

export function wholeText(text: string) {
  return (_content: string, element: Element | null): boolean =>
    element !== null &&
    element.textContent === text &&
    [...element.children].every((child) => child.textContent !== text);
}
