"use client";

// The compose wizard: pick → (crop) → details → seal.
//
// This component owns the three things a step cannot: the draft on the device,
// the uploads in flight, and the one signing pass at the end. The steps
// themselves are given values and callbacks and hold nothing, which is what
// keeps the flow's rules in `lib/compose/wizard.ts` where they can be tested.
//
// The wizard replaces the composer for CREATION only. Editing an existing post
// is still the 1.0 form: an edit is a different act with a different batch rule
// (D19 split it out as its own bite), and routing it through a body-first pick
// screen would ask an author to re-choose a body they already have.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { HeaderBar, HelpButton } from "@/lib/ui2/header-bar";
import { HelpDialog, HELP_TOPICS, type HelpTopic } from "@/lib/ui2/help-dialog";
import { PillButton } from "@/lib/ui2/pill-button";
import { preparePost } from "@/lib/api/content-api";
import { fetchReferenceCandidates } from "@/lib/api/references-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useKeyOnDevice } from "@/lib/identity/use-key-on-device";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { TransportError } from "@/lib/ui/transport-error";
import {
  advanceGate,
  attachmentIds,
  bodyContent,
  emptyWizard,
  sealGate,
  shapeRatio,
  wizardReducer,
  type PickedAsset,
  type WizardAction,
  type WizardState,
} from "@/lib/compose/wizard";
import {
  composeDraftStore,
  draftIsWorthKeeping,
  draftSummary,
  type ComposeDraftStore,
} from "@/lib/compose/draft-store";
import { runUpload } from "@/lib/compose/uploads";
import { usePreviewUrls } from "@/lib/compose/previews";
import { PickAction, PickStep } from "./pick-step";
import { CropStep } from "./crop-step";
import { DetailsStep } from "./details-step";
import { DescribeSheet } from "@/lib/ui2/compose/describe-sheet";
import { PickedSheet } from "@/lib/ui2/compose/picked-sheet";
import { SealStep, type SealSheet } from "./seal-step";

/** The refusal path shapes the batched sections use, down to their index. */
function pathIndex(field: readonly string[] | null, head: string): number | null {
  if (field === null || field.length < 2 || field[0] !== head) return null;
  const index = Number(field[1]);
  return Number.isInteger(index) ? index : null;
}

/** A stable empty list, so the preview effect does not re-run on every render. */
const NO_ASSETS: readonly PickedAsset[] = [];

const HEADINGS: Record<WizardState["step"], string> = {
  pick: "New post",
  crop: "Crop",
  details: "Details",
  seal: "What you sign",
};

