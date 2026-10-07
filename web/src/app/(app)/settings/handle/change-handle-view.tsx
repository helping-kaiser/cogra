"use client";

// CHANGE YOUR HANDLE (design/designs/canonical/screens/ChangeHandle.jsx and
// ChangeHandleConfirm.jsx, `ChangeHandleBody` in `_shared.jsx`; their
// sidecars). No password is asked. A press with a handle that breaks the
// rules says so on the field and opens nothing; a well-formed one asks first,
// in a think-twice dialog naming the cost with the old handle.
//
// SEAM 053.8 LIVES HERE: the dialog's `Change it` is what sends, so
// `HANDLE_TAKEN` arrives after it — the dialog closes onto the form and the
// field reads `That handle is taken.`, nothing changed. While the change is
// in flight the dialog holds: `Change it` refuses a second press without
// dimming, Keep it, the scrim, Back and Escape do nothing, and the label
// reads `Changing handle…` only past 200ms. No answer keeps the dialog up
// with the line in it and `Change it` reading `Retry` (the sidecar; seam
// contradiction K1 with graph.json:2119 builds by the sidecar).

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { hasCode } from "@/lib/api/outcome";
import { changeHandle, fetchSettingsAccount } from "@/lib/api/settings-api";
import { handleValid } from "@/lib/onboarding/registration-rules";
import { useAuthGuard } from "@/lib/session/runtime";
import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { DialogSurface } from "@/lib/ui2/dialog-surface";
import { FormTextField } from "@/lib/ui2/form-fields";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { useSlowAnswer, WaitingCommit } from "@/lib/ui2/waiting-commit";

import { NO_ANSWER, NOT_THROUGH, TaskPage } from "../task-page";

const NODE: DataNode = { path: "changeHandle" };
const FORMAT_LINE = "A handle is 3–30 characters: a–z, 0–9, _.";
const TAKEN_LINE = "That handle is taken.";

export function ChangeHandleView() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();

  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  /** `format` re-checks live; `taken` stands until the next press. */
  const [error, setError] = useState<{ kind: "format" | "taken"; line: string } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogLine, setDialogLine] = useState<string | null>(null);
  const commitRef = useRef<HTMLDivElement | null>(null);
  const slow = useSlowAnswer(busy);

  useEffect(() => {
    void guard.run(() => fetchSettingsAccount(client)).then((outcome) => {
      if (outcome.kind === "success") setCurrent(outcome.value.handle);
    });
  }, [client, guard]);

  const folded = value.trim().toLowerCase();

  const onChange = (next: string) => {
    // Handles are always lowercase; the hint says so, so the fold is no surprise.
    setValue(next.toLowerCase());
    if (error?.kind === "format" && handleValid(next)) setError(null);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (value === "") return;
    if (!handleValid(value)) {
      setError({ kind: "format", line: FORMAT_LINE });
      return;
    }
    setError(null);
    setDialogLine(null);
    setAsking(folded);
  };

  const closeDialog = () => {
    if (busy) return;
    setAsking(null);
    setDialogLine(null);
    queueMicrotask(() => commitRef.current?.querySelector("button")?.focus());
  };

  const onChangeIt = async () => {
    if (busy || asking === null) return;
    setBusy(true);
    setDialogLine(null);
    const outcome = await guard.run(() => changeHandle(client, asking));
    setBusy(false);
    if (outcome.kind === "success") {
      router.push("/settings?done=handle");
      return;
    }
    if (hasCode(outcome, "HANDLE_TAKEN")) {
      setAsking(null);
      setError({ kind: "taken", line: TAKEN_LINE });
      return;
    }
    if (hasCode(outcome, "BAD_INPUT")) {
      setAsking(null);
      setError({ kind: "format", line: FORMAT_LINE });
      return;
    }
    setDialogLine(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
  };

  const old = current === null ? "" : `@${current}`;

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Change your handle"
      lead={`${old} is how people mention and find you. Everything you have published stays yours — the handle is a name, not the account.`}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <div className="mt-8">
          <FormTextField
            label="New handle"
            kind="handle"
            enterKeyHint="go"
            value={value}
            onChange={onChange}
            hint="3 to 30 characters: letters, numbers and underscore. Handles are always lowercase."
            error={error?.line ?? null}
            node={part(NODE, "handle")}
          />
        </div>
        <div className="mt-6" ref={commitRef}>
          <WaitingCommit
            label="Change handle"
            busyLabel="Change handle"
            reason="Waiting for a new handle"
            waiting={value === ""}
            node={part(NODE, "commit")}
          />
        </div>
        <div className="mt-6">
          <QuietNote node={part(NODE, "note")}>
            Links to your old handle stop working the moment you change it, and anyone can claim it
            afterwards.
          </QuietNote>
        </div>
      </form>

      {asking !== null && (
        <DialogSurface
          title={`Change your handle to @${asking}?`}
          body={[
            `Links to ${old} stop working the moment it changes, and anyone can claim ${old} afterwards.`,
          ]}
          onDismiss={closeDialog}
          locked={busy}
          node={part(NODE, "dialog")}
          actions={
            <>
              <button
                type="button"
                onClick={() => void onChangeIt()}
                aria-busy={busy || undefined}
                aria-disabled={busy || undefined}
                className={buttonClassName({ variant: "text" })}
                {...testAttributes(part(NODE, "dialog.change"))}
              >
                {slow ? "Changing handle…" : dialogLine === NO_ANSWER ? "Retry" : "Change it"}
              </button>
              <button
                type="button"
                onClick={closeDialog}
                aria-disabled={busy || undefined}
                className={buttonClassName({ variant: "primary" })}
                {...testAttributes(part(NODE, "dialog.keep"))}
              >
                Keep it
              </button>
            </>
          }
        >
          {dialogLine !== null && (
            <p role="alert" className="m-0 mt-4 text-body-medium text-error" data-testid="changeHandle-dialog-fault">
              {dialogLine}
            </p>
          )}
        </DialogSurface>
      )}
    </TaskPage>
  );
}
