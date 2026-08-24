# Friendly confirmations and save feedback

Date: 2026-08-24

First of two pieces. The second, `2026-08-24-local-drafts-design.md`, adds
localStorage draft persistence and depends on the `ConfirmDialog` built here.
This document stands alone and ships on its own.

## Problem

1. **Deletes do not ask.** The trash button on an organisation, project or
   education card removes the entry on the first click, and there is no undo
   anywhere in the app.
2. **The prompts that do exist are browser-native.** The four discard-changes
   prompts are `window.confirm` and the three save outcomes are `alert`. They are
   unstyleable, sit outside the app's visual language, and on the save path block
   the page to say something that does not need blocking.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Delete interaction | Confirm dialog | Predictable, one component covers every site. An undo toast was rejected: missing it means reloading, which costs every other unsaved edit. |
| What gets confirmed | Anything that destroys something you cannot reconstruct | A flat "confirm every destructive-looking control" inverts the coverage — it prompts on clearing a link, which destroys nothing, and stays silent on replacing a photo, which is permanent. |
| Save results | Toast on success, persistent banner on failure | Nothing important auto-disappears; nothing trivial blocks. |

## Why a failed save still needs a banner

`savePortfolio` fires four independent PUTs with no transaction, so a partial
failure leaves askhb.no serving inconsistent content — a new role in the
experience list under the old name in the header. Nothing can un-publish the half
that landed. That message has to survive until it is dealt with, which is why
failure is a banner and success is a toast.

## Architecture

### New modules

| File | Purpose |
|---|---|
| `src/components/ConfirmDialog.tsx` | Presentational modal. Owns no state. |
| `src/components/ConfirmProvider.tsx` | Holds the pending request, renders the one dialog, provides the context. |
| `src/func/confirmContext.ts` | `createContext` and the `useConfirm` hook. |
| `src/components/Toast.tsx` | The transient success message. |
| `src/components/Notice.tsx` | One header strip: tone, message, optional action, optional dismiss. |

`confirmContext.ts` is split from the provider because the lint rule that keeps
fast refresh working objects to a module exporting both a component and a
non-component.

`ConfirmProvider` is mounted in `App.tsx`, wrapping `PortfolioEditor`. That is the
whole change to that file — it keeps its body-class effect and stays the
router-less single-child component it is.

### The confirm mechanism

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

Because this replaces `window.confirm`, it has to re-earn what that gave for
free: Escape and a backdrop click cancel, `role="alertdialog"` with the title
wired through `aria-labelledby`, focus moved in on open and trapped while open,
Cancel focused by default so a stray Return never deletes, and focus returned to
the trigger on close.

**Focus restoration needs a fallback.** Confirming a card delete unmounts the very
button that opened the dialog; focusing a detached node is a no-op and focus falls
to `body`, restarting keyboard navigation at the top of the document — a
regression against `window.confirm`. On close, check `document.contains(trigger)`
and fall back to that section's "Add …" button when it is gone.

**The dialog is portalled to `document.body` with an explicit stacking level.**
`EditorDialog` is fixed to the viewport and creates its own stacking context, so a
confirm rendered as a sibling subtree would sit above it only by accident of tree
shape. A portal makes it a guarantee.

`EditorDialog` itself has no focus trap and no Escape handler today. That is left
as-is, but it means Escape closes a confirm and does nothing to the editor dialog
behind it. Worth revisiting separately; not part of this work.

Only one request is held at a time. **A second request arriving while one is
pending throws in development and resolves to `cancel` in production.** Silently
resolving `false` would be worse than it looks: `false` is the destructive answer
for any request whose safe choice is the confirming one, and it would hide a
genuine caller bug behind a plausible-looking outcome. The next piece of work adds
a caller where that distinction bites.

### What gets confirmed, and why

The rule is **confirm anything that destroys something you cannot reconstruct**,
not "confirm anything with a trash icon" — where "reconstruct" has to mean
*reachable from inside the editor*, not merely possible in principle. Clearing
the CV link destroys nothing in the bucket, but nothing in this piece can put it
back, and that is what decides it.

**Confirmed — the content is gone and you would have to retype it:**

