# Friendly confirmations, save feedback, and local draft persistence

Date: 2026-08-24

## Problem

Three separate rough edges in the editor, which turn out to share a solution.

1. **Deletes do not ask.** The trash button on an organisation, project or
   education card removes the entry on the first click. So does removing a role
   inside the organisation dialog, and clearing a CV link, a logo or a
   screenshot. There is no undo anywhere in the app.
2. **The prompts that do exist are browser-native.** The four discard-changes
   prompts are `window.confirm` and the three save outcomes are `alert`. They
   are unstyleable, they sit outside the app's visual language, and on the save
   path they block the page to say something that does not need blocking.
3. **An unsaved draft does not survive a refresh.** Close the tab, reload, or
   lose the connection mid-save and every edit since the last successful save is
   gone. R2 keeps no versions, so there is nothing to recover from.

## What local persistence does and does not fix

Persisting the draft removes the data-loss dimension of a failed save, but not
the whole failure. `savePortfolio` fires four independent PUTs with no
transaction:

- **Total failure** — nothing landed in R2, the draft survives a refresh, retry
  later. Genuinely solved.
- **Partial failure** — some files landed and some did not, so askhb.no is
  serving inconsistent content: a new role in the experience list under the old
  name in the header. The draft is safe and a retry pushes the rest, but nothing
  can un-publish the half that landed.

So persistence changes what the failure message *says* rather than removing the
need for one. It stops being "you may have lost work" and becomes "the site is
inconsistent until you save again". That message still has to be impossible to
miss, which is why it is a banner rather than a toast.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Delete interaction | Confirm dialog | Predictable, matches the discard prompts, one component covers every site. An undo toast was considered and rejected: missing it means reloading, which costs every other unsaved edit. |
| Stale restored draft | Store the forked-from state alongside the draft, and never rebase it | The only version that can actually detect that R2 moved. A timestamp alone relies on the author remembering, and a rebased base warns once and then goes quiet. |
| Save results | Toast on success, persistent banner on failure | Nothing important auto-disappears; nothing trivial blocks. |
| Image remove button | Confirms, like everything else | Chosen over an exemption: one rule with no exceptions to remember beats a marginally lighter interaction. |
| `beforeunload` warning | Keep | Weaker now, but unsaved still means askhb.no is showing the old content. |

## Architecture

### New modules

| File | Purpose |
|---|---|
| `src/components/ConfirmDialog.tsx` | Presentational modal. Owns no state. |
| `src/components/ConfirmProvider.tsx` | Holds the pending request, renders the one dialog, provides the context. |
| `src/func/confirmContext.ts` | `createContext` and the `useConfirm` hook. |
| `src/components/Toast.tsx` | The transient success message. |
| `src/components/Notice.tsx` | One header strip: tone, message, optional action, optional dismiss. |
| `src/func/draftStorage.ts` | Read, write and clear the persisted draft. Every access guarded. |

`confirmContext.ts` is split from the provider because the lint rule that keeps
fast refresh working objects to a module exporting both a component and a
non-component. The same split is why the hook does not live beside the dialog.

