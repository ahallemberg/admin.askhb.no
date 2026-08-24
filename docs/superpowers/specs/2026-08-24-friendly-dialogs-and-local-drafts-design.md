# Friendly confirmations, save feedback, and local draft persistence

Date: 2026-08-24

## Problem

Three rough edges in the editor, which turn out to share a solution.

1. **Deletes do not ask.** The trash button on an organisation, project or
   education card removes the entry on the first click, and there is no undo
   anywhere in the app.
2. **The prompts that do exist are browser-native.** The four discard-changes
   prompts are `window.confirm` and the three save outcomes are `alert`. They are
   unstyleable, sit outside the app's visual language, and on the save path block
   the page to say something that does not need blocking.
3. **An unsaved draft does not survive a refresh.** Close the tab, reload, or lose
   the connection mid-save and every edit since the last successful save is gone.
   R2 keeps no versions, so there is nothing to recover from.

## What local persistence does and does not fix

Persisting the draft removes the data-loss dimension of a failed save, not the
whole failure. `savePortfolio` fires four independent PUTs with no transaction:

- **Total failure** — nothing landed, the draft survives a refresh, retry later.
  Genuinely solved.
- **Partial failure** — some files landed and some did not, so askhb.no is serving
  inconsistent content. The draft is safe and a retry pushes the rest, but nothing
  can un-publish the half that landed.

So persistence changes what the failure message *says* rather than removing the
need for one. It stops being "you may have lost work" and becomes "the site is
inconsistent until you save again". That still has to be impossible to miss,
which is why it is a banner and not a toast.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Delete interaction | Confirm dialog | Predictable, one component covers every site. An undo toast was rejected: missing it means reloading, which costs every other unsaved edit. |
| What gets confirmed | Anything that destroys something you cannot reconstruct | A flat "confirm every destructive-looking control" inverted the coverage — it prompted on clearing a link, which destroys nothing, and stayed silent on replacing a photo, which is permanent. |
| Conflict detection | A re-fetch at save time, compared against the draft's fork point | The load-time check alone is blind to the window that actually loses data: R2 moving between page load and save. |
| Stale fork point | Stored alongside the draft, and never rebased | A rebased fork point warns once and then goes quiet while the danger remains. |
| Save results | Toast on success, persistent banner on failure | Nothing important auto-disappears; nothing trivial blocks. |
| Change count | Counted per entry, with ids held parallel to the data | Matching entries by name reports a rename as a delete plus an add, and collides on the blank names new entries start with. |
| `beforeunload` warning | Keep | Weaker now, but unsaved still means askhb.no is showing the old content. |

## Architecture

### New modules

| File | Purpose |
|---|---|
| `src/components/ConfirmDialog.tsx` | Presentational modal. Owns no state. |
| `src/components/ConfirmProvider.tsx` | Holds the pending request, renders the one dialog, provides the context. |
| `src/func/confirmContext.ts` | `createContext` and the `useConfirm` hook. |
| `src/components/StaleDraftDialog.tsx` | The per-file conflict resolver. Deliberately not a `useConfirm` caller — see below. |
| `src/components/Toast.tsx` | The transient success message. |
| `src/components/Notice.tsx` | One header strip: tone, message, optional action, optional dismiss. |
| `src/func/draftStorage.ts` | Read, write and clear the persisted draft. Every access guarded. |
| `src/func/changes.ts` | Describe the difference between two portfolios as a list of changes. |
| `src/func/entryIds.ts` | Mint and carry the parallel entry ids. |

`confirmContext.ts` is split from the provider because the lint rule that keeps
fast refresh working objects to a module exporting both a component and a
non-component.

`ConfirmProvider` is mounted in `App.tsx`, wrapping `PortfolioEditor`. That is the
whole change to that file.

### Confirmation

`useConfirm()` returns an async function taking a request and resolving to a
boolean:

