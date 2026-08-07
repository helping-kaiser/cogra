import type { ReactNode } from "react";

export function Card({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
    >
      {children}
    </section>
  );
}