export function ComposeWizard({
  store = identityStore,
  drafts = composeDraftStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
  drafts?: ComposeDraftStore;
}) {
  const client = useApolloClient();
  const router = useRouter();
  const guard = useAuthGuard();
  const signer = useWriteSigner();
  const keyOnDevice = useKeyOnDevice(store);

  const [state, setState] = useState<WizardState>(emptyWizard);
  const dispatch = useCallback((action: WizardAction) => {
    setState((current) => wizardReducer(current, action));
  }, []);

  /** A draft found on this device, offered before it is adopted. */
  const [offered, setOffered] = useState<WizardState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<SealSheet>("none");
  // Show all, and the describe sheet it can open. Describing holds an asset id
  // rather than an index so a remove or a reorder underneath it cannot silently
  // move the sheet onto a different picture.
  const [managing, setManaging] = useState(false);
  const [describing, setDescribing] = useState<string | null>(null);
  // Which explanation is open, if any — the `?`s share one dialog because only
  // one can be open at a time and each names its own topic.
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [transportFailed, setTransportFailed] = useState(false);
  const [tagErrors, setTagErrors] = useState<Readonly<Record<number, string>>>({});
  const [referenceErrors, setReferenceErrors] = useState<Readonly<Record<number, string>>>({});

  const previews = usePreviewUrls(state.assets);
  // The offered draft's own cover, which the card draws before the draft has
  // been adopted and its assets are still nobody's.
  const offeredPreviews = usePreviewUrls(offered?.assets ?? NO_ASSETS);

  // The Reference affordance: a detail surface sends the author here with the
  // node it wants cited, and the chip arrives prefilled. It resolves through
  // the finder's own lookup, so a miss simply leaves the section empty.
  const prefill = useSearchParams().get("reference");
  useEffect(() => {
    if (prefill === null) return;
    let cancelled = false;
    void fetchReferenceCandidates(client, prefill, 1).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      const candidate = outcome.value[0];
      if (candidate === undefined) return;
      setState((current) =>
        current.references.some((reference) => reference.targetId === candidate.targetId)
          ? current
          : { ...current, references: [...current.references, candidate] },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [client, prefill]);

  // ---- the draft on this device -------------------------------------------

  useEffect(() => {
    let cancelled = false;
    void drafts.load().then((draft) => {
      if (cancelled) return;
      if (draft !== null && draftIsWorthKeeping(draft)) setOffered(draft);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [drafts]);

  // THE DRAFT IS KEPT CONTINUOUSLY. Every meaningful change is written, and
  // leaving never discards — the only way a draft goes is the offer's Discard.
  //
  // The timer is a coalescing window, not a save policy: the draft carries the
  // picked bytes, and `save` reads every one of them back out of its Blob, so a
  // write per character typed would stutter the title field with ten pictures
  // attached. 200ms is short enough that a change is on disk before a reader
  // can reach for anything, and every departure flushes below regardless.
  // The departure handlers are bound once but must write what the draft holds
  // NOW, so the state is mirrored into a ref — updated in an effect, because a
  // ref written during render is a value React is free to discard.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  // ONCE THE POST HAS LANDED THERE IS NO DRAFT TO KEEP. The coalescing timer is
  // armed by the last change before signing and fires on its own schedule, so
  // without this latch it can land after the clear and put the published draft
  // straight back. Checked where each write actually happens rather than in the
  // effect body, because the write is what has to be stopped.
  const landed = useRef(false);

  const keep = useCallback(() => {
    if (landed.current || !loaded || offered !== null || !draftIsWorthKeeping(latest.current)) return;
    void drafts.save(latest.current);
  }, [loaded, offered, drafts]);

  useEffect(() => {
    if (!loaded || offered !== null || !draftIsWorthKeeping(state)) return;
    const timer = setTimeout(() => {
      if (landed.current) return;
      void drafts.save(state);
    }, 200);
    return () => clearTimeout(timer);
  }, [state, loaded, offered, drafts]);

  // Closing the tab, reloading, or switching away. `beforeunload` is not used:
  // it is unreliable on mobile, where a tab is far more often discarded than
  // closed. `visibilitychange` to hidden is the transition browsers do
  // guarantee, and `pagehide` covers the bfcache path.
  // (https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") keep();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", keep);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", keep);
    };
  }, [keep]);

  // ---- the uploads ---------------------------------------------------------

  // Which assets have been handed to `runUpload` already. A ref rather than
  // state because it must not re-run the effect that writes it — and because
  // React mounts effects twice in development, which without this would upload
  // every picture twice.
  const started = useRef(new Set<string>());
  const ratio = shapeRatio(state);
  // The crop is fixed once the reader leaves the crop screen, so that is when
  // the bytes can be encoded — earlier and every nudge would invalidate an
  // upload in flight.
  const uploading = state.step === "details" || state.step === "seal";

  useEffect(() => {
    if (!uploading) return;
    for (const asset of state.assets) {
      if (asset.upload.kind !== "waiting" || started.current.has(asset.id)) continue;
      started.current.add(asset.id);
      void runUpload(client, asset, ratio, (upload) =>
        dispatch({ type: "upload", id: asset.id, upload }),
      );
    }
  }, [uploading, state.assets, ratio, client, dispatch]);

  const retry = (id: string) => {
    started.current.delete(id);
    dispatch({ type: "upload", id, upload: { kind: "waiting" } });
  };

  // Re-cropping invalidates the bytes that were uploaded from the old framing,
  // so everything starts again. The orphaned assets are the server's to sweep —
  // they are attached to nothing (D5).
  //
  // This hangs off the step change rather than off a button: the picked row
  // carries no "Crop" shortcut any more (jakob 2026-08-31, "none"), so Back is
  // the only way to the crop step and it is where the invalidation belongs.
  const invalidateUploads = () => {
    started.current.clear();
    setState((current) => ({
      ...current,
      assets: current.assets.map((asset) => ({ ...asset, upload: { kind: "waiting" } })),
    }));
  };

  // ---- signing -------------------------------------------------------------

  const submit = async () => {
    setBusy(true);
    setRefusal(null);
    setTagErrors({});
    setReferenceErrors({});
    setTransportFailed(false);

    const prepared = await guard.run(() =>
      preparePost(client, {
        title: state.title.trim() === "" ? null : state.title,
        description: state.description.trim() === "" ? null : state.description,
        content: bodyContent(state),
        sensitive: state.sensitive,
        sensitiveReason: state.sensitiveReason,
        license: state.license,
        tags: state.tags,
        references: state.references,
        attachments: attachmentIds(state) ?? undefined,
      }),
    );

    if (prepared.kind === "failed") {
      setBusy(false);
      setTransportFailed(true);
      return;
    }
    if (prepared.kind === "refused") {
      setBusy(false);
      const perTag: Record<number, string> = {};
      const perReference: Record<number, string> = {};
      let general: string | null = null;
      for (const error of prepared.errors) {
        const tag = pathIndex(error.field, "tags");
        const reference = pathIndex(error.field, "references");
        if (tag !== null) perTag[tag] = error.message;
        else if (reference !== null) perReference[reference] = error.message;
        else general = general ?? error.message;
      }
      setTagErrors(perTag);
      setReferenceErrors(perReference);
      // A refusal that landed on a section is shown on that section's own chip,
      // so the seal only speaks when nothing else can.
      setRefusal(
        general ??
          (Object.keys(perTag).length + Object.keys(perReference).length > 0
            ? "Something in the details was refused."
            : "The server refused this write."),
      );
      if (Object.keys(perTag).length + Object.keys(perReference).length > 0) {
        dispatch({ type: "goto", step: "details" });
      }
      return;
    }

    await finish(prepared.value.node, prepared.value.writes);
  };

  const finish = async (node: string, writes: readonly StagedWriteView[]) => {
    const results = [];
    for (const staged of writes) results.push(await signer.signStaged(staged));
    setBusy(false);

    if (results.every((result) => result.kind === "done")) {
      // The draft has become a post, so it stops being a draft. The latch goes
      // up BEFORE the clear, so a save the reader's last keystroke armed cannot
      // slip in behind it.
      landed.current = true;
      await drafts.clear();
      // ComposeLanded is the POST'S OWN PAGE carrying a confirmation, not the
      // feed carrying a card: what an author wants after publishing is to see
      // the thing they published, and the board draws exactly that.
      router.push(`/posts/${node}?published=1`);
      return;
    }

    // The batch lands together or not at all, so one unlanded write means the
    // post did not land — and nothing was spent. The draft is kept exactly
    // because this screen promises it is.
    const expired = results.some(
      (result) =>
        result.kind === "refused" &&
        result.errors.some((error) => error.code === "STAGED_WRITE_EXPIRED"),
    );
    await drafts.save(state);
    if (expired) {
      router.push("/feed?compose=expired");
      return;
    }
    const refused = results.find((result) => result.kind === "refused");
    setRefusal(
      refused && refused.kind === "refused"
        ? (refused.errors[0]?.message ?? "The post wasn't signed.")
        : "The post wasn't signed. Nothing was spent.",
    );
  };

  // ---- rendering -----------------------------------------------------------

  const gate = advanceGate(state);
  const seal = sealGate(state);

  // The arrow: ONE STAGE BACK, never out of the flow (jakob, round 4). From the
  // first stage there is no stage to step to, so that one lands on the feed.
  const leave = () => {
    const previous = state.step;
    // Leaving keeps the draft — written here rather than left to the coalescing
    // timer, which the navigation would otherwise outrun.
    keep();
    // Stepping back off Details lands on Crop in a media post, and whatever was
    // uploaded came from the framing the author is about to change.
    if (previous === "details" && state.mode === "media") invalidateUploads();
    dispatch({ type: "back" });
    if (previous === "pick") router.push("/feed");
  };

  // The X: OUT OF THE FLOW from any stage, draft kept, NO confirmation —
  // nothing is lost, and the draft prompt is the return surface. Without it an
  // author five stages deep was stuck backing out tap by tap.
  const leaveFlow = () => {
    keep();
    router.push("/feed");
  };

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        <HeaderBar title="New post" onBack={() => router.push("/feed")} backLabel="Back to feed" />
        <p className="px-6">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <HeaderBar
        title={HEADINGS[state.step]}
        onBack={leave}
        backLabel={state.step === "pick" ? "Back to feed" : "Back a step"}
        onLeave={leaveFlow}
        // The seal board's `?`, opening the house help dialog with copy-voice's
        // "Signed actions". One `?` per screen, so only the seal carries one.
        help={
          state.step === "seal" ? (
            <HelpButton onOpen={() => setHelp(HELP_TOPICS.signedActions)} label="Signed actions" />
          ) : undefined
        }
        action={
          state.step === "pick" ? (
            <PickAction onNext={() => dispatch({ type: "advance" })} disabled={!gate.ok} />
          ) : state.step === "crop" ? (
            <PillButton testId="wizard-next" size="sm" onClick={() => dispatch({ type: "advance" })}>
              Next
            </PillButton>
          ) : state.step === "seal" ? (
            // The seal carries no forward pill — signing happens on the surface
            // — but the board still names where the reader has got to.
            <span className="text-body-small text-on-surface-variant">Last step</span>
          ) : undefined
        }
        testId="wizard-header"
      />

      {offered !== null && (
        <DraftCard
          draft={offered}
          previews={offeredPreviews}
          onContinue={() => {
            setState(offered);
            setOffered(null);
          }}
          onDiscard={() => {
            setOffered(null);
            void drafts.clear();
          }}
        />
      )}

      {/* The other way out of the offer, said rather than drawn: the pick screen
          below is already the way to start fresh, so this names it instead of
          adding a second control that would compete with Continue. Discarding
          is the card's own affordance and the only route to it. */}
      {offered !== null && (
        <div className="flex flex-none items-center gap-2 px-6 py-2">
          <p
            data-testid="wizard-draft-fresh"
            className="m-0 flex-1 text-body-medium text-on-surface-variant"
          >
            Or start fresh — pick one picture, several, or one video.
          </p>
        </div>
      )}

      {transportFailed && (
        <div className="px-6">
          <TransportError testId="wizard-transport-error" />
        </div>
      )}

      {state.step === "pick" && (
        <PickStep
          mode={state.mode}
          words={state.words}
          assets={state.assets}
          previews={previews}
          error={gate.ok ? null : gate.reason}
          onWords={(words) => dispatch({ type: "words", words })}
          onMode={(mode) => dispatch({ type: "mode", mode })}
          onPick={(files) =>
            dispatch({
              type: "pick",
              assets: files.map((file, index) => ({
                id: `${Date.now()}-${index}-${file.name}`,
                file,
              })),
            })
          }
          onUnpick={(id) => dispatch({ type: "unpick", id })}
          onManage={() => setManaging(true)}
        />
      )}

      {state.step === "crop" && (
        <CropStep
          assets={state.assets}
          previews={previews}
          shape={state.shape}
          focused={state.focused}
          onShape={(shape) => dispatch({ type: "shape", shape })}
          onFocus={(index) => dispatch({ type: "focus", index })}
          onCrop={(id, crop) => dispatch({ type: "crop", id, crop })}
        />
      )}

      {state.step === "details" && (
        <DetailsStep
          mode={state.mode}
          assets={state.assets}
          previews={previews}
          title={state.title}
          description={state.description}
          tags={state.tags}
          references={state.references}
          tagErrors={tagErrors}
          referenceErrors={referenceErrors}
          onTitle={(title) => dispatch({ type: "title", title })}
          onDescription={(description) => dispatch({ type: "description", description })}
          onTags={(tags) => dispatch({ type: "tags", tags })}
          onReferences={(references) => dispatch({ type: "references", references })}
          onManage={() => setManaging(true)}
          onDescribe={() => setDescribing(state.assets[0]?.id ?? null)}
          onRetry={retry}
          onRemove={(id) => dispatch({ type: "unpick", id })}
          onNext={() => dispatch({ type: "advance" })}
        />
      )}

      {state.step === "seal" && (
        <SealStep
          state={state}
          sheet={sheet}
          blocked={seal.ok ? null : seal.reason}
          busy={busy}
          keyOnDevice={keyOnDevice}
          refusal={refusal}
          onSheet={setSheet}
          onLicense={(license) => dispatch({ type: "license", license })}
          onPDirected={(pDirected) => dispatch({ type: "pDirected", pDirected })}
          onSensitive={(sensitive) => dispatch({ type: "sensitive", sensitive })}
          onSensitiveReason={(sensitiveReason) =>
            dispatch({ type: "sensitiveReason", sensitiveReason })
          }
          onHelp={() => setHelp(HELP_TOPICS.markingAsSensitive)}
          onSign={() => void submit()}
          onBack={() => dispatch({ type: "back" })}
          onRestoreKey={() => router.push("/restore")}
        />
      )}

      {/* Show all and the describe sheet live on the wizard rather than inside a
          step, because both are reached from more than one screen and a sheet
          owned by a step would close when the step changed under it. */}
      <PickedSheet
        open={managing}
        onClose={() => setManaging(false)}
        items={state.assets.map((asset) => ({
          id: asset.id,
          src: previews[asset.id] ?? null,
          altText: asset.altText === "" ? null : asset.altText,
          described: asset.altText.trim() !== "",
        }))}
        onDescribe={(id) => setDescribing(id)}
        onRemove={(id) => dispatch({ type: "unpick", id })}
        onMove={(from, to) => dispatch({ type: "reorder", from, to })}
        testId="wizard-picked-sheet"
      />

      <DescribeSheet
        open={describing !== null}
        onClose={() => setDescribing(null)}
        src={describing === null ? null : (previews[describing] ?? null)}
        value={state.assets.find((asset) => asset.id === describing)?.altText ?? ""}
        onChange={(altText) => {
          if (describing !== null) dispatch({ type: "altText", id: describing, altText });
        }}
        position={{
          index: state.assets.findIndex((asset) => asset.id === describing),
          total: state.assets.length,
        }}
        testId="wizard-describe-sheet"
      />

      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help ?? HELP_TOPICS.signedActions}
        testId="wizard-help"
      />
    </main>
  );
}

