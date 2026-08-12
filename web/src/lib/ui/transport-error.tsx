// The house connectivity alert. One home for the transport copy —
// surfaces with deliberately different wording pass `message`.

export function TransportError({ testId, message }: { testId: string; message?: string }) {
  return (
    <p role="alert" data-testid={testId} className="text-sm text-red-600 dark:text-red-400">
      {message ?? "Can't reach the server. Check your connection and try again."}
    </p>
  );
}
