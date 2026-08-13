import type { ReactNode } from "react";

export function Card({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-md border border-outline-variant p-4"
    >
      {children}
    </section>
  );
}