```ts
type ConfirmRequest = {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;    // default 'Confirm'
    cancelLabel?: string;     // default 'Cancel'
    tone?: 'danger' | 'warning';
};
```

The four existing discard handlers keep their shape exactly — `if (!(await
confirm({...}))) return;` — a one-line change each.

Because this replaces `window.confirm`, it re-earns what that gave for free:
Escape and a backdrop click cancel, `role="alertdialog"` with the title wired
through `aria-labelledby`, focus moved in on open and trapped while open, Cancel
focused by default so a stray Return never deletes, and focus returned to the
trigger on close.

**Focus restoration needs a fallback.** Confirming a card delete unmounts the very
button that opened the dialog; focusing a detached node is a no-op and focus falls
to `body`, restarting keyboard navigation at the top of the document — a
regression against `window.confirm`. On close, check `document.contains(trigger)`
and fall back to that section's "Add …" button when it is gone.

**The dialog is portalled to `document.body` with an explicit stacking level.**
`EditorDialog` is fixed to the viewport and creates its own stacking context; a
confirm rendered as a sibling subtree would sit above it only by accident of tree
shape. A portal makes it a guarantee.

Note that `EditorDialog` itself has no focus trap and no Escape handler today.
That is left as-is, but it means Escape closes a confirm and does nothing to the
editor dialog behind it. Worth revisiting separately; not part of this work.

Only one request is held at a time. **A second request while one is pending
throws in development and resolves to `cancel` in production**, rather than
silently resolving `false` — see the StrictMode note under Load for why the
silent version is dangerous.

#### What gets confirmed, and why

The rule is **confirm anything that destroys something you cannot reconstruct**,
not "confirm anything with a trash icon". Applied:

**Confirmed — the content is gone and you would have to retype it:**

| Site | Note |
|---|---|
| Organisation / project / education card delete | Names the entry; for an organisation, its role count |
| Role removal in `OrganisationDialog` | A role is title, dates, description and skills |
| The four discard-changes prompts | Unchanged wording; `PersonalInfoDialog` keeps its photo-replaced variant verbatim |
| Discard changes (the new header button) | Lists what is about to be lost |

**Confirmed — the bucket object is overwritten the moment you pick a file, and
there is no versioning and no DELETE to get it back:**

| Site | Note |
|---|---|
| `ProfilePictureField` replace | Fixed key; the previous photo is permanently gone. `CLAUDE.md` already says so |
| `CvSection` replace | Fixed key; same shape |
| `ImageUploadField` replace | Only when the new file's computed key equals the current value's key — a different filename writes a new object and destroys nothing, so it needs no prompt |
| The first save after a date migration | Rewrites dates and regroups every experience bucket-wide. `describeMigration` already has the copy |

**Not confirmed — nothing is destroyed:**

| Site | Why |
|---|---|
| `ImageUploadField` remove | Clears a link; the object stays in the bucket, and dialog Cancel undoes the field |
| `CvSection` remove | Clears `cvUrl`; the PDF stays reachable, and Discard restores the field |
| `EducationDialog.removeDescription`, `RoleEditor.removeSkill`, `ProjectDialog.removeSkill`, `LinksEditor` remove-link | Dialog-local, one field, undone by Cancel and trivially retyped |

This replaces an earlier "one rule, no exceptions" framing. That rule was not
actually kept — it confirmed the harmless removes while leaving the destructive
replaces silent, and it had no answer for the four dialog-local removes above.

### Entry identity

Entries have no ids: `Organisation`, `EducationItem` and `ProjectItem` are
positional arrays keyed only by human-readable fields. Describing a change by
matching on those fields fails in three ways — a rename reads as a delete plus an
add and names an entry that no longer exists; new entries start blank
(`BLANK_ORGANISATION.company` is `''`) so two of them collide; and duplicates are
legitimate, since two stints at one employer is the shape the organisation model
exists to express.

So ids are minted client-side. **They live parallel to the data, never inside
it:**

