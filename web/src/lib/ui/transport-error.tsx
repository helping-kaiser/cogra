// The house connectivity alert. One home for the transport copy —
// surfaces with deliberately different wording pass `message`.

// Which read fetch last completed with a fault, on surfaces that
// paginate. The fault surfaces where that fetch was requested — a
// failed refresh on the banner above the content, a failed page fetch
// in place of the load-more control (web.md "Design guidelines").
export type TransportFault = "refresh" | "append";

export function TransportError({ testId, message }: { testId: string; message?: string }) {
  return (
    <p role="alert" data-testid={testId} className="text-sm text-error">
      {message ?? "Can't reach the server. Check your connection and try again."}
    </p>
  );
}