`ConfirmProvider` is mounted in `App.tsx`, wrapping `PortfolioEditor`. That is
the whole change to that file; it keeps its body-class effect and stays the
router-less single-child component it is today.

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
    // What Escape, a backdrop click and the initial focus all resolve to.
    // Default 'cancel'; 'confirm' when confirming is the safe choice.
    defaultAction?: 'cancel' | 'confirm';
};
```

The four existing discard handlers keep their shape exactly — `if (!(await
confirm({...}))) return;` — so each is a one-line change rather than a
restructure.

`defaultAction` exists for one case, the stale-draft prompt below, where the
*confirming* button is the safe one. Everywhere else the default applies and a
stray keypress cannot delete anything.

Because this replaces `window.confirm`, it has to re-earn what that provided for
free:

- Escape and a backdrop click resolve to `defaultAction`
- `role="alertdialog"` with the title wired through `aria-labelledby`
- Focus moves into the dialog on open and returns to the trigger on close
- Focus is trapped while open
- The `defaultAction` button takes initial focus

It renders above the editor dialogs' stacking layer. Only one request is held at
a time; a second request arriving while one is pending resolves immediately to
false, which cannot happen through the UI but keeps the provider total.

### Draft persistence

One key — `askhb-admin-draft` — holding a versioned envelope:

```ts
type StoredDraft = {
    version: number;
    savedAt: number;         // Date.now() at the time of the write
    base: PortfolioData;     // what R2 held when this draft forked
    draft: PortfolioData;
};
```

`base` is what makes the stale check possible, and it is the reason the envelope
is roughly twice the size of the draft alone. Both halves are text — logos and
screenshots are URLs, not blobs — so the whole thing is well under any quota.

#### `base` is sticky, and that is the whole point

There are two different "what R2 holds" values here and collapsing them into one
is a data-loss bug, so the editor keeps both:

- **`savedSnapshot`** — what R2 is believed to hold *now*, set by a successful
  load and by a fully successful save. This is what `isDirty` compares against,
  exactly as today.
- **`draftBase`** — what R2 held when the *current draft* forked. New state.
  This is what gets persisted as `base`, and it is **not** rebased when a draft
  is restored.

They are equal in the ordinary case and diverge only when a draft outlives a
change to the bucket. Writing `base: savedSnapshot` instead — the obvious
one-variable version — makes the staleness warning erase its own evidence the
first time it fires:

1. R2 holds **A**. Edits make draft **D**. Stored: `base: A, draft: D`.
2. R2 becomes **B**, edited from another browser.
3. Next load: `loaded` is **B**, stored `base` is **A**, so the warning fires.
   The author picks *Keep my draft*.
4. The write effect runs and, with a single variable, rewrites storage as
   `base: B, draft: D`.
5. The tab closes without saving.
6. **The next load compares B against B and says nothing** — while `D` is still
   forked from A and still overwrites B on the next save.

Keeping `draftBase` unrebased makes step 4 a no-op, so the warning survives
every reload until it is genuinely resolved. `draftBase` is assigned in exactly
four places and nowhere else: both branches of the load, a fully successful
save, and Discard. Nothing else may touch it, and in particular the write effect
only reads it.

That also means the warning does not need an acknowledgement flag to remember
that *Keep* was chosen. It is derived, not remembered:

```ts
const hasDraft  = savedSnapshot !== null && !deepEqual(portfolio, savedSnapshot);
const isStale   = hasDraft && !deepEqual(draftBase, savedSnapshot);
```

Gating on `hasDraft` covers the case where the author edits back to what the
bucket holds: there is then nothing pending to overwrite, so a warning would be
a lie even though `draftBase` still disagrees.

`version` guards the shape. A mismatch discards the blob rather than migrating
it, which is also what guarantees a restored draft never re-enters the load-time
migration path: it is already grouped and already normalised, and `CLAUDE.md` is
explicit that `groupExperiences` must not run twice.

`readDraft` validates before returning. Not deep validation — the same level of
rigour as `isOrganisationArray`, which tests only the first element:

- the envelope parses and its version matches
- `base` and `draft` each have a `personalInfo` object and three arrays
- a non-empty `experiences` satisfies `isOrganisationArray`

Anything else returns null and the blob is dropped. The editor has no error
boundary, so a corrupt blob reaching render would blank the page.

### Load

**The existing load is unchanged.** It still fetches, still runs the migration,
still sets `savedSnapshot` from the fetch, and `savePortfolio` still refuses to
run while `isLoading || loadError`. All three guards `CLAUDE.md` calls
load-bearing survive untouched. The restore adds to the load rather than
changing it: it replaces `portfolio` and sets `draftBase`, and touches nothing
else.

1. Fetch and normalise as today into `loaded`. `savedSnapshot = loaded`.
2. No valid stored draft, or its `draft` equals `loaded` — set `portfolio` and
   `draftBase` to `loaded` and clear storage. Identical to today's behaviour.
3. `draft` differs from `loaded` — restore it: `portfolio = draft`, and
   **`draftBase = the stored base`, not `loaded`**. Then:
   - stored `base` equals `loaded` — the ordinary case. Show a notice giving the
     draft's age, with a Discard action.
   - stored `base` differs from `loaded` — **R2 moved under the draft.** Raise a
     modal naming which of the four files changed. Keeping is the safe action
     and takes focus, so Escape keeps. Discarding sets both `portfolio` and
     `draftBase` to `loaded`. Dismissing without choosing keeps the draft, and
     the derived `isStale` above then holds a persistent warning in the header
     for as long as the divergence lasts — across reloads, not just this one.
4. **The fetch failed — do not touch storage.** The draft waits for a load that
   works. Clearing it here would destroy the work a transient outage was
   supposed to protect.

The stale branch also fires after a partial save failure, and correctly so. A
partial failure deliberately leaves `savedSnapshot` and `draftBase` alone,
because what R2 holds is no longer known — so the next load sees a `base` that
disagrees with the bucket and says so. That is the truth, and it falls out of
the rule rather than needing a case of its own.

### Write

One effect on `portfolio`:

- `savedSnapshot` is null (the load has not resolved) — do nothing
- `portfolio` equals `savedSnapshot` — clear storage
- otherwise — write `{ version, savedAt: Date.now(), base: draftBase, draft: portfolio }`

That single rule gives draft-clearing on a successful save and on Discard for
free, because both work by making `portfolio` and `savedSnapshot` agree. No
other call site touches storage.

The effect **reads** `draftBase` and never assigns it. Assigning from in here
would reintroduce the rebasing bug by the back door, and it would also make the
effect depend on state it writes.

The first guard is what keeps the empty initial state out of storage. Until the
fetch resolves, `savedSnapshot` is null and `portfolio` is the blank object with
its three empty arrays — precisely the value `CLAUDE.md` warns must never be
written over the bucket. It must never be persisted as a draft either, because a
restore would feed it straight back in.

StrictMode double-invokes effects, which is harmless here: both passes compute
the same envelope from the same state and the second write overwrites the first
with identical bytes. `savedAt` differs by a millisecond or two between them,
which nothing reads for anything finer than a displayed timestamp.

**No debounce.** `portfolio` changes only on discrete events — a dialog's Save,
a delete, a reorder, a CV or photo upload. Every text field lives in a dialog's
own local draft and never reaches this state per keystroke, so there is nothing
to coalesce.

If a write throws — a private window, a filled quota — the editor carries on and
shows a quiet notice saying the local backup is unavailable. Failing silently
would leave the author believing they are protected when they are not.

### Save feedback

A fully successful save advances **both** `savedSnapshot` and `draftBase` to the
saved `portfolio`. That is the fourth and last assignment of `draftBase`, and it
is what resolves a stale divergence: the draft has now been published, so what
R2 holds and what the draft forked from are the same object again.

Success sets a toast that clears itself after four seconds. Failure sets:

```ts
const [saveError, setSaveError] = useState<{ kind: 'partial' | 'total'; failed: string[] } | null>(null);
```

rendered as a banner naming the files, with a Retry action, dismissed only by
the author or by a later successful save.

`saveFailed` stays as a separate boolean and keeps feeding `isDirty`. Dismissing
the banner must not clear it: the banner is a message, `saveFailed` is the fact
that R2 is mixed, and the editor has to keep saying so even when no edit is
outstanding.

### Discard button

Header, beside Save, disabled unless dirty. Confirms, then sets **both**
`portfolio` and `draftBase` to `savedSnapshot` — back to what R2 held at page
load, with the fork point reset to match. The write effect clears storage on its
own. Resetting `draftBase` here is what stops a discarded divergence from
leaving a stale warning behind with no draft to justify it.

### Header layout

The header row gains the Discard button. Notices stack full-width directly below
the header rather than crowding into that row, which now has to hold up to four
of them: restored draft, stale draft, save failure, storage unavailable.

## Call sites

Getting a confirmation they do not have today:

| Site | Copy |
|---|---|
| `PortfolioEditor` organisation delete | Names the organisation and its role count |
| `PortfolioEditor` project delete | Names the project |
| `PortfolioEditor` education delete | Names the degree |
| `OrganisationDialog` role removal | Names the role; says cancelling the dialog would undo it too |
| `CvSection` remove | Says the portfolio hides its download button, and that the PDF stays in the bucket and stays reachable — the worker supports no delete |
| `ImageUploadField` remove | Says the file stays in the bucket |

Copy is honest about scope. Deleting a card edits the draft and nothing else, so
it says so:

> **Delete "Computas"?**
> This removes the organisation and its 2 roles from the draft. Nothing changes
> on askhb.no until you save.

Converted from `window.confirm`, wording unchanged: the four discard prompts in
`ProjectDialog`, `EducationDialog`, `OrganisationDialog` and
`PersonalInfoDialog`. `PersonalInfoDialog`'s photo-replaced variant is carried
over verbatim — it explains that the replacement is already in the bucket and
that discarding cannot bring the old photo back, which is still true and is the
kind of wording `CLAUDE.md` asks to keep honest.

Converted from `alert`: the three save outcomes in `PortfolioEditor`.

## Error handling

| Failure | Behaviour |
|---|---|
| R2 load fails | Unchanged — `loadError`, editor body does not render, save blocked. Stored draft left alone. |
| Stored draft corrupt or wrong version | Dropped. Editor loads from R2 as though there were none. |
| localStorage read throws | Treated as no draft. |
| localStorage write throws | Editor continues; one notice says the backup is unavailable. |
| Save partially fails | Banner naming the files, Retry offered, `saveFailed` set, `savedSnapshot` deliberately not advanced. |
| Save totally fails | Same banner, wording says nothing reached R2. |
| Draft's base disagrees with R2 | Modal on load; keeping is the default. The warning then persists across reloads until a save or a discard resolves it, because `draftBase` is never rebased. |

## Out of scope

No change to the write path itself — still four independent PUTs, still no
transaction, still no rollback, because the worker offers neither DELETE nor a
batch endpoint. Making the save atomic is a worker change and a separate piece
of work. The admin chrome still has no dark mode.

## Verification

No test framework is configured and none is being added, per `CLAUDE.md`.

- `npm run build` — type-checks under `strict` plus the unused-symbol flags
- `npm run lint`
- Manual walkthrough in `npm run dev`:
  1. Delete a card of each kind; cancel once, confirm once
  2. Remove a role, a CV link and a logo; cancel and confirm each
  3. Open each of the four dialogs, edit, close — the styled discard prompt
     appears; close an untouched dialog and it does not
  4. Replace the profile photo, then close — the photo-replaced wording appears
  5. Edit, refresh, confirm the draft returns with the restored notice
  6. Edit, refresh, Discard — the editor returns to R2 content and a second
     refresh restores nothing
  7. Edit in one browser and save; edit in another that has a stale draft and
     reload — the stale-draft modal names the changed files
  8. **From that state, choose Keep, then reload again without saving — the
     warning must still be there.** This is the regression test for the
     rebasing bug; a single-variable implementation goes quiet on this reload
  9. Save successfully — toast appears and fades; a refresh restores nothing
  10. Save offline — banner appears and stays; the draft survives a refresh
  11. Escape and backdrop clicks cancel a confirm; tab order stays inside it;
      focus returns to the trigger
