// THE COMING-SOON DOOR (design/components/states/ComingSoonCard.jsx over
// `WashCard ghost={false}`): what a slot opens while the surface behind it is
// drawn after V1.0. A card on the brand wash (`--surface-hero`), a headline
// built as the thing, an em dash and `coming soon`, then one line of what will
// be there — and NO ACTION: nothing a reader can do fills a door that is not
// open yet, and the shell around it is the way on.
//
// The master spells the promise itself, so no door can phrase it differently.

export function ComingSoonCard({
  thing,
  line,
  testId,
}: {
  thing: string;
  line: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="relative mx-4 flex flex-none flex-col gap-2 overflow-hidden rounded-large p-5"
      style={{ background: "var(--surface-hero)" }}
    >
      <h2 className="m-0 text-headline-small">{thing} — coming soon</h2>
      <p className="m-0 text-body-medium">{line}</p>
    </div>
  );
}