| Site | Note |
|---|---|
| Organisation / project / education card delete | Names the entry; for an organisation, its role count |
| Role removal in `OrganisationDialog` | A role is title, dates, description and skills |
| The four discard-changes prompts | Unchanged wording; `PersonalInfoDialog` keeps its photo-replaced variant verbatim |
| `CvSection` remove | Destroys nothing — the PDF stays in the bucket — but there is nowhere to undo it. It is the only remove that sits on the page rather than inside a dialog, so no Cancel backs it out, and the Discard button that would is in the second piece. Restoring the link means having the file again |

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
| `EducationDialog.removeDescription`, `RoleEditor.removeSkill`, `ProjectDialog.removeSkill`, `LinksEditor` remove-link | Dialog-local, one field, undone by Cancel and trivially retyped |
| `ScreenshotCapture` re-capture | Overwrites the previous capture at the same key, but a capture is *regenerated from the live site* — the thing it destroys can be remade by pressing the button again, which is exactly what "reconstruct" means. Contrast the upload replaces above, where the file on disk may be the only copy |
| `ScreenshotCapture` remove-dark | Clears the stored dark url; the object stays in the bucket |

The capture and the upload field write to the same prefix, so a hand-uploaded
file named like a capture would collide with one. That case is already covered:
`ImageUploadField`'s prompt fires on a computed-key match, whatever produced the
object currently at that key.

This replaces an earlier "one rule, no exceptions" framing. That rule was not
actually kept — it confirmed the harmless removes while leaving the destructive
replaces silent, and it had no answer for the four dialog-local removes above.

Copy is honest about scope. Deleting a card edits the draft and nothing else, so
it says so rather than borrowing a scarier phrase it has not earned:

> **Delete "Computas"?**
> This removes the organisation and its 2 roles from the draft. Nothing changes
> on askhb.no until you save.

The replace prompts say the opposite, because for them it is true:

> **Replace the profile photo?**
> The new file overwrites the old one in the bucket immediately. There is no
> version to restore — this cannot be undone, saved or not.

### Save feedback

Success sets a toast that clears itself after four seconds. Failure sets:

```ts
const [saveError, setSaveError] = useState<{ kind: 'partial' | 'total'; failed: string[] } | null>(null);
```

rendered as a `Notice` banner naming the files, with a Retry action, dismissed
only by the author or by a later successful save.

`saveFailed` stays exactly as it is and keeps feeding `isDirty`. **Dismissing the
banner must not clear it**: the banner is a message, `saveFailed` is the fact that
R2 is mixed, and the editor has to keep saying so even when no edit is
outstanding.

The partial-failure copy names the files and says what it means for the site:

> ⚠ Saved 2 of 4 files. `experiences.json` and `education.json` failed —
> askhb.no is serving a mix of old and new until you save again.

### Palette

The three new components paint in the shared theme tokens the rest of the chrome
moved onto — paper, ink, ink-muted, rule — rather than in Tailwind's greys.
Semantic colour stays Tailwind: red for destructive, amber for the migration
warning, matching the red the entry cards already use on a delete hover. Brand
palette and semantic palette are separate things, and only the first belongs in
the submodule.

### Header layout

Notices stack full-width directly below the header rather than crowding the
header row.

## Out of scope

No change to the write path — still four independent PUTs, still no transaction,
still no rollback, because the worker offers neither DELETE nor a batch endpoint.
No draft persistence, no Discard button, no change counting: those are the second
document. The admin chrome still has no dark mode, and `EditorDialog` gains no
focus trap or Escape handler here.

## Verification

No test framework is configured and none is being added, per `CLAUDE.md`.

- `npm run build` — type-checks under `strict` plus the unused-symbol flags
- `npm run lint`
- Manual walkthrough in `npm run dev`:
  1. Delete a card of each kind; cancel once, confirm once. Focus lands somewhere
     sensible after the card disappears rather than falling to the top of the page
  2. Remove a role; cancel and confirm
  3. Replace a profile photo, a CV, and a logo re-uploaded under the same
     filename — each confirms and says what is about to be overwritten
  4. Upload a logo under a *different* filename — no prompt, because nothing is
     overwritten
  5. Clear an image link — no prompt, because dialog Cancel undoes it. Remove the CV — this one *does* prompt, and says the PDF stays reachable
  6. Remove a skill chip, a description line and a link — no prompt
  7. Open each of the four dialogs, edit, close — the styled discard prompt
     appears; close an untouched dialog and it does not
  8. Replace the profile photo, then close the dialog — the photo-replaced
     wording appears, unchanged from today
  9. Save with a migration pending — the migration confirm appears and names what
     will be rewritten
  10. Save successfully — the toast appears and fades
  11. Save offline — the banner appears, names the files, and stays until
      dismissed. Dismissing it leaves "Unsaved changes" showing, because R2 is
      still mixed
  12. Escape and a backdrop click cancel a confirm; tab order stays inside it;
      the confirm renders above an open editor dialog