// ComposeDraft — the card that sits above a fresh pick screen when this device
// is already holding an unpublished post.
function DraftCard({
  draft,
  previews,
  onContinue,
  onDiscard,
}: {
  draft: WizardState;
  previews: Readonly<Record<string, string>>;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const summary = draftSummary(draft);
  const cover = draft.assets[0];
  return (
    <div
      data-testid="wizard-draft-card"
      className="mx-6 my-2 flex flex-none flex-col gap-2 rounded-medium bg-surface-container-highest p-4"
    >
      <h2 className="m-0 text-title-medium">Your draft is here</h2>
      <div className="flex items-center gap-2">
        {cover !== undefined && (
          <div className="size-10 flex-none overflow-hidden rounded-small">
            {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL
                for bytes that never left the device. */}
            <img
              src={previews[cover.id] ?? ""}
              alt=""
              className="block size-full object-cover"
            />
          </div>
        )}
        <span className="flex flex-1 flex-col">
          <span className="text-body-medium">{summary.title}</span>
          <span className="text-body-small text-on-surface-variant">{summary.detail}</span>
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <PillButton testId="wizard-draft-discard" variant="text" onClick={onDiscard}>
          Discard
        </PillButton>
        <PillButton testId="wizard-draft-continue" onClick={onContinue}>
          Continue
        </PillButton>
      </div>
    </div>
  );
}