```ts
type EntryIds = { experiences: string[]; education: string[]; projects: string[] };
```

index-aligned with the corresponding arrays, snapshotted alongside
`savedSnapshot`, and persisted in the draft envelope.

**An id field inside `PortfolioData` would be a bug, not a shortcut.** Ids are
minted per load, so `deepEqual` against anything derived from R2 would differ on
the ids alone: the staleness check would fire on every reload and `isDirty` would
be permanently true after a restore. Keeping them outside also means the PUT path
needs no stripping step, which matters because that is the path where mistakes
are unrecoverable.

This mirrors `OrganisationDialog`'s existing `KeyedRole` handling one level up,
including its reason for minting outside the state updater: StrictMode invokes
updaters twice and an id generated inside one advances the counter for a value
React discards.

The nine handlers that mutate a section array (add, delete, reorder, per section)
each mutate the matching id array identically. That symmetry is the invariant;
`entryIds.ts` exposes the operations so it is enforced in one place rather than
nine.

### Change description

`changes.ts` turns two portfolios plus their id arrays into a list:

```ts
type Change = { kind: 'added' | 'edited' | 'deleted' | 'reordered'; label: string };
```

One change is **one entry affected**, one section reordered, personal information,
or the CV link. An entry edited in five fields counts once — the number answers
"how much am I about to publish", which is a question about entries.

Matching is by id, so a rename is one edit. Reordering is detected by comparing id
order, content-independent: `DraggableList` rebuilds the array on any drop where
the indices differ, including a drop that lands an entry back where it started, so
"the reorder handler fired" is not the same question as "the order changed".

The count renders as a pill in the header that opens to name each change, and the
Discard dialog lists the same set.

**`saveFailed` is not a change and must not be counted.** After a partial failure
followed by Discard, `portfolio` equals `savedSnapshot` so the list is empty,
while `isDirty` is still true because R2 really is mixed. Rendering that as "0
unsaved changes" is wrong. The count is computed from the change list alone, and
the mixed-bucket state is its own always-visible strip.

### Draft persistence

One key — `askhb-admin-draft` — holding a versioned envelope:

```ts
type StoredDraft = {
    version: number;
    savedAt: number;
    saveFailed: boolean;          // the bucket was left mixed by this draft's last save
    failedFiles: string[];
    base: PortfolioData;          // what R2 held when this draft forked
    baseIds: EntryIds;
    draft: PortfolioData;
    draftIds: EntryIds;
};
```

`version` guards the shape. A mismatch discards the blob rather than migrating it,
which also guarantees a restored draft never re-enters the load-time migration
path: it is already grouped and already normalised, and `CLAUDE.md` is explicit
that `groupExperiences` must not run twice.

`readDraft` validates `draft` before returning — the envelope parses, the version
matches, `draft` has a `personalInfo` object and three arrays, and a non-empty
`experiences` satisfies `isOrganisationArray`. The same level of rigour as
`isOrganisationArray` itself, which tests only the first element. Anything else
returns null and the blob is dropped; the editor has no error boundary, so a
corrupt blob reaching render would blank the page.

**`base` is validated only as "parses and is an object".** It is never rendered
and never saved — it is only ever fed to `deepEqual` — so validating it as
strictly as `draft` would throw away a good draft over a field nothing reads.

Guarded access follows the pattern `previewTheme.ts` already establishes.

#### `base` is sticky, and that is the whole point

Two different "what R2 holds" values, and collapsing them is a data-loss bug:

- **`savedSnapshot`** — what R2 is believed to hold *now*, set by a successful load
  and by a fully successful save. Drives `isDirty`, exactly as today.
- **`draftBase`** — what R2 held when the *current draft* forked. New state, and
  **not** rebased when a draft is restored.

Writing `base: savedSnapshot` instead makes the warning erase its own evidence:

1. R2 holds **A**. Edits make draft **D**. Stored: `base: A`.
2. R2 becomes **B**, edited elsewhere.
3. Next load warns correctly. The author picks *Keep my draft*.
4. A single-variable write effect rewrites storage as `base: B`.
5. The tab closes without saving.
6. **The next load compares B against B and says nothing** — while `D` is still
   forked from A.

`draftBase` is assigned in exactly four places and nowhere else: both branches of
the load, a fully successful save, and Discard. The write effect only reads it.

The warning is derived, not remembered, so *Keep* needs no acknowledgement flag:

```ts
const hasDraft = savedSnapshot !== null && !deepEqual(portfolio, savedSnapshot);
const isStale  = hasDraft && !deepEqual(draftBase, savedSnapshot);
```

Gating on `hasDraft` covers an author who edits back to what the bucket holds:
there is then nothing pending to overwrite, so a warning would be a lie.

### Load

**The existing load is unchanged.** It still fetches, still runs the migration,
still sets `savedSnapshot` from the fetch, and `savePortfolio` still refuses to run
while `isLoading || loadError`. All three guards `CLAUDE.md` calls load-bearing
survive untouched. The restore adds to the load rather than changing it.

1. Fetch and normalise as today into `loaded`. `savedSnapshot = loaded`, ids
   minted.
2. No valid stored draft, or its `draft` equals `loaded` — set `portfolio` and
   `draftBase` to `loaded` and clear storage. Identical to today.
3. `draft` differs from `loaded` — restore it, and set **`draftBase` to the stored
   `base`, not to `loaded`**. Then:
   - stored `base` equals `loaded` — ordinary case. A notice gives the draft's age
     and offers Discard.
   - stored `base` differs — **the bucket moved under the draft.** Open
     `StaleDraftDialog` (below). Dismissing without choosing keeps the draft, and
     `isStale` holds a warning in the header for as long as the divergence lasts,
     across reloads.
   - the envelope's `saveFailed` is set — the divergence is the author's own
     half-landed save, not another session. The dialog says so, naming
     `failedFiles`, rather than implying someone else edited the bucket.
4. **The fetch failed — do not touch storage.** The draft waits for a load that
   works.

**The load effect needs a cancellation flag.** It is `useEffect(..., [])` with no
guard today, and StrictMode double-invokes it in development. With a
promise-based confirm in that path, both invocations reach the stale branch: the
first opens the dialog, the second hits the one-request-at-a-time rule and — under
a "resolve false" policy — silently discards the draft while the first dialog is
still on screen. Add `let ignore = false` with a cleanup that sets it, and bail
before every `setState`. Worth doing on its own merits.

#### `StaleDraftDialog` resolves per file, not all-or-nothing

`PortfolioData`'s four keys map one-to-one onto the four PUTs, so the granularity
is already there. For each key:

- `base[k]` equals `draft[k]` — the draft never touched this file. Take `loaded[k]`
  silently. No question.
- `base[k]` differs from `draft[k]`, and `base[k]` equals `loaded[k]` — the draft
  changed it and nobody else did. Keep the draft's. No question.
- both differ — a genuine conflict. Ask.

That turns a four-file scare into at most one real question and removes the
blanket clobber, where "Keep" would otherwise PUT all four files and destroy
another session's edits to a file this draft never touched.

This is a bespoke dialog rather than a `useConfirm` caller: it was never a
boolean, it names files, and it wants a choice per conflict.

### Write

One effect, with dependencies `[portfolio, savedSnapshot, draftBase, entryIds]`:

- `savedSnapshot` is null (the load has not resolved) — do nothing
- `portfolio` equals `savedSnapshot` **and `saveFailed` is false** — clear storage
- otherwise — write the envelope with `base: draftBase`

