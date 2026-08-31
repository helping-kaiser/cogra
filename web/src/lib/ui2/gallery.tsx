"use client";

// The component gallery: every 2.0 component in every variant, on one surface.
//
// WHY A COMPONENT AND NOT A ROUTE. Stage 1 adds no pages, and a preview route
// would be one. This is the gallery's content as a component, so stage 2 can
// mount it at whatever path it likes (or a review build can) without stage 1
// having decided that. `gallery.test.tsx` renders it whole, which is what keeps
// every variant here honest: a variant that stops rendering fails the suite.
//
// The repo has no Storybook, Ladle, or Histoire — this is the substitute, and
// the absence is recorded in the PR rather than papered over.

import { useState } from "react";

import { BottomSheet, SheetItem } from "./bottom-sheet";
import { Chip } from "./chip";
import { HeaderBar, HelpButton } from "./header-bar";
import { ListRow, StancePair } from "./list-row";
import { MonogramAvatar } from "./monogram-avatar";
import { PillButton, TextAction } from "./pill-button";
import { TextField } from "./text-field";
import { POST_SHAPES, POST_SHAPE_ORDER } from "./media/aspect";
import { BodyVeil } from "./media/body-veil";
import { CENTERED, type Crop } from "./media/crop";
import { CropFrame } from "./media/crop-frame";
import { MediaGallery } from "./media/media-gallery";
import { MediaTile } from "./media/media-tile";
import { RemovedPlaceholder } from "./media/removed-placeholder";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-outline-variant pt-6">
      <h2 className="text-title-medium text-on-surface-variant">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function ComponentGallery() {
  const [shape, setShape] = useState<(typeof POST_SHAPE_ORDER)[number]>("tall");
  const [crop, setCrop] = useState<Crop>(CENTERED);
  const [title, setTitle] = useState("Salt maps of the coast road");
  const [description, setDescription] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [license, setLicense] = useState("public-domain");

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-6 p-6">
      <h1 className="text-headline-small">2.0 components</h1>

      <Section title="Header">
        <HeaderBar
          title="Crop"
          onBack={() => {}}
          help={<HelpButton onOpen={() => {}} label="About the crop" />}
          action={
            <PillButton testId="gallery-header-next" size="sm">
              Next
            </PillButton>
          }
        />
        <HeaderBar title="Recovery code" />
      </Section>

      <Section title="Buttons">
        <Row>
          <PillButton testId="gallery-filled">Next</PillButton>
          <PillButton testId="gallery-outlined" variant="outlined">
            Cancel
          </PillButton>
          <PillButton testId="gallery-text" variant="text">
            Keep browsing
          </PillButton>
          <PillButton testId="gallery-disabled" disabled>
            Set
          </PillButton>
        </Row>
        <Row>
          <PillButton testId="gallery-sm" size="sm">
            Next
          </PillButton>
          <TextAction testId="gallery-action">Write words instead</TextAction>
        </Row>
        <PillButton testId="gallery-full" full>
          Sign and publish
        </PillButton>
      </Section>

      <Section title="Chips">
        <Row>
          {POST_SHAPE_ORDER.map((key) => (
            <Chip
              key={key}
              testId={`gallery-shape-${key}`}
              selected={shape === key}
              onClick={() => setShape(key)}
            >
              {POST_SHAPES[key].label}
            </Chip>
          ))}
        </Row>
        <Row>
          <Chip testId="gallery-topic" selected onDismiss={() => {}} dismissLabel="Remove #coastroad">
            #coastroad
          </Chip>
          <Chip testId="gallery-add-topic">Add a topic</Chip>
        </Row>
      </Section>

      <Section title="Fields">
        <TextField
          label="Title"
          optional
          value={title}
          onChange={setTitle}
          testId="gallery-title"
        />
        <TextField
          label="Description"
          optional
          multiline
          value={description}
          onChange={setDescription}
          placeholder="Words beside the pictures go here."
          testId="gallery-description"
        />
        <TextField
          label="Handle"
          value="a"
          onChange={() => {}}
          testId="gallery-invalid"
          error="Handles are 3–30 characters."
        />
      </Section>

      <Section title="People">
        <Row>
          <MonogramAvatar name="Mira" size={24} />
          <MonogramAvatar name="Sol" size={40} />
          <MonogramAvatar name="Ada" size={64} />
          <MonogramAvatar name="Noa" src="/broken.jpg" size={40} />
        </Row>
      </Section>

      <Section title="Rows">
        <ListRow
          mark={<MonogramAvatar name="Ada" size={24} />}
          title="The long way home — @ada"
          kind="Post"
          trailing={<StancePair face="🙂" reading="Like this" forAgainst={0.1} reaches={0.1} />}
          testId="gallery-row"
          onOpen={() => {}}
          onDismiss={() => {}}
        />
        <ListRow mark={<span>#</span>} title="#saltmarsh" kind="Topic" />
      </Section>

      <Section title="Sheet">
        <PillButton testId="gallery-open-sheet" variant="outlined" onClick={() => setSheetOpen(true)}>
          Open the license sheet
        </PillButton>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="The license">
          {["public-domain", "credit", "credit-and-record"].map((key) => (
            <SheetItem
              key={key}
              testId={`gallery-license-${key}`}
              selected={license === key}
              onSelect={() => setLicense(key)}
            >
              {key}
            </SheetItem>
          ))}
        </BottomSheet>
      </Section>

      <Section title="Media — tiles">
        <MediaTile label="Wide 1.91:1" sourceRatio={1.91} testId="gallery-tile-wide" />
        <MediaTile label="Square" sourceRatio={1} testId="gallery-tile-square" />
        <MediaTile label="Tall 4:5" sourceRatio={4 / 5} testId="gallery-tile-tall" />
        {/* Taller than the cap: fitted whole, bars on the reserved surface. */}
        <MediaTile label="9:16, capped at 4:5" sourceRatio={9 / 16} testId="gallery-tile-capped" />
      </Section>

      <Section title="Media — galleries">
        <MediaGallery
          items={[{ label: "One", sourceRatio: 1 }]}
          testId="gallery-one"
        />
        <MediaGallery
          items={[
            { label: "1", sourceRatio: 1 },
            { label: "2", sourceRatio: 1 },
            { label: "3", sourceRatio: 1 },
          ]}
          testId="gallery-three"
        />
        <MediaGallery
          items={Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}`, sourceRatio: 1 }))}
          testId="gallery-many"
        />
      </Section>

      <Section title="Honesty states">
        <BodyVeil reason="Injured seabird">
          <div className="flex flex-col gap-2">
            <MediaTile label="The body" sourceRatio={1} />
            <p className="text-body-medium">
              The whole body veils as one — media, text, and description together.
            </p>
          </div>
        </BodyVeil>
        <RemovedPlaceholder reason="author" when="12 March" />
        <RemovedPlaceholder reason="platform" when="12 March" />
      </Section>

      <Section title="Crop">
        <CropFrame src="/gallery-placeholder.jpg" shape={shape} crop={crop} onChange={setCrop} />
      </Section>
    </div>
  );
}