**The dependency list is load-bearing and easy to get wrong.** A successful save
calls `setSavedSnapshot(portfolio)` with the *same object reference*, so
`portfolio` does not change identity. An effect keyed on `[portfolio]` alone would
not re-run, and storage would never be cleared after a successful save — leaving an
envelope with a stale `savedAt` and a `base` two states behind. It self-heals on
the next load, which makes it worse: the bug is invisible in manual testing.
`react-hooks/exhaustive-deps` is active and will demand the full list; do not
silence it.

The effect **reads** `draftBase` and never assigns it. Assigning from here would
reintroduce the rebasing bug by the back door.

**The `saveFailed` clause matters.** Discarding after a partial failure makes
`portfolio` equal `savedSnapshot`, and clearing storage there would lose the only
record that the bucket is mixed — `saveFailed` is React state and dies with the
reload. The envelope is kept, carrying `saveFailed` and `failedFiles`, so the next
load can say so.

The first guard is what keeps the empty initial state out of storage. Until the
fetch resolves, `savedSnapshot` is null and `portfolio` is the blank object with
three empty arrays — precisely the value `CLAUDE.md` warns must never reach the
bucket. It must never be persisted either, or a restore would feed it back in.

StrictMode double-invocation is harmless here: both passes compute the same
envelope from the same state, and only `savedAt` differs, by a millisecond nothing
reads.

**No debounce.** `portfolio` changes only on discrete events — a dialog's Save, a
delete, a reorder, an upload. Every text field lives in a dialog's own local state
and never reaches this per keystroke.

If a write throws — private window, filled quota — the editor carries on and shows
a notice saying the local backup is unavailable. Failing silently would leave the
author believing they are protected when they are not. The notice is raised once
and stays; repeated failures do not stack.

### The save-time conflict check

**This is the safeguard. The load-time dialog is an early notice.**

`draftBase` compares against a fetch taken at page load, so it is structurally
blind to the window that actually loses data: R2 changing between that load and
the save. The two-device timeline — laptop tab open, an edit made from a phone,
back to the laptop an hour later — is ordinary, and nothing in the load-time
design sees it.

So `savePortfolio` re-fetches the four objects before writing and compares them
against **`draftBase`** — not `savedSnapshot`. Comparing against `draftBase` is
what makes one check cover both windows: in the ordinary case the two are equal,
and in the restored-stale-draft case `draftBase` is the older fork point that
`savedSnapshot` has already moved past.

If any object differs, the save aborts before the first PUT and reports which
files, offering the same per-file resolution as `StaleDraftDialog`. Nothing is
written.

The re-fetch reuses `fetchFromR2` / `fetchFromR2OrDefault` and inherits their
behaviour, including the narrow 404 fallback for `projects.json`. **A re-fetch that
fails aborts the save**, on the same reasoning that keeps that fallback narrow: a
read that did not succeed is not evidence that writing is safe.

Save is not additionally disabled while `isStale`. The check is the gate, and it
runs against fresh data rather than a possibly hours-old page load.

### Save feedback

A fully successful save advances **both** `savedSnapshot` and `draftBase` to the
saved `portfolio`, and snapshots the ids. That is the fourth and last assignment
of `draftBase`, and it is what resolves a stale divergence: the draft has been
published, so the two agree again.

Success sets a toast that clears itself after four seconds. Failure sets:

```ts
const [saveError, setSaveError] = useState<{ kind: 'partial' | 'total' | 'conflict'; failed: string[] } | null>(null);
```

rendered as a banner naming the files, with Retry, dismissed only by the author or
by a later successful save.

`saveFailed` stays a separate boolean and keeps feeding `isDirty`. Dismissing the
banner must not clear it: the banner is a message, `saveFailed` is the fact that
R2 is mixed, and the editor has to keep saying so.

**`hasDraft`, not `isDirty`, gates the count and the Discard button.** They differ
in exactly one state — a partial failure with nothing pending — and that is the
state where `isDirty` would enable a Discard button that confirms and then does
nothing, and render a count of zero.

### Discard button

Header, beside Save, disabled unless `hasDraft`. Confirms, listing the changes,
then sets **both** `portfolio` and `draftBase` to `savedSnapshot`. Resetting
`draftBase` here is what stops a discarded divergence from leaving a stale warning
behind with no draft to justify it.

### Header layout

The header row gains the change-count pill and the Discard button. Notices stack
full-width below the header rather than crowding that row, which now has to hold
up to five: restored draft, stale draft, mixed bucket, save failure, storage
unavailable.

## Error handling

| Failure | Behaviour |
|---|---|
| R2 load fails | Unchanged — `loadError`, editor body does not render, save blocked. Stored draft left alone. |
| Stored draft corrupt or wrong version | Dropped. Editor loads from R2 as though there were none. |
| localStorage read throws | Treated as no draft. |
| localStorage write throws | Editor continues; one notice says the backup is unavailable. |
| Save-time re-fetch fails | Save aborts before any PUT. Nothing written. |
| Save-time re-fetch shows a conflict | Save aborts; per-file resolution offered. |
| Save partially fails | Banner naming the files, Retry offered, `saveFailed` set, `savedSnapshot` and `draftBase` deliberately not advanced, envelope kept. |
| Save totally fails | Same banner; wording says nothing reached R2. |
| Draft's base disagrees with R2 | Per-file resolution on load; the warning persists across reloads until a save or discard resolves it. |

## Accepted limitations

**Two tabs share one key.** Both write `askhb-admin-draft`, last writer wins, and
neither knows. Accepted for a single-author tool; recorded so the behaviour is a
decision rather than a surprise.

**Refresh stops being the escape hatch.** Today, a catastrophic accidental edit is
undone by refusing to save and reloading. After this change that edit is
transported across the reload instead. This is the intended trade — it is the same
mechanism that protects a day's work — and Discard is the mitigation, but it
inverts a property the author currently relies on.

## Out of scope

No change to the write path itself — still four independent PUTs, still no
transaction, still no rollback, because the worker offers neither DELETE nor a
batch endpoint. Making the save atomic is a worker change and separate work. The
admin chrome still has no dark mode. `EditorDialog` gains no focus trap or Escape
handler here.

## Verification

No test framework is configured and none is being added, per `CLAUDE.md`.

- `npm run build` — type-checks under `strict` plus the unused-symbol flags
- `npm run lint` — note `react-hooks/exhaustive-deps` on the write effect
- Manual walkthrough in `npm run dev`:
  1. Delete a card of each kind; cancel once, confirm once. Focus lands somewhere
     sensible after the card disappears
  2. Remove a role; cancel and confirm
  3. Replace a profile photo, a CV and a logo under the same filename — each
     confirms and says what is about to be overwritten. Upload a logo under a
     *different* filename — no prompt
  4. Clear an image link and a CV link — no prompt
  5. Open each of the four dialogs, edit, close — the styled discard prompt
     appears; close an untouched dialog and it does not
  6. Edit, refresh, confirm the draft returns with its age and the change count
  7. Rename an entry — the count says one edit, not a delete plus an add
  8. Add two blank entries — the count distinguishes them
  9. Reorder a section and drop an entry back where it started — only the first
     counts as a change
  10. Edit, refresh, Discard — the editor returns to R2 content and a second
      refresh restores nothing
  11. Edit in one browser and save; reload another holding a stale draft — only
      genuinely conflicting files are questioned, and untouched ones take the
      bucket's version silently
  12. **From that state choose Keep, then reload again without saving — the
      warning must still be there.** Regression test for the rebasing bug
  13. Load the editor, change a file from another browser, then save — the
      save-time check aborts before writing and names the file
  14. Save successfully — toast appears and fades; **a refresh restores nothing**,
      which is the regression test for the write effect's dependency list
  15. Simulate a partial failure, then Discard, then reload — the mixed-bucket
      warning is still there
  16. Escape and backdrop clicks cancel a confirm; tab order stays inside it
